import nextPlugin from "eslint-config-next";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: ["node_modules", ".next"]
  },
  ...nextPlugin
];

export default config;

