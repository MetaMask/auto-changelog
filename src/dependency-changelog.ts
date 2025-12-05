import { promises as fs } from 'fs';
import path from 'path';

import type { DependencyChange, PackageChanges } from './dependency-types';
import { parseChangelog } from './parse-changelog';
import type { PackageRename } from './shared-types';

/**
 * Result of validating a changelog for dependency bump entries.
 */
type ChangelogValidationResult = {
  /** Package directory name. */
  package: string;
  /** Whether the changelog file exists. */
  hasChangelog: boolean;
  /** Whether the changelog has an Unreleased section. */
  hasUnreleasedSection: boolean;
  /** Dependency changes missing from the changelog. */
  missingEntries: DependencyChange[];
  /** Existing changelog entries that match dependency bumps. */
  existingEntries: string[];
  /** Version that was checked (null for [Unreleased] section). */
  checkedVersion?: string | null;
};

/**
 * Checks if a file exists.
 *
 * @param filePath - Path to the file.
 * @returns True if the file exists, false otherwise.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads and parses a JSON file.
 *
 * @param filePath - Path to the JSON file.
 * @returns The parsed JSON content.
 */
async function readJsonFile<T = Record<string, unknown>>(
  filePath: string,
): Promise<T> {
  const fileContent = await fs.readFile(filePath, 'utf8');
  return JSON.parse(fileContent) as T;
}

/**
 * Reads a changelog file, returning null if it does not exist.
 *
 * @param changelogPath - Path to the changelog.
 * @returns The changelog contents or null.
 */
async function readChangelog(changelogPath: string): Promise<string | null> {
  if (!(await fileExists(changelogPath))) {
    return null;
  }

  return await fs.readFile(changelogPath, 'utf8');
}

/**
 * Extract package rename flags from package.json scripts if present.
 *
 * @param packagePath - Path to the package directory.
 * @returns Package rename info, if detected.
 */
