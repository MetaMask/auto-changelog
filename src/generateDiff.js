const diff = require('diff');

function getTrimmedLines(value) {
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
function generateDiff(before, after) {
  const changes = diff.diffLines(before, after);
  // `diffLines` will always return at least one change
  const lastChange = changes[changes.length - 1];
  const penultimateChange = changes[changes.length - 2] || {};

  // Add notice about newline at end of file
  if (!lastChange.value.endsWith('\n')) {
    lastChange.noNewline = true;
  }
  // If the last change is an addition and the penultimate change is a
  // removal, then the last line of the file is also in the penultimate change.
  // That's why we're checking to see if the newline notice is needed here as
  // well.
  if (
    lastChange.added &&
    penultimateChange.removed &&
    !penultimateChange.value.endsWith('\n')
  ) {
    penultimateChange.noNewline = true;
  }

  const diffLines = changes.flatMap(
    ({ added, noNewline, removed, value }, index) => {
      const lines = getTrimmedLines(value);
      const changedLines = [];
      if (added || removed) {
        // Add up to 2 lines of context before each change
        const previousContext = changes[index - 1];
        if (
          previousContext &&
          !previousContext.added &&
          !previousContext.removed
        ) {
          const hasPreviousChange = index > 1;
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

module.exports = { generateDiff };
