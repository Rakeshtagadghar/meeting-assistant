import baseConfig from "@ainotes/config/eslint-base";

export default [
  ...baseConfig,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {},
  },
];
