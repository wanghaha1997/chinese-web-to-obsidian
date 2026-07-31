import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const contentScript = await fs.readFile(path.join(projectRoot, "extension", "content.js"), "utf8");

await testZhuanlanArticle();
await testQuestionAnswer();
await testMultipleQuestionAnswers();
await testNestedRichTextIsNotDuplicated();
await testCaixinArticle();
await testWechatArticle();
await testZsxqTopics();
await testZsxqTopicDetailWithComments();
await testZsxqTitleFromBody();
console.log("content extraction tests passed");

async function testZhuanlanArticle() {
  const data = await extractFromHtml(`<!doctype html>
    <html>
      <head><title>专栏标题 - 知乎</title></head>
      <body>
        <h1>专栏文章标题</h1>
        <a class="UserLink-link">专栏作者</a>
        <article class="Post-RichTextContainer">
          <p>这是专栏正文第一段。</p>
          <p>这是专栏正文第二段。</p>
        </article>
      </body>
    </html>`, "https://zhuanlan.zhihu.com/p/123456");

  assertEqual(data.title, "专栏文章标题", "专栏标题提取失败");
  assertEqual(data.author, "专栏作者", "专栏作者提取失败");
  assertIncludes(data.html, "这是专栏正文第一段。", "专栏正文提取失败");
  assertEqual(data.url, "https://zhuanlan.zhihu.com/p/123456", "专栏 URL 提取失败");
  assertEqual(data.candidates.length, 1, "专栏候选数量错误");
}

async function testQuestionAnswer() {
  const data = await extractFromHtml(`<!doctype html>
    <html>
      <head><title>问题回答 - 知乎</title></head>
      <body>
        <div class="QuestionHeader-title">知乎问题标题</div>
        <div class="AuthorInfo-name">回答作者</div>
        <div class="AnswerItem">
          <div class="RichContent-inner">
            <p>短内容。</p>
          </div>
        </div>
        <div class="AnswerItem">
          <div class="RichContent-inner">
            <p>这是回答正文第一段。</p>
            <p>这是回答正文第二段，内容更长。</p>
          </div>
        </div>
      </body>
    </html>`, "https://www.zhihu.com/question/123/answer/456");

  assertEqual(data.title, "知乎问题标题", "回答标题提取失败");
  assertEqual(data.author, "回答作者", "回答作者提取失败");
  assertIncludes(data.html, "短内容。", "默认回答正文提取失败");
  assertEqual(data.url, "https://www.zhihu.com/question/123/answer/456", "回答 URL 提取失败");
  assertEqual(data.candidates.length, 2, "回答候选数量错误");
}

async function testMultipleQuestionAnswers() {
  const data = await extractFromHtml(`<!doctype html>
    <html>
      <head><title>问题回答 - 知乎</title></head>
      <body>
        <div class="QuestionHeader-title">知乎问题标题</div>
        <div class="AnswerItem">
          <div class="AuthorInfo-name">答主 A</div>
          <div class="RichContent-inner">
            <p>A 的回答。</p>
          </div>
        </div>
        <div class="AnswerItem">
          <div class="AuthorInfo-name">答主 B</div>
          <div class="RichContent-inner">
          <p>这是回答正文第一段。</p>
          <p>这是回答正文第二段，内容更长。</p>
          </div>
        </div>
      </body>
    </html>`, "https://www.zhihu.com/question/123/answer/456");

  assertEqual(data.candidates.length, 2, "多回答候选数量错误");
  assertEqual(data.candidates[0].author, "答主 A", "第一个候选作者错误");
  assertEqual(data.candidates[1].author, "答主 B", "第二个候选作者错误");
  assertIncludes(data.candidates[0].html, "A 的回答", "第一个候选正文错误");
  assertIncludes(data.candidates[1].html, "这是回答正文第二段", "第二个候选正文错误");
}

async function testNestedRichTextIsNotDuplicated() {
  const data = await extractFromHtml(`<!doctype html>
    <html>
      <head><title>问题回答 - 知乎</title></head>
      <body>
        <div class="QuestionHeader-title">知乎问题标题</div>
        <div class="AnswerItem">
          <div class="AuthorInfo-name">答主 A</div>
          <div class="RichContent-inner">
            <div class="RichText">
              <p>A 的回答会同时匹配两个正文选择器。</p>
            </div>
          </div>
        </div>
        <div class="AnswerItem">
          <div class="AuthorInfo-name">答主 B</div>
          <div class="RichContent-inner">
            <div class="RichText">
              <p>B 的回答也只能出现一次。</p>
            </div>
          </div>
        </div>
      </body>
    </html>`, "https://www.zhihu.com/question/123/answer/456");

  assertEqual(data.candidates.length, 2, "嵌套 RichText 不应造成候选重复");
  assertEqual(data.candidates[0].author, "答主 A", "去重后第一个候选作者错误");
  assertEqual(data.candidates[1].author, "答主 B", "去重后第二个候选作者错误");
}

