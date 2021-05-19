import { Version } from './constants';
import { parseChangelog } from './parseChangelog';

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

/**
 * Indicates that the release header for the current version is missing.
 */
export class MissingCurrentVersionError extends InvalidChangelogError {
  /**
   * @param currentVersion - The current version
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
   * @param options
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

interface ValidateChangelogOptions {
  changelogContent: string;
  currentVersion: Version;
  repoUrl: string;
  isReleaseCandidate: boolean;
}

/**
 * Validates that a changelog is well-formatted.
 *
 * @param options
 * @param options.changelogContent - The current changelog
 * @param options.currentVersion - The current version
 * @param options.repoUrl - The GitHub repository URL for the current
 * project.
 * @param options.isReleaseCandidate - Denotes whether the current project is in
 * the midst of release preparation or not. If this is set, this command will
 * also ensure the current version is represented in the changelog with a
 * header, and that there are no unreleased changes present.
 */
export function validateChangelog({
  changelogContent,
  currentVersion,
  repoUrl,
  isReleaseCandidate,
}: ValidateChangelogOptions) {
  const changelog = parseChangelog({ changelogContent, repoUrl });

  // Ensure release header exists, if necessary
  if (
    isReleaseCandidate &&
    !changelog
      .getReleases()
      .find((release) => release.version === currentVersion)
  ) {
    throw new MissingCurrentVersionError(currentVersion);
  }

  const hasUnreleasedChanges =
    Object.keys(changelog.getUnreleasedChanges()).length !== 0;
  if (isReleaseCandidate && hasUnreleasedChanges) {
    throw new UnreleasedChangesError();
  }

  const validChangelog = changelog.toString();
  if (validChangelog !== changelogContent) {
    throw new ChangelogFormattingError({
      validChangelog,
      invalidChangelog: changelogContent,
    });
  }
}