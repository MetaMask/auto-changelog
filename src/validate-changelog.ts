import { Change, Formatter } from './changelog';
import type { DependencyCheckResult } from './check-dependency-bumps';
import { Version, ChangeCategory } from './constants';
import type { DependencyChange } from './dependency-types';
import { hasChangelogEntry } from './dependency-utils';
import { parseChangelog } from './parse-changelog';
import { PackageRename } from './shared-types';

/**
 * Indicates that the changelog is invalid.
 */
export class InvalidChangelogError extends Error {}

/**
 * Indicates that unreleased changes are still present in the changelog.
 */
export class UnreleasedChangesError extends InvalidChangelogError {
  constructor() {
    super('Unreleased changes present in the changelog');
  }
}

export class UncategorizedChangesError extends InvalidChangelogError {
  constructor() {
    super('Uncategorized changes present in the changelog');
  }
}

/**
 * Indicates that the release header for the current version is missing.
 */
export class MissingCurrentVersionError extends InvalidChangelogError {
  /**
   * Construct a changelog missing version error.
   *
   * @param currentVersion - The current version.
   */
  constructor(currentVersion: Version) {
    super(`Current version missing from changelog: '${currentVersion}'`);
  }
}

/**
 * Indicates that pull request links are missing for a change entry.
 */
export class MissingPullRequestLinksError extends InvalidChangelogError {
  constructor(change: Change, releaseVersion: Version) {
    super(
      `Pull request link(s) missing for change: '${change.description}' (in ${releaseVersion})`,
    );
  }
}

/**
 * Represents a formatting error in a changelog.
 */
export class ChangelogFormattingError extends InvalidChangelogError {
  public data: Record<string, string>;

  /**
   * Construct a changelog formatting error.
   *
   * @param options - Error options.
   * @param options.validChangelog - The string contents of the well-formatted
   * changelog.
   * @param options.invalidChangelog - The string contents of the malformed
   * changelog.
   */
  constructor({
    validChangelog,
    invalidChangelog,
  }: {
    validChangelog: string;
    invalidChangelog: string;
  }) {
    super('Changelog is not well-formatted');
    this.data = {
      validChangelog,
      invalidChangelog,
    };
  }
}

/**
 * Indicates that changelog entries for dependency bumps are missing.
 */
export class MissingDependencyEntriesError extends InvalidChangelogError {
  public missingEntries: DependencyChange[];

  /**
   * Construct a missing dependency entries error.
   *
   * @param missingEntries - The dependency changes missing from the changelog.
   */
  constructor(missingEntries: DependencyChange[]) {
    const deps = missingEntries.map((entry) => entry.dependency).join(', ');
    super(`Missing changelog entries for dependency bumps: ${deps}`);
    this.missingEntries = missingEntries;
  }
}

type ValidateChangelogOptions = {
  changelogContent: string;
  currentVersion?: Version;
  repoUrl: string;
  isReleaseCandidate: boolean;
  tagPrefix?: string;
  formatter?: Formatter;
  /**
   * The package rename properties, used in case of package is renamed
   */
  packageRename?: PackageRename;
  /**
   * Whether to validate that each changelog entry has one or more links to
   * associated pull requests within the repository (true) or not (false).
   */
  ensureValidPrLinksPresent?: boolean;
  /**
   * Dependency changes result from git diff analysis.
   * When provided, the changelog will be checked for entries corresponding to
   * each dependency bump. The versionBump field determines which section to check:
   * if provided, entries are checked in that version's section; otherwise Unreleased.
   */
  dependencyResult?: DependencyCheckResult;
};

/**
 * Checks if a changelog already has an entry for a dependency change.
 *
 * @param releaseChanges - The release changes to search.
 * @param change - The dependency change to look for.
 * @returns True if an entry exists for this dependency bump.
 */

