(function () {
  function extractCurrentPage() {
    if (isWechatPage()) {
      return extractWechatPage();
    }

    if (isCaixinPage()) {
      return extractCaixinPage();
    }

    if (isZsxqPage()) {
      return extractZsxqPage();
    }

    return extractZhihuPage();
  }

  function extractZhihuPage() {
    const title = getFirstText([
      "h1",
      ".QuestionHeader-title",
      ".Post-Title",
      ".ContentItem-title"
    ]);
    const candidates = getContentCandidates();
    const selectedCandidate = candidates[0] || null;
    const author = selectedCandidate ? selectedCandidate.author : getPageAuthor();
    const html = selectedCandidate ? selectedCandidate.html : "";
    const publishedAt = selectedCandidate ? selectedCandidate.publishedAt : getZhihuPublishedAt(document);
    const warnings = [];

    if (!title) {
      warnings.push("未能获取标题，将使用页面标题或默认标题。");
    }

    if (!author) {
      warnings.push("未能获取作者，将保存为未知作者。");
    }

    if (!html) {
      warnings.push("未能获取正文，请确认知乎正文已经加载完成。");
    }

    return {
      source: "zhihu",
      title: title || document.title || "未命名知乎内容",
      author: author || "未知作者",
      url: location.href,
      html,
      publishedAt,
      candidates,
      warnings
    };
  }

  function extractCaixinPage() {
    const title = getMetaContent(["og:title", "twitter:title"]) || getFirstText([
      "h1",
      ".article-title",
      ".articleTit",
      ".title"
    ]);
    const author = getCaixinAuthor();
    const contentElement = getBestCaixinContentElement();
    const html = contentElement ? cleanContentHtml(contentElement) : "";
    const text = contentElement ? normalizeText(contentElement.textContent) : "";
    const publishedAt = getCaixinPublishedAt();
    const warnings = [];

    if (!title) {
      warnings.push("未能获取标题，将使用页面标题或默认标题。");
    }

    if (!author) {
      warnings.push("未能获取作者，将保存为未知作者。");
    }

    if (!html) {
      warnings.push("未能获取正文，请确认财新文章正文已经加载完成。");
    }

    const normalizedTitle = stripCaixinTitle(title || document.title || "未命名财新内容");
    const normalizedAuthor = author || "未知作者";
    const candidates = html ? [{
      id: "article",
      label: buildCandidateLabel(1, normalizedAuthor, text),
      author: normalizedAuthor,
      html,
      textPreview: text.slice(0, 80),
      url: location.href,
      publishedAt
    }] : [];

    return {
      source: "caixin",
      title: normalizedTitle,
      author: normalizedAuthor,
      url: location.href,
      html,
      publishedAt,
      candidates,
      warnings
    };
  }

  function extractWechatPage() {
    const title = getFirstText([
      "#activity-name",
      ".rich_media_title",
      "h1"
    ]) || getMetaContent(["og:title"]);
    const author = getMetaContent(["author"]) || getFirstText([
      "#js_author_name_text",
      "#js_author_name",
      "#js_name",
      ".rich_media_meta_nickname"
    ]);
    const contentElement = getFirstElement([
      "#js_content",
      ".rich_media_content"
    ]);
    const html = contentElement ? cleanContentHtml(contentElement) : "";
    const text = contentElement ? normalizeText(contentElement.textContent) : "";
    const publishedAt = getFirstText([
      "#publish_time"
    ]);
    const warnings = [];

    if (!title) {
      warnings.push("未能获取标题，将使用页面标题或默认标题。");
    }

    if (!author) {
      warnings.push("未能获取作者，将保存为未知作者。");
    }

    if (!html) {
      warnings.push("未能获取正文，请确认微信公众号文章已经加载完成。");
    }

    const normalizedTitle = title || document.title || "未命名微信公众号文章";
    const normalizedAuthor = author || "未知作者";
    const candidates = html ? [{
      id: "article",
      label: buildCandidateLabel(1, normalizedAuthor, text),
      title: normalizedTitle,
      author: normalizedAuthor,
      html,
      textPreview: text.slice(0, 80),
      url: location.href,
      publishedAt
    }] : [];

    return {
      source: "wechat",
      title: normalizedTitle,
      author: normalizedAuthor,
      url: location.href,
      html,
      publishedAt,
      candidates,
      warnings
    };
  }

  function extractZsxqPage() {
    const planet = getZsxqPlanetName();
    const candidates = getZsxqCandidates();
    const selectedCandidate = candidates[0] || null;
    const title = selectedCandidate ? (selectedCandidate.title || getZsxqTitle(selectedCandidate)) : getZsxqTitle(null);
    const author = selectedCandidate ? selectedCandidate.author : getZsxqPageAuthor();
    const html = selectedCandidate ? selectedCandidate.html : "";
    const warnings = [];

    if (!title) {
      warnings.push("未能获取标题，将使用页面标题或默认标题。");
    }

    if (!author) {
      warnings.push("未能获取作者，将保存为未知作者。");
    }

    if (!html) {
      warnings.push("未能获取正文，请确认知识星球内容已经加载完成。");
    }

    if (selectedCandidate && selectedCandidate.comments.length === 0) {
      warnings.push("未读取到评论，保存时将只包含正文。");
    }

    return {
      source: "zsxq",
      title: title || document.title || "未命名知识星球内容",
      author: author || "未知作者",
      url: selectedCandidate ? selectedCandidate.url : location.href,
      planet,
      html,
      candidates,
      warnings
    };
  }

  function getFirstText(selectors) {
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      const match = elements
        .map((element) => normalizeText(element.textContent))
        .find(Boolean);

      if (match) {
        return match;
      }
    }

    return "";
  }

  function getContentCandidates() {
    if (location.hostname === "zhuanlan.zhihu.com") {
      return getArticleCandidates();
    }

    const contentElements = Array.from(document.querySelectorAll(".RichContent-inner, .RichText"));
    const seenContentElements = new Set();
    const seenContainers = new Set();
    const seenTextFingerprints = new Set();
    const candidates = [];

    for (const contentElement of contentElements) {
      if (seenContentElements.has(contentElement)) {
        continue;
      }

      seenContentElements.add(contentElement);

      const html = cleanContentHtml(contentElement);
      const text = normalizeText(contentElement.textContent);

      if (!html || !text) {
        continue;
      }

      const container = contentElement.closest(".AnswerItem, .List-item, .ContentItem") || contentElement.parentElement;

      if (container && seenContainers.has(container)) {
        continue;
      }

      const textFingerprint = getTextFingerprint(text);

      if (seenTextFingerprints.has(textFingerprint)) {
        continue;
      }

      if (container) {
        seenContainers.add(container);
      }

      seenTextFingerprints.add(textFingerprint);

      const author = getContainerAuthor(container) || getPageAuthor() || "未知作者";
      const publishedAt = getZhihuPublishedAt(container);

      candidates.push({
        id: `candidate-${candidates.length + 1}`,
        label: buildCandidateLabel(candidates.length + 1, author, text),
        author,
        html,
        textPreview: text.slice(0, 80),
        url: location.href,
        publishedAt
      });
    }

    return candidates;
  }

  function getArticleCandidates() {
    const contentElement = getFirstElement([
      ".Post-RichTextContainer",
      ".RichContent-inner",
      ".RichText"
    ]);

    if (!contentElement) {
      return [];
    }

    const html = cleanContentHtml(contentElement);
    const text = normalizeText(contentElement.textContent);

    if (!html || !text) {
      return [];
    }

    const author = getPageAuthor() || "未知作者";
    const publishedAt = getZhihuPublishedAt(document);

    return [{
      id: "article",
      label: buildCandidateLabel(1, author, text),
      author,
      html,
      textPreview: text.slice(0, 80),
      url: location.href,
      publishedAt
    }];
  }

  function getFirstElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function getMetaContent(names) {
    for (const name of names) {
      const element = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
      const content = element ? normalizeText(element.getAttribute("content")) : "";

      if (content) {
        return content;
      }
    }

    return "";
  }

  function getZhihuPublishedAt(root) {
    return getFirstDateValue(root, [
      "meta[itemprop='datePublished']",
      "meta[property='article:published_time']",
      "[itemprop='datePublished']",
      "time[datetime]",
      ".ContentItem-time",
      ".AnswerItem-time",
      ".Post-Header .ContentItem-time"
    ]);
  }

  function getCaixinPublishedAt() {
    return getFirstDateValue(document, [
      "meta[property='article:published_time']",
      "meta[name='publishdate']",
      "meta[name='publish_time']",
      "meta[name='pubdate']",
      "time[datetime]",
      ".article-time",
      ".articleInfo",
      ".article-info",
      ".artInfo"
    ]);
  }

  function getFirstDateValue(root, selectors) {
    for (const selector of selectors) {
      const elements = Array.from(root.querySelectorAll(selector));

      for (const element of elements) {
        const value = normalizeText(
          element.getAttribute("content") ||
          element.getAttribute("datetime") ||
          element.textContent
        );
        const match = value.match(/\d{4}(?:年\d{1,2}月\d{1,2}日|[-/.]\d{1,2}[-/.]\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?/);

        if (match) {
          return match[0];
        }
      }
    }

    return "";
  }

  function getCaixinAuthor() {
    const metaAuthor = getMetaContent(["author"]);

    if (metaAuthor) {
      return normalizeCaixinAuthor(metaAuthor);
    }

    const bylineText = getFirstText([
      ".article-time",
      ".articleInfo",
      ".article-info",
      ".artInfo",
      ".source",
      ".author"
    ]);
    const parsedBylineAuthor = parseCaixinAuthor(bylineText);

    if (parsedBylineAuthor) {
      return parsedBylineAuthor;
    }

    return parseCaixinAuthor(document.body ? document.body.innerText.slice(0, 3000) : "");
  }

  function getBestCaixinContentElement() {
    const selectors = [
      "#Main_Content_Val",
      ".article-content",
      ".articleContent",
      ".article-content-l",
      ".articleMain",
      ".articalContent",
      ".content",
      "article"
    ];
    const candidates = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    let bestElement = null;
    let bestScore = 0;

    for (const element of candidates) {
      const paragraphCount = element.querySelectorAll("p").length;
      const textLength = normalizeText(element.textContent).length;
      const score = textLength + paragraphCount * 120;

      if (paragraphCount > 0 && textLength > 30 && score > bestScore) {
        bestElement = element;
        bestScore = score;
      }
    }

    return bestElement;
  }

  function getZsxqCandidates() {
    const containers = getZsxqCandidateContainers();
    const seenContainers = new Set();
    const seenFingerprints = new Set();
    const candidates = [];

    for (const container of containers) {
      if (!container || seenContainers.has(container)) {
        continue;
      }

      const author = getZsxqContainerAuthor(container) || getZsxqPageAuthor() || "未知作者";
      const contentElement = getZsxqMainContentElement(container);

      if (!contentElement) {
        continue;
      }

      const html = cleanZsxqContentHtml(contentElement);
      const text = normalizeText(contentElement.textContent);

      if (!html || (text.length < 1 && !contentElement.querySelector("img"))) {
        continue;
      }

      const fingerprint = getTextFingerprint(text || html);

      if (seenFingerprints.has(fingerprint)) {
        continue;
      }

      seenContainers.add(container);
      seenFingerprints.add(fingerprint);

      const comments = extractZsxqComments(container, author);
      const publishedAt = getZsxqPublishedAt(container);
      const topicUrl = getZsxqTopicUrl(container) || location.href;
      const topicId = getZsxqTopicId(container);

      candidates.push({
        id: `candidate-${candidates.length + 1}`,
        label: buildZsxqCandidateLabel(candidates.length + 1, author, text, comments.length),
        title: getZsxqTitle({ textPreview: text, author, html }),
        author,
        html,
        textPreview: text.slice(0, 80),
        url: topicUrl,
        topicId,
        planet: getZsxqPlanetName(),
        publishedAt,
        comments
      });
    }

    return candidates.slice(0, 20);
  }

  function getZsxqCandidateContainers() {
    if (isZsxqTopicDetailPage()) {
      const detailContainer = getFirstElement([
        "app-topic-detail",
        "#topic-detail-container",
        ".topic-detail",
        ".topic-detail-page",
        "app-topic-detail-page"
      ]);

      if (detailContainer) {
        return [detailContainer];
      }

      return [];
    }

    const selectors = [
      "app-topic",
      ".topic-container",
      ".digest-topic-item",
      ".topic-item",
      ".topicItem"
    ];
    const mainRoot = document.querySelector("app-main-content, main, [role='main'], #app") || document;
    const containers = selectors.flatMap((selector) => Array.from(mainRoot.querySelectorAll(selector)));

    if (containers.length > 0) {
      return dedupeNestedElements(containers);
    }

    return [];
  }

  function getZsxqMainContentElement(container) {
    const answerContainer = container.querySelector("app-answer-content .answer-content-container");

    if (answerContainer) {
      return buildZsxqAnswerContent(answerContainer);
    }

    const questionContainer = container.querySelector("app-question-content .question-content-container");

    if (questionContainer) {
      return questionContainer;
    }

    const contentSelectors = [
      "app-talk-content .talk-content-container .content",
      "app-talk-content .content",
      ".talk-content-container .content",
      "app-note-content .content",
      "app-task-content .content",
      ".digest-topic-item .topic-content",
      ".topic-content",
      ".content-text"
    ];

    for (const selector of contentSelectors) {
      const element = container.querySelector(selector);
      const textLength = element ? normalizeText(element.textContent).length : 0;

      if (element && (textLength >= 1 || element.querySelector("img"))) {
        return element;
      }
    }

    const scoped = container.cloneNode(true);
    removeZsxqNoiseNodes(scoped);
    removeZsxqCommentNodes(scoped);

    const paragraphs = Array.from(scoped.querySelectorAll("p")).filter((element) => normalizeText(element.textContent).length >= 1);

    if (paragraphs.length > 0) {
      const wrapper = document.createElement("div");

      for (const paragraph of paragraphs) {
        wrapper.appendChild(paragraph.cloneNode(true));
      }

      return wrapper;
    }

    return normalizeText(scoped.textContent).length >= 1 || scoped.querySelector("img") ? scoped : null;
  }

  function buildZsxqAnswerContent(answerContainer) {
    const wrapper = document.createElement("div");
    const questionPart = answerContainer.querySelector(".question");
    const answerPart = answerContainer.querySelector(".answer");

    if (questionPart) {
      const questionWrapper = document.createElement("div");
      questionWrapper.innerHTML = "<h3>问题</h3>";
      questionWrapper.appendChild(questionPart.cloneNode(true));
      wrapper.appendChild(questionWrapper);
    }

    if (answerPart) {
      const answerWrapper = document.createElement("div");
      answerWrapper.innerHTML = "<h3>回答</h3>";
      answerWrapper.appendChild(answerPart.cloneNode(true));
      wrapper.appendChild(answerWrapper);
    }

    return wrapper.childNodes.length > 0 ? wrapper : answerContainer;
  }

  function extractZsxqComments(container, topicAuthor) {
    const commentItems = collectZsxqCommentElements(container);
    const seenFingerprints = new Set();
    const comments = [];

    for (const item of commentItems) {
      const parsed = parseZsxqCommentElement(item, topicAuthor);

      if (!parsed) {
        continue;
      }

      const fingerprint = getTextFingerprint(`${parsed.author}|${parsed.time}|${parsed.text}`);

      if (seenFingerprints.has(fingerprint)) {
        continue;
      }

      seenFingerprints.add(fingerprint);
      comments.push(parsed);
    }

    return comments.slice(0, 200);
  }

  function collectZsxqCommentElements(container) {
    const itemSelectors = [
      "app-comment-item",
      ".comment-item-container",
      ".main-comment-item"
    ];
    const roots = [
      ...container.querySelectorAll(".comment-box, .comment-container, .icon-comment")
    ];

    if (isZsxqTopicDetailPage()) {
      const detailRoot = document.querySelector("app-topic-detail-page, app-topic-detail, .topic-detail-page") || document;

      for (const element of detailRoot.querySelectorAll(".comment-container, .comment-box")) {
        if (!container.contains(element)) {
          roots.push(element);
        }
      }
    }

    const items = [];

    if (roots.length > 0) {
      for (const root of dedupeNestedElements(roots)) {
        for (const selector of itemSelectors) {
          items.push(...root.querySelectorAll(selector));
        }
      }
    }

    if (items.length === 0) {
      for (const selector of itemSelectors) {
        items.push(...container.querySelectorAll(selector));
      }
    }

    return dedupeNestedElements(items.filter(Boolean));
  }

  function parseZsxqCommentElement(element, topicAuthor) {
    if (!element) {
      return null;
    }

    const author = getFirstTextIn(element, [
      ".comment-item-container > .text .comment",
      ".comment-item-container .comment",
      ".main-comment-item .comment",
      ".comment"
    ]) || "未知评论者";
    const time = getFirstTextIn(element, [
      ".operations .time",
      ".comment-item-container .time",
      ".time"
    ]);
    const contentElement = getBestZsxqCommentContentElement(element);
    const clone = contentElement.cloneNode(true);
    removeZsxqNoiseNodes(clone);
    const html = clone.innerHTML.trim();
    const text = normalizeText(clone.textContent);

    if (!text || text.length < 1) {
      return null;
    }

    if (topicAuthor && isSameZsxqAuthor(author, topicAuthor) && text.length > 2000 && !element.matches("app-comment-item, .comment-item-container, .main-comment-item")) {
      return null;
    }

    return {
      author,
      time,
      html: html || `<p>${text}</p>`,
      text
    };
  }

  function getBestZsxqCommentContentElement(element) {
    const candidates = Array.from(element.querySelectorAll(".text, .comment-content, .reply-content"));
    let bestElement = null;
    let bestLength = 0;

    for (const candidate of candidates) {
      if (candidate.querySelector(".comment")) {
        continue;
      }

      const textLength = normalizeText(candidate.textContent).length;

      if (textLength > bestLength) {
        bestElement = candidate;
        bestLength = textLength;
      }
    }

    return bestElement || element;
  }

  function cleanZsxqContentHtml(element) {
    const clone = normalizeZsxqContentElement(element);
    return clone.innerHTML.trim();
  }

  function normalizeZsxqContentElement(element) {
    const clone = element.cloneNode(true);
    removeZsxqNoiseNodes(clone);
    removeZsxqCommentNodes(clone);
    unwrapZsxqCustomTags(clone);
    normalizeImageSources(clone);

    if (!clone.querySelector("p, li, h1, h2, h3, h4, blockquote, pre")) {
      const wrapper = document.createElement("div");

      for (const paragraph of formatZsxqPlainTextToParagraphs(clone.textContent || "")) {
        const node = document.createElement("p");
        node.textContent = paragraph;
        wrapper.appendChild(node);
      }

      return wrapper.childNodes.length > 0 ? wrapper : clone;
    }

    return clone;
  }

  function unwrapZsxqCustomTags(root) {
    for (const element of root.querySelectorAll("e, [class*='watermark']")) {
      const replacement = document.createElement("span");
      replacement.textContent = normalizeText(element.textContent);
      element.replaceWith(replacement);
    }
  }

  function formatZsxqPlainTextToParagraphs(text) {
    const normalized = normalizeText(text)
      .replace(/知识星球([\u4e00-\u9fa5A-Za-z0-9·]+)/g, "$1")
      .replace(/\s+-\s*/g, "\n\n- ")
      .replace(/([。！？])\s+/g, "$1\n\n");

    return normalized
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }

  function getZsxqTopicId(container) {
    const scope = container || document;
    const link = scope.querySelector("a[href*='topic_detail/'], a[href*='/topic/']");

    if (link && link.href) {
      const match = link.href.match(/topic(?:_detail)?\/(\d+)/);

      if (match) {
        return match[1];
      }
    }

    const detailsLink = scope.querySelector(".details-container, [class*='details-container']");

    if (detailsLink) {
      const onclick = detailsLink.getAttribute("onclick") || "";
      const match = onclick.match(/topic(?:_detail)?\/(\d+)/) || String(detailsLink.textContent || "").match(/(\d{10,})/);

      if (match) {
        return match[1];
      }
    }

    return getZsxqTopicIdFromUrl();
  }

  function getZsxqTopicIdFromUrl() {
    const match = location.pathname.match(/topic(?:_detail)?\/(\d+)/);
    return match ? match[1] : "";
  }

  function removeZsxqNoiseNodes(root) {
    for (const selector of [
      "script",
      "style",
      "iframe",
      "app-topic-header",
      "app-topic-operation",
      ".related",
      ".recommend",
      ".share-wrapper",
      ".share-topic",
      ".advertisement",
      ".ad",
      ".like-container",
      ".like-user",
      ".operation-icon-container",
      ".operation-icon",
      ".moreComment",
      ".comment-input",
      ".reply-input",
      ".header-container",
      ".skeleton-container",
      ".enter-group",
      ".details-container",
      ".showAll",
      ".showAllQuestion",
      ".ellipsis"
    ]) {
      for (const node of root.querySelectorAll(selector)) {
        node.remove();
      }
    }
  }

  function removeZsxqCommentNodes(root) {
    for (const selector of [
      "app-comment-item",
      ".comment-box",
      ".comment-container",
      ".icon-comment",
      ".comment-item-container",
      ".main-comment-item",
      ".comment-list",
      ".reply-list"
    ]) {
      for (const node of root.querySelectorAll(selector)) {
        node.remove();
      }
    }
  }

  function getZsxqPlanetName() {
    return getFirstText([
      ".group-name",
      ".group-info-card-group-name",
      ".groupName",
      ".planet-name",
      ".header-title",
      ".nav-title"
    ]) || stripZsxqTitle(document.title).split(/[-_｜|]/)[0].trim();
  }

  function getZsxqPublishedAt(container) {
    return getFirstTextIn(container, [
      "app-topic-header .date",
      ".header-container .date",
      ".modify-time",
      ".date",
      ".time"
    ]);
  }

  function getZsxqTopicUrl(container) {
    const topicId = getZsxqTopicId(container);

    if (topicId) {
      return `https://wx.zsxq.com/dweb2/index/topic_detail/${topicId}`;
    }

    const link = container.querySelector("a[href*='topic_detail']");

    if (link && link.href) {
      return link.href;
    }

    if (isZsxqTopicDetailPage()) {
      return location.href;
    }

    return "";
  }

  function isZsxqTopicDetailPage() {
    return /\/topic_detail\//.test(location.pathname);
  }

  function buildZsxqCandidateLabel(index, author, text, commentCount) {
    const preview = text.slice(0, 36);
    const commentSuffix = commentCount > 0 ? `（${commentCount} 条评论）` : "";
    return `${index}. ${author || "未知作者"}：${preview}${text.length > 36 ? "..." : ""}${commentSuffix}`;
  }

  function isSameZsxqAuthor(left, right) {
    return normalizeZsxqAuthorName(left) === normalizeZsxqAuthorName(right);
  }

  function normalizeZsxqAuthorName(value) {
    return normalizeText(value).replace(/\s+/g, "").toLowerCase();
  }

  function getFirstElementIn(root, selectors) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function dedupeNestedElements(elements) {
    const uniqueElements = [];

    for (const element of elements) {
      if (uniqueElements.some((existing) => existing.contains(element))) {
        continue;
      }

      if (uniqueElements.some((existing) => element.contains(existing))) {
        continue;
      }

      uniqueElements.push(element);
    }

    return uniqueElements;
  }

  function cleanContentHtml(element) {
    const clone = element.cloneNode(true);

    for (const selector of [
      "script",
      "style",
      "iframe",
      ".related",
      ".recommend",
      ".share",
      ".advertisement",
      ".ad"
    ]) {
      for (const node of clone.querySelectorAll(selector)) {
        node.remove();
      }
    }

    normalizeImageSources(clone);
    return clone.innerHTML.trim();
  }

  function normalizeImageSources(root) {
    for (const image of root.querySelectorAll("img")) {
      const source = [
        "data-src",
        "data-original",
        "data-actualsrc",
        "data-lazy-src",
        "src"
      ]
        .map((attribute) => image.getAttribute(attribute))
        .find((value) => value && !value.startsWith("data:") && !value.startsWith("blob:"));

      if (!source) {
        continue;
      }

      try {
        image.setAttribute("src", new URL(source, location.href).href);
      } catch (error) {
        image.setAttribute("src", source);
      }

      image.removeAttribute("srcset");
      image.removeAttribute("data-src");
      image.removeAttribute("data-original");
      image.removeAttribute("data-actualsrc");
      image.removeAttribute("data-lazy-src");
    }
  }

  function getPageAuthor() {
    return getFirstText([
      ".AuthorInfo-name",
      ".Post-Author .UserLink-link",
      ".UserLink-link",
      ".ContentItem-meta .AuthorInfo-head"
    ]);
  }

  function getContainerAuthor(container) {
    if (!container) {
      return "";
    }

    return getFirstTextIn(container, [
      ".AuthorInfo-name",
      ".UserLink-link",
      ".ContentItem-meta .AuthorInfo-head",
      "[itemprop='name']"
    ]);
  }

  function getFirstTextIn(root, selectors) {
    for (const selector of selectors) {
      const elements = Array.from(root.querySelectorAll(selector));
      const match = elements
        .map((element) => normalizeText(element.textContent))
        .find(Boolean);

      if (match) {
        return match;
      }
    }

    return "";
  }

  function getZsxqPageAuthor() {
    return getFirstText([
      "app-topic-header .role",
      ".header-container .author .role",
      ".user-name",
      ".username",
      ".author-name",
      ".nickname"
    ]);
  }

  function getZsxqContainerAuthor(container) {
    if (!container) {
      return "";
    }

    return getFirstTextIn(container, [
      "app-topic-header .role",
      ".header-container .author .role",
      ".question-content-container .owner",
      ".answer-content-container .question-owner",
      ".owner",
      ".name",
      ".user-name",
      ".username",
      ".author-name",
      ".nickname"
    ]);
  }

  function getZsxqTitle(candidate) {
    if (candidate && candidate.textPreview) {
      const titleFromBody = extractZsxqTitleFromText(candidate.textPreview);

      if (titleFromBody) {
        return titleFromBody;
      }
    }

    const explicitTitle = getFirstText([
      "h1",
      ".title",
      ".topic-title",
      ".post-title"
    ]);

    if (explicitTitle && !isGenericZsxqTitle(explicitTitle)) {
      return stripZsxqTitle(explicitTitle);
    }

    if (candidate && candidate.textPreview) {
      return stripZsxqTitle(candidate.textPreview.slice(0, 42));
    }

    const pageTitle = stripZsxqTitle(document.title || "");
    return isGenericZsxqTitle(pageTitle) ? "未命名知识星球内容" : pageTitle;
  }

  function extractZsxqTitleFromText(text) {
    const normalized = normalizeText(text);
    const patterns = [
      /^(.{4,30}?)\s+昨天/u,
      /^(.{4,30}?)\s+今天/u,
      /^(.{4,30}?)\s+昨晚/u,
      /^(.{4,40}?)\s+(?:我们|那么|另外|如果|觉得|继续|进一步)/u,
      /^(.{4,42})/u
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);

      if (match && match[1]) {
        const title = stripZsxqTitle(match[1]);

        if (!isGenericZsxqTitle(title)) {
          return title;
        }
      }
    }

    return "";
  }

  function isGenericZsxqTitle(value) {
    const title = stripZsxqTitle(value);
    const genericTitles = [
      /^创建[\/／]管理的星球$/,
      /^我加入的星球$/,
      /^知识星球$/,
      /^最新$/,
      /^精华$/,
      /^问答$/,
      /^作业$/,
      /^星球$/
    ];

    return !title || genericTitles.some((pattern) => pattern.test(title));
  }

  function stripZsxqTitle(value) {
    return normalizeText(value)
      .replace(/[-_｜|].*?知识星球.*$/, "")
      .replace(/^知识星球\s*/, "")
      .trim();
  }

  function buildCandidateLabel(index, author, text) {
    const preview = text.slice(0, 36);
    return `${index}. ${author || "未知作者"}：${preview}${text.length > 36 ? "..." : ""}`;
  }

  function normalizeText(value) {
    return value ? value.replace(/\s+/g, " ").trim() : "";
  }

  function getTextFingerprint(text) {
    return text.replace(/\s+/g, "").slice(0, 500);
  }

  function isCaixinPage() {
    return /(^|\.)caixin\.com$/.test(location.hostname);
  }

  function isWechatPage() {
    return location.hostname === "mp.weixin.qq.com";
  }

  function isZsxqPage() {
    return /(^|\.)zsxq\.com$/.test(location.hostname);
  }

  function stripCaixinTitle(value) {
    return normalizeText(value).replace(/[_-].*?财新网.*$/, "").trim();
  }

  function parseCaixinAuthor(value) {
    const text = normalizeText(value);

    if (!text) {
      return "";
    }

    const authorMatch = text.match(/作者[：:]\s*([^责任编辑|｜\n]{1,60})/);

    if (authorMatch) {
      return normalizeCaixinAuthor(authorMatch[1]);
    }

    const bylineMatch = text.match(/文[｜|]\s*财新\s*([^0-9\n]{1,80})/);

    if (bylineMatch) {
      return normalizeCaixinAuthor(bylineMatch[1]);
    }

    return "";
  }

  function normalizeCaixinAuthor(value) {
    return normalizeText(value)
      .replace(/^财新\s*/, "")
      .replace(/\s*责任编辑.*$/, "")
      .replace(/\s*\d{4}.*$/, "")
      .replace(/发自[^，,、\s]+/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*[，,]\s*/g, "，")
      .trim();
  }

  globalThis.__zhihuSaveToObsidianExtract = extractCurrentPage;

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message) {
        return false;
      }

      if (!["EXTRACT_PAGE", "EXTRACT_ZHIHU_PAGE"].includes(message.type)) {
        return false;
      }

      sendResponse(extractCurrentPage());
      return false;
    });
  }
}());
