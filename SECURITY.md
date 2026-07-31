# Security Policy

## Supported versions

Security fixes are provided for the latest released version.

| Version | Supported |
| --- | --- |
| 0.9.x | Yes |
| 0.8.x | No |
| Earlier versions | No |

## Reporting a vulnerability

Use GitHub private vulnerability reporting when it is available for this repository. Do not publish exploit details, cookies, tokens, credentials, private page content, or local vault paths in a public Issue.

If private reporting is unavailable, open a minimal Issue titled `[Security] Private contact requested` without vulnerability details. The maintainer will arrange a private channel before technical information is shared.

Please include, through the private channel:

- Affected version
- Impact and affected component
- Minimal reproduction steps using synthetic content
- Suggested mitigation, if known

## Security boundaries

- The service must remain bound to `127.0.0.1`.
- Saved paths must remain inside the configured Obsidian vault.
- Contributions must not introduce collection of cookies, credentials, or private site API data.
- Test fixtures must use synthetic or sanitized content.
