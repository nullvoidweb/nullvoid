# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. E-mail **security@anishalx.dev** with:

- a description of the issue and its impact,
- steps to reproduce (a minimal test page or file helps a lot),
- the browser and extension version.

You'll get an acknowledgement within 3 working days. Please allow up to 90 days for a fix before you disclose publicly. We are happy to credit reporters.

## Scope

In scope:

- Bypasses of the extension's isolation boundaries, such as script execution from e-mail bodies, file previews, AI output or the remote-browser stream inside extension pages.
- Ways for a web page to read extension secrets, call privileged background handlers, or abuse the interstitial page (for example clickjacking "Proceed anyway").
- Injection into the AI assistant that leads to an action without user intent.
- Logic flaws that silently disable protection.

Out of scope:

- False positives or negatives in heuristics or third-party blocklists. Please report those as normal issues using the `false-positive` label.
- Vulnerabilities in third-party services (mail.tm, Browserless, AI providers) or in the browser itself.

## Design summary

- Secrets live in an AES-GCM-encrypted IndexedDB vault in the extension origin, which content scripts cannot read. They are never committed or bundled.
- Extension pages use a strict CSP with no `unsafe-eval` or `unsafe-inline`. All third-party code is vendored and pinned.
- Untrusted HTML is sanitised with DOMPurify and rendered in sandboxed, script-less frames with a restrictive meta CSP. PDF.js runs with `isEvalSupported: false`.
- The background message router accepts messages only from this extension and allows content scripts just two handlers.

## Key hygiene for contributors

Never commit API keys. Earlier 1.x versions of this repository contained hard-coded keys; they must be treated as compromised and revoked by their owners.
