<p align="center">
  <img src="icons/128.png" alt="Scene Skipper icon" width="88" height="88">
</p>

<h1 align="center">Scene Skipper</h1>

<p align="center">Automatically skip Netflix intros and recaps in Chromium and Firefox.</p>

<p align="center">
  <a href="#installation">Installation</a> &nbsp;·&nbsp;
  <a href="#usage">Usage</a> &nbsp;·&nbsp;
  <a href="#privacy-and-permissions">Privacy</a> &nbsp;·&nbsp;
  <a href="#development">Development</a>
</p>

---

Straight to the story. Scene Skipper clicks Netflix’s **Skip Intro** and **Skip Recap** buttons when they appear.

## Features

- **Your choice.** Skip intros, recaps, or both; pause anytime from the toolbar.
- **Set it once.** Preferences stay saved locally across browser sessions.
- **Both browsers.** One shared codebase for Chromium and Firefox.
- **Keep it private.** No tracking, external requests, or runtime dependencies.

## Get the source

```sh
git clone https://github.com/Marcos-A/scene-skipper.git
cd scene-skipper
```

## Installation

### Chromium

Works with Chrome, Edge, Brave, and other Chromium browsers. No build step is required.

1. Open your browser’s extension manager, such as `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `scene-skipper` project folder containing `manifest.json`.
4. Refresh any open Netflix tabs and play a show.
5. Pin Scene Skipper to the toolbar for easy access to its controls.

### Firefox

Requires desktop Firefox **142 or newer**. This package targets desktop Firefox; Android support has not been tested.

1. [Download Scene Skipper for Firefox](https://github.com/Marcos-A/scene-skipper/releases/download/v1.0.0/scene-skipper-firefox-1.0.0.xpi). The package is **signed by Mozilla**.
2. Open `about:addons`, click the gear menu, and choose **Install Add-on From File**.
3. Select the downloaded `.xpi` and confirm installation.
4. Allow Netflix site access if prompted, refresh Netflix, and play a show.

The signed extension stays installed after Firefox restarts. Python and a local build are not required. See the [v1.0.0 release notes](https://github.com/Marcos-A/scene-skipper/releases/tag/v1.0.0).

For local development, use [temporary installation](#temporary-firefox-installation). Instructions for preparing future releases are under [Firefox signing](#firefox-signing).

## Usage

Skipping is enabled by default. Click the extension icon to turn automatic skipping on or off, or toggle **Intros** and **Recaps** separately. Changes apply immediately to open Netflix tabs without refreshing.

Preferences apply across Netflix tabs in the same browser profile. Each browser stores its own settings.

## Privacy and permissions

The extension runs only on `https://www.netflix.com/`. It uses the `storage` permission to save your preferences locally. It collects no viewing history or personal data and makes no external network requests.

## How it works

A Manifest V3 content script watches Netflix’s player for visible, enabled controls identified by `player-skip-intro` and `player-skip-recap`. It uses language-independent attributes rather than translated button text. A DOM observer responds to changes, with a one-second fallback for navigation and CSS changes.

Netflix must provide a supported skip button. The extension does not skip credits, select the next episode, dismiss “Are you still watching?”, or change playback timing directly. Changes to Netflix’s player markup may require updating the selectors in `content.js`.

## Development

Both browser versions share the scripts, popup, and icons. The root `manifest.json` is the common manifest; `browsers/firefox.json` adds Firefox-specific metadata. The scripts use Firefox’s `browser` API when available and fall back to Chromium’s `chrome` API.

<details>
<summary>Project structure</summary>

```text
assets/icon-source.png  Full-resolution icon source
browsers/firefox.json   Firefox manifest override
icons/                 Extension icons
scripts/build.py       Browser packaging script
tests/                 Automated checks
content.js             Netflix button detection and clicking
manifest.json          Shared manifest; directly loadable in Chromium
popup.html             Toolbar popup markup
popup.css              Toolbar popup styles
popup.js               Toolbar popup controls
```

</details>

### Build packages

Requires Python **3.9 or newer**. No third-party Python packages are needed.

```sh
python3 scripts/build.py           # Both browsers
python3 scripts/build.py chromium  # Chromium only
python3 scripts/build.py firefox   # Firefox only
```

Builds are written to `dist/chromium/` and `dist/firefox/`, with versioned ZIP packages alongside them. Only runtime assets are included, with `manifest.json` at each archive’s root. The script copies JavaScript, HTML, CSS, and icons unchanged and merges the Firefox-specific settings into the shared manifest. There is no minification, bundling, or transpilation. Generated files are ignored by Git.

Edit the shared source files, then rebuild if testing a generated version. Click **Reload** in your browser’s extension manager or debugging page and refresh Netflix. Chromium installations loaded directly from the project root do not need a rebuild.

For releases, update `version` in the shared manifest. Keep the Firefox add-on ID stable after the first submission so Firefox recognizes subsequent updates.

### Temporary Firefox installation

For testing local changes, build the Firefox package with Python 3.9+:

```sh
python3 scripts/build.py firefox
```

Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and select `dist/firefox/manifest.json`. Allow Netflix site access if prompted, then refresh Netflix.

Temporary add-ons are removed when Firefox restarts. For everyday use, install the [signed release](#firefox). See Mozilla’s [temporary installation guide](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).

### Firefox signing

To install permanently in regular Firefox, submit the package to the [Mozilla Add-ons Developer Hub](https://addons.mozilla.org/developers/). Choose **On your own** for an unlisted add-on, then upload `dist/scene-skipper-firefox-1.0.0.zip`.

When asked whether source code is required, choose **Yes**: the custom packaging script generates the Firefox manifest. Provide a separate source archive containing the build script and this README. From a clean, committed checkout, create both archives with:

```sh
python3 scripts/build.py firefox
git archive --format=zip --output=dist/scene-skipper-source-1.0.0.zip HEAD
```

Upload `dist/scene-skipper-source-1.0.0.zip` as the source package. The reviewer can extract it and run `python3 scripts/build.py firefox` with Python 3.9+ and no third-party dependencies. The runtime files are reproducible; ZIP timestamps and other archive metadata may differ.

Once Mozilla signs the extension, download the signed `.xpi`. In Firefox, open `about:addons`, use the gear menu to choose **Install Add-on From File**, and select it. Each subsequent release needs a new version number and signature. Attach the signed `.xpi` to the matching GitHub release and update the Firefox download link in this README. Signed packages are release assets and stay out of Git history.

See Mozilla’s [source submission guidance](https://extensionworkshop.com/documentation/publish/source-code-submission/).

### Run checks

Requires Node.js **22 or newer** for JavaScript checks and Python **3.9 or newer** for packaging checks.

```sh
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

The automated checks use mocked browser APIs and player controls and validate the generated packages. They do not launch either browser.

For a manual check in each browser, play a Netflix episode with an intro or recap and verify it skips. Pause the extension and verify the next skip button remains available, then check each individual toggle. This requires a Netflix account and a signed-in browser. Live Netflix playback has not yet been verified.

## Development note

This project was developed under human direction and review, with support from artificial intelligence tools for parts of the code, debugging, and documentation. Decisions about how the system works and responsibility for the final result rest with the project maintainer.

## License

Released under the [MIT License](LICENSE).

## Disclaimer

Scene Skipper is an independent project and is not affiliated with or endorsed by Netflix.
