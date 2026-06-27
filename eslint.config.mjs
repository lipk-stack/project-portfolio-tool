// Flat ESLint config (ESLint 9) for the Portia monorepo.
// Lints application source only (server/src + client/src); build output, config
// files, and scripts are excluded so the lint stays fast and signal-rich.
//
// Philosophy (YAGNI): catch real correctness/maintainability problems as ERRORS,
// surface stylistic/`any` concerns as WARNINGS so they never block CI but are
// visible in editors. Formatting is owned by Prettier, not ESLint.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'server/public/**',
      'data/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // `any` is sometimes pragmatic in this codebase (third-party payloads,
      // SQLite rows); flag it for visibility but don't fail the build.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow intentionally-unused args/vars prefixed with `_`.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // `declare global { namespace Express { ... } }` is the canonical way to
      // augment Express's Request type — allow it in ambient declarations.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    },
  },

  // Server: Node runtime.
  {
    files: ['server/src/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Client: browser runtime + React rules.
  {
    files: ['client/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Test files: relax a few rules that are normal in tests.
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
