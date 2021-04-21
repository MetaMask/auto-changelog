const { parseChangelog } = require('./parseChangelog');

/**
 * @typedef {import('./constants.js').Version} Version
 */

/**
 * Indicates that the changelog is invalid.
 */
class InvalidChangelogError extends Error {}

/**
 * Indicates that unreleased changes are still present in the changelog.
 */
class UnreleasedChangesError extends InvalidChangelogError {
  constructor() {
    super('Unreleased changes present in the changelog');
  }
}

/**
 * Indicates that the release header for the current version is missing.
 */
class MissingCurrentVersionError extends InvalidChangelogError {
  /**
   * @param {Version} currentVersion - The current version
   */
  constructor(currentVersion) {
    super(`Current version missing from changelog: '${currentVersion}'`);
  }
}

/**
 * Represents a formatting error in a changelog.
 */
class ChangelogFormattingError extends InvalidChangelogError {
  /**
   * @param {Object} options
   * @param {string} options.validChangelog - The string contents of the well-
   *   formatted changelog.
   * @param {string} options.invalidChangelog - The string contents of the
   *   malformed changelog.
   */
  constructor({ validChangelog, invalidChangelog }) {
    super('Changelog is not well-formatted');
    this.data = {
      validChangelog,
      invalidChangelog,
    };
  }
}

/**
 * Validates that a changelog is well-formatted.
 * @param {Object} options
 * @param {string} options.changelogContent - The current changelog
 * @param {Version} options.currentVersion - The current version
 * @param {string} options.repoUrl - The GitHub repository URL for the current
 *   project.
 * @param {boolean} options.isReleaseCandidate - Denotes whether the current
 *   project is in the midst of release preparation or not. If this is set, this
 *   command will also ensure the current version is represented in the
 *   changelog with a release header, and that there are no unreleased changes
 *   present.
 * @throws {InvalidChangelogError} Will throw if the changelog is invalid
 * @throws {MissingCurrentVersionError} Will throw if `isReleaseCandidate` is
 *   `true` and the changelog is missing the release header for the current
 *   version.
 * @throws {UnreleasedChangesError} Will throw if `isReleaseCandidate` is
 *   `true` and the changelog contains unreleased changes.
 * @throws {ChangelogFormattingError} Will throw if there is a formatting error.
 */
function validateChangelog({
  changelogContent,
  currentVersion,
  repoUrl,
  isReleaseCandidate,
}) {
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

  const hasUnreleasedChanges = changelog.getUnreleasedChanges().length !== 0;
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

module.exports = {
  ChangelogFormattingError,
  InvalidChangelogError,
  MissingCurrentVersionError,
  UnreleasedChangesError,
  validateChangelog,
};
