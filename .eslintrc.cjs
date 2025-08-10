/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: ["./tsconfig.json"],
    },
    extends: ["next/core-web-vitals"],
    rules: {
        // Keep linting minimal for MVP
    },
};
