import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),

  // Build/config files run in NODE, not the browser. Linting them with only
  // browser globals reported `__dirname` in vite.config.js as an undefined
  // variable — a false positive about the one file that is definitionally not
  // browser code. See CLAUDE.md DEP-09.
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },

  {
    files: ['**/*.{js,jsx}'],
    ignores: ['*.config.js'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { react },
    rules: {
      // ⚠️ REQUIRED FOR CORRECTNESS, not style. Without this rule ESLint does
      // not count a LOCALLY-SCOPED binding used as a JSX element name as a
      // usage, so `const Row = ({ icon: Icon }) => <Icon />` reports
      // "'Icon' is defined but never used" — and deleting it, as the error
      // instructs, removes a rendered element. Module-scope imports were
      // already counted; local bindings were not. See CLAUDE.md DEP-09.
      'react/jsx-uses-vars': 'error',

      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],

      // Lets a module export a component ALONGSIDE constant values without
      // failing Fast Refresh — the shadcn/ui convention.
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true },
      ],
    },
  },

  // Fast Refresh exemptions. This is a DEVELOPER-EXPERIENCE rule — its only
  // consequence is a full page reload instead of a hot update while editing.
  // Nothing ships differently. Both exemptions are deliberate; the rule stays
  // on everywhere else.
  //
  // (a) Vendored shadcn/ui primitives — `export { Button, buttonVariants }` is
  //     how they ship upstream, and restructuring makes every future shadcn
  //     update a manual merge.
  // (b) ToastContext and the RecentOrders column definitions, which pair a
  //     component with a hook or with the non-component `columns` array.
  {
    files: [
      'src/components/ui/**',
      'src/ToastContext.jsx',
      'src/components/RecentOrders/Columns.jsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
