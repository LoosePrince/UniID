/**
 * 将 SDK UMD 构建产物复制到 demo 与 Next public 静态目录。
 * 在仓库根目录执行：node scripts/copy-sdk-umd.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "packages/sdk-core/dist/uniid.umd.js");
const targets = [
  path.join(root, "demo/sdk/uniid.umd.js"),
  path.join(root, "public/sdk/uniid.umd.js")
];

if (!fs.existsSync(src)) {
  console.error(
    "[copy-sdk-umd] 未找到构建产物，请先执行: npm run sdk:build:core\n  期望文件:",
    src
  );
  process.exit(1);
}

for (const dest of targets) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("[copy-sdk-umd]", path.relative(root, dest));
}
