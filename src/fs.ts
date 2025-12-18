import { promises as fs } from 'fs';

/**
 * Read the file contents from the filesystem.
 *
 * @param filePath - The path to the file.
 * @returns The file contents.
 */
export async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, {
    encoding: 'utf8',
  });
}

/**
 * Writes content to the file at the given path.
 *
 * @param filePath - The path to the file.
 * @param content - The new content of the file.
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  await fs.writeFile(filePath, content, 'utf8');
}
