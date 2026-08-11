import type Changelog from './changelog';
import { Formatter, getKnownPropertyNames } from './changelog';
import {
  ChangeCategory,
  ConventionalCommitType,
  Version,
  CHANGELOG_VERB_TO_CATEGORY,
  keywordsToIndicateExcluded,
} from './constants';
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
  // Ensure we have all tags on remote (overwrite if necessary)
  await runCommandAndSplit('git', ['fetch', '--tags', '--force']);

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

/**
 * Get all change descriptions included in the given changelog.
 * Descriptions are trimmed to match the normalization applied during comparison.
 *
 * @param changelog - The changelog.
 * @returns All change descriptions included in the given changelog, trimmed.
 */
function getAllLoggedDescriptions(changelog: Changelog) {
  return getAllChanges(changelog).map((change) => change.description.trim());
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
  useChangelogEntry?: boolean;
  /**
   * Whether to use short PR links in the changelog entries.
   */
  useShortPrLink?: boolean;
  /**
   * Whether to require PR numbers for all commits. If true, commits without PR numbers are filtered out.
   */
  requirePrNumbers?: boolean;
  /**
   * Whether to convert recognized leading imperative verbs to past tense.
   */
  normalizeToPastTense?: boolean;
  /**
   * Whether to exclude `chore:` commits that lack a changelog entry.
   */
  excludeChoreWithoutChangelogEntry?: boolean;
  /**
   * Whether to prevent automatically adding commits that precede an entry
   * already present in the target changelog section.
   */
  preventBackfill?: boolean;
  /**
   * Whether to print commit-level update diagnostics to stderr.
   */
  verbose?: boolean;
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
 * @param options.requirePrNumbers - Whether to require PR numbers for all commits. If true, commits without PR numbers are filtered out.
 * @param options.normalizeToPastTense - Whether to convert recognized leading imperative verbs to past tense.
 * @param options.excludeChoreWithoutChangelogEntry - Whether to exclude `chore:` commits that lack a changelog entry.
 * @param options.preventBackfill - Whether to skip commits older than the target changelog section frontier.
 * @param options.verbose - Whether to print commit-level update diagnostics to stderr.
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
  useChangelogEntry = false,
  useShortPrLink = false,
  requirePrNumbers = false,
  normalizeToPastTense = false,
  excludeChoreWithoutChangelogEntry = false,
  preventBackfill = false,
  verbose = false,
}: UpdateChangelogOptions): Promise<string | undefined> {
  const changelog = parseChangelog({
    changelogContent,
    repoUrl,
    tagPrefix: tagPrefixes[0],
    formatter,
    packageRename,
    shouldExtractPrLinks: true, // By setting this to true, we ensure we don't re-add a PR to the changelog if it was already added in previous releases
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

  const targetChanges = isReleaseCandidate
    ? changelog.getReleaseChanges(currentVersion as Version)
    : changelog.getUnreleasedChanges();
  const targetSectionPrNumbers = Object.values(targetChanges)
    .flat()
    .flatMap((change) => change.prNumbers);

  const newChangeEntries = await getNewChangeEntries({
    mostRecentTag,
    repoUrl,
    loggedPrNumbers: getAllLoggedPrNumbers(changelog),
    loggedDescriptions: getAllLoggedDescriptions(changelog),
    targetSectionPrNumbers,
    projectRootDirectory,
    useChangelogEntry,
    useShortPrLink,
    requirePrNumbers,
    normalizeToPastTense,
    preventBackfill,
    verbose,
  });

  for (const entry of newChangeEntries.reverse()) {
    const category = autoCategorize
      ? getCategory(
          entry.subject,
          entry.hasChangelogEntry,
          excludeChoreWithoutChangelogEntry,
        )
      : ChangeCategory.Uncategorized;

    if (category !== ChangeCategory.Excluded) {
      changelog.addChange({
        version: isReleaseCandidate ? currentVersion : undefined,
        category,
        description: entry.description,
      });
      if (verbose) {
        console.error(
          `[auto-changelog] emitted category=${category} description=${JSON.stringify(entry.description)}`,
        );
      }
    }
  }

  const newChangelogContent = await changelog.toString(useShortPrLink);
  const isChangelogUpdated = changelogContent !== newChangelogContent;
  return isChangelogUpdated ? newChangelogContent : undefined;
}

/**
 * Determine the category of a change based on the commit message prefix.
 *
 * @param description - The commit message description.
 * @param hasChangelogEntry - Whether the description came from an explicit
 * `CHANGELOG entry:`. When true, a `chore:`-prefixed change is categorized by
 * its leading verb instead of being excluded, so an author-provided entry is
 * respected.
 * @param excludeChoreWithoutChangelogEntry - Whether to exclude `chore:`
 * commits without a changelog entry.
 * @returns The category of the change.
 */
export function getCategory(
  description: string,
  hasChangelogEntry = false,
  excludeChoreWithoutChangelogEntry = false,
): ChangeCategory {
  // Check whether the commit description includes exclusion keywords
  if (checkIfDescriptionIndicatesExcluded(description)) {
    return ChangeCategory.Excluded;
  }

  // Get array of all ConventionalCommitType values
  const conventionalCommitTypes = Object.values(ConventionalCommitType);

  // Create a regex pattern that matches any of the ConventionalCommitTypes
  const typesWithPipe = conventionalCommitTypes.join('|');
  const conventionalCommitPattern = new RegExp(
    `^(${typesWithPipe})\\s*(\\([^)]*\\))?:.*$`,
    'ui',
  );

  const match = description.match(conventionalCommitPattern);

  // The text fed to the leading-verb heuristic below. Defaults to the whole
  // description (the no-prefix case) and is reassigned to the prefix-stripped
  // text when a category-less prefix such as `chore:` is present.
  let descriptionForVerb = description;

  // Strip a leading Conventional Commit prefix (with optional scope), e.g.
  // `chore(deps): ` or `perf: `, so the verb of the remaining text (e.g.
  // "Removed ...") can be recognized by the leading-verb heuristic.
  const stripPrefix = (text: string): string =>
    text.replace(
      new RegExp(`^(${typesWithPipe})\\s*(\\([^)]*\\))?:\\s*`, 'iu'),
      '',
    );

  if (match) {
    const prefix = match[1]?.toLowerCase(); // Always use lowercase for consistency
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
      // A `chore:` commit with no authored `CHANGELOG entry:` is a CI/internal
      // change that is not user-facing, so exclude it from the changelog. When
      // an entry was authored, fall through so the entry's leading verb can
      // still categorize it.
      case ConventionalCommitType.CHORE:
        if (excludeChoreWithoutChangelogEntry && !hasChangelogEntry) {
          return ChangeCategory.Excluded;
        }
        descriptionForVerb = stripPrefix(description);
        break;
      // For other prefixes that carry no category information (e.g. perf,
      // docs, bump, revert), strip the prefix and fall through to the
      // leading-verb heuristic below so a well-written entry can still be
      // categorized.
      default:
        descriptionForVerb = stripPrefix(description);
        break;
    }
  }

  // No usable Conventional Commit prefix: categorize from the entry's leading
  // "Keep a Changelog" verb (past tense, e.g. "Fixed a bug...") if recognized.
  const leadingVerbCategory = getCategoryFromLeadingVerb(descriptionForVerb);
  if (leadingVerbCategory) {
    return leadingVerbCategory;
  }

  // Nothing matched: no recognizable prefix and no recognized leading verb.
  return ChangeCategory.Uncategorized;
}

/**
 * Determine a category from the leading verb of a "Keep a Changelog"-style
 * entry (e.g. "Added ...", "Fixed ...", "Updated ...").
 *
 * @param description - The changelog entry / commit description.
 * @returns The matched category, or `undefined` if the first word is not a
 * recognized verb.
 */
function getCategoryFromLeadingVerb(
  description: string,
): ChangeCategory | undefined {
  const firstWord = description.trim().match(/^([A-Za-z]+)/u)?.[1];

  if (!firstWord) {
    return undefined;
  }

  return CHANGELOG_VERB_TO_CATEGORY[firstWord.toLowerCase()];
}

/**
 * Escape characters that are special inside a regular expression so a literal
 * keyword can be embedded safely.
 *
 * @param value - The literal string to escape.
 * @returns The escaped string.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Check whether the commit description includes exclusion keywords.
 *
 * Keywords are matched on word boundaries rather than as bare substrings, so a
 * short keyword such as `oidc` matches "OIDC token exchange" but not the middle
 * of an unrelated word like "avoidcache". Keywords that legitimately end in a
 * hyphen (e.g. `cp-`, `infra-`) still match their ticket forms (`cp-1234`)
 * because the boundary falls between the hyphen and the following digit.
 *
 * @param description - The raw or processed commit description.
 * @returns True if the description contains any exclusion keywords; otherwise false.
 */
function checkIfDescriptionIndicatesExcluded(description: string): boolean {
  const _description = description.toLowerCase();

  return keywordsToIndicateExcluded.some((word) => {
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'u');
    return pattern.test(_description);
  });
}
