import { Formatter } from './changelog';
import { Version, ChangeCategory } from './constants';
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
};

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
 * @throws `InvalidChangelogError` - Will throw if the changelog is invalid
 * @throws `MissingCurrentVersionError` - Will throw if `isReleaseCandidate` is
 * `true` and the changelog is missing the release header for the current
 * version.
 * @throws `UnreleasedChangesError` - Will throw if `isReleaseCandidate` is
 * `true` and the changelog contains unreleased changes.
 * @throws `UnreleasedChangesError` - Will throw if `isReleaseCandidate` is
 * `true` and the changelog contains uncategorized changes.
 * @throws `ChangelogFormattingError` - Will throw if there is a formatting error.
 */
export function validateChangelog({
  changelogContent,
  currentVersion,
  repoUrl,
  isReleaseCandidate,
  tagPrefix = 'v',
  formatter = undefined,
  packageRename,
}: ValidateChangelogOptions) {
  const changelog = parseChangelog({
    changelogContent,
    repoUrl,
    tagPrefix,
    formatter,
    packageRename,
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

  const validChangelog = changelog.toString();
  if (validChangelog !== changelogContent) {
    throw new ChangelogFormattingError({
      validChangelog,
      invalidChangelog: changelogContent,
    });
  }
}
