/**
 * Shared type definitions for dependency bump checking.
 */

import { Formatter } from './changelog';

/**
 * Represents a single dependency version change.
 */
export type DependencyChange = {
  /** Name of the dependency that changed. */
  dependency: string;
  /** Type of dependency. */
  type: 'dependencies' | 'peerDependencies';
  /** Previous version of the dependency. */
  oldVersion: string;
  /** New version of the dependency. */
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
  /** Starting git reference (defaults to merge base with base branch). */
  fromRef?: string;
  /** Ending git reference (defaults to HEAD). */
  toRef?: string;
  /** Remote name for auto-detection (defaults to 'origin'). */
  remote?: string;
  /** Base branch reference for auto-detection (defaults to '<remote>/main'). */
  baseBranch?: string;
  /** Formatter to use for changelog entries. */
  formatter: Formatter;
  /** Whether to automatically add missing changelog entries. */
  fix?: boolean;
  /** PR number to include in changelog entries. */
  prNumber?: string;
  /** Repository URL override. */
  repoUrl?: string | null;
  /** Output stream for status messages. */
  stdout: Pick<NodeJS.WriteStream, 'write'>;
  /** Error stream for error messages. */
  stderr: Pick<NodeJS.WriteStream, 'write'>;
};
