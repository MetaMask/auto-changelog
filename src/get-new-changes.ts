import { Octokit } from '@octokit/rest';

import { ConventionalCommitType } from './constants';
import { getOwnerAndRepoFromUrl } from './repo';
import { runCommand, runCommandAndSplit } from './run-command';

let github: Octokit;

export type AddNewCommitsOptions = {
  mostRecentTag: string | null;
  repoUrl: string;
  loggedPrNumbers: string[];
  loggedDescriptions: string[];
  projectRootDirectory?: string;
  useChangelogEntry: boolean;
  useShortPrLink: boolean;
  requirePrNumbers?: boolean;
};

// Get array of all ConventionalCommitType values
const conventionalCommitTypes = Object.values(ConventionalCommitType);

// Create a regex pattern that matches any of the ConventionalCommitTypes
const typesWithPipe = conventionalCommitTypes.join('|');

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
 * Remove outer backticks if present in the given message.
 *
 * @param message - The changelog entry message.
 * @returns The message without outer backticks.
 */
function removeOuterBackticksIfPresent(message: string) {
  return message.replace(/^`(.*)`$/u, '$1');
}

/**
 * Remove Conventional Commit prefix if it exists in the given message.
 *
 * @param message - The changelog entry message.
 * @returns The message without Conventional Commit prefix.
 */
function removeConventionalCommitPrefixIfPresent(message: string) {
  const regex = new RegExp(`^(${typesWithPipe})(\\([^)]*\\))?:\\s*`, 'iu');
  return message.replace(regex, '');
}

type Commit = {
  prNumber?: string;
  subject: string;
  description: string;
  isMergeCommit: boolean;
};

/**
 * Get commit details for each given commit hash.
 *
 * @param commitHashes - The list of commit hashes.
 * @param repoUrl - The repository URL.
 * @param useChangelogEntry - Whether to use `CHANGELOG entry:` from the commit body and the no-changelog label.
 * @returns Commit details for each commit, including description, PR number (if present), and merge commit indicator.
 */
