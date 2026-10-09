# Contributing to NULL VOID

Thanks for helping make browsing safer. You can contribute by reporting bugs, reporting false positives or negatives, improving docs, or sending pull requests.

## Getting started

```bash
git clone https://github.com/nullvoidweb/nullvoid.git
cd nullvoid
npm install
```

Load `src/` as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked). Most changes take effect after clicking the reload icon on the extension card. Service-worker changes need that reload.

## Before you open a pull request

```bash
npm run lint
npm test
npm run test:integration
npm run test:e2e        # builds dist/chrome and drives it in Chromium
npm run lint:firefox    # for manifest or API changes
```

CI runs the same commands.

## Guidelines

- **Plain ES modules, no framework, no bundler** for extension code. Shared logic goes in `src/lib/`. Keep anything that can be pure, pure (no `chrome.*`, no DOM) so it can be unit-tested in Node.
- **Never use `innerHTML` with untrusted data.** Build DOM with `h()` from `lib/ui.js` (which uses `textContent`), or sanitise with `lib/sanitize.js`.
- **No remote code.** New third-party libraries must be vendored via `scripts/vendor.mjs` with their license in `src/vendor/licenses`.
- **No secrets in code.** Use `lib/vault.js`.
- Background handlers are registered with `handle(action, fn, { contentScripts })`. Only expose a handler to content scripts if a web page context truly needs it.
- Register service-worker listeners at module top level (MV3 requirement), and use `chrome.alarms` rather than `setInterval`.
- Add tests: unit tests for logic, an E2E scenario for user-visible flows.
- Match the existing style: 2-space indent, double quotes, semicolons, small focused functions, comments that explain *why*.

## Blocklists

`npm run rules` regenerates `src/rules/` from the feeds listed in `scripts/update-blocklists.mjs`. Only add feeds with licenses compatible with MIT redistribution (MIT, CC0, BSD…) and record them in the `SOURCES` list. To keep a shared platform from being blocked wholesale, add it to `NEVER_BLOCK`.

## Reporting false positives

Open an issue with the `false-positive` label. Include the URL (defang it like `hxxps://example[.]com`), which protection fired (interstitial mode, in-page warning or download guard), and the details shown under "Technical details".

## Security issues

Please follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
