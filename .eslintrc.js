module.exports = {
  extends: [
    '@metamask/eslint-config',
    '@metamask/eslint-config/config/nodejs',
  ],

  plugins: [
    'json',
  ],

  overrides: [
    {
      files: [
        '*.test.js',
      ],
      extends: [
        '@metamask/eslint-config/config/jest',
      ],
    },
  ],

  ignorePatterns: [
    '!.eslintrc.js',
  ],
};
