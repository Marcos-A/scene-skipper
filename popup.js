"use strict";

const extensionApi = globalThis.browser ?? globalThis.chrome;
const defaults = { enabled: true, skipIntros: true, skipRecaps: true };
const controls = Object.fromEntries(Object.keys(defaults).map(key => [key, document.getElementById(key)]));
const options = document.getElementById("skip-options");
const status = document.getElementById("status");

function renderStatus() {
  options.disabled = !controls.enabled.checked;
  status.textContent = !controls.enabled.checked ? "Paused. Use Netflix’s skip buttons manually."
    : !controls.skipIntros.checked && !controls.skipRecaps.checked ? "Choose intros or recaps to start skipping."
    : "Ready. Skips automatically while you watch.";
}

async function initialize() {
  try {
    const settings = await extensionApi.storage.local.get(defaults);
    for (const [key, control] of Object.entries(controls)) {
      control.checked = settings[key];
      control.addEventListener("change", async () => {
        try {
          await extensionApi.storage.local.set({ [key]: control.checked });
          renderStatus();
        } catch {
          control.checked = !control.checked;
          renderStatus();
          status.textContent = "Couldn’t save. Please try again.";
        }
      });
    }
    controls.enabled.disabled = false;
    renderStatus();
  } catch {
    status.textContent = "Couldn’t load settings. Reopen this popup to retry.";
  }
}

initialize();
