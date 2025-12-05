/**
 * Shared type definitions for dependency bump checking.
 */

/**
 * Represents a single dependency version change.
 */
export type DependencyChange = {
  package: string;
  dependency: string;
  type: 'dependencies' | 'peerDependencies';
  oldVersion: string;
  newVersion: string;
};

/**
 * Information about a package with dependency changes.
 */
export type PackageInfo = {
  /** Package name from package.json (e.g., '@metamask/controller-utils'). */
  packageName: string;
  /** Dependency changes for this package. */
  dependencyChanges: DependencyChange[];
  /** New version if the package itself is being bumped. */
  newVersion?: string;
};

/**
 * Maps package directory names to their changes and version info.
 */
export type PackageChanges = Record<string, PackageInfo>;

/**
 * Options for checking dependency bumps between git references.
 */
export type CheckDependencyBumpsOptions = {
  /** Root directory containing packages. */
  projectRoot: string;
  /** Starting git reference (defaults to merge base with default branch). */
  fromRef?: string;
  /** Ending git reference (defaults to HEAD). */
  toRef?: string;
  /** Default branch name for auto-detection. */
  defaultBranch?: string;
  /** Whether to automatically add missing changelog entries. */
  fix?: boolean;
  /** PR number to include in changelog entries. */
  prNumber?: string;
  /** Repository URL override. */
  repoUrl?: string;
  /** Output stream for status messages. */
  stdout: Pick<NodeJS.WriteStream, 'write'>;
  /** Error stream for error messages. */
  stderr: Pick<NodeJS.WriteStream, 'write'>;
};
