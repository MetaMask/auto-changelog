import type Changelog from './changelog';
import { Formatter, getKnownPropertyNames } from './changelog';
import { ChangeCategory, ConventionalCommitType, Version } from './constants';
import { getNewChangeEntries } from './get-new-changes';
import { parseChangelog } from './parse-changelog';
import { runCommandAndSplit } from './run-command';
import { PackageRename } from './shared-types';

/**
 * Get the most recent tag for a project.
 *
 * @param options - Options.
 * @param options.tagPrefixes - A list of tag prefixes to look for, where the first is the intended
 * prefix and each subsequent prefix is a fallback in case the previous tag prefixes are not found.
 * @returns The most recent tag.
 */
async function getMostRecentTag({
  tagPrefixes,
}: {
  tagPrefixes: [string, ...string[]];
}) {
  // Ensure we have all tags on remote
  await runCommandAndSplit('git', ['fetch', '--tags']);

  let mostRecentTagCommitHash: string | null = null;
  for (const tagPrefix of tagPrefixes) {
    const revListArgs = [
      'rev-list',
      `--tags=${tagPrefix}*`,
      '--max-count=1',
      '--date-order',
    ];
    const results = await runCommandAndSplit('git', revListArgs);
    if (results.length) {
      mostRecentTagCommitHash = results[0];
      break;
    }
  }

  if (mostRecentTagCommitHash === null) {
    return null;
  }
  const [mostRecentTag] = await runCommandAndSplit('git', [
    'describe',
    '--tags',
    mostRecentTagCommitHash,
  ]);
  return mostRecentTag;
}

/**
 * Get all changes from a changelog.
 *
 * @param changelog - The changelog.
 * @returns All commit descriptions included in the given changelog.
 */
function getAllChanges(changelog: Changelog) {
  const releases = changelog.getReleases();
  const changes = Object.values(changelog.getUnreleasedChanges()).flat();
  for (const release of releases) {
    changes.push(
      ...Object.values(changelog.getReleaseChanges(release.version)).flat(),
    );
  }
  return changes;
}

/**
 * Get all pull request numbers included in the given changelog.
 *
 * @param changelog - The changelog.
 * @returns All pull request numbers included in the given changelog.
 */
function getAllLoggedPrNumbers(changelog: Changelog) {
  return getAllChanges(changelog).flatMap((change) => change.prNumbers);
}

export type UpdateChangelogOptions = {
  changelogContent: string;
  currentVersion?: Version;
  repoUrl: string;
  isReleaseCandidate: boolean;
  projectRootDirectory?: string;
  tagPrefixes?: [string, ...string[]];
  formatter?: Formatter;
  autoCategorize?: boolean;
  /**
   * The package rename properties, used in case of package is renamed
   */
  packageRename?: PackageRename;
  /**
   * Whether to use `CHANGELOG entry:` from the commit body and the no-changelog label
   */
  useChangelogEntry: boolean;
  /**
   * Whether to use short PR links in the changelog entries.
   */
  useShortPrLink: boolean;
};

/**
 * Update a changelog with any commits made since the last release. Commits for
 * PRs that are already included in the changelog are omitted.
 *
 * @param options - Update options.
 * @param options.changelogContent - The current changelog.
 * @param options.currentVersion - The current version. Required if
 * `isReleaseCandidate` is set, but optional otherwise.
 * @param options.repoUrl - The GitHub repository URL for the current project.
 * @param options.isReleaseCandidate - Denotes whether the current project.
 * is in the midst of release preparation or not. If this is set, any new
 * changes are listed under the current release header. Otherwise, they are
 * listed under the 'Unreleased' section.
 * @param options.projectRootDirectory - The root project directory, used to
 * filter results from various git commands. This path is assumed to be either
 * absolute, or relative to the current directory. Defaults to the root of the
 * current git repository.
 * @param options.tagPrefixes - A list of tag prefixes to look for, where the first is the intended
 * prefix and each subsequent prefix is a fallback in case the previous tag prefixes are not found.
 * @param options.formatter - A custom Markdown formatter to use.
 * @param options.packageRename - The package rename properties.
 * An optional, which is required only in case of package renamed.
 * @param options.autoCategorize - A flag indicating whether changes should be auto-categorized
 * based on commit message prefixes.
 * @param options.useChangelogEntry - Whether to use `CHANGELOG entry:` from the commit body and the no-changelog label.
 * @param options.useShortPrLink - Whether to use short PR links in the changelog.
 * @returns The updated changelog text.
 */
