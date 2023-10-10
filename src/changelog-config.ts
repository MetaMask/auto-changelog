/* eslint-disable node/no-process-env, node/no-sync */

import fs from 'fs';
import path from 'path';

type PackageJson = {
  autoChangelog: {
    packageRename: {
      originalLastestVersion: string;
      originalTagPrefix: string;
    };
  };
};

/**
 * Returns the latest version of the original package in case of package renamed.
 *
 * @returns The latest version string of the original package, or null.
 */
export function getOriginalLatestVersion(): string | null {
  // Set automatically by Yarn 3.x
  const packageJsonPath = process.env.npm_package_json;
  if (packageJsonPath) {
    const packageJson = path.resolve(packageJsonPath);
    const packageJsonContent = JSON.parse(
      fs.readFileSync(packageJson, 'utf8'),
    ) as PackageJson;

    if (
      typeof packageJsonContent.autoChangelog?.packageRename
        ?.originalLastestVersion === 'string'
    ) {
      return packageJsonContent.autoChangelog.packageRename
        .originalLastestVersion;
    }
  }

  return null;
}

/**
 * Returns the original package tag prefix in case of package renamed.
 *
 * @returns The original package tag prefix.
 */
export function getOriginalTagPrefix(): string | null {
  // Set automatically by Yarn 3.x
  const packageJsonPath = process.env.npm_package_json;
  if (packageJsonPath) {
    const packageJson = path.resolve(packageJsonPath);
    const packageJsonContent = JSON.parse(
      fs.readFileSync(packageJson, 'utf8'),
    ) as PackageJson;
    if (
      typeof packageJsonContent.autoChangelog?.packageRename
        ?.originalTagPrefix === 'string'
    ) {
      return packageJsonContent.autoChangelog.packageRename.originalTagPrefix;
    }
  }

  return null;
}
