/**
 * Log an error and set the process exit code to 1.
 *
 * @param errorMessage - The error message to log.
 */
export function error(errorMessage: string) {
  console.error(errorMessage);
  process.exitCode = 1;
}
