# Privacy Policy — NULL VOID browser extension

_Last updated: 2026-10-09 · applies to version 2.0.0 and later_

NULL VOID is built to protect your privacy. The extension has **no servers of its own, no analytics, no telemetry and no advertising**. Its developers never receive your browsing data.

## What stays on your device

| Data | Where | Purpose |
| --- | --- | --- |
| Settings, trusted/blocked sites | `chrome.storage.local` | Remember your preferences |
| API keys, tokens, disposable-mailbox passwords | Extension IndexedDB, AES-GCM encrypted | Use the services you configure |
| Activity log (blocked threats, warnings) | `chrome.storage.local`, at most 500 entries | Shown to you on the Activity page |
| AI chat history | `chrome.storage.local`, at most 30 chats | Lets you reopen conversations |
| Per-tab URL and risk score, reputation cache | `chrome.storage.session` (cleared when the browser closes) | Popup display, interstitial page |

URL risk scoring, phishing-page checks, ad and malware blocking, and file analysis all run **locally**.

## What is sent to third parties, and only when you use the feature

| Service | When | What is sent |
| --- | --- | --- |
| **mail.tm** | You create or read a disposable inbox | Requests for that inbox (address, generated password, messages) |
| **Browserless** or your own CDP endpoint | You open the Disposable Browser | The pages you visit there and your input in that session |
| **Your AI provider** (Anthropic, OpenAI-compatible, Google Gemini) | You send a message or ask for an analysis | Your messages, plus the page text, e-mail or file report you ask about. Page text can be disabled in Settings |
| **Google Safe Browsing** | Enabled by you, on Scan, link checks or every navigation if chosen | 4-byte SHA-256 hash prefixes of the URL, never the URL itself |
| **VirusTotal** | Enabled by you | The URL being checked, or a file's SHA-256 hash (files are never uploaded) |
| **abuse.ch** (URLhaus, MalwareBazaar) | Enabled by you | The host name being checked, or a file's SHA-256 hash |
| **NULL VOID website** (optional sign-in) | You choose to sign in | Standard sign-in to your account |

Each service handles data under its own privacy policy. API keys are sent only to the service they belong to.

## Permissions and why they are needed

- **Access to all sites** (`<all_urls>`), `webNavigation`, `tabs`, `scripting`, `declarativeNetRequest` (+ `Feedback`): block malicious and ad hosts, check pages for phishing, and show warnings.
- `downloads`: pause or block dangerous downloads.
- `storage`, `unlimitedStorage`: settings, logs and the encrypted vault.
- `alarms`, `notifications`: check disposable inboxes and notify you about new mail or blocked threats.
- `contextMenus`, `sidePanel`: right-click actions and the AI side panel.
- `browsingData`: wipe site data when a temporary Disposable Browser window closes.

## Your controls

- Every network feature is optional and can be switched off in Settings.
- **Settings → Privacy & Data → Delete everything** removes all local data, keys, logs and rules, and deletes your disposable inboxes at mail.tm.
- Uninstalling the extension removes all local data.

## Contact

contact@anishalx.dev · security reports: see [SECURITY.md](SECURITY.md)
