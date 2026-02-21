import { writeFile } from './fs';

/**
 * Exit the process with the given error.
 *
 * @param errorMessage - The error message to exit with.
 */
export function exitWithError(errorMessage: string) {
  console.error(errorMessage);
  process.exitCode = 1;
}

/**
 * Save the changelog to the filesystem.
 *
 * @param changelogPath - The path to the changelog file.
 * @param newChangelogContent - The new changelog contents to save.
 */
export async function saveChangelog(
  changelogPath: string,
  newChangelogContent: string,
) {
  await writeFile(changelogPath, newChangelogContent);
}
