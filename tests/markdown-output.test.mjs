import { buildMarkdown } from "../server/index.js";

const markdown = buildMarkdown({
  source: "zhihu",
  title: "测试标题",
  author: "答主 A",
  url: "https://www.zhihu.com/question/1/answer/2",
  html: "<p>测试正文。</p>",
  savedAt: "2026-06-24T12:00:00.000Z"
});

assertIncludes(markdown, 'author: "[[答主 A]]"', "frontmatter 作者应保存为 Obsidian 内部链接");
assertIncludes(markdown, "> 作者：[[答主 A]]", "正文作者应保存为 Obsidian 内部链接");
assertIncludes(markdown, "测试正文。", "正文转换失败");

const escapedMarkdown = buildMarkdown({
  source: "zhihu",
  title: "测试标题",
  author: "[[答主|A]]",
  url: "https://www.zhihu.com/question/1/answer/2",
  html: "<p>测试正文。</p>",
  savedAt: "2026-06-24T12:00:00.000Z"
});

assertIncludes(escapedMarkdown, 'author: "[[答主A]]"', "作者内部链接应清理 Obsidian 链接特殊字符");

const caixinMarkdown = buildMarkdown({
  source: "caixin",
  title: "财新测试标题",
  author: "于海荣",
  url: "https://economy.caixin.com/2026-06-24/102457132.html",
  html: "<p>财新测试正文。</p>",
  savedAt: "2026-06-24T12:00:00.000Z"
});

assertIncludes(caixinMarkdown, "source: 财新", "财新 source 应写入中文来源");
assertIncludes(caixinMarkdown, "  - 财新", "财新标签应写入 Markdown");
assertIncludes(caixinMarkdown, 'author: "[[于海荣]]"', "财新作者应保存为 Obsidian 内部链接");

const wechatMarkdown = buildMarkdown({
  source: "wechat",
  title: "公众号测试标题",
  author: "署名作者",
  url: "https://mp.weixin.qq.com/s/test",
  html: '<p>公众号测试正文。</p><img src="./公众号测试标题.assets/image-001.jpg" alt="正文图片">',
  publishedAt: "2026-07-27 23:45",
  savedAt: "2026-07-31T12:00:00.000Z"
});

assertIncludes(wechatMarkdown, "source: 微信公众号", "微信公众号 source 应写入中文来源");
assertIncludes(wechatMarkdown, "  - 微信公众号", "微信公众号标签应写入 Markdown");
assertIncludes(wechatMarkdown, 'author: "[[署名作者]]"', "微信公众号作者应保存为 Obsidian 内部链接");
assertIncludes(wechatMarkdown, 'published_at: "2026-07-27"', "微信公众号发布时间应转成标准日期");
assertIncludes(wechatMarkdown, "![正文图片](./公众号测试标题.assets/image-001.jpg)", "微信公众号本地图片链接应写入 Markdown");

const zsxqMarkdown = buildMarkdown({
  source: "zsxq",
  title: "知识星球测试标题",
  author: "星球作者",
  url: "https://wx.zsxq.com/dweb2/index/topic_detail/123456",
  html: "<p>知识星球测试正文。</p>",
  savedAt: "2026-06-25T12:00:00.000Z"
});

assertIncludes(zsxqMarkdown, "source: 知识星球", "知识星球 source 应写入中文来源");
assertIncludes(zsxqMarkdown, "  - 知识星球", "知识星球标签应写入 Markdown");
assertIncludes(zsxqMarkdown, 'author: "[[星球作者]]"', "知识星球作者应保存为 Obsidian 内部链接");

const zsxqWithMetaMarkdown = buildMarkdown({
  source: "zsxq",
  title: "谈一谈存储预期差",
  author: "星球作者",
  url: "https://wx.zsxq.com/dweb2/index/topic_detail/123456",
  html: "<p>谈一谈存储预期差 昨天美光业绩大好。 -赛腾股份，前道检测设备。 -深科技，HBM封测。</p>",
  planet: "某投资星球",
  publishedAt: "2026-06-24 09:00",
  comments: [
    {
      author: "读者甲",
      time: "2026-06-24 10:00",
      text: "评论内容。"
    }
  ],
  savedAt: "2026-06-25T12:00:00.000Z"
});

assertIncludes(zsxqWithMetaMarkdown, 'planet: "某投资星球"', "知识星球名称应写入 frontmatter");
assertIncludes(zsxqWithMetaMarkdown, "published_at:", "知识星球发布时间应写入 frontmatter");
assertIncludes(zsxqWithMetaMarkdown, "> [[星球作者]] · [[某投资星球]]", "知识星球摘要应写入引用块");
assertIncludes(zsxqWithMetaMarkdown, "## 评论（1）", "知识星球评论应写入 Markdown");
assertIncludes(zsxqWithMetaMarkdown, "### [[读者甲]] · 2026-06-24 10:00", "知识星球评论标题应包含作者和时间");
assertIncludes(zsxqWithMetaMarkdown, "评论内容。", "知识星球评论正文应写入 Markdown");
assertIncludes(zsxqWithMetaMarkdown, "\n- 赛腾股份", "知识星球列表应换行排版");
assertNotIncludes(zsxqWithMetaMarkdown, "# 谈一谈存储预期差", "知识星球不应重复输出一级标题");

const zsxqUnsafePlanetMarkdown = buildMarkdown({
  source: "zsxq",
  title: "知识星球标签清理测试",
  author: "星球作者",
  url: "https://wx.zsxq.com/dweb2/index/topic_detail/123456",
  html: "<p>知识星球测试正文。</p>",
  planet: "投研:星球#1",
  savedAt: "2026-06-25T12:00:00.000Z"
});

assertIncludes(zsxqUnsafePlanetMarkdown, 'planet: "投研:星球#1"', "知识星球名称属性应保留原始文本");
assertIncludes(zsxqUnsafePlanetMarkdown, "  - 投研星球1", "知识星球标签应清理 YAML/标签特殊字符");

console.log("markdown output tests passed");

function assertIncludes(actual, expected, message) {
  if (!actual.includes(expected)) {
    throw new Error(`${message}，实际内容：${actual}`);
  }
}

function assertNotIncludes(actual, expected, message) {
  if (actual.includes(expected)) {
    throw new Error(`${message}，实际内容：${actual}`);
  }
}
