# Changelog

All notable changes to this project are documented in this file.

## [0.9.0] - 2026-07-31

### Added

- WeChat Official Account article extraction for rendered title, author, publish time, body, and images.
- Local image downloads for rendered Zsxq and WeChat content.
- Per-source save folder configuration for WeChat articles.
- Image extraction and localization tests.

### Security and privacy

- Image downloads are restricted to source hosts under `zsxq.com` and `qpic.cn`.
- Image requests do not forward browser cookies or article body content.
- Failed image downloads keep the original remote URL instead of failing the note save.

## [0.8.1] - 2026-07-14

First public release under the name **Chinese Web to Obsidian**.

### Added

- Zhihu question answer and column article extraction.
- Caixin rendered article extraction.
- Zsxq visible topic extraction with optional displayed comments.
- Selection of one candidate or all visible candidates.
- Per-source Obsidian vault folders.
- Obsidian internal links for authors.
- Local save path configuration from the extension popup.
- macOS vault folder picker and LaunchAgent setup scripts.
- Automated extraction, Markdown output, and configuration tests.
- English project documentation and release automation.

### Privacy and security

- The local service listens only on `127.0.0.1`.
- The extension reads only content rendered in the active tab.
- No site cookies, credentials, private APIs, analytics, or cloud content storage are used.

[0.9.0]: https://github.com/wanghaha1997/chinese-web-to-obsidian/releases/tag/v0.9.0
[0.8.1]: https://github.com/wanghaha1997/chinese-web-to-obsidian/releases/tag/v0.8.1
