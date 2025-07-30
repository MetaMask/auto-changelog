/* eslint-disable node/no-process-env */

import { Octokit } from '@octokit/rest';
import { strict as assert } from 'assert';

import { runCommand, runCommandAndSplit } from './run-command';

let github: Octokit;

export type AddNewCommitsOptions = {
  mostRecentTag: string | null;
  repoUrl: string;
  loggedPrNumbers: string[];
  projectRootDirectory?: string;
  useChangelogEntry: boolean;
  useShortPrLink: boolean;
};

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
  return await runCommandAndSplit('git', revListArgs);
}

/**
 * Get commit details for each given commit hash.
 *
 * @param commitHashes - The list of commit hashes.
 * @param useChangelogEntry - Whether to use `CHANGELOG entry:` from the commit body and the no-changelog label.
 * @returns Commit details for each commit, including description and PR number (if present).
 */
async function getCommits(commitHashes: string[], useChangelogEntry: boolean) {
  initOctoKit();

  const commits: { prNumber?: string; subject: string; description: string }[] =
    [];
  for (const commitHash of commitHashes) {
    const subject = await runCommand('git', [
      'show',
      '-s',
      '--format=%s',
      commitHash,
    ]);

    assert.ok(
      Boolean(subject),
      `"git show" returned empty subject for commit "${commitHash}".`,
    );

    const subjectMatch = subject.match(/\(#(\d+)\)/u);

    let prNumber: string | undefined;
    let description = subject;

    if (subjectMatch) {
      // Squash & Merge: the commit subject is parsed as `<description> (#<PR ID>)`
      prNumber = subjectMatch[1];

      if (useChangelogEntry) {
        const body = await runCommand('git', [
          'show',
          '-s',
          '--format=%b',
          commitHash,
        ]);

        const changelogMatch = body.match(/\nCHANGELOG entry:\s(\S.+?)\n\n/su);

        if (changelogMatch) {
          const changelogEntry = changelogMatch[1].replace('\n', ' ');

          description = changelogEntry; // This may be string 'null' to indicate no description
        } else {
          description = subject.match(/^(.+)\s\(#\d+\)/u)?.[1] ?? '';
        }

        if (description !== 'null') {
          const prLabels = await getPrLabels(prNumber);

          // TODO: eliminate this debug log
          console.log(`PR #${prNumber} labels:`, prLabels);

          if (prLabels.includes('no-changelog')) {
            description = 'null'; // Has the no-changelog label, use string 'null' to indicate no description
          }
        }
      } else {
        description = subject.match(/^(.+)\s\(#\d+\)/u)?.[1] ?? '';
      }
    } else {
      // Merge: the PR ID is parsed from the git subject (which is of the form `Merge pull request
      // #<PR ID> from <branch>`, and the description is assumed to be the first line of the body.
      // If no body is found, the description is set to the commit subject
      const mergeMatch = subject.match(/#(\d+)\sfrom/u);
      if (mergeMatch) {
        prNumber = mergeMatch[1];
        const [firstLineOfBody] = await runCommandAndSplit('git', [
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

    if (description !== 'null') {
      // String 'null' is used to indicate no description
      commits.push({ prNumber, subject, description });
    }
  }

  return commits;
}

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
 * @param options.useChangelogEntry - Whether to use `CHANGELOG entry:` from the commit body and the no-changelog label.
 * @param options.useShortPrLink - Whether to use short PR links in the changelog entries.
 * @returns A list of new change entries to add to the changelog, based on commits made since the last release.
 */
export async function getNewChangeEntries({
  mostRecentTag,
  repoUrl,
  loggedPrNumbers,
  projectRootDirectory,
  useChangelogEntry,
  useShortPrLink,
}: AddNewCommitsOptions) {
  const commitRange =
    mostRecentTag === null ? 'HEAD' : `${mostRecentTag}..HEAD`;
  const commitsHashesSinceLastRelease = await getCommitHashesInRange(
    commitRange,
    projectRootDirectory,
  );
  const commits = await getCommits(
    commitsHashesSinceLastRelease,
    useChangelogEntry,
  );

  const newCommits = commits.filter(
    ({ prNumber }) => !prNumber || !loggedPrNumbers.includes(prNumber),
  );

  return newCommits.map(({ prNumber, subject, description }) => {
    let newDescription = description;

    if (prNumber) {
      const suffix = useShortPrLink
        ? `(#${prNumber})`
        : `([#${prNumber}](${repoUrl}/pull/${prNumber}))`;

      newDescription = `${description} ${suffix}`;
    }

    return { description: newDescription, subject };
  });
}

/**
 * Initialize the Octokit GitHub client with authentication token.
 */
function initOctoKit() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  github = new Octokit({ auth: process.env.GITHUB_TOKEN });
}

/**
 * Fetch labels for a pull request.
 *
 * @param prNumber - The pull request number.
 * @returns A list of label names for the PR (empty array if not found or invalid).
 */
async function getPrLabels(prNumber: string): Promise<string[]> {
  if (!prNumber) {
    return [];
  }

  if (!github) {
    initOctoKit();
  }

  const { data: pullRequest } = await github.rest.pulls.get({
    owner: 'MetaMask',
    repo: 'metamask-extension',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    pull_number: Number(prNumber),
  });

  if (pullRequest) {
    const labels = pullRequest.labels.map((label: any) => label.name);
    return labels;
  }

  return [];
}
