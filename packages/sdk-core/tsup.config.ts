import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(pkgRoot, "src/index.ts");
const OUT = path.join(pkgRoot, "dist");
const TSCONFIG = path.join(pkgRoot, "tsconfig.json");

export default defineConfig([
  {
    entry: { index: SRC },
    outDir: OUT,
    format: ["esm", "cjs"],
    dts: { resolve: true, entry: SRC, compilerOptions: { incremental: false } },
    sourcemap: true,
    clean: true,
    tsconfig: TSCONFIG,
    target: "es2020"
  },
  {
    entry: { uniid: path.join(pkgRoot, "src/umd-entry.ts") },
    outDir: OUT,
    format: ["iife"],
    globalName: "UniID",
    sourcemap: true,
    minify: true,
    tsconfig: TSCONFIG,
    target: "es2018",
    outExtension() {
      return { js: ".umd.js" };
    },
    footer: {
      js: 'UniID = typeof UniID === "function" ? UniID : UniID.default;'
    }
  }
]);
