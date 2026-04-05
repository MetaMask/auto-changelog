import type { Change, DependencyBump, Formatter } from './changelog';
import { ChangeCategory } from './constants';
import { findDependencyBumpChangelogEntry } from './find-dependency-bump-changelog-entry';
import { readFile, writeFile } from './fs';
import { parseChangelog } from './parse-changelog';

/**
 * Extracts PR numbers from a change entry's description text.
 * Matches patterns like `[#123](url)` and `(#123)`.
 *
 * @param entry - The Change object to extract PR numbers from.
 * @returns Array of PR number strings.
 */
function extractPrNumbersFromEntry(entry: Change): string[] {
  // If prNumbers were already extracted (via shouldExtractPrLinks), use them
  if (entry.prNumbers.length > 0) {
    return entry.prNumbers;
  }
  // Otherwise extract from the description text
  const matches = entry.description.matchAll(/\[#(\d+)\]|(?<!\[)#(\d+)\)/gu);
  const numbers: string[] = [];
  for (const match of matches) {
    numbers.push(match[1] ?? match[2]);
  }
  return [...new Set(numbers)];
}

/**
 * Options for updating a single changelog with dependency entries.
 */
type UpdateChangelogWithDependenciesOptions = {
  /** Path to the changelog file. */
  changelogPath: string;
  /** Dependency changes to add. */
  dependencyChanges: DependencyBump[];
  /** Current version of the package (if being released). */
  currentVersion?: string;
  /** PR numbers to use in entries. */
  prNumbers: string[];
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
 * Update a single changelog with dependency bump entries.
 *
 * Parses the changelog once, checks for existing entries, updates stale ones,
 * adds missing ones, then stringifies and writes. Uses the Changelog API
 * exclusively — no string replacement.
 *
 * @param options - Options.
 * @param options.changelogPath - Path to the changelog file.
 * @param options.dependencyChanges - Dependency changes to add.
 * @param options.currentVersion - Current version of the package (if being released).
 * @param options.prNumbers - PR numbers to use in entries.
 * @param options.repoUrl - Repository URL for PR links.
 * @param options.formatter - Formatter for changelog content.
 * @param options.tagPrefix - Tag prefix for the package.
 * @param options.packageRename - Package rename info if applicable.
 * @returns The updated changelog content.
 */
export async function updateChangelogWithDependencies({
  changelogPath,
  dependencyChanges,
  currentVersion,
  prNumbers,
  repoUrl,
  formatter,
  tagPrefix,
  packageRename,
}: UpdateChangelogWithDependenciesOptions): Promise<string> {
  let changelogContent: string;
  try {
    changelogContent = await readFile(changelogPath);
  } catch {
    throw new Error(`Changelog not found at ${changelogPath}`);
  }

  // Parse WITHOUT shouldExtractPrLinks to avoid reformatting PR links
  // on entries we don't modify. We extract PR numbers inline only for
  // entries we actually update.
  const changelog = parseChangelog({
    changelogContent,
    repoUrl,
    tagPrefix,
    formatter,
    ...(packageRename && { packageRename }),
  });

  // Check which entries are missing or need updating
  const changesSection = currentVersion
    ? changelog.getReleaseChanges(currentVersion)
    : changelog.getUnreleasedChanges();

  const entriesToAdd: DependencyBump[] = [];
  let hasUpdates = false;

  for (const change of dependencyChanges) {
    if (!changesSection || Object.keys(changesSection).length === 0) {
      entriesToAdd.push(change);
      continue;
    }

    const entryCheck = findDependencyBumpChangelogEntry(changesSection, change);
    if (entryCheck.hasExactMatch) {
      continue;
    }

    if (
      entryCheck.existingEntry !== undefined &&
      entryCheck.entryIndex !== undefined
    ) {
      // Update existing entry with new version and merge PR numbers.
      // Preserve the original oldVersion from the existing entry so the
      // range reflects the full history (e.g., ^62.9.2 → ^62.17.1),
      // not just the latest bump (^62.17.0 → ^62.17.1).
      const existingPrNumbers = extractPrNumbersFromEntry(
        entryCheck.existingEntry,
      );
      const mergedPrNumbers = [
        ...new Set([...existingPrNumbers, ...prNumbers]),
      ];
      const existingOldVersion =
        entryCheck.existingEntry.dependencyBump?.oldVersion;
      changelog.updateChange({
        version: currentVersion,
        category: ChangeCategory.Changed,
        entryIndex: entryCheck.entryIndex,
        dependencyBump: {
          ...change,
          oldVersion: existingOldVersion ?? change.oldVersion,
        },
        prNumbers: mergedPrNumbers,
      });
      hasUpdates = true;
    } else {
      entriesToAdd.push(change);
    }
  }

  // If nothing changed, return original content without rewriting
  if (!hasUpdates && entriesToAdd.length === 0) {
    return changelogContent;
  }

  // Add new entries: non-breaking first, then breaking
  // (since addToStart=true, breaking added last end up on top)
  const nonBreaking = entriesToAdd.filter((entry) => !entry.isBreaking);
  const breaking = entriesToAdd.filter((entry) => entry.isBreaking);

  // Add in reverse order so they appear in correct order
  for (let i = nonBreaking.length - 1; i >= 0; i--) {
    changelog.addChange({
      category: ChangeCategory.Changed,
      ...(currentVersion && { version: currentVersion }),
      prNumbers,
      dependencyBump: nonBreaking[i],
    });
  }

  for (let i = breaking.length - 1; i >= 0; i--) {
    changelog.addChange({
      category: ChangeCategory.Changed,
      ...(currentVersion && { version: currentVersion }),
      prNumbers,
      dependencyBump: breaking[i],
    });
  }

  const updatedContent = await changelog.toString();
  await writeFile(changelogPath, updatedContent);
  return updatedContent;
}
