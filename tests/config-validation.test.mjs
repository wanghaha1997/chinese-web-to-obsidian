import assert from "node:assert/strict";
import path from "node:path";

import { getTargetDir, normalizeConfig } from "../server/index.js";

const config = normalizeConfig({
  vaultPath: "/Users/ray/Documents/My Vault",
  saveFolder: "网页收藏/"
});

assert.deepEqual(config, {
  vaultPath: "/Users/ray/Documents/My Vault",
  saveFolder: "网页收藏",
  sourceFolders: {
    zhihu: "知乎",
    caixin: "财新",
    zsxq: "知识星球",
    wechat: "微信公众号"
  }
});
assert.equal(
  getTargetDir(config),
  path.join("/Users/ray/Documents/My Vault", "网页收藏")
);
assert.equal(
  getTargetDir(config, "zhihu"),
  path.join("/Users/ray/Documents/My Vault", "知乎")
);

const sourceConfig = normalizeConfig({
  vaultPath: "/Users/ray/Documents/My Vault",
  saveFolder: "网页收藏",
  sourceFolders: {
    zhihu: "内容/知乎",
    caixin: "内容/财新",
    zsxq: "内容/知识星球/",
    wechat: "内容/微信公众号"
  }
});

assert.equal(
  getTargetDir(sourceConfig, "zhihu"),
  path.join("/Users/ray/Documents/My Vault", "内容/知乎")
);
assert.equal(
  getTargetDir(sourceConfig, "caixin"),
  path.join("/Users/ray/Documents/My Vault", "内容/财新")
);
assert.equal(
  getTargetDir(sourceConfig, "zsxq"),
  path.join("/Users/ray/Documents/My Vault", "内容/知识星球")
);
assert.equal(
  getTargetDir(sourceConfig, "wechat"),
  path.join("/Users/ray/Documents/My Vault", "内容/微信公众号")
);

assert.throws(
  () => normalizeConfig({ vaultPath: "Documents/Vault", saveFolder: "网页收藏" }),
  /vaultPath 必须是绝对路径/
);
assert.throws(
  () => normalizeConfig({ vaultPath: "/Users/ray/Documents/Vault", saveFolder: "../其他目录" }),
  /saveFolder 只能是 Vault 内的相对目录/
);
assert.throws(
  () => normalizeConfig({ vaultPath: "/Users/ray/Documents/Vault", saveFolder: "/tmp" }),
  /saveFolder 只能是 Vault 内的相对目录/
);
assert.throws(
  () => normalizeConfig({
    vaultPath: "/Users/ray/Documents/Vault",
    saveFolder: "网页收藏",
    sourceFolders: {
      zhihu: "../知乎",
      caixin: "财新",
      zsxq: "知识星球",
      wechat: "微信公众号"
    }
  }),
  /sourceFolders.zhihu 只能是 Vault 内的相对目录/
);

console.log("config validation tests passed");
