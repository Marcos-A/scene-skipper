const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8');

function button(overrides = {}) {
  return {
    clicks: 0, disabled: false, isConnected: true,
    visible: true, hiddenParent: false, ariaDisabled: false,
    matches: () => true,
    getAttribute(name) { return name === 'aria-disabled' && this.ariaDisabled ? 'true' : null; },
    getClientRects() { return this.visible ? [{}] : []; },
    closest() { return this.hiddenParent ? {} : null; },
    click() { this.clicks++; },
    ...overrides,
  };
}

async function player(settings = {}, pathname = '/watch/12345', namespace = 'chrome') {
  const state = { intro: [], recap: [], video: null, changed: null, mutation: null, interval: null, frames: [], timers: [], disconnected: false };
  const location = { pathname };
  const context = vm.createContext({
    location,
    document: {
      documentElement: {},
      querySelector: () => state.video,
      querySelectorAll: selector => selector === '[data-uia="player-skip-intro"]' ? state.intro
        : selector === '[data-uia="player-skip-recap"]' ? state.recap : [],
    },
    [namespace]: { storage: {
      local: { get: async defaults => ({ ...defaults, ...settings }) },
      onChanged: { addListener(fn) { state.changed = fn; }, removeListener() { state.changed = null; } },
    } },
    MutationObserver: class {
      constructor(fn) { state.mutation = fn; }
      observe() {}
      disconnect() { state.disconnected = true; }
    },
    getComputedStyle: el => ({ visibility: el.visibility ?? 'visible', display: 'block' }),
    requestAnimationFrame: fn => state.frames.push(fn),
    setInterval(fn) { state.interval = fn; return 1; },
    clearInterval() { state.interval = null; },
    setTimeout: fn => state.timers.push(fn),
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  state.flush = () => { while (state.frames.length) state.frames.shift()(); };
  state.scan = () => { state.mutation(); state.flush(); };
  state.change = values => {
    state.changed(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { newValue: value }])), 'local');
    state.flush();
  };
  state.location = location;
  return state;
}

test('clicks intro and recap buttons inserted after initialization', async () => {
  const p = await player();
  p.flush();
  const intro = button(), recap = button();
  p.intro = [intro]; p.scan();
  p.intro = []; p.recap = [recap]; p.scan();
  assert.equal(intro.clicks, 1);
  assert.equal(recap.clicks, 1);
});

test('saved disabled state prevents clicks; enabling applies without reloading', async () => {
  const p = await player({ enabled: false });
  const intro = button(); p.intro = [intro]; p.flush();
  assert.equal(intro.clicks, 0);
  p.change({ enabled: true });
  assert.equal(intro.clicks, 1);
  p.change({ enabled: false });
  p.intro = [button()]; p.scan();
  assert.equal(p.intro[0].clicks, 0);
});

test('intro and recap preferences work independently', async () => {
  const p = await player({ skipIntros: false });
  const intro = button(), recap = button();
  p.intro = [intro]; p.recap = [recap]; p.flush();
  assert.equal(intro.clicks, 0); assert.equal(recap.clicks, 1);
  p.change({ skipIntros: true, skipRecaps: false });
  assert.equal(intro.clicks, 1);
  p.recap = [button()]; p.scan();
  assert.equal(p.recap[0].clicks, 0);
});

test('ignores hidden and disabled controls, then clicks when actionable', async () => {
  for (const condition of [{ visible: false }, { disabled: true }, { ariaDisabled: true }, { hiddenParent: true }, { visibility: 'hidden' }]) {
    const p = await player();
    const intro = button(condition); p.intro = [intro]; p.flush();
    assert.equal(intro.clicks, 0);
    Object.assign(intro, { visible: true, disabled: false, ariaDisabled: false, hiddenParent: false, visibility: 'visible' });
    p.scan(); assert.equal(intro.clicks, 1);
  }
});

test('does not repeatedly click the same persistent control during DOM changes', async () => {
  const p = await player(); const intro = button(); p.intro = [intro]; p.flush();
  for (let i = 0; i < 10; i++) p.scan();
  assert.equal(intro.clicks, 1);
});

test('a hidden control can reappear for another segment', async () => {
  const p = await player(); const intro = button(); p.intro = [intro]; p.flush();
  intro.visible = false; p.scan(); intro.visible = true; p.scan();
  assert.equal(intro.clicks, 2);
});

test('supports a button nested inside the Netflix skip marker', async () => {
  const p = await player(); const intro = button();
  p.intro = [{ matches: () => false, querySelector: () => intro }]; p.flush();
  assert.equal(intro.clicks, 1);
});

test('starts on the browse page and handles SPA navigation and episode changes', async () => {
  const p = await player({}, '/browse'); const intro = button(); p.intro = [intro]; p.flush();
  assert.equal(intro.clicks, 0);
  p.location.pathname = '/watch/12345'; p.interval(); p.flush();
  assert.equal(intro.clicks, 1);
  p.location.pathname = '/watch/67890'; p.interval(); p.flush();
  assert.equal(intro.clicks, 2);
});

test('re-arms a reused control after playback advances', async () => {
  const p = await player(); const intro = button();
  p.video = { currentTime: 1 }; p.intro = [intro]; p.flush();
  p.video.currentTime = 90; p.timers.shift()(); p.scan();
  assert.equal(intro.clicks, 2);
});

test('manifest limits access to Netflix and all declared assets exist', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.netflix.com/*']);
  for (const file of [manifest.action.default_popup, ...manifest.content_scripts[0].js, ...Object.values(manifest.icons)]) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
  }
});

for (const namespace of ['chrome', 'browser']) {
  test(`${namespace}: content script loads settings and responds to changes`, async () => {
    const p = await player({ enabled: false }, '/watch/12345', namespace);
    const intro = button(); p.intro = [intro]; p.flush();
    assert.equal(intro.clicks, 0);
    p.change({ enabled: true });
    assert.equal(intro.clicks, 1);
  });
}
