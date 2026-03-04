import execa from 'execa';

/**
 * Executes a shell command in a child process and returns what it wrote to
 * stdout, or rejects if the process exited with an error.
 *
 * @param command - The command to run, e.g. "git".
 * @param args - The arguments to the command.
 * @param options - Optional settings.
 * @param options.cwd - Working directory for the command.
 * @returns The stdout output as a string.
 */
export async function runCommand(
  command: string,
  args: string[],
  { cwd }: { cwd?: string } = {},
): Promise<string> {
  return (await execa(command, [...args], cwd ? { cwd } : undefined)).stdout;
}

/**
 * Executes a shell command in a child process and returns what it wrote to
 * stdout, or rejects if the process exited with an error.
 * Trims, splits the output by newlines, and filters out empty lines.
 *
 * @param command - The command to run, e.g. "git".
 * @param args - The arguments to the command.
 * @param options - Optional settings.
 * @param options.cwd - Working directory for the command.
 * @returns An array of the non-empty lines returned by the command.
 */
export async function runCommandAndSplit(
  command: string,
  args: string[],
  { cwd }: { cwd?: string } = {},
): Promise<string[]> {
  return (await execa(command, [...args], cwd ? { cwd } : undefined)).stdout
    .trim()
    .split('\n')
    .filter((line) => line !== '');
}
