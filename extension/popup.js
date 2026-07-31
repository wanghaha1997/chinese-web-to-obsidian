const SERVICE_BASE_URL = "http://127.0.0.1:3721";
const SAVE_URL = `${SERVICE_BASE_URL}/save`;
const CONFIG_URL = `${SERVICE_BASE_URL}/config`;
const SELECT_FOLDER_URL = `${SERVICE_BASE_URL}/select-folder`;
const ALL_CANDIDATES_ID = "__all_candidates__";
const titleElement = document.getElementById("title");
const authorElement = document.getElementById("author");
const urlElement = document.getElementById("url");
const statusElement = document.getElementById("status");
const saveButton = document.getElementById("save");
const chooseVaultButton = document.getElementById("chooseVault");
const saveConfigButton = document.getElementById("saveConfig");
const candidateField = document.getElementById("candidateField");
const candidateSelect = document.getElementById("candidate");
const commentField = document.getElementById("commentField");
const commentModeSelect = document.getElementById("commentMode");
const vaultPathInput = document.getElementById("vaultPath");
const saveFolderInput = document.getElementById("saveFolder");
const zhihuFolderInput = document.getElementById("zhihuFolder");
const caixinFolderInput = document.getElementById("caixinFolder");
const zsxqFolderInput = document.getElementById("zsxqFolder");
const wechatFolderInput = document.getElementById("wechatFolder");
const targetDirElement = document.getElementById("targetDir");
let pageData = null;
let selectedCandidate = null;
let currentConfig = null;

document.addEventListener("DOMContentLoaded", init);
saveButton.addEventListener("click", saveToObsidian);
chooseVaultButton.addEventListener("click", chooseVaultFolder);
saveConfigButton.addEventListener("click", saveConfig);
candidateSelect.addEventListener("change", selectCandidate);
commentModeSelect.addEventListener("change", updateCommentStatus);

async function init() {
  try {
    loadConfig();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error("未找到当前标签页。");
    }

    setStatus("正在读取页面内容...");
    const data = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE" });
    pageData = data;
    selectedCandidate = getInitialCandidate(data);
    renderPageData(data);
    renderCandidateOptions(data);
    renderCommentOptions(data);
    updateTargetDirDisplay();

    if (!selectedCandidate || !selectedCandidate.html) {
      setStatus("未能读取正文，暂时不能保存。", "error");
      return;
    }

    const warningText = data.warnings && data.warnings.length ? `\n${data.warnings.join("\n")}` : "";
    const candidateText = data.candidates && data.candidates.length > 1 ? `已找到 ${data.candidates.length} 段可保存内容，可以选择单条或全部保存。` : "已读取页面内容，可以保存。";
    setStatus(`${candidateText}${getCommentStatusSuffix()}${warningText}`);
    saveButton.disabled = false;
  } catch (error) {
    pageData = null;
    selectedCandidate = null;
    titleElement.textContent = "未能读取";
    authorElement.textContent = "未能读取";
    urlElement.textContent = "未能读取";
    saveButton.disabled = true;
    setStatus(`读取失败：${error.message}\n请确认当前标签页是知乎、财新、知识星球或微信公众号的受支持页面。`, "error");
  }
}

async function saveToObsidian() {
  const candidatesToSave = getCandidatesToSave();

  if (!pageData || candidatesToSave.length === 0) {
    setStatus("没有可保存的正文内容。", "error");
    return;
  }

  saveButton.disabled = true;
  setStatus(candidatesToSave.length > 1 ? `正在保存 1/${candidatesToSave.length}...` : "正在保存...");

  try {
    const savedResults = [];

    for (let index = 0; index < candidatesToSave.length; index += 1) {
      if (candidatesToSave.length > 1) {
        setStatus(`正在保存 ${index + 1}/${candidatesToSave.length}...`);
      }

      const result = await saveCandidateToObsidian(candidatesToSave[index]);
      savedResults.push(result);
    }

    const savedPaths = savedResults.map((result) => result.path);
    const imageSummary = getSavedImageSummary(savedResults);

    if (savedPaths.length === 1) {
      setStatus(`保存成功：${savedPaths[0]}${imageSummary}`, "success");
    } else {
      setStatus(`保存成功：${savedPaths.length} 条\n最后保存：${savedPaths[savedPaths.length - 1]}${imageSummary}`, "success");
    }

    saveButton.disabled = false;
  } catch (error) {
    setStatus(`保存失败：${error.message}\n请确认 Node.js 服务已经启动。`, "error");
    saveButton.disabled = false;
  }
}