async function testCaixinArticle() {
  const data = await extractFromHtml(`<!doctype html>
    <html>
      <head>
        <title>如何解决供强需弱？学者称收入分配或比宏观政策更重要_经济频道_财新网</title>
        <meta property="og:title" content="如何解决供强需弱？学者称收入分配或比宏观政策更重要_经济频道_财新网">
      </head>
      <body>
        <h1>如何解决供强需弱？学者称收入分配或比宏观政策更重要</h1>
        <div class="article-info">2026-06-24 19:58:24来源：财新网 作者：于海荣责任编辑：霍侃</div>
        <div id="Main_Content_Val">
          <p>文｜财新 于海荣</p>
          <p>供强需弱是根源于中国的增长模式和制度逻辑的结构性矛盾。</p>
          <p>从未来角度讲，讨论收入分配政策比讨论经济增长政策更为关键和重要。</p>
        </div>
      </body>
    </html>`, "https://economy.caixin.com/2026-06-24/102457132.html");

  assertEqual(data.source, "caixin", "财新 source 提取失败");
  assertEqual(data.title, "如何解决供强需弱？学者称收入分配或比宏观政策更重要", "财新标题提取失败");
  assertEqual(data.author, "于海荣", "财新作者提取失败");
  assertIncludes(data.html, "供强需弱是根源于中国", "财新正文提取失败");
  assertEqual(data.candidates.length, 1, "财新候选数量错误");
}

async function testWechatArticle() {
  const data = await extractFromHtml(`<!doctype html>
    <html>
      <head>
        <title>公众号文章标题</title>
        <meta property="og:title" content="公众号文章标题">
        <meta name="author" content="署名作者">
      </head>
      <body>
        <h1 id="activity-name">公众号文章标题</h1>
        <span id="js_author_name_text">署名作者</span>
        <a id="js_name">测试公众号</a>
        <em id="publish_time">2026年7月27日 23:45</em>
        <div id="js_content" class="rich_media_content">
          <p>这是微信公众号文章正文。</p>
          <img src="data:image/svg+xml,placeholder" data-src="https://mmbiz.qpic.cn/test/article-image.jpeg" alt="正文图片">
        </div>
      </body>
    </html>`, "https://mp.weixin.qq.com/s/test-article");

  assertEqual(data.source, "wechat", "微信公众号 source 提取失败");
  assertEqual(data.title, "公众号文章标题", "微信公众号标题提取失败");
  assertEqual(data.author, "署名作者", "微信公众号作者提取失败");
  assertEqual(data.publishedAt, "2026年7月27日 23:45", "微信公众号发布时间提取失败");
  assertIncludes(data.html, "这是微信公众号文章正文", "微信公众号正文提取失败");
  assertIncludes(data.html, 'src="https://mmbiz.qpic.cn/test/article-image.jpeg"', "微信公众号懒加载图片地址未还原");
  assertEqual(data.candidates.length, 1, "微信公众号候选数量错误");
}

async function testZsxqTopics() {
  const data = await extractFromHtml(`<!doctype html>
    <html>
      <head><title>某投资星球 - 知识星球</title></head>
      <body>
        <app-main-content>
          <div class="group-name">某投资星球</div>
          <app-topic>
            <div class="topic-container">
              <app-topic-header>
                <div class="header-container">
                  <div class="author"><div class="info"><div class="role">星球作者 A</div></div></div>
                  <div class="date">2026-06-24 10:00</div>
                </div>
              </app-topic-header>
              <app-talk-content>
                <div class="talk-content-container">
                  <div class="content">
                    <p>这是知识星球第一条内容，适合保存到 Obsidian。</p>
                    <img data-src="https://images.zsxq.com/test/topic-image.png" alt="星球图片">
                  </div>
                </div>
              </app-talk-content>
              <div class="comment-box">
                <app-comment-item>
                  <div class="comment-item-container">
                    <div class="text"><div class="comment">读者甲</div></div>
                    <div class="text">感谢分享。</div>
                    <div class="operations"><div class="time">2026-06-24 11:00</div></div>
                  </div>
                </app-comment-item>
              </div>
            </div>
          </app-topic>
          <app-topic>
            <div class="topic-container">
              <app-topic-header>
                <div class="header-container">
                  <div class="author"><div class="info"><div class="role">星球作者 B</div></div></div>
                </div>
              </app-topic-header>
              <app-talk-content>
                <div class="talk-content-container">
                  <div class="content"><p>这是知识星球第二条内容，也应该成为一个候选项。</p></div>
                </div>
              </app-talk-content>
            </div>
          </app-topic>
        </app-main-content>
      </body>
    </html>`, "https://wx.zsxq.com/dweb2/index/group/123456");

  assertEqual(data.source, "zsxq", "知识星球 source 提取失败");
  assertEqual(data.planet, "某投资星球", "知识星球名称提取失败");
  assertEqual(data.author, "星球作者 A", "知识星球默认作者提取失败");
  assertIncludes(data.html, "这是知识星球第一条内容", "知识星球默认正文提取失败");
  assertEqual(data.candidates.length, 2, "知识星球候选数量错误");
  assertEqual(data.candidates[0].comments.length, 1, "知识星球评论数量错误");
  assertEqual(data.candidates[0].comments[0].author, "读者甲", "知识星球评论作者错误");
  assertIncludes(data.candidates[0].html, "这是知识星球第一条内容", "知识星球正文不应包含评论");
  assertIncludes(data.candidates[0].html, 'src="https://images.zsxq.com/test/topic-image.png"', "知识星球图片地址未保留");
  assertEqual(data.candidates[1].author, "星球作者 B", "知识星球第二个候选作者错误");
}

