const Changelog = require('./changelog');
const { unreleased } = require('./constants');

function truncated(line) {
  return line.length > 80 ? `${line.slice(0, 80)}...` : line;
}

/**
 * Constructs a Changelog instance that represents the given changelog, which
 * is parsed for release and change information.
 * @param {Object} options
 * @param {string} options.changelogContent - The changelog to parse
 * @param {string} options.repoUrl - The GitHub repository URL for the current
 *   project.
 * @returns {Changelog} A changelog instance that reflects the changelog text
 *   provided.
 */
function parseChangelog({ changelogContent, repoUrl }) {
  const changelogLines = changelogContent.split('\n');
  const changelog = new Changelog({ repoUrl });

  const unreleasedHeaderIndex = changelogLines.indexOf(`## [${unreleased}]`);
  if (unreleasedHeaderIndex === -1) {
    throw new Error(`Failed to find ${unreleased} header`);
  }
  const unreleasedLinkReferenceDefinition = changelogLines.findIndex((line) => {
    return line.startsWith(`[${unreleased}]: `);
  });
  if (unreleasedLinkReferenceDefinition === -1) {
    throw new Error(`Failed to find ${unreleased} link reference definition`);
  }

  const contentfulChangelogLines = changelogLines.slice(
    unreleasedHeaderIndex + 1,
    unreleasedLinkReferenceDefinition,
  );

  let mostRecentRelease;
  let mostRecentCategory;
  let currentChangeEntry;

  /**
   * Finalize a change entry, adding it to the changelog.
   *
   * This is required because change entries can span multiple lines.
   *
   * @param {Object} [options]
   * @param {boolean} [options.removeTrailingNewline] - Indicates that the
   *   trailing newline is not a part of the change description, so should be
   *   removed.
   */
  function finalizePreviousChange({ removeTrailingNewline = false } = {}) {
    if (!currentChangeEntry) {
      return;
    }
    if (removeTrailingNewline && currentChangeEntry.endsWith('\n')) {
      currentChangeEntry = currentChangeEntry.slice(
        0,
        currentChangeEntry.length - 1,
      );
    }
    changelog.addChange({
      addToStart: false,
      category: mostRecentCategory,
      description: currentChangeEntry,
      version: mostRecentRelease,
    });
    currentChangeEntry = undefined;
  }

  for (const line of contentfulChangelogLines) {
    if (line.startsWith('## [')) {
      const results = line.match(
        /^## \[(\d+\.\d+\.\d+)\](?: - (\d\d\d\d-\d\d-\d\d))?(?: \[(\w+)\])?/u,
      );
      if (results === null) {
        throw new Error(`Malformed release header: '${truncated(line)}'`);
      }
      // Trailing newline removed because the release section is expected to
      // be prefixed by a newline.
      finalizePreviousChange({ removeTrailingNewline: true });
      mostRecentRelease = results[1];
      mostRecentCategory = undefined;
      const date = results[2];
      const status = results[3];
      changelog.addRelease({
        addToStart: false,
        date,
        status,
        version: mostRecentRelease,
      });
    } else if (line.startsWith('### ')) {
      const results = line.match(/^### (\w+)$\b/u);
      if (results === null) {
        throw new Error(`Malformed category header: '${truncated(line)}'`);
      }
      const isFirstCategory = mostRecentCategory === null;
      finalizePreviousChange({ removeTrailingNewline: !isFirstCategory });
      mostRecentCategory = results[1];
    } else if (line.startsWith('- ')) {
      if (mostRecentCategory === undefined) {
        throw new Error(`Category missing for change: '${truncated(line)}'`);
      }
      const description = line.slice(2);
      finalizePreviousChange();
      currentChangeEntry = description;
    } else if (currentChangeEntry) {
      currentChangeEntry += `\n${line}`;
    } else if (line === '') {
      continue;
    } else {
      throw new Error(`Unrecognized line: '${truncated(line)}'`);
    }
  }
  // Trailing newline removed because the reference link definition section is
  // expected to be separated by a newline.
  finalizePreviousChange({ removeTrailingNewline: true });

  return changelog;
}

module.exports = { parseChangelog };
