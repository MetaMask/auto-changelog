import type { Change } from './changelog';
import { ChangeCategory } from './constants';
import type { DependencyChange } from './dependency-types';

/**
 * Release changes structure used for dependency checking.
 * This matches the structure returned by getReleaseChanges/getUnreleasedChanges.
 */
type ReleaseChanges = Partial<Record<ChangeCategory, Change[]>>;

/**
 * Result of checking for a changelog entry.
 */
export type ChangelogEntryCheckResult = {
  /** Whether an exact version match was found. */
  hasExactMatch: boolean;
  /** The existing entry text, if found. */
  existingEntry?: string;
  /** The index of the entry in the Changed array, if found. */
  entryIndex?: number;
};

/**
 * Checks if a changelog entry exists for a dependency change.
 * This function checks for both exact version matches and any version matches.
 *
 * @param releaseChanges - The release changes to search in.
 * @param change - The dependency change to check for.
 * @returns Result indicating whether an entry exists and details about it.
 */
export function hasChangelogEntry(
  releaseChanges: ReleaseChanges,
  change: DependencyChange,
): ChangelogEntryCheckResult {
  const changedEntries = (releaseChanges[ChangeCategory.Changed] ?? []).map(
    (entry) => entry.description,
  );

  const escapedDep = change.dependency.replace(/[/\\^$*+?.()|[\]{}]/gu, '\\$&');
  const escapedOldVer = change.oldVersion.replace(
    /[/\\^$*+?.()|[\]{}]/gu,
    '\\$&',
  );
  const escapedNewVer = change.newVersion.replace(
    /[/\\^$*+?.()|[\]{}]/gu,
    '\\$&',
  );

  const breakingPrefix =
    change.type === 'peerDependencies' ? '\\*\\*BREAKING:\\*\\* ' : '';
  const isBreaking = change.type === 'peerDependencies';

  const exactPattern = new RegExp(
    `${breakingPrefix}Bump \`${escapedDep}\` from \`${escapedOldVer}\` to \`${escapedNewVer}\``,
    'u',
  );

  const exactIndex = changedEntries.findIndex((entry) => {
    const matchesPattern = exactPattern.test(entry);
    if (!isBreaking) {
      return matchesPattern && !entry.startsWith('**BREAKING:**');
    }
    return matchesPattern;
  });

  if (exactIndex !== -1) {
    return {
      hasExactMatch: true,
      existingEntry: changedEntries[exactIndex],
      entryIndex: exactIndex,
    };
  }

  const anyVersionPattern = new RegExp(
    `${breakingPrefix}Bump \\x60${escapedDep}\\x60 from \\x60[^\\x60]+\\x60 to \\x60[^\\x60]+\\x60`,
    'u',
  );

  const anyIndex = changedEntries.findIndex((entry) => {
    const matchesPattern = anyVersionPattern.test(entry);
    if (!isBreaking) {
      return matchesPattern && !entry.startsWith('**BREAKING:**');
    }
    return matchesPattern;
  });

  if (anyIndex !== -1) {
    return {
      hasExactMatch: false,
      existingEntry: changedEntries[anyIndex],
      entryIndex: anyIndex,
    };
  }

  return { hasExactMatch: false };
}
