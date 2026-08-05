# Privacy Policy

Last updated: 2026-08-05

Chinese Web to Obsidian is a local-first Chrome extension and local Node.js service.

## Data processed

When the user clicks the extension, it may read the following information from the active supported page:

- Page title
- Author name
- Original page URL
- HTML content already rendered in the page
- Image URLs already present in rendered article or answer content
- Comments already displayed on a supported Zsxq page, only when the user chooses to include them

## How data is used

The extension sends this information only to `http://127.0.0.1:3721`, where the local service converts it to Markdown and writes it to the Obsidian vault configured by the user. For supported inline images, the local service requests the original image URL from an allowlisted source image host and saves the response beside the Markdown note. These requests do not include site cookies or article body content.

## Data collection and sharing

This project does not:

- Send captured content to the project maintainer or an external server
- Collect analytics, telemetry, or advertising identifiers
- Read or store site cookies, passwords, authentication tokens, or API keys
- Call private APIs of supported websites
- Provide cloud storage or user accounts
- Send captured content to AI models

## Chrome permissions

- `activeTab` allows the extension to read the currently active supported page after the user invokes it.
- Access to `http://127.0.0.1:3721/*` allows the extension to communicate with the local save service.

## Data retention

The extension does not maintain a remote database. Saved Markdown files remain in the user's configured Obsidian vault and are controlled by the user. Local service logs may contain save status and local file paths, but not article bodies by design.

## Source image hosts

The project does not transmit captured article text to third-party services. Image downloads contact only allowlisted source image hosts under `zhimg.com`, `caixin.com`, `zsxq.com`, or `qpic.cn`; if a download fails, the Markdown keeps the original remote image URL. If the user's vault is stored in a separately configured synchronization service such as OneDrive or iCloud, that synchronization is controlled by the user and is outside this project's operation.

## Changes

Material privacy changes will be documented in the repository and release notes.

## Contact

Privacy questions can be submitted through the repository's [GitHub Issues](https://github.com/wanghaha1997/chinese-web-to-obsidian/issues). Do not include private page content, credentials, tokens, or personal vault paths in an issue.
