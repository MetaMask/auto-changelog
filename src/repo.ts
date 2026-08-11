/* eslint-disable node/no-process-env, node/no-sync */

import fs from 'fs';
import path from 'path';

type PackageJson = {
  repository?:
    | string
    | {
        url?: string;
      };
};

/**
 * Read the `repository` field from a `package.json` file and normalize it to a
 * URL string, stripping any trailing `.git`.
 *
 * @param packageJsonPath - The path to the `package.json` file.
 * @returns The repository URL, or `null` if the file cannot be read or has no
 * usable `repository` field.
 */
function readRepositoryUrlFromPackageJson(
  packageJsonPath: string,
): string | null {
  let packageJsonContent: PackageJson;
  try {
    packageJsonContent = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    ) as PackageJson;
  } catch {
    return null;
  }

  const { repository } = packageJsonContent;

  if (typeof repository === 'string') {
    return repository.replace(/\.git$/u, '');
  }

  if (typeof repository?.url === 'string') {
    return repository.url.replace(/\.git$/u, '');
  }

  return null;
}

/**
 * Find the nearest `package.json` at or above the given directory.
 *
 * Walks up the directory tree from `startDirectory` to the filesystem root,
 * returning the path of the first `package.json` that exists.
 *
 * @param startDirectory - The directory to start searching from.
 * @returns The path to the nearest `package.json`, or `null` if none is found.
 */
export function findNearestPackageJson(
  startDirectory: string = process.cwd(),
): string | null {
  let directory = path.resolve(startDirectory);

  for (;;) {
    const packageJsonPath = path.join(directory, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return packageJsonPath;
    }

    const parent = path.dirname(directory);
    if (parent === directory) {
      // Reached the filesystem root.
      return null;
    }
    directory = parent;
  }
}

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
    const repositoryUrl = readRepositoryUrlFromPackageJson(
      path.resolve(projectCwd, 'package.json'),
    );
    if (repositoryUrl) {
      return repositoryUrl;
    }
  }

  // When run directly (not through an npm/yarn script) neither env var above
  // is set, so fall back to the nearest `package.json` at or above the current
  // working directory.
  const packageJsonPath = findNearestPackageJson();
  if (packageJsonPath) {
    return readRepositoryUrlFromPackageJson(packageJsonPath);
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
