import Changelog from './changelog';

/**
 * Creates a new empty changelog.
 *
 * @param options - Changelog options.
 * @param options.repoUrl - The GitHub repository URL for the current project.
 * @param [options.tagPrefix] - The prefix used in tags before the version number.
 * @returns The initial changelog text.
 */
export function createEmptyChangelog({
  repoUrl,
  tagPrefix = 'v',
}: {
  repoUrl: string;
  tagPrefix?: string;
}) {
  const changelog = new Changelog({ repoUrl, tagPrefix });
  return changelog.toString();
}