function getSavedImageSummary(results) {
  const downloaded = results.reduce((total, result) => total + (result.images?.downloaded || 0), 0);
  const failed = results.reduce((total, result) => total + (result.images?.failed || 0), 0);

  if (downloaded === 0 && failed === 0) {
    return "";
  }

  const failedText = failed > 0 ? `，${failed} 张保留原链接` : "";
  return `\n图片：本地保存 ${downloaded} 张${failedText}`;
}

async function saveCandidateToObsidian(saveCandidate) {
  const saveTitle = getCandidateTitle(pageData, saveCandidate);
  const comments = filterComments(saveCandidate.comments || [], commentModeSelect.value, saveCandidate.author);
  const response = await fetch(SAVE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      source: pageData.source,
      title: saveTitle,
      author: saveCandidate.author || pageData.author,
      url: saveCandidate.url || pageData.url,
      html: saveCandidate.html,
      comments,
      planet: pageData.planet || saveCandidate.planet || "",
      publishedAt: saveCandidate.publishedAt || pageData.publishedAt || "",
      savedAt: new Date().toISOString()
    })
  });
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.error || `保存失败：${saveTitle}`);
  }

  return result;
}

async function loadConfig() {
  try {
    const response = await fetch(CONFIG_URL);
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "读取保存目录失败");
    }

    renderConfig(result.config);
  } catch (error) {
    targetDirElement.textContent = "未连接本地服务";
  }
}

async function chooseVaultFolder() {
  chooseVaultButton.disabled = true;
  setStatus("正在打开文件夹选择窗口...");

  try {
    const response = await fetch(SELECT_FOLDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        saveFolder: saveFolderInput.value.trim(),
        sourceFolders: getSourceFoldersFromInputs()
      })
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "选择文件夹失败");
    }

    renderConfig(result.config);
    setStatus(`保存目录已更新：${result.config.targetDir}`, "success");
  } catch (error) {
    setStatus(`选择文件夹失败：${error.message}\n请确认 Node.js 服务已经启动。`, "error");
  } finally {
    chooseVaultButton.disabled = false;
  }
}

async function saveConfig() {
  const vaultPath = vaultPathInput.value.trim();
  const saveFolder = saveFolderInput.value.trim();
  const sourceFolders = getSourceFoldersFromInputs();

  if (!vaultPath || !saveFolder || !sourceFolders.zhihu || !sourceFolders.caixin || !sourceFolders.zsxq || !sourceFolders.wechat) {
    setStatus("请填写 Vault 路径、Vault 内文件夹，以及四个来源的保存文件夹。", "error");
    return;
  }

  saveConfigButton.disabled = true;
  setStatus("正在更新保存目录...");

  try {
    const response = await fetch(CONFIG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        vaultPath,
        saveFolder,
        sourceFolders
      })
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "更新保存目录失败");
    }

    renderConfig(result.config);
    setStatus(`保存目录已更新：${result.config.targetDir}`, "success");
  } catch (error) {
    setStatus(`保存目录更新失败：${error.message}\n请确认 Node.js 服务已经启动，并检查路径是否正确。`, "error");
  } finally {
    saveConfigButton.disabled = false;
  }
}

function renderConfig(config) {
  currentConfig = config;
  vaultPathInput.value = config.vaultPath || "";
  saveFolderInput.value = config.saveFolder || "";
  zhihuFolderInput.value = config.sourceFolders?.zhihu || "知乎";
  caixinFolderInput.value = config.sourceFolders?.caixin || "财新";
  zsxqFolderInput.value = config.sourceFolders?.zsxq || "知识星球";
  wechatFolderInput.value = config.sourceFolders?.wechat || "微信公众号";
  updateTargetDirDisplay();
}

function updateTargetDirDisplay() {
  if (!currentConfig) {
    return;
  }

  const source = pageData && pageData.source;
  const targetDir = source && currentConfig.targetDirs?.[source]
    ? currentConfig.targetDirs[source]
    : currentConfig.targetDir;

  targetDirElement.textContent = targetDir || "未设置";
}

function getSourceFoldersFromInputs() {
  return {
    zhihu: zhihuFolderInput.value.trim(),
    caixin: caixinFolderInput.value.trim(),
    zsxq: zsxqFolderInput.value.trim(),
    wechat: wechatFolderInput.value.trim()
  };
}

function renderPageData(data) {
  if (isAllCandidatesSelected()) {
    titleElement.textContent = `${data.title || "当前页面"}（全部 ${getAvailableCandidates(data).length} 条）`;
    authorElement.textContent = "全部作者";
    urlElement.textContent = data.url || "未能获取链接";
    return;
  }

  titleElement.textContent = getCandidateTitle(data, selectedCandidate) || "未能获取标题";
  authorElement.textContent = selectedCandidate && selectedCandidate.author ? selectedCandidate.author : data.author || "未能获取作者";
  urlElement.textContent = (selectedCandidate && selectedCandidate.url) || data.url || "未能获取链接";
}