export async function updateChangelog({
  changelogContent,
  currentVersion,
  repoUrl,
  isReleaseCandidate,
  projectRootDirectory,
  tagPrefixes = ['v'],
  formatter = undefined,
  packageRename,
  autoCategorize,
  useChangelogEntry,
  useShortPrLink,
}: UpdateChangelogOptions): Promise<string | undefined> {
  const changelog = parseChangelog({
    changelogContent,
    repoUrl,
    tagPrefix: tagPrefixes[0],
    formatter,
    packageRename,
  });

  const mostRecentTag = await getMostRecentTag({
    tagPrefixes,
  });

  if (isReleaseCandidate) {
    if (!currentVersion) {
      throw new Error(
        `A version must be specified if 'isReleaseCandidate' is set.`,
      );
    }
    if (mostRecentTag === `${tagPrefixes[0]}${currentVersion}`) {
      throw new Error(
        `Current version already has a tag ('${mostRecentTag}'), which is unexpected for a release candidate.`,
      );
    }

    // Ensure release header exists, if necessary
    if (
      !changelog
        .getReleases()
        .find((release) => release.version === currentVersion)
    ) {
      changelog.addRelease({ version: currentVersion });
    }

    const hasUnreleasedChangesToRelease =
      getKnownPropertyNames(changelog.getUnreleasedChanges()).length > 0;
    if (hasUnreleasedChangesToRelease) {
      changelog.migrateUnreleasedChangesToRelease(currentVersion);
    }
  }

  const newChangeEntries = await getNewChangeEntries({
    mostRecentTag,
    repoUrl,
    loggedPrNumbers: getAllLoggedPrNumbers(changelog),
    projectRootDirectory,
    useChangelogEntry,
    useShortPrLink,
  });

  for (const entry of newChangeEntries.reverse()) {
    const category = autoCategorize
      ? getCategory(entry.subject)
      : ChangeCategory.Uncategorized;

    if (category !== ChangeCategory.Excluded) {
      changelog.addChange({
        version: isReleaseCandidate ? currentVersion : undefined,
        category,
        description: entry.description,
      });
    }
  }

  const newChangelogContent = await changelog.toString();
  const isChangelogUpdated = changelogContent !== newChangelogContent;
  return isChangelogUpdated ? newChangelogContent : undefined;
}

/**
 * Determine the category of a change based on the commit message prefix.
 *
 * @param description - The commit message description.
 * @returns The category of the change.
 */
export function getCategory(description: string): ChangeCategory {
  // Don't include merge commits in the changelog
  if (description.startsWith('Merge')) {
    return ChangeCategory.Excluded;
  }

  // Get array of all ConventionalCommitType values
  const conventionalCommitTypes = Object.values(ConventionalCommitType);

  // Create a regex pattern that matches any of the ConventionalCommitTypes
  const typesWithPipe = conventionalCommitTypes.join('|');
  const conventionalCommitPattern = new RegExp(`^(${typesWithPipe}).*$`, 'ui');

  const match = description.match(conventionalCommitPattern);

  if (match) {
    const prefix = match.length > 1 ? match[1] : undefined;
    switch (prefix) {
      case ConventionalCommitType.FEAT:
        return ChangeCategory.Added;
      case ConventionalCommitType.FIX:
        return ChangeCategory.Fixed;
      // Begin categories that should be excluded from the changelog
      case ConventionalCommitType.STYLE:
      case ConventionalCommitType.REFACTOR:
      case ConventionalCommitType.TEST:
      case ConventionalCommitType.BUILD:
      case ConventionalCommitType.CI:
      case ConventionalCommitType.RELEASE:
        return ChangeCategory.Excluded;
      // End categories that should be excluded from the changelog
      default:
        return ChangeCategory.Uncategorized;
    }
  }
  // Return 'Uncategorized' if no colon is found or prefix doesn't match
  return ChangeCategory.Uncategorized;
}
