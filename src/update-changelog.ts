import { strict as assert } from 'assert';
import execa from 'execa';

import type Changelog from './changelog';
import { Formatter, getKnownPropertyNames } from './changelog';
import { ChangeCategory, Version, ConventionalCommitType } from './constants';
import { parseChangelog } from './parse-changelog';
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
  await runCommand('git', ['fetch', '--tags']);

  let mostRecentTagCommitHash: string | null = null;
  for (const tagPrefix of tagPrefixes) {
    const revListArgs = [
      'rev-list',
      `--tags=${tagPrefix}*`,
      '--max-count=1',
      '--date-order',
    ];
    const results = await runCommand('git', revListArgs);
    if (results.length) {
      mostRecentTagCommitHash = results[0];
      break;
    }
  }

  if (mostRecentTagCommitHash === null) {
    return null;
  }
  const [mostRecentTag] = await runCommand('git', [
    'describe',
    '--tags',
    mostRecentTagCommitHash,
  ]);
  return mostRecentTag;
}

/**
 * Get commit details for each given commit hash.
 *
 * @param commitHashes - The list of commit hashes.
 * @returns Commit details for each commit, including description and PR number (if present).
 */
async function getCommits(commitHashes: string[]) {
  const commits: { prNumber?: string; description: string }[] = [];
  for (const commitHash of commitHashes) {
    const [subject] = await runCommand('git', [
      'show',
      '-s',
      '--format=%s',
      commitHash,
    ]);
    assert.ok(
      Boolean(subject),
      `"git show" returned empty subject for commit "${commitHash}".`,
    );

    let matchResults = subject.match(/\(#(\d+)\)/u);
    let prNumber: string | undefined;
    let description = subject;

    if (matchResults) {
      // Squash & Merge: the commit subject is parsed as `<description> (#<PR ID>)`
      prNumber = matchResults[1];
      description = subject.match(/^(.+)\s\(#\d+\)/u)?.[1] ?? '';
    } else {
      // Merge: the PR ID is parsed from the git subject (which is of the form `Merge pull request
      // #<PR ID> from <branch>`, and the description is assumed to be the first line of the body.
      // If no body is found, the description is set to the commit subject
      matchResults = subject.match(/#(\d+)\sfrom/u);
      if (matchResults) {
        prNumber = matchResults[1];
        const [firstLineOfBody] = await runCommand('git', [
          'show',
          '-s',
          '--format=%b',
          commitHash,
        ]);
        description = firstLineOfBody || subject;
      }
    }
    // Otherwise:
    // Normal commits: The commit subject is the description, and the PR ID is omitted.

    commits.push({ prNumber, description });
  }
  return commits;
}

/**
 * Get all change descriptions from a changelog.
 *
 * @param changelog - The changelog.
 * @returns All commit descriptions included in the given changelog.
 */
function getAllChangeDescriptions(changelog: Changelog) {
  const releases = changelog.getReleases();
  const changeDescriptions = Object.values(
    changelog.getUnreleasedChanges(),
  ).flat();
  for (const release of releases) {
    changeDescriptions.push(
      ...Object.values(changelog.getReleaseChanges(release.version)).flat(),
    );
  }
  return changeDescriptions;
}

/**
 * Get all pull request numbers included in the given changelog.
 *
 * @param changelog - The changelog.
 * @returns All pull request numbers included in the given changelog.
 */
function getAllLoggedPrNumbers(changelog: Changelog) {
  const changeDescriptions = getAllChangeDescriptions(changelog);

  const prNumbersWithChangelogEntries = [];
  for (const description of changeDescriptions) {
    if (!description) {
      continue;
    }
    const matchResults = description.matchAll(/\[#(\d+)\]/gu);
    const prNumbers = Array.from(matchResults, (result) => result[1]);
    prNumbersWithChangelogEntries.push(...prNumbers);
  }

  return prNumbersWithChangelogEntries;
}

/**
 * Get all commit hashes included in the given commit range.
 *
 * @param commitRange - The commit range.
 * @param rootDirectory - The project root directory.
 * @returns A list of commit hashes for the given range.
 */
async function getCommitHashesInRange(
  commitRange: string,
  rootDirectory?: string,
) {
  const revListArgs = ['rev-list', commitRange];
  if (rootDirectory) {
    revListArgs.push(rootDirectory);
  }
  return await runCommand('git', revListArgs);
}

type AddNewCommitsOptions = {
  mostRecentTag: string | null;
  repoUrl: string;
  loggedPrNumbers: string[];
  projectRootDirectory?: string;
};

/**
 * Get the list of new change entries to add to a changelog.
 *
 * @param options - Options.
 * @param options.mostRecentTag - The most recent tag.
 * @param options.repoUrl - The GitHub repository URL for the current project.
 * @param options.loggedPrNumbers - A list of all pull request numbers included in the relevant parsed changelog.
 * @param options.projectRootDirectory - The root project directory, used to
 * filter results from various git commands. This path is assumed to be either
 * absolute, or relative to the current directory. Defaults to the root of the
 * current git repository.
 * @returns A list of new change entries to add to the changelog, based on commits made since the last release.
 */
export async function getNewChangeEntries({
  mostRecentTag,
  repoUrl,
  loggedPrNumbers,
  projectRootDirectory,
}: AddNewCommitsOptions) {
  const commitRange =
    mostRecentTag === null ? 'HEAD' : `${mostRecentTag}..HEAD`;
  const commitsHashesSinceLastRelease = await getCommitHashesInRange(
    commitRange,
    projectRootDirectory,
  );
  const commits = await getCommits(commitsHashesSinceLastRelease);

  const newCommits = commits.filter(
    ({ prNumber }) => !prNumber || !loggedPrNumbers.includes(prNumber),
  );

  return newCommits.map(({ prNumber, description }) => {
    if (prNumber) {
      const suffix = `([#${prNumber}](${repoUrl}/pull/${prNumber}))`;
      return `${description} ${suffix}`;
    }
    return description;
  });
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
}: UpdateChangelogOptions): Promise<string | undefined> {
  const changelog = parseChangelog({
    changelogContent,
    repoUrl,
    tagPrefix: tagPrefixes[0],
    formatter,
    packageRename,
  });

  console.log(`autoCategorize: ${autoCategorize}`);

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
  });

  for (const description of newChangeEntries.reverse()) {
    const category = autoCategorize
      ? getCategory(description)
      : ChangeCategory.Uncategorized;

    changelog.addChange({
      version: isReleaseCandidate ? currentVersion : undefined,
      category,
      description,
    });
  }

  const newChangelogContent = await changelog.toString();
  const isChangelogUpdated = changelogContent !== newChangelogContent;
  return isChangelogUpdated ? newChangelogContent : undefined;
}

/**
 * Executes a shell command in a child process and returns what it wrote to
 * stdout, or rejects if the process exited with an error.
 *
 * @param command - The command to run, e.g. "git".
 * @param args - The arguments to the command.
 * @returns An array of the non-empty lines returned by the command.
 */
async function runCommand(command: string, args: string[]): Promise<string[]> {
  return (await execa(command, [...args])).stdout
    .trim()
    .split('\n')
    .filter((line) => line !== '');
}

/**
 * Determine the category of a change based on the commit message prefix.
 *
 * @param description - The commit message description.
 * @returns The category of the change.
 */
function getCategory(description: string): ChangeCategory {
  // Check if description contains a colon
  if (description.includes(':')) {
    const [prefix] = description.split(':').map((part) => part.trim());
    switch (prefix) {
      case ConventionalCommitType.Feat:
        return ChangeCategory.Added;
      case ConventionalCommitType.Fix:
        return ChangeCategory.Fixed;
      default:
        return ChangeCategory.Uncategorized;
    }
  }

  // Return 'Uncategorized' if no colon is found or prefix doesn't match
  return ChangeCategory.Uncategorized;
}