/**
 * Validates that a changelog is well-formatted.
 *
 * @param options - Validation options.
 * @param options.changelogContent - The current changelog.
 * @param options.currentVersion - The current version. Required if
 * `isReleaseCandidate` is set, but optional otherwise.
 * @param options.repoUrl - The GitHub repository URL for the current
 * project.
 * @param options.isReleaseCandidate - Denotes whether the current project is in
 * the midst of release preparation or not. If this is set, this command will
 * also ensure the current version is represented in the changelog with a
 * header, and that there are no unreleased changes present.
 * @param options.tagPrefix - The prefix used in tags before the version number.
 * @param options.formatter - A custom Markdown formatter to use.
 * @param options.packageRename - The package rename properties.
 * An optional, which is required only in case of package renamed.
 * @param options.ensureValidPrLinksPresent - Whether to validate that each
 * changelog entry has one or more links to associated pull requests within the
 * repository (true) or not (false).
 * @param options.dependencyResult - Dependency changes result from git diff analysis.
 * When provided, the changelog will be checked for entries corresponding to
 * each dependency bump. The versionBump field determines which section to check:
 * if provided, entries are checked in that version's section; otherwise Unreleased.
 * @throws `InvalidChangelogError` - Will throw if the changelog is invalid
 * @throws `MissingCurrentVersionError` - Will throw if `isReleaseCandidate` is
 * `true` and the changelog is missing the release header for the current
 * version.
 * @throws `UnreleasedChangesError` - Will throw if `isReleaseCandidate` is
 * `true` and the changelog contains unreleased changes.
 * @throws `UnreleasedChangesError` - Will throw if `isReleaseCandidate` is
 * `true` and the changelog contains uncategorized changes.
 * @throws `ChangelogFormattingError` - Will throw if there is a formatting error.
 * @throws `MissingPullRequestLinkError` if a changelog entry is missing a pull
 * request link.
 * @throws `MissingDependencyEntriesError` if dependency changes are provided
 * but the changelog is missing entries for them.
 */
export async function validateChangelog({
  changelogContent,
  currentVersion,
  repoUrl,
  isReleaseCandidate,
  tagPrefix = 'v',
  formatter = undefined,
  packageRename,
  ensureValidPrLinksPresent,
  dependencyResult,
}: ValidateChangelogOptions) {
  const changelog = parseChangelog({
    changelogContent,
    repoUrl,
    tagPrefix,
    formatter,
    packageRename,
    shouldExtractPrLinks: ensureValidPrLinksPresent,
  });
  const hasUnreleasedChanges =
    Object.keys(changelog.getUnreleasedChanges()).length !== 0;
  const releaseChanges = currentVersion
    ? changelog.getReleaseChanges(currentVersion)
    : undefined;

  if (isReleaseCandidate) {
    if (!currentVersion) {
      throw new Error(
        `A version must be specified if 'isReleaseCandidate' is set.`,
      );
    } else if (
      !changelog
        .getReleases()
        .find((release) => release.version === currentVersion)
    ) {
      throw new MissingCurrentVersionError(currentVersion);
    } else if (hasUnreleasedChanges) {
      throw new UnreleasedChangesError();
    } else if (
      releaseChanges?.[ChangeCategory.Uncategorized]?.length &&
      releaseChanges?.[ChangeCategory.Uncategorized]?.length !== 0
    ) {
      throw new UncategorizedChangesError();
    }
  }

  if (ensureValidPrLinksPresent) {
    for (const release of changelog.getReleases()) {
      const releaseChangesForVersion = changelog.getReleaseChanges(
        release.version,
      );
      for (const changes of Object.values(releaseChangesForVersion)) {
        for (const change of changes) {
          if (change.prNumbers.length === 0) {
            throw new MissingPullRequestLinksError(change, release.version);
          }
        }
      }
    }
  }

  // Validate dependency bump entries if provided
  const dependencyChanges = dependencyResult?.dependencyChanges;
  if (dependencyChanges && dependencyChanges.length > 0) {
    // Check in the appropriate section: use versionBump if provided, otherwise Unreleased
    const changesSection = dependencyResult.versionBump
      ? changelog.getReleaseChanges(dependencyResult.versionBump)
      : changelog.getUnreleasedChanges();

    const missingEntries: DependencyChange[] = [];

    // If changesSection is undefined/empty, all entries are missing
    if (!changesSection || Object.keys(changesSection).length === 0) {
      missingEntries.push(...dependencyChanges);
    } else {
      for (const depChange of dependencyChanges) {
        if (!hasChangelogEntry(changesSection, depChange).hasExactMatch) {
          missingEntries.push(depChange);
        }
      }
    }

    if (missingEntries.length > 0) {
      throw new MissingDependencyEntriesError(missingEntries);
    }
  }

  const validChangelog = await changelog.toString();
  if (validChangelog !== changelogContent) {
    throw new ChangelogFormattingError({
      validChangelog,
      invalidChangelog: changelogContent,
    });
  }
}
