import { promises as fs } from 'fs';

import { Formatter } from './changelog';
import {
  getDependencyChangesForPackage,
  updateSinglePackageChangelog,
  type DependencyCheckResult,
} from './check-dependency-bumps';
import { Version } from './constants';
import { generateDiff } from './generate-diff';
import { PackageRename } from './shared-types';
import {
  ChangelogFormattingError,
  InvalidChangelogError,
  MissingDependencyEntriesError,
  validateChangelog,
} from './validate-changelog';

/**
 * Exit the process with the given error.
 *
 * @param errorMessage - The error message to exit with.
 */
function exitWithError(errorMessage: string) {
  console.error(errorMessage);
  process.exitCode = 1;
}

/**
 * Read the changelog contents from the filesystem.
 *
 * @param changelogPath - The path to the changelog file.
 * @returns The changelog contents.
 */
async function readChangelog(changelogPath: string) {
  return await fs.readFile(changelogPath, {
    encoding: 'utf8',
  });
}

/**
 * Save the changelog to the filesystem.
 *
 * @param changelogPath - The path to the changelog file.
 * @param newChangelogContent - The new changelog contents to save.
 */
async function saveChangelog(
  changelogPath: string,
  newChangelogContent: string,
) {
  await fs.writeFile(changelogPath, newChangelogContent);
}

/**
 * Options for validating a changelog.
 */
export type ValidateOptions = {
  changelogPath: string;
  currentVersion?: Version;
  isReleaseCandidate: boolean;
  repoUrl: string;
  tagPrefix: string;
  fix: boolean;
  formatter: Formatter;
  /**
   * The package rename properties, used in case of package is renamed
   */
  packageRename?: PackageRename;
  /**
   * Whether to validate that each changelog entry has one or more links to
   * associated pull requests within the repository (true) or not (false).
   */
  ensureValidPrLinksPresent: boolean;
  /**
   * Whether to check for dependency bump changelog entries.
   */
  checkDeps?: boolean;
  /**
   * Path to the package.json file for dependency checking.
   */
  manifestPath?: string;
  /**
   * Starting git reference for dependency checking (auto-detects if not provided).
   */
  fromRef?: string;
  /**
   * Ending git reference for dependency checking.
   */
  toRef?: string;
  /**
   * Remote name for auto-detection (defaults to 'origin').
   */
  remote?: string;
  /**
   * Base branch reference for auto-detection.
   */
  baseBranch?: string;
  /**
   * PR number to use when fixing missing dependency entries.
   */
  currentPr?: string;
};

/**
 * Validate the changelog.
 *
 * @param options - Validation options.
 * @param options.changelogPath - The path to the changelog file.
 * @param options.currentVersion - The current project version.
 * @param options.isReleaseCandidate - Whether the current branch is a release candidate or not.
 * @param options.repoUrl - The GitHub repository URL for the current project.
 * @param options.tagPrefix - The prefix used in tags before the version number.
 * @param options.fix - Whether to attempt to fix the changelog or not.
 * @param options.formatter - A custom Markdown formatter to use.
 * @param options.packageRename - The package rename properties.
 * @param options.ensureValidPrLinksPresent - Whether to validate that each
 * changelog entry has one or more links to associated pull requests within the
 * repository (true) or not (false).
 * @param options.checkDeps - Whether to check for dependency bump entries.
 * @param options.manifestPath - Path to package.json for dependency checking.
 * @param options.fromRef - Starting git reference for dependency checking.
 * @param options.toRef - Ending git reference for dependency checking.
 * @param options.remote - Remote name for auto-detection.
 * @param options.baseBranch - Base branch for auto-detection.
 * @param options.currentPr - PR number to use when fixing missing entries.
 */
export async function validate({
  changelogPath,
  currentVersion,
  isReleaseCandidate,
  repoUrl,
  tagPrefix,
  fix,
  formatter,
  packageRename,
  ensureValidPrLinksPresent,
  checkDeps,
  manifestPath,
  fromRef,
  toRef,
  remote,
  baseBranch,
  currentPr,
}: ValidateOptions) {
  const changelogContent = await readChangelog(changelogPath);

  // Fetch dependency changes if checkDeps is enabled
  let dependencyResult: DependencyCheckResult | undefined;
  if (checkDeps && manifestPath) {
    const result = await getDependencyChangesForPackage({
      manifestPath,
      fromRef,
      toRef,
      remote,
      baseBranch,
    });

    // null means we're on the base branch or couldn't auto-detect
    if (result === null) {
      return exitWithError(
        'Could not auto-detect git reference. Provide --fromRef or switch to a feature branch.',
      );
    }

    dependencyResult = result;
  }

  try {
    await validateChangelog({
      changelogContent,
      currentVersion,
      repoUrl,
      isReleaseCandidate,
      tagPrefix,
      formatter,
      packageRename,
      ensureValidPrLinksPresent,
      dependencyResult,
    });
    return undefined;
  } catch (error) {
    if (error instanceof ChangelogFormattingError) {
      const { validChangelog, invalidChangelog } = error.data;
      if (fix) {
        await saveChangelog(changelogPath, validChangelog);
        return undefined;
      }

      const diff = generateDiff(validChangelog, invalidChangelog);
      return exitWithError(`Changelog not well-formatted. Diff:\n\n${diff}`);
    } else if (error instanceof MissingDependencyEntriesError) {
      if (fix && currentPr) {
        await updateSinglePackageChangelog({
          changelogPath,
          dependencyChanges: error.missingEntries,
          currentVersion: dependencyResult?.versionBump,
          prNumber: currentPr,
          repoUrl,
          formatter,
          tagPrefix,
          packageRename,
        });
        console.log(
          `Added ${error.missingEntries.length} missing dependency changelog entries.`,
        );
        return undefined;
      }
      const deps = error.missingEntries
        .map((entry) => entry.dependency)
        .join(', ');
      return exitWithError(
        `Changelog is missing dependency bump entries for: ${deps}\nRun with --fix --currentPr <pr-number> to add them automatically.`,
      );
    } else if (error instanceof InvalidChangelogError) {
      return exitWithError(`Changelog is invalid: ${error.message}`);
    }
    throw error;
  }
}
