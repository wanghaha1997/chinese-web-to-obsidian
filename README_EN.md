# Chinese Web to Obsidian

<p align="center">
  <img src="assets/chinese-web-to-obsidian-logo.png" alt="Chinese Web to Obsidian logo" width="144">
</p>

<p align="center">
  <a href="README.md">中文</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="PRIVACY.md">Privacy</a> ·
  <a href="SECURITY.md">Security</a>
</p>

[![Tests](https://github.com/wanghaha1997/chinese-web-to-obsidian/actions/workflows/test.yml/badge.svg)](https://github.com/wanghaha1997/chinese-web-to-obsidian/actions/workflows/test.yml)
[![Release](https://img.shields.io/github/v/release/wanghaha1997/chinese-web-to-obsidian)](https://github.com/wanghaha1997/chinese-web-to-obsidian/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](extension/manifest.json)

A local-first Chrome extension and Node.js service that saves rendered content from Chinese knowledge platforms to an Obsidian vault as structured Markdown.

![Select one rendered answer before saving](assets/screenshots/popup-select-answer.png)

## Why this project

- Save one selected answer or all currently visible candidates.
- Preserve title, author, source URL, and rendered body content.
- Prefix saved note titles and filenames with the article publication date, falling back to the local save date when unavailable.
- Save rendered inline images from every supported source beside the Markdown note and place them after the article text.
- Link authors with Obsidian `[[internal links]]`.
- Route each supported source to its own vault folder.
- Keep captured content on the user's computer.

## Supported sources

| Source | Supported pages | Notes |
| --- | --- | --- |
| Zhihu | Question answers and column articles | Select one answer or save all visible answers, including inline images |
| Caixin | Opened and rendered article pages | Saves inline images and does not bypass access controls |
| Zsxq | Visible topics and already displayed comments | Comments are not saved by default |
| WeChat Official Accounts | Opened and rendered article pages | Saves the byline author, publish time, body, and images |

The extension reads only content that is already rendered in the current browser tab. It does not read site cookies, call private site APIs, simulate login, or bypass paywalls.

## Architecture

```text
Rendered page in Chrome
  -> Manifest V3 content script
  -> POST http://127.0.0.1:3721/save
  -> Local Express and Turndown service
  -> Markdown file in the local Obsidian vault
```

The service listens only on `127.0.0.1`.

## Quick start

Requirements: Node.js 20.19.0 or later and a Chromium browser with Manifest V3 support.

```bash
git clone https://github.com/wanghaha1997/chinese-web-to-obsidian.git
cd chinese-web-to-obsidian
npm install
cp config.example.json config.json
```

Edit `config.json` and set `vaultPath` to the absolute path of your Obsidian vault:

```json
{
  "vaultPath": "/Users/your-name/Documents/ObsidianVault",
  "saveFolder": "Web Clippings",
  "sourceFolders": {
    "zhihu": "Zhihu",
    "caixin": "Caixin",
    "zsxq": "Zsxq",
    "wechat": "WeChat"
  }
}
```

Start the local service:

```bash
npm start
```

Verify it:

```bash
curl http://127.0.0.1:3721/health
```

Then open `chrome://extensions/`, enable Developer mode, choose **Load unpacked**, and select the `extension` directory.

## Privacy

Captured content is sent only to the local service at `127.0.0.1:3721` and written to the configured vault. For supported inline images, the local service may download them directly from allowlisted source image hosts without site cookies. The project does not include analytics, cloud storage, user accounts, or AI summarization. See [PRIVACY.md](PRIVACY.md).

## Development

```bash
npm install
npm test
```

When a supported website changes its DOM, use small sanitized HTML fixtures in extraction tests. Never commit cookies, credentials, paid article bodies, personal vault paths, or private user content.

See [CONTRIBUTING.md](CONTRIBUTING.md), [ROADMAP.md](ROADMAP.md), and [Maintaining with Codex](docs/MAINTAINING_WITH_CODEX.md).

## Scope boundaries

This project does not provide account login, cloud sync, bulk collection through private APIs, paywall bypassing, or automatic AI rewriting. It only saves content the user can already see in the current tab.

## License

[MIT](LICENSE)
