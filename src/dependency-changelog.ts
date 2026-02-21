import type { Formatter } from './changelog';
import { ChangeCategory } from './constants';
import type { DependencyChange } from './dependency-types';
import { hasChangelogEntry } from './dependency-utils';
import { readFile, writeFile } from './fs';
import { parseChangelog } from './parse-changelog';

/**
 * Options for updating a single changelog with dependency entries.
 */
type UpdateChangelogWithDependenciesOptions = {
  /** Path to the changelog file. */
  changelogPath: string;
  /** Dependency changes to add. */
  dependencyChanges: DependencyChange[];
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

  const changelog = parseChangelog({
    changelogContent,
    repoUrl,
    tagPrefix,
    formatter,
    ...(packageRename && { packageRename }),
    shouldExtractPrLinks: true,
  });

  // Check which entries are missing or need updating
  const changesSection = currentVersion
    ? changelog.getReleaseChanges(currentVersion)
    : changelog.getUnreleasedChanges();

  const entriesToAdd: DependencyChange[] = [];
  let hasUpdates = false;

  for (const change of dependencyChanges) {
    if (!changesSection || Object.keys(changesSection).length === 0) {
      entriesToAdd.push(change);
      continue;
    }

    const entryCheck = hasChangelogEntry(changesSection, change);
    if (entryCheck.hasExactMatch) {
      continue;
    }

    if (
      entryCheck.existingEntry !== undefined &&
      entryCheck.entryIndex !== undefined
    ) {
      // Update existing entry with new versions and merge PR numbers
      const mergedPrNumbers = [
        ...new Set([...entryCheck.existingEntry.prNumbers, ...prNumbers]),
      ];
      changelog.updateChange({
        version: currentVersion,
        category: ChangeCategory.Changed,
        entryIndex: entryCheck.entryIndex,
        dependencyBump: change,
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

  // Add new entries: deps first, then peerDeps
  // (since addToStart=true, peerDeps added last end up on top)
  const deps = entriesToAdd.filter((entry) => entry.type === 'dependencies');
  const peerDeps = entriesToAdd.filter(
    (entry) => entry.type === 'peerDependencies',
  );

  // Add in reverse order so they appear in correct order
  for (let i = deps.length - 1; i >= 0; i--) {
    changelog.addChange({
      category: ChangeCategory.Changed,
      ...(currentVersion && { version: currentVersion }),
      prNumbers,
      dependencyBump: deps[i],
    });
  }

  for (let i = peerDeps.length - 1; i >= 0; i--) {
    changelog.addChange({
      category: ChangeCategory.Changed,
      ...(currentVersion && { version: currentVersion }),
      prNumbers,
      dependencyBump: peerDeps[i],
    });
  }

  const updatedContent = await changelog.toString();
  await writeFile(changelogPath, updatedContent);
  return updatedContent;
}
