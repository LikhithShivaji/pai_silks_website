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
      // usage, so `const NavItem = ({ icon: Icon }) => <Icon />` reported
      // "'Icon' is defined but never used" — and deleting it, as the error
      // instructs, blanks every icon in the profile menu.
      //
      // Confirmed with a minimal reproduction: `Icon` used only as `<Icon />`
      // was flagged, while an imported `Footer` used only as `<Footer />` was
      // not. Module-scope imports were already counted; local bindings were not.
      // See CLAUDE.md DEP-09.
      'react/jsx-uses-vars': 'error',

      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],

      // `allowConstantExport` lets a module export a component ALONGSIDE
      // constant values without failing the Fast Refresh rule. This is the
      // shadcn/ui convention — `export { Button, buttonVariants }` — so without
      // it every vendored primitive is a lint error for following the
      // convention it shipped with, not for any defect.
      //
      // It does NOT silence the rule for React contexts or hooks: those still
      // report, and are handled per-file where the split is genuinely wanted.
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true },
      ],
    },
  },

  // --- Fast Refresh exemptions -------------------------------------------
  //
  // `react-refresh/only-export-components` is a DEVELOPER-EXPERIENCE rule, not
  // a correctness one. Its only consequence is that editing a file which
  // exports both a component and something else triggers a full page reload
  // instead of a state-preserving hot update. Nothing ships differently.
  //
  // Both exemptions below are deliberate decisions, not blanket silencing —
  // the rule stays ON everywhere else.

  // (a) Vendored shadcn/ui primitives. `export { Button, buttonVariants }` and
  //     `export { useFormField, Form, ... }` are how these components ship from
  //     upstream. `allowConstantExport` does not cover them because
  //     `buttonVariants` is a cva() call rather than a literal. Restructuring
  //     them would diverge from upstream and make every future shadcn update a
  //     manual merge, to remove a hot-reload nicety from files nobody edits.
  {
    files: ['src/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // (b) Our three React contexts, which each export a provider component
  //     alongside their hook or context object.
  //
  //     The "proper" fix is to split the hook and the context into their own
  //     files. That is a real improvement and worth doing when there is room to
  //     test it — but CartContext alone is imported by 17 files, so it is churn
  //     across the app for a hot-reload benefit, and it was judged not worth
  //     the regression risk immediately before handover. Recorded so the next
  //     person knows it is an accepted trade-off, not an oversight.
  {
    files: ['src/AuthContext.jsx', 'src/CartContext.jsx', 'src/ToastContext.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
