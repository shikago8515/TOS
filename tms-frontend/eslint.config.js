import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'logs/**',
      'node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['src/**/*.{ts,vue}', 'vite.config.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-alert': 'off',
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-unsafe-optional-chaining': 'error',
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: ['src/**/*.test.ts', 'vite.config.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
)
