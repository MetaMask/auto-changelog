import { strict as assert } from 'assert';
import runCommand from './run-command';
import { parseChangelog } from './parse-changelog';
import { ChangeCategory, Version } from './constants';
import type Changelog from './changelog';

async function getMostRecentTag({
  projectRootDirectory,
}: {
  projectRootDirectory?: string;
}) {
  const revListArgs = ['rev-list', '--tags', '--max-count=1'];
  if (projectRootDirectory) {
    revListArgs.push(projectRootDirectory);
  }
  const results = await runCommand('git', revListArgs);
  if (results.length === 0) {
    return null;
  }
  const [mostRecentTagCommitHash] = results;
  const [mostRecentTag] = await runCommand('git', [
    'describe',
    '--tags',
    mostRecentTagCommitHash,
  ]);
  assert.equal(mostRecentTag[0], 'v', 'Most recent tag should start with v');
  return mostRecentTag;
}

async function getCommits(commitHashes: string[]) {
  const commits: { prNumber?: string; description: string }[] = [];
  for (const commitHash of commitHashes) {
    const [subject] = await runCommand('git', [
      'show',
      '-s',
      '--format=%s',
      commitHash,
    ]);

    let matchResults = subject.match(/\(#(\d+)\)/u);
    let prNumber: string | undefined;
    let description = subject;

    if (matchResults) {
      // Squash & Merge: the commit subject is parsed as `<description> (#<PR ID>)`
      prNumber = matchResults[1];
      description = subject.match(/^(.+)\s\(#\d+\)/u)?.[1] || '';
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

function getAllLoggedPrNumbers(changelog: Changelog) {
  const changeDescriptions = getAllChangeDescriptions(changelog);

  const prNumbersWithChangelogEntries = [];
  for (const description of changeDescriptions) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const matchResults = description!.match(/\[#(\d+)\]/u);
    if (matchResults === null) {
      continue;
    }
    const prNumber = matchResults[1];
    prNumbersWithChangelogEntries.push(prNumber);
  }

  return prNumbersWithChangelogEntries;
}

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

export interface UpdateChangelogOptions {
  changelogContent: string;
  currentVersion?: Version;
  repoUrl: string;
  isReleaseCandidate: boolean;
  projectRootDirectory?: string;
}

/**
 * Update a changelog with any commits made since the last release. Commits for
 * PRs that are already included in the changelog are omitted.
 * @param options
 * @param options.changelogContent - The current changelog
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
 * @returns The updated changelog text
 */
export async function updateChangelog({
  changelogContent,
  currentVersion,
  repoUrl,
  isReleaseCandidate,
  projectRootDirectory,
}: UpdateChangelogOptions) {
  if (isReleaseCandidate && !currentVersion) {
    throw new Error(
      `A version must be specified if 'isReleaseCandidate' is set.`,
    );
  }
  const changelog = parseChangelog({ changelogContent, repoUrl });

  // Ensure we have all tags on remote
  await runCommand('git', ['fetch', '--tags']);
  const mostRecentTag = await getMostRecentTag({ projectRootDirectory });

  if (isReleaseCandidate && mostRecentTag === `v${currentVersion}`) {
    throw new Error(
      `Current version already has tag, which is unexpected for a release candidate.`,
    );
  }

  const commitRange =
    mostRecentTag === null ? 'HEAD' : `${mostRecentTag}..HEAD`;
  const commitsHashesSinceLastRelease = await getCommitHashesInRange(
    commitRange,
    projectRootDirectory,
  );
  const commits = await getCommits(commitsHashesSinceLastRelease);

  const loggedPrNumbers = getAllLoggedPrNumbers(changelog);
  const newCommits = commits.filter(
    ({ prNumber }) =>
      prNumber === undefined || !loggedPrNumbers.includes(prNumber),
  );

  const hasUnreleasedChanges =
    Object.keys(changelog.getUnreleasedChanges()).length !== 0;
  if (
    newCommits.length === 0 &&
    (!isReleaseCandidate || hasUnreleasedChanges)
  ) {
    return undefined;
  }

  // Ensure release header exists, if necessary
  if (
    isReleaseCandidate &&
    !changelog
      .getReleases()
      .find((release) => release.version === currentVersion)
  ) {
    // Typecast: currentVersion will be defined here due to type guard at the
    // top of this function.
    changelog.addRelease({ version: currentVersion as Version });
  }

  if (isReleaseCandidate && hasUnreleasedChanges) {
    // Typecast: currentVersion will be defined here due to type guard at the
    // top of this function.
    changelog.migrateUnreleasedChangesToRelease(currentVersion as Version);
  }

  const newChangeEntries = newCommits.map(({ prNumber, description }) => {
    if (prNumber) {
      const suffix = `([#${prNumber}](${repoUrl}/pull/${prNumber}))`;
      return `${description} ${suffix}`;
    }
    return description;
  });

  for (const description of newChangeEntries.reverse()) {
    changelog.addChange({
      version: isReleaseCandidate ? currentVersion : undefined,
      category: ChangeCategory.Uncategorized,
      description,
    });
  }

  return changelog.toString();
}
