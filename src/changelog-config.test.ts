import fs from 'fs';
import path from 'path';

import {
  getOriginalLatestVersion,
  getOriginalTagPrefix,
} from './changelog-config';

const packageJson = {
  autoChangelog: {
    packageRename: {
      originalLastestVersion: '1.0.0',
      originalTagPrefix: 'test-package',
    },
  },
};

describe('getOriginalLatestVersion', () => {
  it('reads the original latest version from an package.json', () => {
    jest.spyOn(path, 'resolve').mockReturnValue('/fakepath');
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(packageJson));
    expect(getOriginalLatestVersion()).toBe('1.0.0');
  });

  it('returns null when there is no org latest version in the package.json', () => {
    jest.spyOn(path, 'resolve').mockReturnValue('/fakepath');
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{}');
    expect(getOriginalLatestVersion()).toBeNull();
  });
});

describe('getOriginalTagPrefix', () => {
  it('reads the original tag prefix from an package.json', () => {
    jest.spyOn(path, 'resolve').mockReturnValue('/fakepath');
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(packageJson));
    expect(getOriginalTagPrefix()).toBe('test-package');
  });

  it('returns null when there is no tag prefix in the package.json', () => {
    jest.spyOn(path, 'resolve').mockReturnValue('/fakepath');
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{}');
    expect(getOriginalTagPrefix()).toBeNull();
  });
});
