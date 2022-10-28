module.exports = {
  root: true,

  extends: ['@metamask/eslint-config', '@metamask/eslint-config-nodejs'],

  overrides: [
    {
      files: ['*.ts'],
      extends: ['@metamask/eslint-config-typescript'],
      rules: {
        // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/34960
        'node/prefer-global/url': 'off',
      },
    },
    {
      files: ['*.test.js', '*.test.ts'],
      extends: ['@metamask/eslint-config-jest'],
    },
    {
      files: ['src/cli.ts'],
      rules: {
        'node/shebang': 'off',
      },
    },
  ],

  ignorePatterns: ['!.eslintrc.js', 'dist'],
};
