/* eslint-disable node/no-process-env */

import path from 'path';

import { findNearestPackageJson, getRepositoryUrl } from './repo';

describe('getRepositoryUrl', () => {
  const originalNpmPackageRepositoryUrl =
    process.env.npm_package_repository_url;
  const originalProjectCwd = process.env.PROJECT_CWD;

  afterEach(() => {
    if (originalNpmPackageRepositoryUrl === undefined) {
      delete process.env.npm_package_repository_url;
    } else {
      process.env.npm_package_repository_url = originalNpmPackageRepositoryUrl;
    }
    if (originalProjectCwd === undefined) {
      delete process.env.PROJECT_CWD;
    } else {
      process.env.PROJECT_CWD = originalProjectCwd;
    }
    jest.restoreAllMocks();
  });

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

  it('falls back to the package.json in the current working directory when no env var is set', () => {
    delete process.env.npm_package_repository_url;
    delete process.env.PROJECT_CWD;
    // The auto-changelog project root, which has a `repository` field.
    jest.spyOn(process, 'cwd').mockReturnValue(path.resolve(__dirname, '..'));

    expect(getRepositoryUrl()).toBe(
      'https://github.com/MetaMask/auto-changelog',
    );
  });

  it('walks up from the current working directory to find the nearest package.json', () => {
    delete process.env.npm_package_repository_url;
    delete process.env.PROJECT_CWD;
    // A nested directory that has no package.json of its own; the search must
    // walk up to the project root.
    jest.spyOn(process, 'cwd').mockReturnValue(__dirname);

    expect(getRepositoryUrl()).toBe(
      'https://github.com/MetaMask/auto-changelog',
    );
  });
});

describe('findNearestPackageJson', () => {
  const projectRoot = path.resolve(__dirname, '..');

  it('finds the package.json in the given directory', () => {
    expect(findNearestPackageJson(projectRoot)).toBe(
      path.join(projectRoot, 'package.json'),
    );
  });

  it('walks up to the nearest package.json from a nested directory', () => {
    // `__dirname` (the `src` directory) has no package.json of its own.
    expect(findNearestPackageJson(__dirname)).toBe(
      path.join(projectRoot, 'package.json'),
    );
  });

  it('defaults to the current working directory', () => {
    jest.spyOn(process, 'cwd').mockReturnValue(__dirname);

    expect(findNearestPackageJson()).toBe(
      path.join(projectRoot, 'package.json'),
    );

    jest.restoreAllMocks();
  });

  it('returns null when no package.json exists up to the filesystem root', () => {
    expect(findNearestPackageJson(path.parse(process.cwd()).root)).toBeNull();
  });
});
