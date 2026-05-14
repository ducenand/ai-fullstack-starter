import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Quality gates — applied only to hand-written source files
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Cyclomatic complexity ≤ 10
      complexity: ["error", 10],

      // Single file ≤ 600 lines (blank lines and comments excluded)
      "max-lines": [
        "error",
        { max: 600, skipBlankLines: true, skipComments: true },
      ],

      // Nesting depth ≤ 4 — deep nesting hurts readability
      "max-depth": ["error", 4],

      // Long parameter lists → use an options object instead (warn only;
      // component props via destructuring are exempt by design)
      "max-params": ["warn", 4],

      // Magic numbers → extract to named constants
      "no-magic-numbers": [
        "warn",
        {
          ignore: [-1, 0, 1, 2, 100, 1000],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          enforceConst: true,
        },
      ],
    },
  },
];

export default eslintConfig;
