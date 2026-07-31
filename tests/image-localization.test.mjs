import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildMarkdown, getAvailableFilePath, localizeImages } from "../server/index.js";

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "chinese-web-images-"));

try {
  await testWechatImages(tempDir);
  await testZsxqImageFailure(tempDir);
  await testAssetDirectoryCollision(tempDir);
  console.log("image localization tests passed");
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}

async function testWechatImages(rootDir) {
  const imageUrl = "https://mmbiz.qpic.cn/test/article-image.jpeg";
  const targetPath = path.join(rootDir, "公众号文章.md");
  let requestCount = 0;
  const result = await localizeImages({
    source: "wechat",
    html: `<p>正文</p>
      <img src="${imageUrl}" alt="图片一">
      <img src="${imageUrl}" alt="重复图片">
      <img src="https://example.com/not-allowed.jpg" alt="其他站点">`
  }, targetPath, {
    fetchImpl: async () => {
      requestCount += 1;
      return new Response(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": "4"
        }
      });
    }
  });

  assert.equal(requestCount, 1, "重复图片应只下载一次");
  assert.equal(result.downloadedCount, 1, "微信公众号图片下载数量错误");
  assert.equal(result.failedCount, 0, "微信公众号图片不应下载失败");
  assert.match(result.html, /\.\/%E5%85%AC%E4%BC%97%E5%8F%B7%E6%96%87%E7%AB%A0\.assets\/image-001\.jpg/, "图片地址应改为 Vault 内相对路径");
  assert.match(result.html, /https:\/\/example\.com\/not-allowed\.jpg/, "非允许域名图片应保留原链接");

  const markdown = buildMarkdown({
    source: "wechat",
    title: "公众号文章",
    author: "署名作者",
    url: "https://mp.weixin.qq.com/s/test",
    html: result.html,
    savedAt: "2026-07-31T12:00:00.000Z"
  });
  assert.match(markdown, /!\[图片一\]\(\.\/%E5%85%AC%E4%BC%97%E5%8F%B7%E6%96%87%E7%AB%A0\.assets\/image-001\.jpg\)/, "Markdown 应引用本地图片");

  const savedImage = await fs.readFile(path.join(rootDir, "公众号文章.assets", "image-001.jpg"));
  assert.equal(savedImage.length, 4, "本地图片文件内容错误");
}

async function testZsxqImageFailure(rootDir) {
  const imageUrl = "https://images.zsxq.com/test/topic-image.png";
  const result = await localizeImages({
    source: "zsxq",
    html: `<p>正文</p><img src="${imageUrl}" alt="星球图片">`
  }, path.join(rootDir, "知识星球主题.md"), {
    fetchImpl: async () => {
      throw new Error("模拟下载失败");
    }
  });

  assert.equal(result.downloadedCount, 0, "失败图片不应计为已下载");
  assert.equal(result.failedCount, 1, "失败图片数量错误");
  assert.match(result.html, /https:\/\/images\.zsxq\.com\/test\/topic-image\.png/, "下载失败时应保留原图片链接");
}

async function testAssetDirectoryCollision(rootDir) {
  await fs.mkdir(path.join(rootDir, "已有附件.assets"));
  const availablePath = await getAvailableFilePath(rootDir, "已有附件");
  assert.equal(availablePath, path.join(rootDir, "已有附件-1.md"), "已有资源目录时不应覆盖附件");
}
