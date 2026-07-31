# Codex Open Source Fund 申请草稿

> 当前目标是申请包含 6 个月 ChatGPT Pro 的 Codex for Open Source。请优先使用 [CODEX_FOR_OPEN_SOURCE_APPLICATION.md](CODEX_FOR_OPEN_SOURCE_APPLICATION.md)。本文件仅保留为普通 Open Source Fund 的参考草稿。

这份文档是表单填写草稿，不代表项目已经获得 OpenAI 资助。提交前请补充申请人的真实资料，并根据表单当时的字段和字数限制调整。

## 项目名称

Chinese Web to Obsidian / 中文网页保存到 Obsidian

## GitHub 仓库

https://github.com/wanghaha1997/chinese-web-to-obsidian

## Brief description of the project

Chinese Web to Obsidian is a local-first, open-source Chrome extension and Node.js service for saving rendered content from Chinese knowledge platforms into an Obsidian vault as structured Markdown. It currently supports Zhihu answers and articles, Caixin articles, and visible Zsxq posts. Users can select a single item or save all visible candidates, route each source to a separate folder, and connect notes by author through Obsidian internal links. The service listens only on 127.0.0.1 and does not use site cookies or internal APIs.

## 项目中文简介

“中文网页保存到 Obsidian”是一个本地优先的开源 Chrome 扩展和 Node.js 服务，用于把中文知识网站中当前已经显示的内容保存为结构化 Markdown。目前支持知乎回答与专栏、财新文章和知识星球可见主题。它可以选择单条内容、按来源自动归档，并用 Obsidian 内部链接关联同一作者的笔记。服务只监听本机地址，不读取网站 Cookie，也不调用网站内部接口。

## Why does this repository qualify?

This project addresses a practical gap for Chinese-language knowledge workflows: preserving user-visible web content in an open Markdown format without sending it to a third-party clipping service. It is actively maintained, has automated extraction, image-localization, and Markdown regression tests, and supports four sites with different rendering structures. Funding would help turn a working personal tool into a more reliable community-maintained project with broader test coverage, clearer releases, and faster compatibility fixes when supported sites change their DOM.

提交时请在这一段补充真实、可验证的数据，例如 GitHub stars、forks、Issues、贡献者数量或实际用户反馈。没有数据时不要编造。

## How would you use API credits for your project?

API credits would support open-source maintenance rather than processing users' saved articles. We would use Codex and OpenAI models for code review, generating and improving regression tests from small sanitized DOM fixtures, diagnosing selector breakages, maintaining cross-platform startup scripts, reviewing security-sensitive local-service changes, and preparing release documentation. User cookies, credentials, private pages, paid article text, and saved vault content would not be sent to the API.

## Maintainer role

I am the project creator and primary maintainer. I designed the local-first architecture, implemented the Chrome extension and local Node.js service, maintain extraction compatibility for supported websites, review privacy boundaries, and manage tests, documentation, releases, and user-reported issues.

## Anything else we should know?

The project intentionally keeps a narrow privacy boundary: it reads only content already rendered in the user's browser, sends it only to a service bound to 127.0.0.1, and writes Markdown directly into the user's local Obsidian vault. It does not bypass authentication or subscriptions, call private site APIs, or upload saved content to a cloud service. The roadmap prioritizes reliability, maintainability, and accessible installation for non-technical users.

## 提交前补充

- 申请人的姓名、邮箱、LinkedIn 和个人 GitHub 地址
- 真实的维护和使用数据
- 最有代表性的用户反馈或 Issue 链接
- OpenAI Organization ID（如果当前表单要求）
- 申请页面当时要求的字符数压缩版本

官方申请入口：

- https://openai.com/form/codex-open-source-fund/
- https://openai.com/form/codex-for-oss/