function getCandidateTitle(data, candidate) {
  if (candidate && candidate.title) {
    return candidate.title;
  }

  if (data.source === "zsxq" && candidate && candidate.textPreview) {
    return candidate.textPreview.slice(0, 42);
  }

  return data.title || "";
}

function renderCandidateOptions(data) {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];

  candidateSelect.textContent = "";

  if (candidates.length <= 1) {
    candidateField.classList.add("hidden");
    return;
  }

  const allOption = document.createElement("option");
  allOption.value = ALL_CANDIDATES_ID;
  allOption.textContent = `全部保存（${getAvailableCandidates(data).length} 条）`;
  candidateSelect.appendChild(allOption);

  for (const candidate of candidates) {
    const option = document.createElement("option");
    option.value = candidate.id;
    option.textContent = candidate.label || candidate.author || candidate.id;
    candidateSelect.appendChild(option);
  }

  candidateSelect.value = selectedCandidate ? selectedCandidate.id : candidates[0].id;
  candidateField.classList.remove("hidden");
}

function selectCandidate() {
  if (!pageData || !Array.isArray(pageData.candidates)) {
    return;
  }

  if (candidateSelect.value === ALL_CANDIDATES_ID) {
    selectedCandidate = null;
    renderPageData(pageData);
    saveButton.disabled = getAvailableCandidates(pageData).length === 0;
    setStatus(`已选择全部 ${getAvailableCandidates(pageData).length} 条内容，点击后会逐条保存。${getCommentStatusSuffix()}`);
    return;
  }

  selectedCandidate = pageData.candidates.find((candidate) => candidate.id === candidateSelect.value) || getInitialCandidate(pageData);
  renderPageData(pageData);

  if (!selectedCandidate || !selectedCandidate.html) {
    saveButton.disabled = true;
    setStatus("当前选择没有可保存的正文内容。", "error");
    return;
  }

  saveButton.disabled = false;
  setStatus(`已切换保存内容，可以保存。${getCommentStatusSuffix()}`);
}

function renderCommentOptions(data) {
  if (data.source !== "zsxq") {
    commentField.classList.add("hidden");
    return;
  }

  commentField.classList.remove("hidden");
  commentModeSelect.value = "none";
}

function updateCommentStatus() {
  if (getCandidatesToSave().length === 0) {
    return;
  }

  setStatus(`已更新评论范围，可以保存。${getCommentStatusSuffix()}`);
}

function getCommentStatusSuffix() {
  if (!pageData || pageData.source !== "zsxq") {
    return "";
  }

  const candidates = getCandidatesToSave();
  const comments = candidates.flatMap((candidate) => Array.isArray(candidate.comments) ? candidate.comments : []);
  const filtered = candidates.flatMap((candidate) => filterComments(candidate.comments || [], commentModeSelect.value, candidate.author));

  if (comments.length === 0) {
    return "\n当前页面未读取到已显示评论。";
  }

  if (commentModeSelect.value === "none") {
    return `\n已读取到 ${comments.length} 条页面已显示评论，本次不会保存评论。`;
  }

  if (commentModeSelect.value === "author") {
    return `\n将保存 ${filtered.length}/${comments.length} 条页面已显示的答主回复。`;
  }

  return `\n将保存 ${filtered.length} 条页面已显示评论。`;
}

function filterComments(comments, commentMode, topicAuthor) {
  if (commentMode === "none") {
    return [];
  }

  if (commentMode === "author") {
    return comments.filter((comment) => isSameAuthor(comment.author, topicAuthor));
  }

  return comments;
}

function isSameAuthor(left, right) {
  return normalizeAuthorName(left) === normalizeAuthorName(right);
}

function normalizeAuthorName(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function getInitialCandidate(data) {
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    return data.candidates[0];
  }

  if (data.html) {
    return {
      id: "current",
      label: data.author || "当前正文",
      author: data.author,
      html: data.html,
      url: data.url
    };
  }

  return null;
}

function getCandidatesToSave() {
  if (!pageData) {
    return [];
  }

  if (isAllCandidatesSelected()) {
    return getAvailableCandidates(pageData);
  }

  return selectedCandidate && selectedCandidate.html ? [selectedCandidate] : [];
}

function getAvailableCandidates(data) {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  return candidates.filter((candidate) => candidate && candidate.html);
}

function isAllCandidatesSelected() {
  return candidateSelect.value === ALL_CANDIDATES_ID;
}

function setStatus(message, type) {
  statusElement.textContent = message;
  statusElement.className = type || "";
}
