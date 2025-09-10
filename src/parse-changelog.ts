import semver from 'semver';

import Changelog, { Formatter } from './changelog';
import { ChangeCategory, unreleased } from './constants';
import { PackageRename } from './shared-types';

/**
 * Truncate the given string at 80 characters.
 *
 * @param line - The string to truncate.
 * @returns The truncated string.
 */
function truncated(line: string) {
  return line.length > 80 ? `${line.slice(0, 80)}...` : line;
}

/**
 * Returns whether the given string is recognized as a valid change category.
 *
 * @param category - The string to validate.
 * @returns Whether the given string is a valid change category.
 */
function isValidChangeCategory(category: string): category is ChangeCategory {
  return ChangeCategory[category as ChangeCategory] !== undefined;
}

/**
 * Constructs a Changelog instance that represents the given changelog, which
 * is parsed for release and change information.
 *
 * @param options - Options.
 * @param options.changelogContent - The changelog to parse.
 * @param options.repoUrl - The GitHub repository URL for the current project.
 * @param options.tagPrefix - The prefix used in tags before the version number.
 * @param options.formatter - A custom Markdown formatter to use.
 * @param options.packageRename - The package rename properties
 * An optional, which is required only in case of package renamed.
 * @param options.shouldExtractPrLinks - When true, look for and parse pull
 * request links at the end of change entries.
 * @returns A changelog instance that reflects the changelog text provided.
 */
