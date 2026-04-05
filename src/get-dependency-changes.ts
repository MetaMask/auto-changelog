import path from 'path';

import type { DependencyBump } from './changelog';
import { runCommand } from './run-command';

/**
 * Thrown when the base ref cannot be auto-detected, typically because
 * the current branch IS the base branch or the remote is unreachable.
 */
export class BaseRefNotFoundError extends Error {
  constructor(reason: string) {
    super(`Could not auto-detect git reference: ${reason}`);
  }
}

/**
 * Gets the content of a file at a specific git reference.
 *
 * @param filePath - Repo-relative path to the file.
 * @param ref - Git reference (e.g., commit SHA, branch name, tag).
 * @param projectRoot - Working directory for the command.
 * @returns The file content, or null if the file doesn't exist at that ref.
 */
async function getFileAtRef(
  filePath: string,
  ref: string,
  projectRoot: string,
): Promise<string | null> {
  try {
    return await runCommand('git', ['show', `${ref}:${filePath}`], {
      cwd: projectRoot,
    });
  } catch {
    return null;
  }
}

/**
 * Gets the cwd-relative path for a file, suitable for use with git commands
 * run from `projectRoot`.
 *
 * @param absolutePath - Absolute path to the file.
 * @param projectRoot - Working directory for git commands.
 * @returns The relative path (e.g., `./package.json`).
 */
function getRelativePath(absolutePath: string, projectRoot: string): string {
  return `./${path.relative(projectRoot, absolutePath)}`;
}

/**
 * Minimal type for the parts of package.json we care about.
 */