async function getPackageRenameInfo(
  packagePath: string,
): Promise<PackageRename | undefined> {
  const manifestPath = path.join(packagePath, 'package.json');

  if (!(await fileExists(manifestPath))) {
    return undefined;
  }

  try {
    const manifest = await readJsonFile<{
      scripts?: Record<string, string>;
    }>(manifestPath);

    if (!manifest.scripts) {
      return undefined;
    }

    for (const script of Object.values(manifest.scripts)) {
      const tagPrefixMatch = script.match(
        /--tag-prefix-before-package-rename\s+(\S+)/u,
      );
      const versionMatch = script.match(
        /--version-before-package-rename\s+(\S+)/u,
      );

      if (tagPrefixMatch && versionMatch) {
        return {
          tagPrefixBeforeRename: tagPrefixMatch[1],
          versionBeforeRename: versionMatch[1],
        };
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

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
  prNumber: string | undefined,
  repoUrl: string,
): string {
  const pr = prNumber ?? 'XXXXX';
  const prLink = `[#${pr}](${repoUrl}/pull/${pr})`;
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
 * Validate changelogs for all packages that had dependency bumps.
 *
 * @param changes - Detected package changes.
 * @param projectRoot - Root directory of the project.
 * @param repoUrl - Repository URL used for parsing links.
 * @returns Validation results.
 */
export async function validateDependencyChangelogs(
  changes: PackageChanges,
  projectRoot: string,
  repoUrl: string,
): Promise<ChangelogValidationResult[]> {
  const results: ChangelogValidationResult[] = [];

  for (const [packageDirName, packageInfo] of Object.entries(changes)) {
    const packageChanges = packageInfo.dependencyChanges;
    const packageVersion = packageInfo.newVersion;
    const packagePath = path.join(projectRoot, 'packages', packageDirName);
    const changelogPath = path.join(packagePath, 'CHANGELOG.md');

    const changelogContent = await readChangelog(changelogPath);

    if (!changelogContent) {
      results.push({
        package: packageDirName,
        hasChangelog: false,
        hasUnreleasedSection: false,
        missingEntries: packageChanges,
        existingEntries: [],
        checkedVersion: packageVersion ?? null,
      });
      continue;
    }

    try {
      const actualPackageName = packageInfo.packageName;
      const packageRename = await getPackageRenameInfo(packagePath);

      const changelog = parseChangelog({
        changelogContent,
        repoUrl,
        tagPrefix: `${actualPackageName}@`,
        ...(packageRename && { packageRename }),
      });

      const changesSection = packageVersion
        ? changelog.getReleaseChanges(packageVersion)
        : changelog.getUnreleasedChanges();

      const hasUnreleasedSection = Object.keys(changesSection).length > 0;

      const missingEntries: DependencyChange[] = [];
      const existingEntries: string[] = [];

      for (const change of packageChanges) {
        const entryCheck = hasChangelogEntry(changesSection, change);
        if (entryCheck.hasExactMatch) {
          existingEntries.push(change.dependency);
        } else {
          missingEntries.push(change);
        }
      }

      results.push({
        package: packageDirName,
        hasChangelog: true,
        hasUnreleasedSection,
        missingEntries,
        existingEntries,
        checkedVersion: packageVersion ?? null,
      });
    } catch {
      results.push({
        package: packageDirName,
        hasChangelog: true,
        hasUnreleasedSection: false,
        missingEntries: packageChanges,
        existingEntries: [],
        checkedVersion: packageVersion ?? null,
      });
    }
  }

  return results;
}

/**
 * Update changelogs with dependency bump entries when missing or outdated.
 *
 * @param changes - Detected package changes.
 * @param options - Update options.
 * @param options.projectRoot - Root directory of the project.
 * @param options.prNumber - PR number to use when adding entries.
 * @param options.repoUrl - Repository URL used for links.
 * @param options.stdout - Stream for informational output.
 * @param options.stderr - Stream for error output.
 * @returns Number of changelog files modified.
 */
export async function updateDependencyChangelogs(
  changes: PackageChanges,
  {
    projectRoot,
    prNumber,
    repoUrl,
    stdout,
    stderr,
  }: {
    projectRoot: string;
    prNumber?: string;
    repoUrl: string;
    stdout: Pick<NodeJS.WriteStream, 'write'>;
    stderr: Pick<NodeJS.WriteStream, 'write'>;
  },
): Promise<number> {
  let updatedCount = 0;

  for (const [packageDirName, packageInfo] of Object.entries(changes)) {
    const packageChanges = packageInfo.dependencyChanges;
    const packageVersion = packageInfo.newVersion;
    const packagePath = path.join(projectRoot, 'packages', packageDirName);
    const changelogPath = path.join(packagePath, 'CHANGELOG.md');

    const changelogContent = await readChangelog(changelogPath);

    if (!changelogContent) {
      stderr.write(
        `⚠️  No CHANGELOG.md found for ${packageDirName} at ${changelogPath}\n`,
      );
      continue;
    }

    try {
      const actualPackageName = packageInfo.packageName;
      const packageRename = await getPackageRenameInfo(packagePath);

      const changelog = parseChangelog({
        changelogContent,
        repoUrl,
        tagPrefix: `${actualPackageName}@`,
        ...(packageRename && { packageRename }),
      });

      const changesSection = packageVersion
        ? changelog.getReleaseChanges(packageVersion)
        : changelog.getUnreleasedChanges();

      const entriesToAdd: DependencyChange[] = [];
      const entriesToUpdate: {
        change: DependencyChange;
        existingEntry: string;
      }[] = [];

      for (const change of packageChanges) {
        const entryCheck = hasChangelogEntry(changesSection, change);

        if (entryCheck.hasExactMatch) {
          continue;
        } else if (entryCheck.existingEntry) {
          entriesToUpdate.push({
            change,
            existingEntry: entryCheck.existingEntry,
          });
        } else {
          entriesToAdd.push(change);
        }
      }

      if (entriesToAdd.length === 0 && entriesToUpdate.length === 0) {
        stdout.write(`✅ ${packageDirName}: All entries already exist\n`);
        continue;
      }

      let updatedContent = changelogContent;

      for (const { change, existingEntry } of entriesToUpdate) {
        const prMatches = existingEntry.matchAll(/\[#(\d+|XXXXX)\]/gu);
        const existingPRs = Array.from(prMatches, (match) => match[1]);
        const newPR = prNumber ?? 'XXXXX';

        if (!existingPRs.includes(newPR)) {
          existingPRs.push(newPR);
        }

        const prLinks = existingPRs
          .map((pr) => `[#${pr}](${repoUrl}/pull/${pr})`)
          .join(', ');

        const prefix =
          change.type === 'peerDependencies' ? '**BREAKING:** ' : '';
        const updatedEntry = `${prefix}Bump \`${change.dependency}\` from \`${change.oldVersion}\` to \`${change.newVersion}\` (${prLinks})`;

        updatedContent = updatedContent.replace(existingEntry, updatedEntry);
      }

      if (entriesToUpdate.length > 0) {
        await fs.writeFile(changelogPath, updatedContent);

        if (entriesToAdd.length === 0) {
          stdout.write(
            `✅ ${packageDirName}: Updated ${entriesToUpdate.length} existing ${
              entriesToUpdate.length === 1 ? 'entry' : 'entries'
            }\n`,
          );
          updatedCount += 1;
          continue;
        }

        const updatedChangelogContent = await fs.readFile(
          changelogPath,
          'utf8',
        );
        const updatedChangelog = parseChangelog({
          changelogContent: updatedChangelogContent,
          repoUrl,
          tagPrefix: `${actualPackageName}@`,
          ...(packageRename && { packageRename }),
        });

        const deps = entriesToAdd.filter(
          (change) => change.type === 'dependencies',
        );
        const peerDeps = entriesToAdd.filter(
          (change) => change.type === 'peerDependencies',
        );

        for (let i = deps.length - 1; i >= 0; i--) {
          const description = formatChangelogEntry(deps[i], prNumber, repoUrl);
          updatedChangelog.addChange({
            category: 'Changed' as any,
            description,
            ...(packageVersion && { version: packageVersion }),
          });
        }

        for (let i = peerDeps.length - 1; i >= 0; i--) {
          const description = formatChangelogEntry(
            peerDeps[i],
            prNumber,
            repoUrl,
          );
          updatedChangelog.addChange({
            category: 'Changed' as any,
            description,
            ...(packageVersion && { version: packageVersion }),
          });
        }

        await fs.writeFile(changelogPath, await updatedChangelog.toString());

        stdout.write(
          `✅ ${packageDirName}: Updated ${entriesToUpdate.length} and added ${entriesToAdd.length} changelog ${
            entriesToAdd.length === 1 ? 'entry' : 'entries'
          }\n`,
        );
      } else {
        const deps = entriesToAdd.filter(
          (change) => change.type === 'dependencies',
        );
        const peerDeps = entriesToAdd.filter(
          (change) => change.type === 'peerDependencies',
        );

        for (let i = deps.length - 1; i >= 0; i--) {
          const description = formatChangelogEntry(deps[i], prNumber, repoUrl);
          changelog.addChange({
            category: 'Changed' as any,
            description,
            ...(packageVersion && { version: packageVersion }),
          });
        }

        for (let i = peerDeps.length - 1; i >= 0; i--) {
          const description = formatChangelogEntry(
            peerDeps[i],
            prNumber,
            repoUrl,
          );
          changelog.addChange({
            category: 'Changed' as any,
            description,
            ...(packageVersion && { version: packageVersion }),
          });
        }

        const updatedChangelogContent = await changelog.toString();
        await fs.writeFile(changelogPath, updatedChangelogContent);

        stdout.write(
          `✅ ${packageDirName}: Added ${entriesToAdd.length} changelog ${
            entriesToAdd.length === 1 ? 'entry' : 'entries'
          }\n`,
        );
      }

      updatedCount += 1;
    } catch (error) {
      stderr.write(
        `⚠️  Error updating CHANGELOG.md for ${packageDirName}: ${String(error)}\n`,
      );
    }
  }

  return updatedCount;
}
