/* eslint-disable node/no-process-env */

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

/**
 * Get commit details for each given commit hash.
 *
 * @param commitHashes - The list of commit hashes.
 * @param repoUrl - The repository URL.
 * @param useChangelogEntry - Whether to use `CHANGELOG entry:` from the commit body and the no-changelog label.
 * @returns Commit details for each commit, including description and PR number (if present).
 */
async function getCommits(
  commitHashes: string[],
  repoUrl: string,
  useChangelogEntry: boolean,
) {
  // Only initialize Octokit if we need to fetch PR labels
  if (useChangelogEntry) {
    initOctoKit();
  }

  const commits: { prNumber?: string; subject: string; description: string }[] =
    [];
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

    // String 'null' is used to indicate no description
    if (description !== 'null') {
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
 * @param options.loggedDescriptions - A list of all change descriptions included in the relevant parsed changelog.
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
  loggedDescriptions,
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
    repoUrl,
    useChangelogEntry,
  );

  // Filter commits to exclude duplicates:
  // - For commits with PR numbers: check if PR number already exists in changelog
  // - For commits without PR numbers: check if the description already exists in changelog
  const newCommits = commits.filter(({ prNumber, description }) => {
    if (prNumber) {
      // PR-based commit: check if this PR number is already logged
      return !loggedPrNumbers.includes(prNumber);
    }
    // Direct commit (no PR number): check if this exact description is already logged
    return !loggedDescriptions.includes(description);
  });

  return newCommits.map(({ prNumber, subject, description }) => {
    // Handle the edge case where the PR description includes multiple changelog entries with this format:
    //   CHANGELOG entry: Added support to Solana tokens with multiplier (#509)
    //   CHANGELOG entry: Fix a bug that was causing to show spam Solana transactions in the activity list (#515)
    //   CHANGELOG entry: Fixed an issue that was causing to show an empty symbol instead of UNKNOWN in activity list for Solana tokens with no metadata (#517)
    // This is not a supposed to happen, but we've seen engineers doing it already.
    // Example PR on metamask-extension repo: (#35695)
    let newDescription = description?.replace(/CHANGELOG entry: /gu, '');

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
