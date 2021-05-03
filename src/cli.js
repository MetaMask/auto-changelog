#!/usr/bin/env node
/* eslint-disable node/no-process-exit */

const { promises: fs, constants: fsConstants } = require('fs');
const path = require('path');
const semver = require('semver');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const { updateChangelog } = require('./updateChangelog');
const { generateDiff } = require('./generateDiff');
const {
  ChangelogFormattingError,
  InvalidChangelogError,
  validateChangelog,
} = require('./validateChangelog');
const { unreleased } = require('./constants');

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

function isValidUrl(proposedUrl) {
  try {
    // eslint-disable-next-line no-new
    new URL(proposedUrl);
    return true;
  } catch (error) {
    return false;
  }
}

async function readChangelog(changelogPath) {
  return await fs.readFile(changelogPath, {
    encoding: 'utf8',
  });
}

async function saveChangelog(changelogPath, newChangelogContent) {
  await fs.writeFile(changelogPath, newChangelogContent);
}

async function update({
  changelogPath,
  currentVersion,
  isReleaseCandidate,
  repoUrl,
}) {
  const changelogContent = await readChangelog(changelogPath);

  const newChangelogContent = await updateChangelog({
    changelogContent,
    currentVersion,
    repoUrl,
    isReleaseCandidate,
  });

  await saveChangelog(changelogPath, newChangelogContent);
  console.log('CHANGELOG updated');
}

async function validate({
  changelogPath,
  currentVersion,
  isReleaseCandidate,
  repoUrl,
}) {
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
      console.error(`Changelog not well-formatted. Diff:\n\n${diff}`);
      process.exit(1);
    } else if (error instanceof InvalidChangelogError) {
      console.error(`Changelog is invalid: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

const rootDescription = `The root project directory. This determines where we \
look for changes since the last release (defaults to the entire repository at \
the current working directory), and where the changelog path is resolved from \
(defaults to the current working directory).`;

function configureCommonCommandOptions(_yargs) {
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

  if (isReleaseCandidate && !currentVersion) {
    console.error(
      `Version not found. Please set the --currentVersion flag, or run this as an npm script from a project with the 'version' field set.`,
    );
    process.exit(1);
  } else if (currentVersion && semver.valid(currentVersion) === null) {
    console.error(`Current version is not valid SemVer: '${currentVersion}'`);
    process.exit(1);
  } else if (!repoUrl) {
    console.error(
      `npm package repository URL not found. Please set the '--repo' flag, or run this as an npm script from a project with the 'repository' field set.`,
    );
    process.exit(1);
  } else if (!isValidUrl(repoUrl)) {
    console.error(`Invalid repo URL: '${repoUrl}'`);
    process.exit(1);
  }

  if (projectRootDirectory) {
    try {
      const stat = await fs.stat(projectRootDirectory);
      if (!stat.isDirectory()) {
        console.error(
          `Project root must be a directory: '${projectRootDirectory}'`,
        );
        process.exit(1);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(
          `Root directory specified does not exist: '${projectRootDirectory}'`,
        );
        process.exit(1);
      } else if (error.code === 'EACCES') {
        console.error(
          `Access to root directory is forbidden by file access permissions: '${projectRootDirectory}'`,
        );
        process.exit(1);
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
      console.error(`File does not exist: '${changelogPath}'`);
    } else {
      console.error(`File is not writable: '${changelogPath}'`);
    }
    process.exit(1);
  }

  if (argv._ && argv._[0] === 'update') {
    await update({
      changelogPath,
      currentVersion,
      isReleaseCandidate,
      repoUrl,
    });
  } else if (argv._ && argv._[0] === 'validate') {
    await validate({
      changelogPath,
      currentVersion,
      isReleaseCandidate,
      repoUrl,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
