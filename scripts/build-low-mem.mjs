/**
 * 低内存、单核友好的 Next.js 生产构建。
 * 面向 RAM < 1GB、CPU 1 核的服务器：限制堆大小与并行度，换取更慢但更稳定的构建。
 *
 * 用法：npm run build:low-mem
 */
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules/next/dist/bin/next");

/** @param {string | undefined} existing */
function mergeNodeOptions(existing) {
  const additions = ["--max-old-space-size=512", "--max-semi-space-size=32"];
  const parts = (existing ?? "").split(/\s+/).filter(Boolean);
  for (const opt of additions) {
    const key = opt.split("=")[0];
    if (!parts.some((p) => p.startsWith(key))) {
      parts.push(opt);
    }
  }
  return parts.join(" ");
}

const env = {
  ...process.env,
  UNIID_LOW_MEM_BUILD: "1",
  NODE_OPTIONS: mergeNodeOptions(process.env.NODE_OPTIONS),
  UV_THREADPOOL_SIZE: "1",
  NEXT_TELEMETRY_DISABLED: "1",
  GENERATE_SOURCEMAP: "false",
};

/**
 * @param {string[]} args
 * @returns {Promise<void>}
 */
function runNext(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, ...args], {
      cwd: root,
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`next ${args.join(" ")} exited with code ${code}`));
    });
  });
}

console.log("[build:low-mem] 低内存单核模式：堆上限 512MB，UV 线程池=1，禁用 source map");
console.log("[build:low-mem] 跳过构建期 ESLint 与 TypeScript 检查（请在资源充足时单独执行 lint / typecheck）");
console.log("[build:low-mem] 构建会明显变慢，适合 RAM < 1GB 的服务器");

await runNext(["build", "--no-lint"]);
