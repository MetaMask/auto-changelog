/**
 * Safely format a changelog with Prettier. If Prettier is not installed, it
 * will throw an error with a clear message. This allows us to use Prettier for
 * formatting when available, without making it a hard dependency of the
 * project.
 *
 * @param changelog - The changelog string to format.
 * @returns The formatted changelog string.
 */
export async function prettier(changelog: string): Promise<string> {
  try {
    const { format } = await import('prettier/standalone');
    const markdown = await import('prettier/plugins/markdown');

    return await format(changelog, {
      parser: 'markdown',
      plugins: [markdown],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to format changelog with Prettier. Is Prettier installed?\n\n${message}`,
    );
  }
}

/**
 * Safely format a changelog with Oxfmt. If Oxfmt is not installed, it will
 * throw an error with a clear message. This allows us to use Oxfmt for
 * formatting when available, without making it a hard dependency of the
 * project.
 *
 * @param changelog - The changelog string to format.
 * @returns The formatted changelog string.
 */
export async function oxfmt(changelog: string): Promise<string> {
  try {
    const { format } = await import('oxfmt');
    const result = await format('CHANGELOG.md', changelog);

    return result.code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to format changelog with Oxfmt. Is Oxfmt installed?\n\n${message}`,
    );
  }
}
