import execa from 'execa';
import path from 'path';

import type { Formatter } from './changelog';
import { updateChangelogWithDependencies } from './dependency-changelog';
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
 * Gets the git diff between two refs for a specific package.json file.
 *
 * @param manifestPath - Path to the package.json file.
 * @param fromRef - Starting git reference.
 * @param toRef - Ending git reference.
 * @returns The git diff output.
 */
async function getManifestGitDiff(
  manifestPath: string,
  fromRef: string,
  toRef: string,
): Promise<string> {
  return await getStdoutFromCommand(
    'git',
    [
      'diff',
      '-U9999', // Show maximum context to ensure full dependency lists are visible
      fromRef,
      toRef,
      '--',
      manifestPath,
    ],
    path.dirname(manifestPath),
  );
}

/**
 * Result of parsing a package.json diff.
 */
export type DiffParseResult = {
  /** Dependency changes detected in the diff. */
  dependencyChanges: DependencyChange[];
  /** New version if the package version was bumped in this diff. */
  versionBump?: string;
};

/**
 * Parse git diff output to find dependency version changes and package version bumps.
 *
 * @param diff - Raw git diff output for a single package.json.
 * @returns Dependency changes and version bump info.
 */
function parseDependencyDiff(diff: string): DiffParseResult {
  const lines = diff.split('\n');
  const dependencyChanges: DependencyChange[] = [];
  let versionBump: string | undefined;

  let currentSection: 'dependencies' | 'peerDependencies' | null = null;
  const removedDeps = new Map<
    string,
    { version: string; section: 'dependencies' | 'peerDependencies' }
  >();

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Detect package version bump (outside of dependency sections)
    if (line.startsWith('+') && line.includes('"version":')) {
      const versionMatch = line.match(/^\+\s*"version":\s*"([^"]+)"/u);
      if (versionMatch) {
        versionBump = versionMatch[1];
      }
    }

    // Track which dependency section we're in
    if (line.includes('"peerDependencies"')) {
      currentSection = 'peerDependencies';
    } else if (line.includes('"dependencies"')) {
      currentSection = 'dependencies';
    } else if (
      line.includes('"devDependencies"') ||
      line.includes('"optionalDependencies"')
    ) {
      currentSection = null;
    }

    // Detect end of a section
    if (currentSection && (line.trim() === '},' || line.trim() === '}')) {
      const nextLine = lines[idx + 1];
      const isNextSectionDependencies =
        nextLine && /^\s*"dependencies"\s*:/u.test(nextLine);
      const isNextSectionPeerDependencies =
        nextLine && /^\s*"peerDependencies"\s*:/u.test(nextLine);

      if (!isNextSectionDependencies && !isNextSectionPeerDependencies) {
        currentSection = null;
      }
    }

    // Track removed dependencies
    if (line.startsWith('-') && currentSection) {
      const match = line.match(/^-\s*"([^"]+)":\s*"([^"]+)"/u);
      if (match) {
        const [, dep, version] = match;
        removedDeps.set(`${currentSection}:${dep}`, {
          version,
          section: currentSection,
        });
      }
    }

    // Match added dependencies with their removed counterparts
    if (line.startsWith('+') && currentSection) {
      const match = line.match(/^\+\s*"([^"]+)":\s*"([^"]+)"/u);
      if (match) {
        const [, dep, newVersion] = match;
        const sectionType = currentSection;
        const key = `${sectionType}:${dep}`;
        const removed = removedDeps.get(key);

        if (removed && removed.version !== newVersion) {
          // Check if we already have this change
          const alreadyExists = dependencyChanges.some(
            (change) =>
              change.dependency === dep && change.type === sectionType,
          );

          if (!alreadyExists) {
            dependencyChanges.push({
              dependency: dep,
              type: sectionType,
              oldVersion: removed.version,
              newVersion,
            });
          }
        }
      }
    }
  }

  return { dependencyChanges, versionBump };
}

/**
 * Gets the current git branch name.
 *
 * @param projectRoot - Working directory for the command.
 * @returns The current branch name.
 */
