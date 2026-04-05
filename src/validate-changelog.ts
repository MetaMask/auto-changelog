import Changelog, { Change, type DependencyBump, Formatter } from './changelog';
import { Version, ChangeCategory } from './constants';
import { findDependencyBumpChangelogEntry } from './find-dependency-bump-changelog-entry';
import type { DependencyCheckResult } from './get-dependency-changes';
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
 * Indicates that a release has no changelog entries.
 */
export class EmptyReleaseError extends InvalidChangelogError {
  constructor(releaseVersion: Version) {
    super(`Release has no changelog entries: '${releaseVersion}'`);
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
  readonly missingEntries: DependencyBump[];

  readonly currentVersion: string | undefined;

  readonly changelog: Changelog;

  /**
   * Construct a missing dependency entries error.
   *
   * @param missingEntries - The dependency changes missing from the changelog.
   * @param changelog - The parsed changelog instance for reuse.
   * @param currentVersion - The current version being validated against.
   */
  constructor(
    missingEntries: DependencyBump[],
    changelog: Changelog,
    currentVersion?: string,
  ) {
    const deps = missingEntries.map((entry) => entry.dependency).join(', ');
    super(`Missing changelog entries for dependency bumps: ${deps}`);
    this.missingEntries = missingEntries;
    this.changelog = changelog;
    this.currentVersion = currentVersion;
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
   * Dependency changes detected from comparing package manifests.
   * When provided, the changelog will be checked for entries corresponding to
   * each dependency bump. If `versionChanged` is true, entries are checked
   * in the `currentVersion` release section; otherwise the Unreleased section.
   */
  dependencyCheckResult?: DependencyCheckResult;
};

/**
 * Normalize line endings to Unix style (LF).
 *
 * This ensures changelog validation behaves consistently across platforms.
 *
 * @param value - The string to normalize.
 * @returns The string with all CRLF/CR converted to LF.
 */
function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/gu, '\n').replace(/\r/gu, '\n');
}

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
 * @param options.dependencyCheckResult - Dependency changes detected from
 * comparing package manifests. When provided, the changelog will be checked for
 * entries corresponding to each dependency bump. If `versionChanged` is true,
 * entries are checked in the `currentVersion` release section; otherwise the
 * Unreleased section.
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
  dependencyCheckResult,
}: ValidateChangelogOptions) {
  const normalizedChangelogContent = normalizeLineEndings(changelogContent);
  const changelog = parseChangelog({
    changelogContent: normalizedChangelogContent,
    repoUrl,
    tagPrefix,
    formatter,
    packageRename,
    shouldExtractPrLinks: ensureValidPrLinksPresent,
  });

  validateReleaseCandidateState(changelog, isReleaseCandidate, currentVersion);

  if (ensureValidPrLinksPresent) {
    validatePrLinks(changelog);
  }

  if (dependencyCheckResult) {
    validateDependencyBumps(changelog, dependencyCheckResult, currentVersion);
  }

  await validateFormatting(changelog, normalizedChangelogContent);

  validateNonEmptyReleases(changelog);
}

/**
 * Validate release candidate constraints: version header exists, no
 * unreleased changes, and no uncategorized changes.
 *
 * @param changelog - The parsed changelog.
 * @param isReleaseCandidate - Whether this is a release candidate.
 * @param currentVersion - The current version.
 */
function validateReleaseCandidateState(
  changelog: Changelog,
  isReleaseCandidate: boolean,
  currentVersion: Version | undefined,
) {
  if (!isReleaseCandidate) {
    return;
  }

  if (!currentVersion) {
    throw new Error(
      `A version must be specified if 'isReleaseCandidate' is set.`,
    );
  }

  if (
    !changelog
      .getReleases()
      .find((release) => release.version === currentVersion)
  ) {
    throw new MissingCurrentVersionError(currentVersion);
  }

  const hasUnreleasedChanges =
    Object.keys(changelog.getUnreleasedChanges()).length !== 0;
  if (hasUnreleasedChanges) {
    throw new UnreleasedChangesError();
  }

  const releaseChanges = changelog.getReleaseChanges(currentVersion);
  if (
    releaseChanges?.[ChangeCategory.Uncategorized]?.length &&
    releaseChanges?.[ChangeCategory.Uncategorized]?.length !== 0
  ) {
    throw new UncategorizedChangesError();
  }
}

