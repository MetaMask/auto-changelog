import type { ChildProcess } from 'child_process';
import spawn from 'cross-spawn';

/**
 * Run a command to completion using the system shell.
 *
 * This will run a command with the specified arguments, and resolve when the
 * process has exited. The STDOUT stream is monitored for output, which is
 * returned after being split into lines. All output is expected to be UTF-8
 * encoded, and empty lines are removed from the output.
 *
 * Anything received on STDERR is assumed to indicate a problem, and is tracked
 * as an error.
 *
 * @param command - The command to run
 * @param args - The arguments to pass to the command
 * @returns Lines of output received via STDOUT
 */
export default async function runCommand(
  command: string,
  args?: readonly string[],
) {
  const output: string[] = [];
  let mostRecentError;
  let errorSignal;
  let errorCode;
  const internalError = new Error('Internal');
  try {
    await new Promise<void>((resolve, reject) => {
      const childProcess: ChildProcess = spawn(command, args);
      if (!childProcess.stdout || !childProcess.stderr) {
        throw new Error('Child process is missing stdout and stderr.');
      }

      childProcess.stdout.setEncoding('utf8');
      childProcess.stderr.setEncoding('utf8');

      childProcess.on('error', (error) => {
        mostRecentError = error;
      });

      childProcess.stdout.on('data', (message) => {
        const nonEmptyLines = message
          .split('\n')
          .filter((line: string) => line !== '');
        output.push(...nonEmptyLines);
      });

      childProcess.stderr.on('data', (message) => {
        mostRecentError = new Error(message.trim());
      });

      childProcess.once('exit', (code, signal) => {
        if (code === 0) {
          return resolve();
        }
        errorCode = code;
        errorSignal = signal;
        return reject(internalError);
      });
    });
  } catch (error) {
    /**
     * The error is re-thrown here in an `async` context to preserve the stack trace. If this was
     * was thrown inside the Promise constructor, the stack trace would show a few frames of
     * Node.js internals then end, without indicating where `runCommand` was called.
     */
    if (error === internalError) {
      let errorMessage;
      if (errorCode !== null && errorSignal !== null) {
        errorMessage = `Terminated by signal '${errorSignal}'; exited with code '${errorCode}'`;
      } else if (errorSignal !== null) {
        errorMessage = `Terminated by signal '${errorSignal}'`;
      } else if (errorCode === null) {
        errorMessage = 'Exited with no code or signal';
      } else {
        errorMessage = `Exited with code '${errorCode}'`;
      }
      const improvedError: Error & { cause?: Error } = new Error(errorMessage);
      if (mostRecentError) {
        improvedError.cause = mostRecentError;
      }
      throw improvedError;
    }
  }
  return output;
}
