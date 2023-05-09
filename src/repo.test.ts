/* eslint-disable node/no-process-env */

import path from 'path';

import { getRepositoryUrl } from './repo';

describe('getRepositoryUrl', () => {
  it('reads the repository URL from an environment variable', () => {
    process.env.npm_package_repository_url =
      'https://github.com/metamask/auto-changelog';

    expect(getRepositoryUrl()).toBe(
      'https://github.com/metamask/auto-changelog',
    );
  });

  it('reads the repository URL from an environment variable (.git suffix)', () => {
    process.env.npm_package_repository_url =
      'https://github.com/metamask/auto-changelog.git';

    expect(getRepositoryUrl()).toBe(
      'https://github.com/metamask/auto-changelog',
    );
  });

  it('reads the repository URL from the package.json', () => {
    process.env.npm_package_repository_url = '';
    process.env.PROJECT_CWD = path.resolve(__dirname, '..');

    expect(getRepositoryUrl()).toBe(
      'https://github.com/MetaMask/auto-changelog',
    );
  });
});
