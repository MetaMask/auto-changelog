import { Formatter } from './changelog';
import { ChangeCategory } from './constants';
import type { DependencyChange } from './dependency-types';
import { readFile, writeFile } from './fs';
import { parseChangelog } from './parse-changelog';

/**
 * Format a changelog entry describing a dependency bump.
 *
 * @param change - Dependency change to describe.
 * @param prNumber - PR number to include, if provided.
 * @param repoUrl - Repository URL for PR links.
 * @returns Formatted changelog entry string.
 */
function formatChangelogEntry(
  change: DependencyChange,
  prNumber: string,
  repoUrl: string,
): string {
  const prLink = `[#${prNumber}](${repoUrl}/pull/${prNumber})`;
  const prefix = change.type === 'peerDependencies' ? '**BREAKING:** ' : '';

  return `${prefix}Bump \`${change.dependency}\` from \`${change.oldVersion}\` to \`${change.newVersion}\` (${prLink})`;
}

/**
 * Determine whether a changelog already contains a dependency bump entry.
 *
 * @param releaseChanges - Changes for a release or the unreleased section.
 * @param change - The dependency change to look for.
 * @returns Match information.
 */
type ChangeEntry = { description: string; prNumbers?: string[] };
type ReleaseChanges = Partial<Record<string, ChangeEntry[]>>;

/**
 * Checks if a changelog already has an entry for a dependency change.
 *
 * @param releaseChanges - The release changes to search.
 * @param change - The dependency change to look for.
 * @returns Match information including whether an exact match was found.
 */
function hasChangelogEntry(
  releaseChanges: ReleaseChanges,
  change: DependencyChange,
): {
  hasExactMatch: boolean;
  existingEntry?: string;
  entryIndex?: number;
} {
  const changedEntries = (releaseChanges.Changed ?? []).map(
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
 * Update a single changelog with dependency bump entries.
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
export async function updateChangelogWithDependencies({
  changelogPath,
  dependencyChanges,
  currentVersion,
  prNumber,
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
  });

  // Check which entries are missing
  const changesSection = currentVersion
    ? changelog.getReleaseChanges(currentVersion)
    : changelog.getUnreleasedChanges();

  const entriesToAdd: DependencyChange[] = [];
  const entriesToUpdate: {
    change: DependencyChange;
    existingEntry: string;
  }[] = [];

  // If changesSection is undefined/empty, all entries need to be added
  if (!changesSection || Object.keys(changesSection).length === 0) {
    entriesToAdd.push(...dependencyChanges);
  } else {
    for (const change of dependencyChanges) {
      const entryCheck = hasChangelogEntry(changesSection, change);
      if (entryCheck.hasExactMatch) {
        continue;
      }

      if (entryCheck.existingEntry === undefined) {
        entriesToAdd.push(change);
      } else {
        entriesToUpdate.push({
          change,
          existingEntry: entryCheck.existingEntry,
        });
      }
    }
  }

  // Update existing entries using string replacement
  let updatedContent = changelogContent;
  for (const { change, existingEntry } of entriesToUpdate) {
    const prMatches = existingEntry.matchAll(/\[#(\d+)\]/gu);
    const existingPRs = Array.from(prMatches, (match) => match[1]);

    if (!existingPRs.includes(prNumber)) {
      existingPRs.push(prNumber);
    }

    const prLinks = existingPRs
      .map((pr) => `[#${pr}](${repoUrl}/pull/${pr})`)
      .join(', ');

    const prefix = change.type === 'peerDependencies' ? '**BREAKING:** ' : '';
    const updatedEntry = `${prefix}Bump \`${change.dependency}\` from \`${change.oldVersion}\` to \`${change.newVersion}\` (${prLinks})`;

    updatedContent = updatedContent.replace(existingEntry, updatedEntry);
  }

  if (entriesToUpdate.length > 0) {
    await writeFile(changelogPath, updatedContent);
  }

  // Add missing entries
  if (entriesToAdd.length > 0) {
    // Re-read the changelog if we updated it
    const latestContent =
      entriesToUpdate.length > 0
        ? await readFile(changelogPath)
        : changelogContent;

    const latestChangelog = parseChangelog({
      changelogContent: latestContent,
      repoUrl,
      tagPrefix,
      formatter,
      ...(packageRename && { packageRename }),
    });

    // Sort: BREAKING (peerDependencies) first
    const deps = entriesToAdd.filter((entry) => entry.type === 'dependencies');
    const peerDeps = entriesToAdd.filter(
      (entry) => entry.type === 'peerDependencies',
    );

    // Add in reverse order so they appear in correct order
    for (let i = deps.length - 1; i >= 0; i--) {
      const description = formatChangelogEntry(deps[i], prNumber, repoUrl);
      latestChangelog.addChange({
        category: ChangeCategory.Changed,
        description,
        ...(currentVersion && { version: currentVersion }),
      });
    }

    for (let i = peerDeps.length - 1; i >= 0; i--) {
      const description = formatChangelogEntry(peerDeps[i], prNumber, repoUrl);
      latestChangelog.addChange({
        category: ChangeCategory.Changed,
        description,
        ...(currentVersion && { version: currentVersion }),
      });
    }

    updatedContent = await latestChangelog.toString();
    await writeFile(changelogPath, updatedContent);
  }

  return updatedContent;
}
