const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../popup.js'), 'utf8');

for (const namespace of ['chrome', 'browser']) {
  test(`${namespace}: popup loads saved preferences and persists toggles`, async () => {
    const elements = Object.fromEntries(['enabled', 'skipIntros', 'skipRecaps', 'skip-options', 'status'].map(id => [id, {
      checked: false, disabled: true,
      addEventListener(event, listener) { this.change = listener; },
    }]));
    const saved = { enabled: true, skipIntros: false, skipRecaps: true };
    vm.runInNewContext(source, {
      document: { getElementById: id => elements[id] },
      [namespace]: { storage: { local: {
        get: async () => saved,
        set: async values => Object.assign(saved, values),
      } } },
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements.enabled.disabled, false);
    assert.equal(elements.skipIntros.checked, false);
    assert.equal(elements.skipRecaps.checked, true);
    elements.enabled.checked = false;
    await elements.enabled.change();
    assert.equal(saved.enabled, false);
    assert.equal(elements['skip-options'].disabled, true);
    assert.match(elements.status.textContent, /Paused/);
    elements.enabled.checked = true;
    await elements.enabled.change();
    elements.skipIntros.checked = true;
    await elements.skipIntros.change();
    assert.equal(saved.skipIntros, true);
    assert.equal(elements['skip-options'].disabled, false);
  });
}
