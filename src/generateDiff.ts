import * as diff from 'diff';

export type Change = diff.Change & { noNewline?: boolean };

/**
 * Splits string into lines, excluding the newline at the end of each
 * line. The trailing newline is optional.
 * @param {string} value - The string value to split into lines
 * @returns {Array<string>} The lines, without trailing newlines
 */
function getTrimmedLines(value: string): string[] {
  const trimmedValue = value.endsWith('\n')
    ? value.substring(0, value.length - 1)
    : value;
  return trimmedValue.split('\n');
}

/**
 * Generates a diff between two multi-line string files. The resulting diff
 * shows any changes using '-' and '+' to indicate the "old" and "new" version
 * respectively, and includes 2 lines of unchanged content around each changed
 * section where possible.
 * @param {string} before - The string representing the base for the comparison.
 * @param {string} after - The string representing the changes being compared.
 * @returns {string} The genereated text diff
 */
export function generateDiff(before: string, after: string): string {
  const diffResult: Change[] = diff.diffLines(before, after);
  const penultimateDiffResult = diffResult[diffResult.length - 2] || {};
  // `diffLines` will always return at least one change object
  const lastDiffResult = diffResult[diffResult.length - 1];

  // Add notice about newline at end of file
  if (!lastDiffResult.value.endsWith('\n')) {
    lastDiffResult.noNewline = true;
  }
  // If the last change is an addition and the penultimate change is a
  // removal, then the last line of the file is also in the penultimate change.
  // That's why we're checking to see if the newline notice is needed here as
  // well.
  if (
    lastDiffResult.added &&
    penultimateDiffResult.removed &&
    !penultimateDiffResult.value.endsWith('\n')
  ) {
    penultimateDiffResult.noNewline = true;
  }

  const diffLines = diffResult.flatMap(
    ({ added, noNewline, removed, value }, index) => {
      const lines = getTrimmedLines(value);
      const changedLines = [];
      if (added || removed) {
        // Add up to 2 lines of context before each change
        const previousContext = diffResult[index - 1];
        if (
          previousContext &&
          !previousContext.added &&
          !previousContext.removed
        ) {
          // The diff result prior to an unchanged result is guaranteed to be
          // either an addition or a removal
          const previousChange = diffResult[index - 2];
          const hasPreviousChange = previousChange !== undefined;
          const previousContextLines = getTrimmedLines(previousContext.value);
          // Avoid repeating context that has already been included in diff
          if (!hasPreviousChange || previousContextLines.length >= 3) {
            const linesOfContext =
              hasPreviousChange && previousContextLines.length === 3 ? 1 : 2;
            const previousTwoLines = previousContextLines
              .slice(-1 * linesOfContext)
              .map((line) => ` ${line}`);
            changedLines.push(...previousTwoLines);
          }
        }
        changedLines.push(
          ...lines.map((line) => `${added ? '+' : '-'}${line}`),
        );
      } else if (index > 0) {
        // Add up to 2 lines of context following a change
        const nextTwoLines = lines.slice(0, 2).map((line) => ` ${line}`);
        changedLines.push(...nextTwoLines);
      }
      if (noNewline) {
        changedLines.push('\\ No newline at end of file');
      }
      return changedLines;
    },
  );
  return diffLines.join('\n');
}
