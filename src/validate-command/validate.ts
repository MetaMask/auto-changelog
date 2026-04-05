import { Formatter } from '../changelog';
import { Version } from '../constants';
import { readFile, writeFile } from '../fs';
import { generateDiff } from '../generate-diff';
import {
  BaseRefNotFoundError,
  getDependencyChanges,
  type DependencyCheckResult,
} from '../get-dependency-changes';
import { PackageRename } from '../shared-types';
import { updateChangelogWithDependencyBumps } from '../update-changelog-with-dependency-bumps';
import {
  ChangelogFormattingError,
  InvalidChangelogError,
  MissingDependencyEntriesError,
  validateChangelog,
} from '../validate-changelog';

import { error } from './cli-utils';

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
  manifestPath: string;
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
  const changelogContent = await readFile(changelogPath);

  let dependencyCheckResult: DependencyCheckResult | undefined;
  if (checkDeps) {
    try {
      dependencyCheckResult = await getDependencyChanges({
        manifestPath,
        fromRef,
        toRef,
        remote,
        baseBranch,
      });
    } catch (caughtError) {
      if (caughtError instanceof BaseRefNotFoundError) {
        return error(
          `${caughtError.message}. Provide --fromRef or switch to a feature branch.`,
        );
      }
      throw caughtError;
    }
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
      dependencyCheckResult,
    });
    return undefined;
  } catch (caughtError) {
    if (caughtError instanceof ChangelogFormattingError) {
      const { validChangelog, invalidChangelog } = caughtError.data;
      if (fix) {
        await writeFile(changelogPath, validChangelog);
        return undefined;
      }

      const diff = generateDiff(validChangelog, invalidChangelog);
      return error(`Changelog not well-formatted. Diff:\n\n${diff}`);
    } else if (caughtError instanceof MissingDependencyEntriesError) {
      if (dependencyCheckResult && fix && currentPr) {
        const prNumbers =
          dependencyCheckResult?.prNumbers &&
          dependencyCheckResult.prNumbers.length > 0
            ? dependencyCheckResult.prNumbers
            : [currentPr];
        // Mirror validate-changelog's fallback: only target the release section
        // when versionChanged AND the release header actually exists. Otherwise
        // entries go into Unreleased.
        const hasReleaseHeader =
          currentVersion !== undefined &&
          changelogContent.includes(`## [${currentVersion}]`);
        await updateChangelogWithDependencyBumps({
          changelogPath,
          dependencyBumps: caughtError.missingEntries,
          currentVersion:
            dependencyCheckResult?.versionChanged && hasReleaseHeader
              ? currentVersion
              : undefined,
          prNumbers,
          repoUrl,
          formatter,
          tagPrefix,
          packageRename,
          changelog: caughtError.changelog,
        });
        console.log(
          `Added ${caughtError.missingEntries.length} missing dependency changelog entries.`,
        );
        return undefined;
      }
      const deps = caughtError.missingEntries
        .map((entry) => entry.dependency)
        .join(', ');
      return error(
        `Changelog is missing dependency bump entries for: ${deps}\nRun with --fix --currentPr <pr-number> to add them automatically.`,
      );
    } else if (caughtError instanceof InvalidChangelogError) {
      return error(`Changelog is invalid: ${caughtError.message}`);
    }
    throw caughtError;
  }
}
