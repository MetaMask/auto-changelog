/* eslint-disable node/no-process-env, node/no-sync */

import path from 'path';
import fs from 'fs';

interface PackageJson {
  repository:
    | string
    | {
        url: string;
      };
}

export function getRepositoryUrl(): string | null {
  // Set automatically by NPM or Yarn 1.x
  const npmPackageRepositoryUrl = process.env.npm_package_repository_url;
  if (npmPackageRepositoryUrl) {
    return npmPackageRepositoryUrl.replace(/\.git$/u, '');
  }

  // Set automatically by Yarn 3.x
  const projectCwd = process.env.PROJECT_CWD;

  console.log(projectCwd);

  if (projectCwd) {
    const packageJson = path.resolve(projectCwd, 'package.json');
    const packageJsonContent = JSON.parse(
      fs.readFileSync(packageJson, 'utf8'),
    ) as PackageJson;

    if (typeof packageJsonContent.repository === 'string') {
      return packageJsonContent.repository.replace(/\.git$/u, '');
    }

    if (typeof packageJsonContent.repository?.url === 'string') {
      return packageJsonContent.repository.url.replace(/\.git$/u, '');
    }
  }

  return null;
}
