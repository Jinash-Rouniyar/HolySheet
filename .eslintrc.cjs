module.exports = {
  root: true,
  extends: ['react-app', 'react-app/jest'],
  rules: {
    // Treat unused vars as errors (consistent with CI)
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['build', 'node_modules', '*.cjs'],
};
