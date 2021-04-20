const diff = require('diff');

/**
 * Generates a diff between two multi-line strings. The resulting diff shows
 * any changes using '-' and '+' to indicate the "old" and "new" version
 * respectively, and includes 2 lines of unchanged content around each changed
 * section where possible.
 * @param {string} before - The string representing the base for the comparison.
 * @param {string} after - The string representing the changes being compared.
 * @returns {string} The genereated text diff
 */
function generateDiff(before, after) {
  const changes = diff.diffLines(before, after);
  const diffLines = [];
  const preceedingContext = [];
  for (const { added, removed, value } of changes) {
    const lines = value.split('\n');
    // remove trailing newline
    lines.pop();
    if (added || removed) {
      if (preceedingContext.length) {
        diffLines.push(...preceedingContext);
        preceedingContext.splice(0, preceedingContext.length);
      }
      diffLines.push(...lines.map((line) => `${added ? '+' : '-'}${line}`));
    } else {
      // If a changed line has been included already, add up to 2 lines of context
      if (diffLines.length) {
        diffLines.push(...lines.slice(0, 2).map((line) => ` ${line}`));
        lines.splice(0, 2);
      }
      // stash last 2 lines for context in case there is another change
      if (lines.length) {
        preceedingContext.push(...lines.slice(-2));
      }
    }
  }
  return diffLines.join('\n');
}

module.exports = { generateDiff };
