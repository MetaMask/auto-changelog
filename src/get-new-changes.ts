import { strict as assert } from 'assert';
import execa from 'execa';

export type AddNewCommitsOptions = {
  mostRecentTag: string | null;
  repoUrl: string;
  loggedPrNumbers: string[];
  projectRootDirectory?: string;
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
  return await runCommand('git', revListArgs);
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
  console.log(`inside real getNewChangeEntries`);
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
