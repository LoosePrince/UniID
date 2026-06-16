/**
 * 组装 GitHub Pages 发布目录：sdk/ UMD 产物 + releases/*.tgz（版本变动时）。
 * 在仓库根目录执行：node scripts/prepare-sdk-pages.mjs
 *
 * 环境变量：
 *   PAGES_OUT        输出目录，默认 ./_site
 *   PAGES_PREV       已有 gh-pages 检出目录（可选），用于保留历史 releases
 *   PACK_ON_VERSION  设为 "1" 时，在 sdk-core 版本相对上一提交变动时执行 npm pack
 *   FORCE_OVERWRITE  设为 "1" 时，强制重新 npm pack 并覆盖当前版本 tarball
 *   PAGES_BASE_PATH  GitHub Pages 项目路径前缀，默认 /UniID/（用于 404 回退页链接）
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

function normalizeBasePath(raw) {
  const trimmed = (raw ?? "/UniID/").trim();
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function listPublishedFiles(siteDir) {
  const sections = [];
  for (const dir of ["sdk", "releases"]) {
    const abs = path.join(siteDir, dir);
    if (!fs.existsSync(abs)) continue;
    const files = fs
      .readdirSync(abs)
      .filter((name) => fs.statSync(path.join(abs, name)).isFile())
      .sort();
    if (files.length > 0) {
      sections.push({
        dir,
        files: files.map((name) => {
          const filePath = path.join(abs, name);
          const stat = fs.statSync(filePath);
          return { name, size: stat.size, href: `${dir}/${name}` };
        })
      });
    }
  }
  return sections;
}

function renderPagesIndex(siteDir, basePath) {
  const sections = listPublishedFiles(siteDir);
  const sdkVersion = readSdkVersion();
  const generatedAt = new Date().toISOString();

  const sectionHtml = sections
    .map(({ dir, files }) => {
      const title = dir === "sdk" ? "浏览器 UMD" : "npm 安装包 (.tgz)";
      const rows = files
        .map(
          ({ name, size, href }) =>
            `<tr><td><a href="${href}"><code>${href}</code></a></td><td>${formatBytes(size)}</td></tr>`
        )
        .join("\n");
      return `<section>
  <h2>${title}</h2>
  <table>
    <thead><tr><th>文件</th><th>大小</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
    })
    .join("\n");

  const umdSnippet = `<script src="${basePath}sdk/uniid.umd.js"><\/script>`;
  const tgzSnippet =
    sections
      .find((s) => s.dir === "releases")
      ?.files.map((f) => `"@uniid/sdk": "${basePath}${f.href}"`)
      .join("\n") ?? `"@uniid/sdk": "${basePath}releases/uniid-sdk-${sdkVersion}.tgz"`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UniID SDK — GitHub Pages</title>
  <base href="${basePath}">
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, sans-serif; line-height: 1.5; max-width: 52rem; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.1rem; margin-top: 2rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid #ccc5; }
    code, pre { font-family: ui-monospace, monospace; font-size: 0.9em; }
    pre { overflow-x: auto; padding: 0.75rem 1rem; border-radius: 6px; background: #8882; }
    .meta { color: #888; font-size: 0.9rem; }
    a { color: inherit; }
  </style>
</head>
<body>
  <h1>UniID SDK 发布文件</h1>
  <p class="meta">当前 SDK 版本 <strong>${sdkVersion}</strong> · 生成于 ${generatedAt}</p>
  <p>访问不存在的路径时，GitHub Pages 会回退到此页面并列出所有可下载文件。</p>
${sectionHtml || "<p>暂无发布文件。</p>"}
  <h2>引用示例</h2>
  <p>浏览器 UMD：</p>
  <pre>${umdSnippet}</pre>
  <p>package.json 依赖（tarball URL）：</p>
  <pre>${tgzSnippet}</pre>
</body>
</html>
`;
}

function writePagesIndex(siteDir) {
  const basePath = normalizeBasePath(process.env.PAGES_BASE_PATH);
  const html = renderPagesIndex(siteDir, basePath);
  for (const name of ["index.html", "404.html"]) {
    fs.writeFileSync(path.join(siteDir, name), html);
    console.log("[prepare-sdk-pages]", name);
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
writePagesIndex(outDir);
console.log("[prepare-sdk-pages] 输出目录:", path.relative(root, outDir));
