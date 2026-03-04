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
 * Finds a changelog entry for a dependency change using
 * structured `dependencyBump` data on Change objects.
 *
 * @param releaseChanges - The release changes to search in.
 * @param change - The dependency change to find.
 * @returns Result indicating whether an entry exists and details about it.
 */
export function findChangelogEntry(
  releaseChanges: ReleaseChanges,
  change: DependencyBump,
): ChangelogEntryCheckResult {
  const changedEntries = releaseChanges[ChangeCategory.Changed] ?? [];

  for (let i = 0; i < changedEntries.length; i++) {
    const entry = changedEntries[i];
    const bump = entry.dependencyBump;
    if (!bump) {
      continue;
    }

    if (
      bump.dependency !== change.dependency ||
      bump.isBreaking !== change.isBreaking
    ) {
      continue;
    }

    // Same dependency and breaking status
    if (
      bump.oldVersion === change.oldVersion &&
      bump.newVersion === change.newVersion
    ) {
      // Exact match
      return { hasExactMatch: true, existingEntry: entry, entryIndex: i };
    }

    // Any-version match (same dep + breaking status, different versions)
    return { hasExactMatch: false, existingEntry: entry, entryIndex: i };
  }

  return { hasExactMatch: false };
}