async function getCommits(
  commitHashes: string[],
  repoUrl: string,
  useChangelogEntry: boolean,
): Promise<Commit[]> {
  // Only initialize Octokit if we need to fetch PR labels
  if (useChangelogEntry) {
    initOctoKit();
  }

  const commits: Commit[] = [];
  for (const commitHash of commitHashes) {
    const subject = await runCommand('git', [
      'show',
      '-s',
      '--format=%s',
      commitHash,
    ]);

    if (!subject) {
      throw new Error(
        `"git show" returned empty subject for commit "${commitHash}".`,
      );
    }

    const subjectMatch = subject.match(/\(#(\d+)\)/u);

    let prNumber: string | undefined;
    let description = subject;
    let isMergeCommit = false;

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

          if (description !== 'null') {
            // Remove outer backticks if present. Example: `feat: new feature description` -> feat: new feature description
            description = removeOuterBackticksIfPresent(description);

            // Remove Conventional Commit prefix if present. Example: feat: new feature description -> new feature description
            description = removeConventionalCommitPrefixIfPresent(description);

            // Make description coming from `CHANGELOG entry:` start with an uppercase letter
            description =
              description.charAt(0).toUpperCase() + description.slice(1);
          }
        } else {
          description = subject.match(/^(.+)\s\(#\d+\)/u)?.[1] ?? '';
        }

        if (description !== 'null') {
          const prLabels = await getPrLabels(repoUrl, prNumber);

          if (prLabels.includes('no-changelog')) {
            description = 'null'; // Has the no-changelog label, use string 'null' to indicate no description
          }
        }
      } else {
        description = subject.match(/^(.+)\s\(#\d+\)/u)?.[1] ?? '';
      }
    } else {
      // Merge commit: the PR ID is parsed from the git subject (which is of the form `Merge pull request
      // #<PR ID> from <branch>`, and the description is assumed to be the first line of the body.
      const mergeMatch = subject.match(/#(\d+)\sfrom/u);
      if (mergeMatch) {
        prNumber = mergeMatch[1];
        isMergeCommit = true;
        const [firstLineOfBody] = await runCommandAndSplit('git', [
          'show',
          '-s',
          '--format=%b',
          commitHash,
        ]);
        description = firstLineOfBody || subject;
      }
    }

    // String 'null' is used to indicate no description
    if (description !== 'null') {
      commits.push({
        prNumber,
        subject,
        description: description.trim(),
        isMergeCommit,
      });
    }
  }

  return commits;
}

/**
 * Filter out duplicate commits based on PR numbers and descriptions.
 *
 * For PR-tagged commits: excludes if PR number already exists in changelog.
 * For direct commits: excludes if a PR-tagged commit with the same description exists
 * in the current batch (handles squash merges), or if already logged in changelog.
 *
 * @param commits - The list of commits to deduplicate.
 * @param loggedPrNumbers - PR numbers already in the changelog.
 * @param loggedDescriptions - Descriptions already in the changelog.
 * @returns Filtered list of commits without duplicates.
 */
function deduplicateCommits(
  commits: Commit[],
  loggedPrNumbers: string[],
  loggedDescriptions: string[],
): Commit[] {
  const prTaggedCommitDescriptions = new Set(
    commits
      .filter((commit) => commit.prNumber !== undefined)
      .map((commit) => commit.description),
  );

  return commits.filter(({ prNumber, description }) => {
    if (prNumber !== undefined) {
      return !loggedPrNumbers.includes(prNumber);
    }

    // Direct commit: skip if a PR-tagged commit with same description exists in this batch
    if (prTaggedCommitDescriptions.has(description)) {
      return false;
    }

    return !loggedDescriptions.includes(description);
  });
}

/**
 * Get the list of new change entries to add to a changelog.
 *
 * @param options - Options.
 * @param options.mostRecentTag - The most recent tag.
 * @param options.repoUrl - The GitHub repository URL for the current project.
 * @param options.loggedPrNumbers - A list of all pull request numbers included in the relevant parsed changelog.
 * @param options.loggedDescriptions - A list of all change descriptions included in the relevant parsed changelog.
 * @param options.projectRootDirectory - The root project directory, used to
 * filter results from various git commands. This path is assumed to be either
 * absolute, or relative to the current directory. Defaults to the root of the
 * current git repository.
 * @param options.useChangelogEntry - Whether to use `CHANGELOG entry:` from the commit body and the no-changelog label.
 * @param options.useShortPrLink - Whether to use short PR links in the changelog entries.
 * @param options.requirePrNumbers - Whether to require PR numbers for all commits. If true, commits without PR numbers are filtered out.
 * @returns A list of new change entries to add to the changelog, based on commits made since the last release.
 */
export async function getNewChangeEntries({
  mostRecentTag,
  repoUrl,
  loggedPrNumbers,
  loggedDescriptions,
  projectRootDirectory,
  useChangelogEntry,
  useShortPrLink,
  requirePrNumbers = false,
}: AddNewCommitsOptions) {
  const commitRange =
    mostRecentTag === null ? 'HEAD' : `${mostRecentTag}..HEAD`;
  const commitsHashesSinceLastRelease = await getCommitHashesInRange(
    commitRange,
    projectRootDirectory,
  );
  const commits = await getCommits(
    commitsHashesSinceLastRelease,
    repoUrl,
    useChangelogEntry,
  );

  const filteredPrCommits = requirePrNumbers
    ? commits.filter((commit) => commit.prNumber !== undefined)
    : commits;

  const newCommits = deduplicateCommits(
    filteredPrCommits,
    loggedPrNumbers,
    loggedDescriptions,
  );

  return newCommits.map(({ prNumber, subject, isMergeCommit, description }) => {
    // Handle edge case where PR description includes multiple CHANGELOG entries
    let newDescription = description?.replace(/CHANGELOG entry: /gu, '');

    // For merge commits, use the description for categorization because the subject
    // is "Merge pull request #123..." which would be incorrectly excluded
    const subjectForCategorization = isMergeCommit ? description : subject;

    if (prNumber) {
      const suffix = useShortPrLink
        ? `(#${prNumber})`
        : `([#${prNumber}](${repoUrl}/pull/${prNumber}))`;

      if (newDescription) {
        const lines = newDescription.split('\n');
        lines[0] = `${lines[0]} ${suffix}`; // Append suffix to the first line (next lines are considered part of the description and ignored by the parsing logic)
        newDescription = lines.join('\n');
      } else {
        newDescription = suffix;
      }
    }

    return { description: newDescription, subject: subjectForCategorization };
  });
}

/**
 * Initialize the Octokit GitHub client with authentication token.
 */
function initOctoKit() {
  // eslint-disable-next-line node/no-process-env
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  github = new Octokit({ auth: githubToken });
}

/**
 * Fetch labels for a pull request.
 *
 * @param repoUrl - The repository URL.
 * @param prNumber - The pull request number.
 * @returns A list of label names for the PR (empty array if not found or invalid).
 */
async function getPrLabels(
  repoUrl: string,
  prNumber: string,
): Promise<string[]> {
  if (!prNumber) {
    return [];
  }

  if (!github) {
    initOctoKit();
  }

  const { owner, repo } = getOwnerAndRepoFromUrl(repoUrl);

  const { data: pullRequest } = await github.rest.pulls.get({
    owner,
    repo,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    pull_number: Number(prNumber),
  });

  if (pullRequest) {
    const labels = pullRequest.labels.map((label: any) => label.name);
    return labels;
  }

  return [];
}
