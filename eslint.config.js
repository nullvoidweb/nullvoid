import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["src/vendor/**", "dist/**", ".cache/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-control-regex": "off",
      "no-misleading-character-class": "off",
      "no-new-func": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "smart"],
    },
  },
  {
    files: ["src/content/**/*.js"],
    languageOptions: { sourceType: "script" },
  },
  {
    // Callbacks passed to page.evaluate()/sw.evaluate() run in the browser.
    files: ["tests/e2e/**/*.js"],
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