async function getCurrentBranchName(projectRoot: string): Promise<string> {
  return await getStdoutFromCommand(
    'git',
    ['rev-parse', '--abbrev-ref', 'HEAD'],
    projectRoot,
  );
}

/**
 * Gets the merge base between HEAD and the base branch.
 *
 * @param projectRoot - Working directory for the command.
 * @param baseBranch - The base branch reference (e.g., 'origin/main', 'upstream/develop').
 * @returns The merge base commit SHA.
 */
async function getMergeBase(
  projectRoot: string,
  baseBranch: string,
): Promise<string> {
  return await getStdoutFromCommand(
    'git',
    ['merge-base', 'HEAD', baseBranch],
    projectRoot,
  );
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
  /** Base branch reference for auto-detection (defaults to '<remote>/main'). */
  baseBranch?: string;
};

/**
 * Get dependency changes for a single package.
 *
 * @param options - Options.
 * @param options.manifestPath - Path to the package.json file.
 * @param options.fromRef - Starting git reference (auto-detects if not provided).
 * @param options.toRef - Ending git reference (defaults to HEAD).
 * @param options.remote - Remote name for auto-detection.
 * @param options.baseBranch - Base branch for auto-detection.
 * @returns Diff parse result with dependency changes and version bump, or null if on base branch.
 */
export async function getDependencyChangesForPackage({
  manifestPath,
  fromRef,
  toRef = 'HEAD',
  remote = 'origin',
  baseBranch,
}: GetDependencyChangesOptions): Promise<DiffParseResult | null> {
  const workingDir = path.dirname(manifestPath);
  const actualBaseBranch = baseBranch ?? `${remote}/main`;
  let actualFromRef = fromRef ?? '';

  // Auto-detect fromRef if not provided
  if (!actualFromRef) {
    const currentBranch = await getCurrentBranchName(workingDir);

    if (currentBranch === actualBaseBranch) {
      // On base branch, can't auto-detect
      return null;
    }

    try {
      actualFromRef = await getMergeBase(workingDir, actualBaseBranch);
    } catch {
      // Could not find merge base
      return null;
    }
  }

  const diff = await getManifestGitDiff(manifestPath, actualFromRef, toRef);
  if (!diff) {
    return { dependencyChanges: [], versionBump: undefined };
  }

  return parseDependencyDiff(diff);
}

/**
 * Options for updating a single package's changelog with dependency entries.
 */
type UpdateSinglePackageOptions = {
  /** Path to the changelog file. */
  changelogPath: string;
  /** Dependency changes to add. */
  dependencyChanges: DependencyChange[];
  /** Current version of the package (if being released). */
  currentVersion?: string;
  /** PR number to use in entries (required). */
  prNumber: string;
  /** Repository URL for PR links. */
  repoUrl: string;
  /** Formatter for changelog content. */
  formatter: Formatter;
  /** Tag prefix for the package. */
  tagPrefix: string;
  /** Package rename info if applicable. */
  packageRename?: {
    versionBeforeRename: string;
    tagPrefixBeforeRename: string;
  };
};

/**
 * Update a single package's changelog with missing dependency bump entries.
 *
 * @param options - Options.
 * @param options.changelogPath - Path to the changelog file.
 * @param options.dependencyChanges - Dependency changes to add.
 * @param options.currentVersion - Current version of the package (if being released).
 * @param options.prNumber - PR number to use in entries.
 * @param options.repoUrl - Repository URL for PR links.
 * @param options.formatter - Formatter for changelog content.
 * @param options.tagPrefix - Tag prefix for the package.
 * @param options.packageRename - Package rename info if applicable.
 * @returns The updated changelog content.
 */
export async function updateSinglePackageChangelog({
  changelogPath,
  dependencyChanges,
  currentVersion,
  prNumber,
  repoUrl,
  formatter,
  tagPrefix,
  packageRename,
}: UpdateSinglePackageOptions): Promise<string> {
  return updateChangelogWithDependencies({
    changelogPath,
    dependencyChanges,
    currentVersion,
    prNumber,
    repoUrl,
    formatter,
    tagPrefix,
    packageRename,
  });
}
