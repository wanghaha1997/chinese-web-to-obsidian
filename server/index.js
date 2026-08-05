import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import cors from "cors";
import express from "express";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

export {
  addSaveDatePrefix,
  buildMarkdown,
  getAvailableFilePath,
  getTargetDir,
  localizeImages,
  normalizeConfig
};

const app = express();
const HOST = "127.0.0.1";
const PORT = 3721;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(PROJECT_ROOT, "config.json");
const execFileAsync = promisify(execFile);
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced"
});
const SOURCES = {
  zhihu: "知乎",
  caixin: "财新",
  zsxq: "知识星球",
  wechat: "微信公众号"
};
const DEFAULT_SOURCE_FOLDERS = {
  zhihu: "知乎",
  caixin: "财新",
  zsxq: "知识星球",
  wechat: "微信公众号"
};
const IMAGE_LOCALIZATION_SOURCES = new Set(["zsxq", "wechat"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 15000;

app.disable("x-powered-by");
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isChromeExtension = origin.startsWith("chrome-extension://");
    const isLocalDebug = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);

    if (isChromeExtension || isLocalDebug) {
      callback(null, true);
      return;
    }

    callback(new Error("不允许的跨域来源"));
  },
  methods: ["POST", "GET"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/config", async (req, res, next) => {
  try {
    const config = await readConfig();
    res.json({
      ok: true,
      config: createConfigResponse(config)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/config", async (req, res, next) => {
  try {
    const config = normalizeConfig(req.body);
    const targetDir = getTargetDir(config);

    await createConfiguredFolders(config);
    await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    console.log(`已更新保存目录：${targetDir}`);
    res.json({
      ok: true,
      config: createConfigResponse(config)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/select-folder", async (req, res, next) => {
  try {
    const currentConfig = await readConfig();
    const vaultPath = await selectLocalFolder();
    const config = normalizeConfig({
      vaultPath,
      saveFolder: cleanPathText(req.body?.saveFolder) || currentConfig.saveFolder,
      sourceFolders: req.body?.sourceFolders || currentConfig.sourceFolders
    });
    const targetDir = getTargetDir(config);

    await createConfiguredFolders(config);
    await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    console.log(`已选择并更新保存目录：${targetDir}`);
    res.json({
      ok: true,
      config: createConfigResponse(config)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/save", async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body);
    const config = await readConfig();
    const targetDir = getTargetDir(config, payload.source);
    await fs.mkdir(targetDir, { recursive: true });

    const targetPath = await getAvailableFilePath(targetDir, payload.title);
    const localized = await localizeImages(payload, targetPath);
    const markdown = buildMarkdown({
      ...payload,
      html: localized.html
    });

    await fs.writeFile(targetPath, markdown, "utf8");

    const imageSummary = localized.downloadedCount > 0
      ? `，图片 ${localized.downloadedCount} 张`
      : "";
    console.log(`已保存：${targetPath}${imageSummary}`);
    res.json({
      ok: true,
      path: targetPath,
      images: {
        downloaded: localized.downloadedCount,
        failed: localized.failedCount
      }
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    error.statusCode = 400;
    error.message = "请求体不是合法 JSON";
  }

  const status = error.statusCode || 500;
  const message = status === 500 ? "保存失败，请查看 Node.js 服务日志" : error.message;
  console.error(error.message);
  res.status(status).json({
    ok: false,
    error: message
  });
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(PORT, HOST, () => {
    console.log(`保存到 Obsidian 服务已启动：http://${HOST}:${PORT}`);
  });
}

async function readConfig() {
  let rawConfig;

  try {
    rawConfig = await fs.readFile(CONFIG_PATH, "utf8");
  } catch (error) {
    throw userError(`找不到配置文件：${CONFIG_PATH}`);
  }

  let config;

  try {
    config = JSON.parse(rawConfig);
  } catch (error) {
    throw userError("config.json 不是合法 JSON，请检查逗号和引号");
  }

  return normalizeConfig(config);
}

function normalizeConfig(body) {
  if (!body || typeof body !== "object") {
    throw userError("配置必须是 JSON 对象");
  }

  const vaultPath = cleanPathText(body.vaultPath);
  const saveFolder = cleanPathText(body.saveFolder);

  if (!vaultPath) {
    throw userError("config.json 缺少 vaultPath");
  }

  if (!path.isAbsolute(vaultPath)) {
    throw userError("config.json 的 vaultPath 必须是绝对路径");
  }

  if (!saveFolder) {
    throw userError("config.json 缺少 saveFolder");
  }

  const normalizedSaveFolder = normalizeRelativeFolder(saveFolder, "saveFolder");
  const sourceFolders = normalizeSourceFolders(body.sourceFolders, normalizedSaveFolder);

  return {
    vaultPath,
    saveFolder: normalizedSaveFolder,
    sourceFolders
  };
}

function getTargetDir(config, source) {
  const saveFolder = source && config.sourceFolders?.[source]
    ? config.sourceFolders[source]
    : config.saveFolder;

  return path.join(config.vaultPath, saveFolder);
}

function createConfigResponse(config) {
  const targetDirs = {};

  for (const source of Object.keys(SOURCES)) {
    targetDirs[source] = getTargetDir(config, source);
  }

  return {
    vaultPath: config.vaultPath,
    saveFolder: config.saveFolder,
    sourceFolders: config.sourceFolders,
    targetDir: getTargetDir(config),
    targetDirs
  };
}

async function createConfiguredFolders(config) {
  await fs.mkdir(getTargetDir(config), { recursive: true });

  for (const source of Object.keys(SOURCES)) {
    await fs.mkdir(getTargetDir(config, source), { recursive: true });
  }
}

function normalizeSourceFolders(value, fallbackFolder) {
  const sourceFolders = {};

  for (const source of Object.keys(SOURCES)) {
    const folder = value && typeof value === "object" && value[source]
      ? value[source]
      : DEFAULT_SOURCE_FOLDERS[source] || fallbackFolder;
    sourceFolders[source] = normalizeRelativeFolder(folder, `sourceFolders.${source}`);
  }

  return sourceFolders;
}

function normalizeRelativeFolder(value, fieldName) {
  const normalizedFolder = path.normalize(cleanPathText(value)).replace(/[\\/]+$/g, "");

  if (
    path.isAbsolute(normalizedFolder) ||
    normalizedFolder === "" ||
    normalizedFolder === "." ||
    normalizedFolder === ".." ||
    normalizedFolder.startsWith(`..${path.sep}`)
  ) {
    throw userError(`${fieldName} 只能是 Vault 内的相对目录`);
  }

  return normalizedFolder;
}

async function selectLocalFolder() {
  if (process.platform !== "darwin") {
    throw userError("当前版本仅支持在 macOS 上通过按钮选择文件夹");
  }

  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      'set chosenFolder to choose folder with prompt "请选择 Obsidian Vault 文件夹"',
      "-e",
      "POSIX path of chosenFolder"
    ]);

    const folderPath = stdout.trim().replace(/\/+$/g, "");

    if (!folderPath || !path.isAbsolute(folderPath)) {
      throw userError("未选择有效的文件夹路径");
    }

    return folderPath;
  } catch (error) {
    if (error.message && error.message.includes("User canceled")) {
      throw userError("已取消选择文件夹");
    }

    throw error;
  }
}

function normalizePayload(body) {
  if (!body || typeof body !== "object") {
    throw userError("请求体必须是 JSON 对象");
  }

  const rawTitle = cleanText(body.title) || "未命名网页内容";
  const author = cleanText(body.author) || "未知作者";
  const url = cleanText(body.url);
  const html = typeof body.html === "string" ? body.html : "";
  const savedAt = parseSavedAt(body.savedAt);
  const title = addSaveDatePrefix(rawTitle, savedAt);

  if (!SOURCES[body.source]) {
    throw userError(`source 必须是以下值之一：${Object.keys(SOURCES).join(", ")}`);
  }

  if (!url) {
    throw userError("缺少原文链接 url");
  }

  if (!html.trim()) {
    throw userError("正文 HTML 为空，请确认知乎页面正文已经加载完成");
  }

  return {
    source: body.source,
    title,
    author,
    url,
    html,
    savedAt,
    planet: cleanText(body.planet),
    publishedAt: cleanText(body.publishedAt),
    comments: normalizeComments(body.comments)
  };
}

function normalizeComments(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((comment) => ({
      author: cleanText(comment.author) || "未知评论者",
      time: cleanText(comment.time),
      text: typeof comment.text === "string" ? comment.text.trim() : "",
      html: typeof comment.html === "string" ? comment.html : ""
    }))
    .filter((comment) => comment.text || comment.html);
}

async function localizeImages(payload, targetPath, options = {}) {
  if (!IMAGE_LOCALIZATION_SOURCES.has(payload.source)) {
    return {
      html: payload.html,
      downloadedCount: 0,
      failedCount: 0
    };
  }

  const dom = new JSDOM(`<body>${payload.html}</body>`);
  const images = Array.from(dom.window.document.body.querySelectorAll("img[src]"));
  const fetchImpl = options.fetchImpl || fetch;
  const noteName = path.basename(targetPath, path.extname(targetPath));
  const assetsFolderName = `${noteName}.assets`;
  const assetsDir = getAssetsDirectory(targetPath);
  const downloadedByUrl = new Map();
  let downloadedCount = 0;
  let failedCount = 0;

  for (const image of images) {
    const sourceUrl = image.getAttribute("src");

    if (!isAllowedImageUrl(sourceUrl, payload.source)) {
      continue;
    }

    if (downloadedByUrl.has(sourceUrl)) {
      image.setAttribute("src", downloadedByUrl.get(sourceUrl));
      continue;
    }

    try {
      const response = await fetchImage(fetchImpl, sourceUrl);
      const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const contentLength = Number(response.headers.get("content-length") || 0);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (!contentType.startsWith("image/")) {
        throw new Error(`响应不是图片：${contentType || "未知类型"}`);
      }

      if (contentLength > MAX_IMAGE_BYTES) {
        throw new Error("图片超过 15 MB");
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length > MAX_IMAGE_BYTES) {
        throw new Error("图片超过 15 MB");
      }

      const extension = getImageExtension(contentType, sourceUrl);
      const fileName = `image-${String(downloadedCount + 1).padStart(3, "0")}${extension}`;
      const filePath = path.join(assetsDir, fileName);
      const relativePath = encodeURI(`./${assetsFolderName}/${fileName}`).replace(/#/g, "%23");

      await fs.mkdir(assetsDir, { recursive: true });
      await fs.writeFile(filePath, buffer);
      image.setAttribute("src", relativePath);
      downloadedByUrl.set(sourceUrl, relativePath);
      downloadedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.warn(`图片下载失败，保留原链接：${safeImageHost(sourceUrl)}（${error.message}）`);
    }
  }

  return {
    html: dom.window.document.body.innerHTML,
    downloadedCount,
    failedCount
  };
}

async function fetchImage(fetchImpl, sourceUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT_MS);

  try {
    return await fetchImpl(sourceUrl, {
      signal: controller.signal,
      redirect: "error"
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isAllowedImageUrl(value, source) {
  let url;

  try {
    url = new URL(value);
  } catch (error) {
    return false;
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return false;
  }

  if (source === "zsxq") {
    return url.hostname === "zsxq.com" || url.hostname.endsWith(".zsxq.com");
  }

  if (source === "wechat") {
    return url.hostname === "qpic.cn" || url.hostname.endsWith(".qpic.cn");
  }

  return false;
}

function getImageExtension(contentType, sourceUrl) {
  const extensions = {
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/x-png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp"
  };

  if (extensions[contentType]) {
    return extensions[contentType];
  }

  const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase();
  return /^\.(avif|gif|jpe?g|png|svg|webp)$/.test(extension) ? extension : ".img";
}

function safeImageHost(value) {
  try {
    return new URL(value).hostname;
  } catch (error) {
    return "未知地址";
  }
}

function buildMarkdown(payload) {
  let markdownBody = turndownService.turndown(payload.html).trim();

  if (payload.source === "zsxq") {
    markdownBody = postProcessZsxqMarkdown(markdownBody, payload.planet);
  }

  const commentsSection = buildCommentsMarkdown(payload.comments);
  const savedDate = formatLocalSaveDate(payload.savedAt);
  const title = escapeYamlValue(payload.title);
  const authorLink = createObsidianLink(payload.author);
  const author = escapeYamlValue(authorLink);
  const url = escapeYamlValue(payload.url);
  const sourceLabel = SOURCES[payload.source] || payload.source;
  const planetLine = payload.planet ? `planet: ${escapeYamlValue(payload.planet)}\n` : "";
  const publishedDate = formatSourceDate(payload.publishedAt);
  const publishedLine = publishedDate ? `published_at: ${escapeYamlValue(publishedDate)}\n` : "";
  const planetTag = payload.planet ? `\n  - ${sanitizeYamlListItem(payload.planet)}` : "";
  const intro = payload.source === "zsxq"
    ? buildZsxqIntro(payload)
    : `\n\n# ${payload.title}\n\n> 作者：${authorLink}\n> 原文：${payload.url}\n\n`;

  return `---\ntitle: ${title}\nauthor: ${author}\nsource: ${sourceLabel}\n${planetLine}${publishedLine}url: ${url}\nsaved_at: ${savedDate}\ntags:\n  - ${sourceLabel}${planetTag}\n  - 待整理\n---${intro}${markdownBody}${commentsSection}`;
}

function buildZsxqIntro(payload) {
  const authorLink = createObsidianLink(payload.author);
  const parts = [authorLink];

  if (payload.planet) {
    parts.push(`[[${cleanObsidianLinkTarget(payload.planet)}]]`);
  }

  if (payload.publishedAt) {
    parts.push(formatSourceDate(payload.publishedAt));
  }

  parts.push(`[原文](${payload.url})`);
  return `\n\n> ${parts.join(" · ")}\n\n`;
}

function buildCommentsMarkdown(comments) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return "";
  }

  const items = comments.map((comment) => {
    const authorLink = createObsidianLink(comment.author);
    const meta = comment.time ? `${authorLink} · ${comment.time}` : authorLink;
    const body = comment.text || turndownService.turndown(comment.html || "").trim();
    return `### ${meta}\n\n${body}`;
  });

  return `\n\n## 评论（${comments.length}）\n\n${items.join("\n\n---\n\n")}\n`;
}

function postProcessZsxqMarkdown(markdown, planet) {
  let result = markdown
    .replace(/知识星球([\u4e00-\u9fa5A-Za-z0-9·]+)/g, "[[$1]]")
    .replace(/\s+-\s*(?=[\u4e00-\u9fa5A-Za-z])/g, "\n\n- ")
    .replace(/([。！？])\s+(?=[\u4e00-\u9fa5A-Za-z0-9])/g, "$1\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (planet) {
    const planetLink = `[[${cleanObsidianLinkTarget(planet)}]]`;
    result = result.replace(new RegExp(planetLink, "g"), planetLink);
  }

  return result;
}

async function getAvailableFilePath(targetDir, title) {
  const baseName = sanitizeFileName(title) || "未命名知乎内容";
  let candidate = path.join(targetDir, `${baseName}.md`);

  for (let index = 1; await noteOutputExists(candidate); index += 1) {
    candidate = path.join(targetDir, `${baseName}-${index}.md`);
  }

  return candidate;
}

async function noteOutputExists(notePath) {
  return await fileExists(notePath) || await fileExists(getAssetsDirectory(notePath));
}

function getAssetsDirectory(notePath) {
  const extension = path.extname(notePath);
  return `${notePath.slice(0, -extension.length)}.assets`;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

function sanitizeFileName(fileName) {
  return fileName
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanPathText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseSavedAt(value) {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function addSaveDatePrefix(title, savedAt) {
  const normalizedTitle = cleanText(title) || "未命名网页内容";

  if (/^\d{1,2}\.\d{2}(?:\s|$)/.test(normalizedTitle)) {
    return normalizedTitle;
  }

  const { month, day } = getLocalSaveDateParts(savedAt);
  return `${month}.${day} ${normalizedTitle}`;
}

function formatLocalSaveDate(savedAt) {
  const { year, month, day } = getLocalSaveDateParts(savedAt);
  return `${year}-${String(month).padStart(2, "0")}-${day}`;
}

function getLocalSaveDateParts(savedAt) {
  const parsedDate = new Date(savedAt);
  const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: String(date.getDate()).padStart(2, "0")
  };
}

function formatSourceDate(value) {
  const text = cleanText(value);
  const chineseDate = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);

  if (chineseDate) {
    const [, year, month, day] = chineseDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoDate ? isoDate[1] : text.slice(0, 10);
}

function escapeYamlValue(value) {
  return JSON.stringify(value);
}

function createObsidianLink(value) {
  const linkTarget = cleanObsidianLinkTarget(value);
  return `[[${linkTarget || "未知作者"}]]`;
}

function cleanObsidianLinkTarget(value) {
  return cleanText(value)
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .replace(/[#[\]^|]/g, "")
    .trim();
}

function sanitizeYamlListItem(value) {
  return cleanText(value)
    .replace(/[\r\n]/g, " ")
    .replace(/#/g, "")
    .replace(/:/g, "")
    .trim();
}

function userError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