export function parseChangelog({
  changelogContent,
  repoUrl,
  tagPrefix = 'v',
  formatter = undefined,
  packageRename,
  shouldExtractPrLinks = false,
}: {
  changelogContent: string;
  repoUrl: string;
  tagPrefix?: string;
  formatter?: Formatter;
  packageRename?: PackageRename;
  shouldExtractPrLinks?: boolean;
}) {
  const changelogLines = changelogContent.split(/(?:\r)?\n/u); // Split on either Windows or Unix line endings
  const changelog = new Changelog({
    repoUrl,
    tagPrefix,
    formatter,
    packageRename,
  });

  const unreleasedHeaderIndex = changelogLines.indexOf(`## [${unreleased}]`);
  if (unreleasedHeaderIndex === -1) {
    throw new Error(`Failed to find ${unreleased} header`);
  }
  const unreleasedLinkReferenceDefinition = changelogLines.findIndex((line) => {
    return line.startsWith(`[${unreleased}]:`);
  });
  if (unreleasedLinkReferenceDefinition === -1) {
    throw new Error(`Failed to find ${unreleased} link reference definition`);
  }

  const contentfulChangelogLines = changelogLines.slice(
    unreleasedHeaderIndex + 1,
    unreleasedLinkReferenceDefinition,
  );

  let mostRecentRelease: string;
  let mostRecentCategory: ChangeCategory | undefined | null;
  let currentChangeEntry: string | undefined;

  /**
   * Finalize a change entry, adding it to the changelog.
   *
   * This is required because change entries can span multiple lines.
   *
   * @param options - Options.
   * @param options.removeTrailingNewline - Indicates that the trailing newline
   * is not a part of the change description, and should therefore be removed.
   */
  function finalizePreviousChange({
    removeTrailingNewline = false,
  }: {
    removeTrailingNewline?: boolean;
  } = {}) {
    if (!currentChangeEntry) {
      return;
    }

    // This should never happen in practice, because `mostRecentCategory` is
    // guaranteed to be set if `currentChangeEntry` is set.
    /* istanbul ignore next */
    if (!mostRecentCategory) {
      throw new Error('Cannot finalize change without most recent category.');
    }

    if (removeTrailingNewline && currentChangeEntry.endsWith('\n')) {
      currentChangeEntry = currentChangeEntry.slice(
        0,
        currentChangeEntry.length - 1,
      );
    }

    const { description, prNumbers } = shouldExtractPrLinks
      ? extractPrLinks(currentChangeEntry)
      : {
          description: currentChangeEntry,
          prNumbers: [],
        };

    changelog.addChange({
      addToStart: false,
      category: mostRecentCategory,
      description,
      version: mostRecentRelease,
      prNumbers,
    });
    currentChangeEntry = undefined;
  }

  for (const line of contentfulChangelogLines) {
    if (line.startsWith('## [')) {
      const results = line.match(
        /^## \[([^[\]]+)\](?: - (\d\d\d\d-\d\d-\d\d))?(?: \[(\w+)\])?/u,
      );
      if (results === null) {
        throw new Error(`Malformed release header: '${truncated(line)}'`);
      }

      if (semver.valid(results[1]) === null) {
        throw new Error(
          `Invalid SemVer version in release header: '${truncated(line)}'`,
        );
      }

      // Trailing newline removed because the release section is expected to
      // be prefixed by a newline.
      finalizePreviousChange({
        removeTrailingNewline: true,
      });
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
      finalizePreviousChange({
        removeTrailingNewline: !isFirstCategory,
      });

      if (!isValidChangeCategory(results[1])) {
        throw new Error(`Invalid change category: '${results[1]}'`);
      }
      mostRecentCategory = results[1];
    } else if (line.startsWith('- ')) {
      if (!mostRecentCategory) {
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

/**
 * Looks for potential links to pull requests from the end of the first line of
 * a change entry and pulls them off.
 *
 * Note that the pattern to look for potential links is intentionally naive,
 * so that we can offer better error messaging in case URLs do not match the
 * repo URL (such an error would appear when attempting to stringify the
 * changelog).
 *
 * @param changeEntry - The text of the change entry.
 * @returns The list of pull request numbers referenced by the change entry, and
 * the change entry without the links to those pull requests.
 */
function extractPrLinks(changeEntry: string): {
  description: string;
  prNumbers: string[];
} {
  const lines = changeEntry.split('\n');
  const prNumbers: string[] = [];

  // Only process the first line for PR link extraction
  let firstLine = lines[0];

  // Example of long match group: " ([#123](...), [#456](...))"
  const longGroupMatchPattern = /\s+\(\s*(\[#\d+\]\([^)]+\)\s*,?\s*)+\)/gu;

  // Example of long match: "[#123](...)"
  const longMatchPattern = /\[#(\d+)\]\([^)]+\)/gu;

  // Match and extract all long PR links like ([#123](...)) separated by commas
  const longGroupMatches = [...firstLine.matchAll(longGroupMatchPattern)];
  for (const longGroupMatch of longGroupMatches) {
    const group = longGroupMatch[0];
    const longMatches = [...group.matchAll(longMatchPattern)];
    for (const match of longMatches) {
      prNumbers.push(match[1]);
    }
  }

  // Remove valid long PR links (grouped in parentheses, possibly comma-separated)
  firstLine = firstLine.replace(longGroupMatchPattern, '');

  // Example of short match group: " (#123), (#123)"
  const shortGroupMatchPattern = /\s+(\(#\d+\)\s*,?\s*)+/gu;

  // Example of short match: "(#123)"
  const shortMatchPattern = /\(#(\d+)\)/gu;

  // Match and extract all short PR links like (#123)
  const shortGroupMatches = [...firstLine.matchAll(shortGroupMatchPattern)];
  for (const shortGroupMatch of shortGroupMatches) {
    const group = shortGroupMatch[0];
    const shortMatches = [...group.matchAll(shortMatchPattern)];
    for (const match of shortMatches) {
      prNumbers.push(match[1]);
    }
  }

  // Remove valid short PR links
  firstLine = firstLine.replace(shortGroupMatchPattern, '');

  // Prepare the cleaned description
  const cleanedLines = [firstLine.trim(), ...lines.slice(1)];
  const cleanedDescription = cleanedLines.join('\n');

  // Return unique PR numbers and the cleaned description
  return {
    description: cleanedDescription.trim(),
    prNumbers: [...new Set(prNumbers)],
  };
}
