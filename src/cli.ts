#!/usr/bin/env node

import { promises as fs, constants as fsConstants } from 'fs';
import path from 'path';
import prettier from 'prettier';
import semver from 'semver';
import type { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import { Formatter } from './changelog';
import { unreleased, Version } from './constants';
import { generateDiff } from './generate-diff';
import { createEmptyChangelog } from './init';
import { getRepositoryUrl } from './repo';
import { PackageRename } from './shared-types';
import { updateChangelog } from './update-changelog';
import {
  ChangelogFormattingError,
  InvalidChangelogError,
  validateChangelog,
} from './validate-changelog';

const updateEpilog = `New commits will be added to the "${unreleased}" section (or \
to the section for the current release if the '--rc' flag is used) in reverse \
chronological order. Any commits for PRs that are represented already in the \
changelog will be ignored.

If the '--rc' flag is used and the section for the current release does not \
yet exist, it will be created.`;

const validateEpilog = `This does not ensure that the changelog is complete, \
or that each change is in the correct section. It just ensures that the \
formatting is correct. Verification of the contents is left for manual review.`;

/**
 * Determine whether the given URL is valid.
 *
 * @param proposedUrl - The URL to validate.
 * @returns True if the URL is valid, false otherwise.
 */
function isValidUrl(proposedUrl: string) {
  try {
    // eslint-disable-next-line no-new
    new URL(proposedUrl);
    return true;
  } catch (error) {
    return false;
  }
}

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

type UpdateOptions = {
  changelogPath: string;
  currentVersion?: Version;
  repoUrl: string;
  isReleaseCandidate: boolean;
  projectRootDirectory?: string;
  tagPrefix: string;
  formatter: Formatter;
  /**
   * The package rename properties, used in case of package is renamed
   */
  packageRename?: PackageRename;
};

/**
 * Update the changelog.
 *
 * @param options - Update options.
 * @param options.changelogPath - The path to the changelog file.
 * @param options.currentVersion - The current project version.
 * @param options.isReleaseCandidate - Whether the current branch is a release candidate or not.
 * @param options.repoUrl - The GitHub repository URL for the current project.
 * @param options.projectRootDirectory - The root project directory.
 * @param options.tagPrefix - The prefix used in tags before the version number.
 * @param options.formatter - A custom Markdown formatter to use.
 * @param options.packageRename - The package rename properties.
 * An optional, which is required only in case of package renamed.
 */
async function update({
  changelogPath,
  currentVersion,
  isReleaseCandidate,
  repoUrl,
  projectRootDirectory,
  tagPrefix,
  formatter,
  packageRename,
}: UpdateOptions) {
  const changelogContent = await readChangelog(changelogPath);

  const newChangelogContent = await updateChangelog({
    changelogContent,
    currentVersion,
    repoUrl,
    isReleaseCandidate,
    projectRootDirectory,
    tagPrefixes: [tagPrefix],
    formatter,
    packageRename,
  });

  if (newChangelogContent) {
    await saveChangelog(changelogPath, newChangelogContent);
    console.log('CHANGELOG.md updated.');
  } else {
    console.log('There are no new commits to add to the changelog.');
  }
}

type ValidateOptions = {
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
 * An optional, which is required only in case of package renamed.
 */
async function validate({
  changelogPath,
  currentVersion,
  isReleaseCandidate,
  repoUrl,
  tagPrefix,
  fix,
  formatter,
  packageRename,
}: ValidateOptions) {
  const changelogContent = await readChangelog(changelogPath);

  try {
    validateChangelog({
      changelogContent,
      currentVersion,
      repoUrl,
      isReleaseCandidate,
      tagPrefix,
      formatter,
      packageRename,
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
    } else if (error instanceof InvalidChangelogError) {
      return exitWithError(`Changelog is invalid: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Returns whether an error has an error code or not.
 *
 * @param error - The error to check.
 * @returns True if the error is a real error and has a code property, false otherwise.
 */
function hasErrorCode(error: unknown): error is Error & { code: unknown } {
  return (
    error instanceof Error &&
    Object.prototype.hasOwnProperty.call(error, 'code')
  );
}

type InitOptions = {
  changelogPath: string;
  repoUrl: string;
  tagPrefix: string;
};

/**
 * Create a new empty changelog.
 *
 * @param options - Initialization options.
 * @param options.changelogPath - The path to the changelog file.
 * @param options.repoUrl - The GitHub repository URL for the current project.
 * @param options.tagPrefix - The prefix used in tags before the version number.
 */
async function init({ changelogPath, repoUrl, tagPrefix }: InitOptions) {
  const changelogContent = createEmptyChangelog({ repoUrl, tagPrefix });
  await saveChangelog(changelogPath, changelogContent);
}

const rootDescription = `The root project directory. This determines where we \
look for changes since the last release (defaults to the entire repository at \
the current working directory), and where the changelog path is resolved from \
(defaults to the current working directory).`;

/**
 * Configure options that are common to all commands.
 *
 * @param _yargs - The yargs instance to configure.
 * @returns A Yargs instance configured with all common commands.
 */
function configureCommonCommandOptions(_yargs: Argv) {
  return _yargs
    .option('file', {
      default: 'CHANGELOG.md',
      description: 'The changelog file path',
      type: 'string',
    })
    .option('repo', {
      default: getRepositoryUrl(),
      description: `The GitHub repository URL`,
      type: 'string',
    })
    .option('root', {
      description: rootDescription,
      type: 'string',
    })
    .option('tagPrefix', {
      default: 'v',
      description: 'The prefix used in tags before the version number.',
      type: 'string',
    })
    .option('versionBeforePackageRename', {
      description: 'A version of the package before being renamed.',
      type: 'string',
    })
    .option('tagPrefixBeforePackageRename', {
      description: 'A tag prefix of the package before being renamed.',
      type: 'string',
    });
}

/**
 * The entrypoint for the auto-changelog CLI.
 */
async function main() {
  const { argv } = yargs(hideBin(process.argv))
    .command(
      'update',
      'Update CHANGELOG.md with any changes made since the most recent release.\nUsage: $0 update [options]',
      (_yargs) =>
        configureCommonCommandOptions(_yargs)
          .option('rc', {
            default: false,
            description: `Add new changes to the current release header, rather than to the '${unreleased}' section.`,
            type: 'boolean',
          })
          .option('currentVersion', {
            description:
              'The current version of the project that the changelog belongs to.',
            type: 'string',
          })
          .option('prettier', {
            default: false,
            description: `Expect the changelog to be formatted with Prettier.`,
            type: 'boolean',
          })
          .epilog(updateEpilog),
    )
    .command(
      'validate',
      'Validate the changelog, ensuring that it is well-formatted.\nUsage: $0 validate [options]',
      (_yargs) =>
        configureCommonCommandOptions(_yargs)
          .option('rc', {
            default: false,
            description: `Verify that the current version has a release header in the changelog`,
            type: 'boolean',
          })
          .option('currentVersion', {
            description:
              'The current version of the project that the changelog belongs to.',
            type: 'string',
          })
          .option('fix', {
            default: false,
            description: `Attempt to fix any formatting errors in the changelog`,
            type: 'boolean',
          })
          .option('prettier', {
            default: false,
            description: `Expect the changelog to be formatted with Prettier.`,
            type: 'boolean',
          })
          .epilog(validateEpilog),
    )
    .command('init', 'Initialize a new empty changelog', (_yargs) => {
      configureCommonCommandOptions(_yargs);
    })
    .strict()
    .demandCommand()
    .help('help')
    .usage(
      `Utilities for validating and updating "Keep a Changelog" formatted changelogs.\nUsage: $0 [command] [options]`,
    );

  const {
    file: changelogFilename,
    rc: isReleaseCandidate,
    repo: repoUrl,
    root: projectRootDirectory,
    tagPrefix,
    fix,
    prettier: usePrettier,
    versionBeforePackageRename,
    tagPrefixBeforePackageRename,
  } = argv;
  let { currentVersion } = argv;

  if (projectRootDirectory) {
    try {
      const stat = await fs.stat(projectRootDirectory);
      if (!stat.isDirectory()) {
        return exitWithError(
          `Project root must be a directory: '${projectRootDirectory}'`,
        );
      }
    } catch (error) {
      if (hasErrorCode(error)) {
        if (error.code === 'ENOENT') {
          return exitWithError(
            `Root directory specified does not exist: '${projectRootDirectory}'`,
          );
        } else if (error.code === 'EACCES') {
          return exitWithError(
            `Access to root directory is forbidden by file access permissions: '${projectRootDirectory}'`,
          );
        }
      }
      throw error;
    }
  }

  if (!currentVersion) {
    const manifestPath = projectRootDirectory
      ? path.join(projectRootDirectory, 'package.json')
      : path.resolve('package.json');

    try {
      const manifestText = await fs.readFile(manifestPath, {
        encoding: 'utf-8',
      });
      const manifest = JSON.parse(manifestText);
      currentVersion = manifest.version;
    } catch (error) {
      if (hasErrorCode(error)) {
        if (error.code === 'ENOENT') {
          return exitWithError(
            `Package manifest not found at path: '${manifestPath}'\nRun this script from the project root directory, or set the project directory using the '--root' flag.`,
          );
        } else if (error.code === 'EACCES') {
          return exitWithError(
            `Access to package manifest is forbidden by file access permissions: '${manifestPath}'`,
          );
        }
      }

      if (error instanceof Error && error.name === 'SyntaxError') {
        return exitWithError(
          `Package manifest cannot be parsed as JSON: '${manifestPath}'`,
        );
      }
      throw error;
    }
  }

  if (!currentVersion) {
    return exitWithError(
      `Version not found. Please set the --currentVersion flag, or run this as an npm script from a project with the 'version' field set.`,
    );
  } else if (currentVersion && semver.valid(currentVersion) === null) {
    return exitWithError(
      `Current version is not valid SemVer: '${currentVersion}'`,
    );
  } else if (!repoUrl) {
    return exitWithError(
      `npm package repository URL not found. Please set the '--repo' flag, or run this as an npm script from a project with the 'repository' field set.`,
    );
  } else if (!isValidUrl(repoUrl)) {
    return exitWithError(`Invalid repo URL: '${repoUrl}'`);
  }

  if (
    (versionBeforePackageRename && !tagPrefixBeforePackageRename) ||
    (!versionBeforePackageRename && tagPrefixBeforePackageRename)
  ) {
    return exitWithError(
      '--version-before-package-rename and --tag-prefix-before-package-rename must be given together or not at all.',
    );
  }

  let changelogPath = changelogFilename;
  if (!path.isAbsolute(changelogFilename) && projectRootDirectory) {
    changelogPath = path.resolve(projectRootDirectory, changelogFilename);
  }

  if (!argv._) {
    throw new Error('No command provided');
  }
  const command = argv._[0];

  if (command !== 'init') {
    try {
      // eslint-disable-next-line no-bitwise
      await fs.access(changelogPath, fsConstants.F_OK | fsConstants.W_OK);
    } catch (error) {
      if (hasErrorCode(error) && error.code === 'ENOENT') {
        return exitWithError(`File does not exist: '${changelogPath}'`);
      }
      return exitWithError(`File is not writable: '${changelogPath}'`);
    }
  }

  const formatter = (changelog: string) => {
    return usePrettier
      ? prettier.format(changelog, { parser: 'markdown' })
      : changelog;
  };

  if (command === 'update') {
    let packageRename: PackageRename | undefined;
    if (versionBeforePackageRename && tagPrefixBeforePackageRename) {
      packageRename = {
        versionBeforeRename: versionBeforePackageRename,
        tagPrefixBeforeRename: tagPrefixBeforePackageRename,
      };
    }
    await update({
      changelogPath,
      currentVersion,
      isReleaseCandidate,
      repoUrl,
      projectRootDirectory,
      tagPrefix,
      formatter,
      packageRename,
    });
  } else if (command === 'validate') {
    let packageRename: PackageRename | undefined;
    if (versionBeforePackageRename && tagPrefixBeforePackageRename) {
      packageRename = {
        versionBeforeRename: versionBeforePackageRename,
        tagPrefixBeforeRename: tagPrefixBeforePackageRename,
      };
    }
    await validate({
      changelogPath,
      currentVersion,
      isReleaseCandidate,
      repoUrl,
      tagPrefix,
      fix,
      formatter,
      packageRename,
    });
  } else if (command === 'init') {
    await init({
      changelogPath,
      repoUrl,
      tagPrefix,
    });
  }
  return undefined;
}

main().catch((error) => {
  exitWithError(error);
});