/**
 * Validate that every change entry has at least one PR link.
 *
 * @param changelog - The parsed changelog.
 */
function validatePrLinks(changelog: Changelog) {
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

/**
 * Validate that dependency bumps detected in the diff have corresponding
 * changelog entries.
 *
 * @param changelog - The parsed changelog.
 * @param dependencyCheckResult - The dependency check result from the diff.
 * @param currentVersion - The current version.
 */
function validateDependencyBumps(
  changelog: Changelog,
  dependencyCheckResult: DependencyCheckResult,
  currentVersion: Version | undefined,
) {
  const { dependencyChanges } = dependencyCheckResult;
  if (!dependencyChanges || dependencyChanges.length === 0) {
    return;
  }

  const releaseChanges = currentVersion
    ? changelog.getReleaseChanges(currentVersion)
    : undefined;

  // Check the release section only when the package version was actually
  // bumped (versionChanged) AND the release header exists. On a release
  // branch where this package is NOT being released, entries belong in
  // Unreleased. Fall back to Unreleased when the release section is missing.
  const changesSection =
    dependencyCheckResult.versionChanged && currentVersion && releaseChanges
      ? releaseChanges
      : changelog.getUnreleasedChanges();

  const missingEntries: DependencyBump[] = [];
  const effectiveChangesSection = changesSection ?? {};

  if (Object.keys(effectiveChangesSection).length === 0) {
    missingEntries.push(...dependencyChanges);
  } else {
    for (const depChange of dependencyChanges) {
      const result = findDependencyBumpChangelogEntry(
        effectiveChangesSection,
        depChange,
      );
      if (!result.hasExactMatch) {
        // Check if the entry exists with wrong breaking status
        const wrongBreaking = findDependencyBumpChangelogEntry(
          effectiveChangesSection,
          {
            ...depChange,
            isBreaking: !depChange.isBreaking,
          },
        );
        if (wrongBreaking.existingEntry) {
          const expected = depChange.isBreaking
            ? 'with **BREAKING:** prefix (peerDependency)'
            : 'without **BREAKING:** prefix (regular dependency)';
          throw new InvalidChangelogError(
            `Dependency \`${depChange.dependency}\` has a changelog entry but ${expected} is expected`,
          );
        }
        missingEntries.push(depChange);
      }
    }
  }

  if (missingEntries.length > 0) {
    throw new MissingDependencyEntriesError(
      missingEntries,
      changelog,
      currentVersion,
    );
  }
}

/**
 * Validate that the stringified changelog matches the original content.
 *
 * @param changelog - The parsed changelog.
 * @param normalizedContent - The normalized original changelog content.
 */
async function validateFormatting(
  changelog: Changelog,
  normalizedContent: string,
) {
  const validChangelog = await changelog.toString();
  if (normalizeLineEndings(validChangelog) !== normalizedContent) {
    throw new ChangelogFormattingError({
      validChangelog,
      invalidChangelog: normalizedContent,
    });
  }
}

/**
 * Validate that every release has at least one changelog entry.
 *
 * @param changelog - The parsed changelog.
 */
function validateNonEmptyReleases(changelog: Changelog) {
  for (const release of changelog.getReleases()) {
    const releaseChangesForVersion = changelog.getReleaseChanges(
      release.version,
    );
    const numberOfEntries = Object.values(releaseChangesForVersion).reduce(
      (total, changes) => total + changes.length,
      0,
    );

    if (numberOfEntries === 0) {
      throw new EmptyReleaseError(release.version);
    }
  }
}
