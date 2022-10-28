import Changelog from './changelog';

/**
 * Creates a new empty changelog.
 *
 * @param options - Changelog options.
 * @param options.repoUrl - The GitHub repository URL for the current project.
 * @returns The initial changelog text.
 */
export function createEmptyChangelog({ repoUrl }: { repoUrl: string }) {
  const changelog = new Changelog({ repoUrl });
  return changelog.toString();
}