async function testZsxqTopicDetailWithComments() {
  const data = await extractFromHtml(`<!doctype html>
    <html>
      <head><title>某投资星球 - 知识星球</title></head>
      <body>
        <app-topic-detail-page>
          <div class="group-name">某投资星球</div>
          <app-topic-detail>
            <div id="topic-detail-container" class="topic-detail">
              <app-topic-header>
                <div class="header-container">
                  <div class="author"><div class="info"><div class="role">星球作者 A</div></div></div>
                  <div class="date">2026-06-24 09:00</div>
                </div>
              </app-topic-header>
              <app-talk-content>
                <div class="talk-content-container">
                  <div class="content"><p>这是详情页正文，应该单独保存。</p></div>
                </div>
              </app-talk-content>
            </div>
          </app-topic-detail>
          <div class="comment-container">
            <app-comment-item>
              <div class="comment-item-container">
                <div class="text"><div class="comment">读者甲</div></div>
                <div class="text">读者评论内容。</div>
                <div class="operations"><div class="time">2026-06-24 10:00</div></div>
              </div>
            </app-comment-item>
            <app-comment-item>
              <div class="comment-item-container">
                <div class="text"><div class="comment">星球作者 A</div></div>
                <div class="text">答主回复内容。</div>
                <div class="operations"><div class="time">2026-06-24 10:30</div></div>
              </div>
            </app-comment-item>
          </div>
        </app-topic-detail-page>
      </body>
    </html>`, "https://wx.zsxq.com/dweb2/index/topic_detail/123456");

  assertEqual(data.candidates.length, 1, "详情页应只提取一条主题");
  assertIncludes(data.candidates[0].html, "这是详情页正文", "详情页正文提取失败");
  assertEqual(data.candidates[0].comments.length, 2, "详情页评论数量错误");
  assertEqual(data.candidates[0].comments[1].author, "星球作者 A", "详情页答主评论作者错误");
}

async function testZsxqTitleFromBody() {
  const data = await extractFromHtml(`<!doctype html>
    <html>
      <head><title>创建/管理的星球 - 知识星球</title></head>
      <body>
        <app-topic>
          <div class="topic-container">
            <app-topic-header>
              <div class="header-container">
                <div class="author"><div class="info"><div class="role">南院大王</div></div></div>
              </div>
            </app-topic-header>
            <app-talk-content>
              <div class="talk-content-container">
                <div class="content"><p>谈一谈存储预期差 昨天美光业绩大好，盘后大涨。</p></div>
              </div>
            </app-talk-content>
          </div>
        </app-topic>
      </body>
    </html>`, "https://wx.zsxq.com/group/15284248885222");

  assertEqual(data.title, "谈一谈存储预期差", "知识星球标题应来自正文而不是页面导航");
  assertEqual(data.candidates[0].title, "谈一谈存储预期差", "知识星球候选标题应来自正文");
}

async function extractFromHtml(html, url) {
  const dom = new JSDOM(html, {
    url,
    runScripts: "dangerously"
  });
  dom.window.eval(contentScript);
  return dom.window.__zhihuSaveToObsidianExtract();
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}，实际值：${actual}`);
  }
}

function assertIncludes(actual, expected, message) {
  if (!actual.includes(expected)) {
    throw new Error(`${message}，实际值：${actual}`);
  }
}
