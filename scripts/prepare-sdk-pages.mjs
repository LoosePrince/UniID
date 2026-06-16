/**
 * 组装 GitHub Pages 发布目录：sdk/ UMD 产物 + releases/*.tgz（版本变动时）。
 * 在仓库根目录执行：node scripts/prepare-sdk-pages.mjs
 *
 * 环境变量：
 *   PAGES_OUT        输出目录，默认 ./_site
 *   PAGES_PREV       已有 gh-pages 检出目录（可选），用于保留历史 releases
 *   PACK_ON_VERSION  设为 "1" 时，在 sdk-core 版本相对上一提交变动时执行 npm pack
 *   FORCE_OVERWRITE  设为 "1" 时，强制重新 npm pack 并覆盖当前版本 tarball
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.resolve(root, process.env.PAGES_OUT ?? "_site");
const prevDir = process.env.PAGES_PREV
  ? path.resolve(root, process.env.PAGES_PREV)
  : null;

const distDir = path.join(root, "packages/sdk-core/dist");
const umdFiles = ["uniid.umd.js", "uniid.umd.js.map"];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function readSdkVersion() {
  const pkgPath = path.join(root, "packages/sdk-core/package.json");
  return JSON.parse(fs.readFileSync(pkgPath, "utf8")).version;
}

function sdkVersionChanged() {
  try {
    const current = readSdkVersion();
    const prevRaw = execSync("git show HEAD~1:packages/sdk-core/package.json", {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    const prev = JSON.parse(prevRaw).version;
    return current !== prev;
  } catch {
    return true;
  }
}

function ensureUmdBuilt() {
  const missing = umdFiles.filter((f) => !fs.existsSync(path.join(distDir, f)));
  if (missing.length > 0) {
    console.error(
      "[prepare-sdk-pages] 缺少 SDK 构建产物，请先执行 npm run sdk:build:core\n  缺失:",
      missing.join(", ")
    );
    process.exit(1);
  }
}

ensureUmdBuilt();

if (prevDir && fs.existsSync(prevDir)) {
  copyDir(prevDir, outDir);
  console.log("[prepare-sdk-pages] 已合并已有 Pages 内容:", path.relative(root, prevDir));
}

const sdkOut = path.join(outDir, "sdk");
fs.mkdirSync(sdkOut, { recursive: true });
for (const file of umdFiles) {
  const dest = path.join(sdkOut, file);
  fs.copyFileSync(path.join(distDir, file), dest);
  console.log("[prepare-sdk-pages] sdk/", file);
}

const version = readSdkVersion();
const tarballName = `uniid-sdk-${version}.tgz`;
const releasesOut = path.join(outDir, "releases");
const existingTarball = path.join(releasesOut, tarballName);
const forceOverwrite = process.env.FORCE_OVERWRITE === "1";
const shouldPack =
  process.env.PACK_ON_VERSION === "1" &&
  (forceOverwrite || sdkVersionChanged() || !fs.existsSync(existingTarball));

if (shouldPack) {
  fs.mkdirSync(releasesOut, { recursive: true });
  if (forceOverwrite && fs.existsSync(existingTarball)) {
    fs.unlinkSync(existingTarball);
    console.log("[prepare-sdk-pages] 已删除旧 tarball，准备覆盖:", tarballName);
  }
  const sdkCoreDir = path.join(root, "packages/sdk-core");
  execSync(`npm pack --pack-destination "${releasesOut}"`, {
    cwd: sdkCoreDir,
    stdio: "inherit"
  });
  const packed = path.join(releasesOut, tarballName);
  if (!fs.existsSync(packed)) {
    console.error("[prepare-sdk-pages] npm pack 未生成预期文件:", tarballName);
    process.exit(1);
  }
  console.log("[prepare-sdk-pages] releases/", tarballName);
} else if (process.env.PACK_ON_VERSION === "1") {
  console.log("[prepare-sdk-pages] sdk-core 版本未变动，跳过 npm pack（可用 FORCE_OVERWRITE=1 强制覆盖）");
}

fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
console.log("[prepare-sdk-pages] 输出目录:", path.relative(root, outDir));
