/* eslint-disable node/no-process-env, node/no-sync */

import fs from 'fs';
import path from 'path';

type PackageJson = {
  repository:
    | string
    | {
        url: string;
      };
};

/**
 * Return the current project repository URL.
 *
 * @returns The repository URL.
 */
export function getRepositoryUrl(): string | null {
  // Set automatically by NPM or Yarn 1.x
  const npmPackageRepositoryUrl = process.env.npm_package_repository_url;
  if (npmPackageRepositoryUrl) {
    return npmPackageRepositoryUrl.replace(/\.git$/u, '');
  }

  // Set automatically by Yarn 3.x
  const projectCwd = process.env.PROJECT_CWD;
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

/**
 * Extract the owner and repository name from a GitHub repository URL.
 *
 * Supports HTTPS and SSH GitHub URLs and removes any trailing .git; throws if parsing fails.
 *
 * @param repoUrl - The full GitHub repository URL (e.g., https://github.com/owner/repo or git@github.com:owner/repo).
 * @returns An object containing the owner and repo name.
 * @throws If the URL cannot be parsed.
 */
export function getOwnerAndRepoFromUrl(repoUrl: string): {
  owner: string;
  repo: string;
} {
  const match = repoUrl.match(
    /github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/]+)$/iu,
  );

  if (!match?.groups) {
    throw new Error(`Cannot parse owner/repo from repoUrl: ${repoUrl}`);
  }

  return { owner: match.groups.owner, repo: match.groups.repo };
}
