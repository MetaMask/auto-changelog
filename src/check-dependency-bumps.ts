import execa from 'execa';
import path from 'path';

import type { DependencyChange } from './dependency-types';

/**
 * Runs a command and returns its stdout.
 *
 * @param command - The command to run.
 * @param args - Arguments to pass to the command.
 * @param projectRoot - Working directory for the command.
 * @returns The stdout output.
 */
async function getStdoutFromCommand(
  command: string,
  args: string[],
  projectRoot: string,
): Promise<string> {
  return (await execa(command, args, { cwd: projectRoot })).stdout;
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
    return await getStdoutFromCommand(
      'git',
      ['show', `${ref}:${filePath}`],
      projectRoot,
    );
  } catch {
    return null;
  }
}

/**
 * Gets the repo-relative path for a file.
 *
 * @param absolutePath - Absolute path to the file.
 * @param projectRoot - Working directory for the git command.
 * @returns The repo-relative path.
 */
async function getRepoRelativePath(
  absolutePath: string,
  projectRoot: string,
): Promise<string> {
  const topLevel = await getStdoutFromCommand(
    'git',
    ['rev-parse', '--show-toplevel'],
    projectRoot,
  );
  return path.relative(topLevel, absolutePath);
}

/**
 * Minimal type for the parts of package.json we care about.
 */
type PackageJson = {
  version?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

/**
 * Result of checking for dependency changes in a package.
 */
export type DependencyCheckResult = {
  /** Dependency changes detected. */
  dependencyChanges: DependencyChange[];
  /** New version if the package version was bumped. */
  versionBump?: string;
  /** PR numbers extracted from commit history for the changed file. */
  prNumbers: string[];
};

/**
 * Compare two package.json objects to find dependency changes.
 * Only examines 'dependencies' and 'peerDependencies' — devDependencies
 * and optionalDependencies are excluded.
 *
 * Note: Only version *changes* are detected. Newly added dependencies
 * (not present in oldPkg) and removed dependencies (not present in newPkg)
 * are intentionally ignored, as changelog entries are only needed for bumps.
 *
 * @param oldPkg - The old package.json content.
 * @param newPkg - The new package.json content.
 * @returns Dependency changes and version bump info.
 */
function compareDependencies(
  oldPkg: PackageJson,
  newPkg: PackageJson,
): { dependencyChanges: DependencyChange[]; versionBump?: string } {
  const dependencyChanges: DependencyChange[] = [];
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
          type: section,
          oldVersion,
          newVersion,
        });
      }
    }
  }

  const versionBump =
    newPkg.version && oldPkg.version !== newPkg.version
      ? newPkg.version
      : undefined;

  return { dependencyChanges, versionBump };
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
    const log = await getStdoutFromCommand(
      'git',
      ['log', '--format=%s', `${fromRef}..${toRef}`, '--', filePath],
      projectRoot,
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
 * fromRef is not provided).
 * @returns Dependency check result, or null if on base branch.
 */
export async function getDependencyChangesForPackage({
  manifestPath,
  fromRef,
  toRef = 'HEAD',
  remote = 'origin',
  baseBranch,
}: GetDependencyChangesOptions): Promise<DependencyCheckResult | null> {
  const workingDir = path.dirname(manifestPath);
  const actualBaseBranch = baseBranch ?? `${remote}/main`;
  let actualFromRef = fromRef;

  // Auto-detect fromRef if not provided
  if (!actualFromRef) {
    // Compare HEAD SHA to base branch SHA (avoids "main" vs "origin/main" bug)
    try {
      const headSha = await getStdoutFromCommand(
        'git',
        ['rev-parse', 'HEAD'],
        workingDir,
      );
      const baseSha = await getStdoutFromCommand(
        'git',
        ['rev-parse', actualBaseBranch],
        workingDir,
      );

      if (headSha === baseSha) {
        return null;
      }
    } catch {
      // Could not resolve base branch ref
      return null;
    }

    try {
      actualFromRef = await getStdoutFromCommand(
        'git',
        ['merge-base', 'HEAD', actualBaseBranch],
        workingDir,
      );
    } catch {
      // Could not find merge base
      return null;
    }
  }

  // Get repo-relative path for git show
  const relativePath = await getRepoRelativePath(manifestPath, workingDir);

  // Get file contents at both refs
  const oldContent = await getFileAtRef(
    relativePath,
    actualFromRef,
    workingDir,
  );
  if (oldContent === null) {
    // New package — no previous version to compare against
    return { dependencyChanges: [], versionBump: undefined, prNumbers: [] };
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

  const { dependencyChanges, versionBump } = compareDependencies(
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

  return { dependencyChanges, versionBump, prNumbers };
}
