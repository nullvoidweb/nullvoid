# Changelog

## Unreleased: frontend & accessibility pass

- **WCAG 2.1 AA across every page, in both themes.** An axe-core audit had found about 60 violations; there are now zero, and `tests/e2e/a11y.test.js` keeps it that way.
  - Every settings toggle and dropdown has an accessible name and description (about 25 were unlabelled).
  - Colour tokens were retuned so all text pairs reach 4.5:1, with separate button-fill tokens so white-on-blue buttons pass in dark mode.
  - Links inside text are underlined. Heading levels are sequential, with an `h1` on every page. The inbox has proper landmark regions.
- **Keyboard support:**
  - Inbox mailboxes and messages, and AI chat history, are now real buttons, so they work from the keyboard.
  - The account menu supports arrow keys and Escape and reports its expanded state.
  - The settings page has a skip link.
  - Focus moves to an opened message.
- **Popup redesign:**
  - Fits Chrome's 600px popup limit, which a test now enforces.
  - The site verdict leads, with a coloured shield, a summary line and an accessible risk meter, plus a loading skeleton.
  - Compact tool rows; e-mail actions are labelled icon buttons.
  - Trusting a suspicious or dangerous site now asks for confirmation.
- Toasts carry an icon per type, errors are announced immediately, toasts dismiss on click, and the exit animation is faster than the entrance.
- Emoji used as icons (📎, ⚠) are replaced with SVG icons, including in the in-page phishing banner. The banner's colours now meet contrast and its buttons show a focus ring.
- Welcome cards show live status ("Remote isolation ready", "Needs an API key", "2 inboxes") instead of static text.
- Inbox shows full addresses on two lines instead of truncating them.
- **Detection fix found during the UI review:** combo-squats that swap a digit into the brand (`paypa1-login.xyz`, `app1e-support.com`) are now caught, and a brand next to ordinary words (`my-apple-tree.org`) is only a weak signal.

## 2.0.0: complete rewrite

### Security fixes (from 1.x)

- **Removed hard-coded API keys** for Gemini, Shodan and Browserless from the source. The keys published in 1.x must be revoked. Every key is now user-supplied and stored in an encrypted on-device vault.
- E-mail HTML and AI output were inserted into extension pages without sanitisation. They now render through DOMPurify in sandboxed, script-less frames.
- The "remote browser" fell back to loading sites in a plain iframe, which is no isolation. It is now true pixel-streaming isolation over CDP.
- Mailbox passwords used `Math.random()`. They now come from `crypto.getRandomValues`.
- Regex rules such as `.*scam.*` blocked any URL containing those words. They are replaced by curated host lists and on-device heuristics.

### Bug fixes (from 1.x)

- The background service worker failed to load because of a syntax error (unclosed `isValidIP`), which disabled every background feature.
- Inline scripts and `onclick` handlers were blocked by the MV3 CSP, so the RBI page, auth callback and inbox buttons did nothing.
- The popup opened a non-existent `file-viewer.html`.
- `declarativeNetRequest`, `notifications` and the rule resources were missing from the manifest.
- Background e-mail polling read the wrong storage keys and never ran. It used `setInterval`, which MV3 kills.
- Fixed the `browserAPI.BrowseData` typo, duplicate message listeners and a test that imported a missing module.

### New

- **Smart Protection:** about 40k ad/tracker and about 377k malware/phishing hosts via declarativeNetRequest. Look-alike and homograph detection, credential-phishing page checks, a download guard, trusted and blocked sites, HTTPS upgrade, per-page badge counts, and an interstitial with session-scoped "Proceed anyway".
- **Threat intelligence (optional):** Google Safe Browsing v5 hash-prefix lookups, VirusTotal and abuse.ch.
- **Disposable Browser:** Browserless regions or a self-hosted CDP endpoint, full input forwarding, dialogs, pop-up folding, remote download blocking, region timezone and locale, quality controls, timeouts, and a local private-window fallback.
- **Disposable Email:** multiple inboxes, live Mercure updates, OTP extraction, verification-link buttons, tracker blocking, SPF/DKIM/DMARC display, attachment analysis, and autofill.
- **Secure File Viewer:** static analysis of PE/ELF/Mach-O, PDF, Office, ZIP, RTF, HTML, scripts and images, with IOCs, hashes, an entropy map, hash reputation, and safe previews (PDF.js, canvas images, Office text, CSV, hex, strings).
- **AI Assistant:** side panel; Claude, OpenAI-compatible (incl. Ollama) or Gemini; page, e-mail, file and selection analysis; prompt-injection hardening.
- Options page with onboarding, activity log, export/import and full data wipe. Light and dark themes.
- Firefox build (140+) with sidebar and data-collection consent.
- Tooling: ESLint, unit tests, CDP integration tests, a Playwright E2E suite, a build/zip script, a blocklist generator, a vendoring script and CI.
