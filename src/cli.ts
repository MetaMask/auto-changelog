import { promises as fs, constants as fsConstants } from 'fs';
import path from 'path';
import { URL } from 'url';
import semver from 'semver';
import yargs from 'yargs/yargs';
import type { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';

import { updateChangelog } from './updateChangelog';
import { generateDiff } from './generateDiff';

import { unreleased, Version } from './constants';

import {
  ChangelogFormattingError,
  InvalidChangelogError,
  validateChangelog,
} from './validateChangelog';

const updateEpilog = `New commits will be added to the "${unreleased}" section (or \
to the section for the current release if the '--rc' flag is used) in reverse \
chronological order. Any commits for PRs that are represented already in the \
changelog will be ignored.

If the '--rc' flag is used and the section for the current release does not \
yet exist, it will be created.`;

const validateEpilog = `This does not ensure that the changelog is complete, \
or that each change is in the correct section. It just ensures that the \
formatting is correct. Verification of the contents is left for manual review.`;

// eslint-disable-next-line node/no-process-env
const npmPackageVersion = process.env.npm_package_version;
// eslint-disable-next-line node/no-process-env
const npmPackageRepositoryUrl = process.env.npm_package_repository_url;

function isValidUrl(proposedUrl: string) {
  try {
    // eslint-disable-next-line no-new
    new URL(proposedUrl);
    return true;
  } catch (error) {
    return false;
  }
}

function exitWithError(errorMessage: string) {
  console.error(errorMessage);
  process.exitCode = 1;
}

async function readChangelog(changelogPath: string) {
  return await fs.readFile(changelogPath, {
    encoding: 'utf8',
  });
}

async function saveChangelog(
  changelogPath: string,
  newChangelogContent: string,
) {
  await fs.writeFile(changelogPath, newChangelogContent);
}

interface UpdateOptions {
  changelogPath: string;
  currentVersion?: Version;
  repoUrl: string;
  isReleaseCandidate: boolean;
  projectRootDirectory?: string;
}

async function update({
  changelogPath,
  currentVersion,
  isReleaseCandidate,
  repoUrl,
  projectRootDirectory,
}: UpdateOptions) {
  const changelogContent = await readChangelog(changelogPath);

  const newChangelogContent = await updateChangelog({
    changelogContent,
    currentVersion,
    repoUrl,
    isReleaseCandidate,
    projectRootDirectory,
  });

  if (newChangelogContent) {
    await saveChangelog(changelogPath, newChangelogContent);
    console.log('CHANGELOG.md updated.');
  } else {
    console.log('There are no new commits to add to the changelog.');
  }
}

interface ValidateOptions {
  changelogPath: string;
  currentVersion: Version;
  isReleaseCandidate: boolean;
  repoUrl: string;
}

async function validate({
  changelogPath,
  currentVersion,
  isReleaseCandidate,
  repoUrl,
}: ValidateOptions) {
  const changelogContent = await readChangelog(changelogPath);

  try {
    validateChangelog({
      changelogContent,
      currentVersion,
      repoUrl,
      isReleaseCandidate,
    });
  } catch (error) {
    if (error instanceof ChangelogFormattingError) {
      const { validChangelog, invalidChangelog } = error.data;
      const diff = generateDiff(validChangelog, invalidChangelog);
      exitWithError(`Changelog not well-formatted. Diff:\n\n${diff}`);
      return;
    } else if (error instanceof InvalidChangelogError) {
      exitWithError(`Changelog is invalid: ${error.message}`);
      return;
    }
    throw error;
  }
}

const rootDescription = `The root project directory. This determines where we \
look for changes since the last release (defaults to the entire repository at \
the current working directory), and where the changelog path is resolved from \
(defaults to the current working directory).`;

function configureCommonCommandOptions(_yargs: Argv) {
  return _yargs
    .option('file', {
      default: 'CHANGELOG.md',
      description: 'The changelog file path',
      type: 'string',
    })
    .option('currentVersion', {
      default: npmPackageVersion,
      description:
        'The current version of the project that the changelog belongs to.',
      type: 'string',
    })
    .option('repo', {
      default: npmPackageRepositoryUrl,
      description: `The GitHub repository URL`,
      type: 'string',
    })
    .option('root', {
      description: rootDescription,
      type: 'string',
    });
}

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
          .epilog(validateEpilog),
    )
    .strict()
    .demandCommand()
    .help('help')
    .usage(
      `Utilities for validating and updating "Keep a Changelog" formatted changelogs.\nUsage: $0 [command] [options]`,
    );

  const {
    currentVersion,
    file: changelogFilename,
    rc: isReleaseCandidate,
    repo: repoUrl,
    root: projectRootDirectory,
  } = argv;

  if (
    isReleaseCandidate &&
    (!currentVersion || typeof currentVersion !== 'string')
  ) {
    exitWithError(
      `Version not found. Please set the --currentVersion flag, or run this as an npm script from a project with the 'version' field set.`,
    );
    return;
  } else if (currentVersion && semver.valid(currentVersion) === null) {
    exitWithError(`Current version is not valid SemVer: '${currentVersion}'`);
    return;
  } else if (!repoUrl) {
    exitWithError(
      `npm package repository URL not found. Please set the '--repo' flag, or run this as an npm script from a project with the 'repository' field set.`,
    );
    return;
  } else if (!isValidUrl(repoUrl)) {
    exitWithError(`Invalid repo URL: '${repoUrl}'`);
    return;
  }

  if (projectRootDirectory) {
    try {
      const stat = await fs.stat(projectRootDirectory);
      if (!stat.isDirectory()) {
        exitWithError(
          `Project root must be a directory: '${projectRootDirectory}'`,
        );
        return;
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        exitWithError(
          `Root directory specified does not exist: '${projectRootDirectory}'`,
        );
        return;
      } else if (error.code === 'EACCES') {
        exitWithError(
          `Access to root directory is forbidden by file access permissions: '${projectRootDirectory}'`,
        );
        return;
      }
      throw error;
    }
  }

  let changelogPath = changelogFilename;
  if (!path.isAbsolute(changelogFilename) && projectRootDirectory) {
    changelogPath = path.resolve(projectRootDirectory, changelogFilename);
  }

  try {
    // eslint-disable-next-line no-bitwise
    await fs.access(changelogPath, fsConstants.F_OK | fsConstants.W_OK);
  } catch (error) {
    if (error.code === 'ENOENT') {
      exitWithError(`File does not exist: '${changelogPath}'`);
    } else {
      exitWithError(`File is not writable: '${changelogPath}'`);
    }
    return;
  }

  if (argv._ && argv._[0] === 'update') {
    await update({
      changelogPath,
      currentVersion,
      isReleaseCandidate,
      repoUrl,
      projectRootDirectory,
    });
  } else if (argv._ && argv._[0] === 'validate') {
    await validate({
      changelogPath,
      // TODO: Is it OK to assign an empty string here?
      currentVersion: currentVersion || '',
      isReleaseCandidate,
      repoUrl,
    });
  }
}

main().catch((error) => {
  exitWithError(error);
});
