(() => {
  "use strict";

  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const defaults = { enabled: true, skipIntros: true, skipRecaps: true };
  const selectors = {
    skipIntros: '[data-uia="player-skip-intro"]',
    skipRecaps: '[data-uia="player-skip-recap"]',
  };
  let settings = { ...defaults, enabled: false };
  let scheduled = false;
  let stopped = false;
  let lastPath = location.pathname;
  let clicked = new WeakSet();

  function scan() {
    scheduled = false;
    if (stopped || !settings.enabled || !/^\/watch\/\d+/.test(location.pathname)) return;
    if (lastPath !== location.pathname) {
      lastPath = location.pathname;
      clicked = new WeakSet();
    }

    for (const [setting, selector] of Object.entries(selectors)) {
      if (!settings[setting]) continue;
      for (const marker of document.querySelectorAll(selector)) {
        const button = marker.matches('button, [role="button"]')
          ? marker : marker.querySelector('button, [role="button"]');
        if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") continue;
        const style = getComputedStyle(button);
        if (!button.getClientRects().length || style.visibility !== "visible" ||
            style.display === "none" || button.closest('[hidden], [inert], [aria-hidden="true"]')) {
          clicked.delete(button);
          continue;
        }
        if (clicked.has(button)) continue;
        clicked.add(button);
        button.click();
        // Re-arm when the same player control is reused later in the episode.
        const video = document.querySelector("video");
        const startTime = video?.currentTime;
        setTimeout(() => {
          if (!video || Math.abs(video.currentTime - startTime) > 5 || !button.isConnected) {
            clicked.delete(button);
          }
        }, 5000);
        return;
      }
    }
  }

  function scheduleScan() {
    if (scheduled || stopped) return;
    scheduled = true;
    requestAnimationFrame(scan);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "inert", "disabled", "aria-hidden", "aria-disabled", "data-uia"],
  });
  // Covers SPA navigation and visibility changes caused by CSS rather than DOM edits.
  const interval = setInterval(scheduleScan, 1000);

  function onSettingsChanged(changes, area) {
    if (area !== "local") return;
    for (const key of Object.keys(defaults)) {
      if (Object.hasOwn(changes, key)) settings[key] = changes[key].newValue ?? defaults[key];
    }
    scheduleScan();
  }

  async function initialize() {
    try {
      settings = { ...defaults, ...await extensionApi.storage.local.get(defaults) };
      if (stopped) return;
      extensionApi.storage.onChanged.addListener(onSettingsChanged);
      scheduleScan();
    } catch {
      // A reloaded/removed extension must not keep clicking with stale settings.
      stop();
    }
  }

  function stop() {
    stopped = true;
    observer.disconnect();
    clearInterval(interval);
    extensionApi.storage.onChanged.removeListener(onSettingsChanged);
  }

  initialize();
})();