type PackageJson = {
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

/**
 * Result of checking for dependency changes in a package.
 */
export type DependencyCheckResult = {
  /** Dependency changes detected. */
  dependencyChanges: DependencyBump[];
  /** PR numbers extracted from commit history for the changed file. */
  prNumbers: string[];
  /** Whether the package's own version changed between the two refs. */
  versionChanged: boolean;
};

/**
 * Find dependency changes between two package.json objects.
 * Only examines 'dependencies' and 'peerDependencies' — devDependencies
 * and optionalDependencies are excluded.
 *
 * Note: Only version *changes* are detected. Newly added dependencies
 * (not present in oldPkg) and removed dependencies (not present in newPkg)
 * are intentionally ignored, as changelog entries are only needed for bumps.
 *
 * @param oldPkg - The old package.json content.
 * @param newPkg - The new package.json content.
 * @returns Array of dependency changes found.
 */
function findDependencyChangesBetweenPackageManifests(
  oldPkg: PackageJson,
  newPkg: PackageJson,
): DependencyBump[] {
  const dependencyChanges: DependencyBump[] = [];
  const sections: ('dependencies' | 'peerDependencies')[] = [
    'dependencies',
    'peerDependencies',
  ];

  for (const section of sections) {
    const oldDeps = oldPkg[section] ?? {};
    const newDeps = newPkg[section] ?? {};

    for (const [dep, newVersion] of Object.entries(newDeps)) {
      const oldVersion = oldDeps[dep];
      if (oldVersion !== undefined && oldVersion !== newVersion) {
        dependencyChanges.push({
          dependency: dep,
          isBreaking: section === 'peerDependencies',
          oldVersion,
          newVersion,
        });
      }
    }
  }

  return dependencyChanges;
}

/**
 * Extracts PR numbers from commit subjects in a range for a given file.
 *
 * @param filePath - Repo-relative path to the file.
 * @param fromRef - Starting git reference.
 * @param toRef - Ending git reference.
 * @param projectRoot - Working directory for the git command.
 * @returns Deduplicated array of PR number strings.
 */
async function getPrNumbersForFileChanges(
  filePath: string,
  fromRef: string,
  toRef: string,
  projectRoot: string,
): Promise<string[]> {
  try {
    const log = await runCommand(
      'git',
      ['log', '--format=%s', `${fromRef}..${toRef}`, '--', filePath],
      { cwd: projectRoot },
    );
    if (!log) {
      return [];
    }
    const prNumbers: string[] = [];
    for (const line of log.split('\n')) {
      const matches = line.matchAll(/\(#(\d+)\)/gu);
      for (const match of matches) {
        prNumbers.push(match[1]);
      }
    }
    return [...new Set(prNumbers)];
  } catch {
    return [];
  }
}

/**
 * Options for getting dependency changes for a single package.
 */
type GetDependencyChangesOptions = {
  /** Path to the package.json file. */
  manifestPath: string;
  /** Starting git reference (optional, auto-detects from merge base if not provided). */
  fromRef?: string;
  /** Ending git reference. */
  toRef?: string;
  /** Remote name for auto-detection (defaults to 'origin'). */
  remote?: string;
  /**
   * Base branch reference for auto-detection (defaults to '<remote>/main').
   * Only used when `fromRef` is not provided, to compute the merge base.
   *
   * For stacked PRs (branch created off another feature branch), set this
   * to the parent branch so that only the current branch's dependency
   * changes are detected.
   */
  baseBranch?: string;
};

/**
 * Get dependency changes for a single package by comparing package.json
 * at two git references using `git show`.
 *
 * @param options - Options.
 * @param options.manifestPath - Path to the package.json file.
 * @param options.fromRef - Starting git reference (auto-detects if not provided).
 * @param options.toRef - Ending git reference (defaults to HEAD).
 * @param options.remote - Remote name for auto-detection.
 * @param options.baseBranch - Base branch for auto-detection (only used when
 * fromRef is not provided). For stacked PRs, set this to the parent branch.
 * @returns Dependency check result.
 * @throws {BaseRefNotFoundError} If the base ref cannot be auto-detected.
 */
export async function getDependencyChanges({
  manifestPath,
  fromRef,
  toRef = 'HEAD',
  remote = 'origin',
  baseBranch = `${remote}/main`,
}: GetDependencyChangesOptions): Promise<DependencyCheckResult> {
  const workingDir = path.dirname(manifestPath);
  let actualFromRef = fromRef;

  // Auto-detect fromRef using merge-base against baseBranch.
  // Note: for stacked PRs (branch off a branch), the merge-base with main
  // includes changes from the parent branch. Use --baseBranch to point to
  // the parent branch in that case.
  if (!actualFromRef) {
    // Compare HEAD SHA to base branch SHA (avoids "main" vs "origin/main" bug)
    try {
      const headSha = await runCommand('git', ['rev-parse', 'HEAD'], {
        cwd: workingDir,
      });
      const baseSha = await runCommand('git', ['rev-parse', baseBranch], {
        cwd: workingDir,
      });

      if (headSha === baseSha) {
        throw new BaseRefNotFoundError(
          'HEAD is the same as the base branch',
        );
      }
    } catch (error) {
      if (error instanceof BaseRefNotFoundError) {
        throw error;
      }
      throw new BaseRefNotFoundError(
        `could not resolve base branch '${baseBranch}'`,
      );
    }

    try {
      actualFromRef = await runCommand(
        'git',
        ['merge-base', 'HEAD', baseBranch],
        { cwd: workingDir },
      );
    } catch {
      throw new BaseRefNotFoundError(
        `could not find merge base with '${baseBranch}'`,
      );
    }
  }

  // Get cwd-relative path for git show
  const relativePath = getRelativePath(manifestPath, workingDir);

  // Get file contents at both refs
  const oldContent = await getFileAtRef(
    relativePath,
    actualFromRef,
    workingDir,
  );
  if (oldContent === null) {
    // New package — no previous version to compare against
    return { dependencyChanges: [], prNumbers: [], versionChanged: true };
  }

  const newContent = await getFileAtRef(relativePath, toRef, workingDir);
  if (newContent === null) {
    throw new Error(`Could not read ${relativePath} at ref ${toRef}`);
  }

  let oldPkg: PackageJson;
  let newPkg: PackageJson;
  try {
    oldPkg = JSON.parse(oldContent);
  } catch {
    throw new Error(
      `Could not parse ${relativePath} at ref ${actualFromRef} as JSON`,
    );
  }
  try {
    newPkg = JSON.parse(newContent);
  } catch {
    throw new Error(`Could not parse ${relativePath} at ref ${toRef} as JSON`);
  }

  const dependencyChanges = findDependencyChangesBetweenPackageManifests(
    oldPkg,
    newPkg,
  );

  // Get PR numbers from commit history
  const prNumbers = await getPrNumbersForFileChanges(
    relativePath,
    actualFromRef,
    toRef,
    workingDir,
  );

  const versionChanged = oldPkg.version !== newPkg.version;

  return { dependencyChanges, prNumbers, versionChanged };
}
