import prettierPlugin from 'eslint-plugin-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintPluginJsonc from 'eslint-plugin-jsonc';

export default defineConfig([
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error', // enables Prettier
    },
  },
  globalIgnores(['node_modules']),
  ...eslintPluginJsonc.configs['flat/recommended-with-jsonc'],
]);
