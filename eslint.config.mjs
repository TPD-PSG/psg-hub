import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Plain Node scripts and helpers are CommonJS on purpose (run by node at start-up, before Next)
  { files: ["**/*.js", "**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  // Each test file exports one anonymous runner by design
  { files: ["tests/**"], rules: { "import/no-anonymous-default-export": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code worktrees and scratch copies of the app (audit round 2: these were most of the noise)
    ".claude/**",
  ]),
]);

export default eslintConfig;
