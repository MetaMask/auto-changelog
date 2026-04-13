import type { Change, DependencyBump, ReleaseChanges } from './changelog';
import { ChangeCategory } from './constants';

/**
 * Result of checking for a changelog entry.
 */
export type ChangelogEntryCheckResult = {
  /** Whether an exact version match was found. */
  hasExactMatch: boolean;
  /** The existing Change object, if found. */
  existingEntry?: Change;
  /** The index of the entry in the Changed array, if found. */
  entryIndex?: number;
};

/**
 * Finds a changelog entry for a dependency bump using
 * structured `dependencyBump` data on Change objects.
 *
 * @param releaseChanges - The release changes to search in.
 * @param dependencyBump - The dependency bump to find.
 * @returns Result indicating whether an entry exists and details about it.
 */
export function findDependencyBumpChangelogEntry(
  releaseChanges: ReleaseChanges,
  dependencyBump: DependencyBump,
): ChangelogEntryCheckResult {
  const changedEntries = releaseChanges[ChangeCategory.Changed] ?? [];

  for (let i = 0; i < changedEntries.length; i++) {
    const entry = changedEntries[i];
    const bump = entry.dependencyBump;
    if (!bump) {
      continue;
    }

    if (
      bump.dependency !== dependencyBump.dependency ||
      bump.isBreaking !== dependencyBump.isBreaking
    ) {
      continue;
    }

    // Same dependency and breaking status
    if (
      bump.oldVersion === dependencyBump.oldVersion &&
      bump.newVersion === dependencyBump.newVersion
    ) {
      // Exact match
      return { hasExactMatch: true, existingEntry: entry, entryIndex: i };
    }

    // Any-version match (same dep + breaking status, different versions)
    return { hasExactMatch: false, existingEntry: entry, entryIndex: i };
  }

  return { hasExactMatch: false };
}
