import type Changelog from './changelog';
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
 * Options for updating a changelog with dependency bump entries.
 */
type UpdateChangelogWithDependencyBumpsOptions = {
  /** Path to the changelog file. */
  changelogPath: string;
  /** Dependency bumps to add. */
  dependencyBumps: DependencyBump[];
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
  /** Pre-parsed changelog instance to avoid re-reading and re-parsing. */
  changelog?: Changelog;
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
 * @param options.dependencyBumps - Dependency bumps to add.
 * @param options.currentVersion - Current version of the package (if being released).
 * @param options.prNumbers - PR numbers to use in entries.
 * @param options.repoUrl - Repository URL for PR links.
 * @param options.formatter - Formatter for changelog content.
 * @param options.tagPrefix - Tag prefix for the package.
 * @param options.packageRename - Package rename info if applicable.
 * @param options.changelog - Pre-parsed changelog instance to skip re-reading.
 * @returns The updated changelog content.
 */
export async function updateChangelogWithDependencyBumps({
  changelogPath,
  dependencyBumps,
  currentVersion,
  prNumbers,
  repoUrl,
  formatter,
  tagPrefix,
  packageRename,
  changelog: existingChangelog,
}: UpdateChangelogWithDependencyBumpsOptions): Promise<string> {
  let changelog = existingChangelog;
  let changelogContent: string | undefined;

  if (!changelog) {
    try {
      changelogContent = await readFile(changelogPath);
    } catch {
      throw new Error(`Changelog not found at ${changelogPath}`);
    }

    // Parse WITHOUT shouldExtractPrLinks to avoid reformatting PR links
    // on entries we don't modify. We extract PR numbers inline only for
    // entries we actually update.
    changelog = parseChangelog({
      changelogContent,
      repoUrl,
      tagPrefix,
      formatter,
      ...(packageRename && { packageRename }),
    });
  }

  // Check which entries are missing or need updating
  const changesSection = currentVersion
    ? changelog.getReleaseChanges(currentVersion)
    : changelog.getUnreleasedChanges();

  const entriesToAdd: DependencyBump[] = [];
  let hasUpdates = false;

  for (const bump of dependencyBumps) {
    if (!changesSection || Object.keys(changesSection).length === 0) {
      entriesToAdd.push(bump);
      continue;
    }

    const entryCheck = findDependencyBumpChangelogEntry(changesSection, bump);
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
          ...bump,
          oldVersion: existingOldVersion ?? bump.oldVersion,
        },
        prNumbers: mergedPrNumbers,
      });
      hasUpdates = true;
    } else {
      entriesToAdd.push(bump);
    }
  }

  // If nothing changed, return original content without rewriting
  if (!hasUpdates && entriesToAdd.length === 0) {
    if (changelogContent !== undefined) {
      return changelogContent;
    }
    return await changelog.toString();
  }

  // Add new entries after existing ones (addToStart: false).
  // Breaking entries first, then non-breaking.
  const breaking = entriesToAdd.filter((entry) => entry.isBreaking);
  const nonBreaking = entriesToAdd.filter((entry) => !entry.isBreaking);

  for (const bump of [...breaking, ...nonBreaking]) {
    changelog.addChange({
      addToStart: false,
      category: ChangeCategory.Changed,
      ...(currentVersion && { version: currentVersion }),
      prNumbers,
      dependencyBump: bump,
    });
  }

  const updatedContent = await changelog.toString();
  await writeFile(changelogPath, updatedContent);
  return updatedContent;
}
