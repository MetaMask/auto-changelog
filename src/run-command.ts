import execa from 'execa';

/**
 * Executes a shell command in a child process and returns what it wrote to
 * stdout, or rejects if the process exited with an error.
 *
 * @param command - The command to run, e.g. "git".
 * @param args - The arguments to the command.
 * @returns An array of the non-empty lines returned by the command.
 */
export async function runCommand(
  command: string,
  args: string[],
): Promise<string> {
  return (await execa(command, [...args])).stdout;
}

/**
 * Executes a shell command in a child process and returns what it wrote to
 * stdout, or rejects if the process exited with an error.
 * Trims, splits the output by newlines, and filters out empty lines.
 *
 * @param command - The command to run, e.g. "git".
 * @param args - The arguments to the command.
 * @returns An array of the non-empty lines returned by the command.
 */
export async function runCommandAndSplit(
  command: string,
  args: string[],
): Promise<string[]> {
  return (await execa(command, [...args])).stdout
    .trim()
    .split('\n')
    .filter((line) => line !== '');
}
