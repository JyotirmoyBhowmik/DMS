module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parserOptions: {
    project: ['./tsconfig.base.json', './packages/*/tsconfig.json', './services/*/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  env: {
    node: true,
    es2022: true
  },
  rules: {
    'no-console': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { "argsIgnorePattern": "^_" }],
    '@typescript-eslint/no-floating-promises': 'error',
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name=/logger|log/i][callee.property.name=/info|debug|warn|error|log/i] Identifier[name=/email|phone|password|pan|aadhaar|ssn|cvv|card|gstin/i]",
        message: "Do not pass unredacted PII variables directly to logger calls. Use the redact() helper or pass redacted/masked fields instead."
      }
    ]
  }
};
