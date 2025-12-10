import execa from 'execa';
import { promises as fs } from 'fs';
import path from 'path';

import {
  validateDependencyChangelogs,
  updateDependencyChangelogs,
} from './dependency-changelog';
import type {
  CheckDependencyBumpsOptions,
  PackageChanges,
  PackageInfo,
} from './dependency-types';
import { getRepositoryUrl } from './repo';

type PackageManifest = {
  name?: string;
  repository?:
    | string
    | {
        url?: string;
      };
};

/**
 * Runs a command and returns its stdout.
 *
 * @param command - The command to run.
 * @param args - Arguments to pass to the command.
 * @param projectRoot - Working directory for the command.
 * @returns The stdout output.
 */
async function getStdoutFromCommand(
  command: string,
  args: string[],
  projectRoot: string,
): Promise<string> {
  return (await execa(command, args, { cwd: projectRoot })).stdout;
}

/**
 * Gets the git diff between two refs for package.json files.
 *
 * @param fromRef - Starting git reference.
 * @param toRef - Ending git reference.
 * @param projectRoot - Working directory for the command.
 * @returns The git diff output.
 */
async function getManifestGitDiff(
  fromRef: string,
  toRef: string,
  projectRoot: string,
): Promise<string> {
  return await getStdoutFromCommand(
    'git',
    [
      'diff',
      '-U9999', // Show maximum context to ensure full dependency lists are visible
      fromRef,
      toRef,
      '--',
      '**/package.json',
    ],
    projectRoot,
  );
}

/**
 * Reads and parses a package.json file.
 *
 * @param manifestPath - Path to the package.json file.
 * @returns The parsed package manifest.
 */
async function readPackageManifest(
  manifestPath: string,
): Promise<PackageManifest> {
  const fileContent = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(fileContent) as PackageManifest;
}

/**
 * Parse git diff output to find dependency and package version changes.
 *
 * @param diff - Raw git diff output.
 * @param projectRoot - Project root directory.
 * @returns Mapping of packages to dependency changes.
 */
export async function parseDependencyDiff(
  diff: string,
  projectRoot: string,
): Promise<PackageChanges> {
  const lines = diff.split('\n');
  const changes: PackageChanges = {};

  let currentFile = '';
  let currentSection: 'dependencies' | 'peerDependencies' | null = null;
  const removedDeps = new Map<
    string,
    { version: string; section: 'dependencies' | 'peerDependencies' }
  >();
  const processedChanges = new Set<string>();
  const packageVersionsMap = new Map<string, string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.+)/u);
      if (match) {
        currentSection = null;
        currentFile = match[1];
      }
    }

    if (line.startsWith('+') && line.includes('"version":')) {
      const versionMatch = line.match(/^\+\s*"version":\s*"([^"]+)"/u);
      if (versionMatch) {
        const newVersion = versionMatch[1];
        const packageMatch = currentFile.match(/packages\/([^/]+)\//u);
        if (packageMatch) {
          const packageName = packageMatch[1];
          packageVersionsMap.set(packageName, newVersion);
        }
      }
    }

    if (line.includes('"peerDependencies"')) {
      currentSection = 'peerDependencies';
    } else if (line.includes('"dependencies"')) {
      currentSection = 'dependencies';
    } else if (
      line.includes('"devDependencies"') ||
      line.includes('"optionalDependencies"')
    ) {
      currentSection = null;
    }

    if (currentSection && (line.trim() === '},' || line.trim() === '}')) {
      const nextLine = lines[i + 1];
      const isNextSectionDependencies =
        nextLine && /^\s*"dependencies"\s*:/u.test(nextLine);
      const isNextSectionPeerDependencies =
        nextLine && /^\s*"peerDependencies"\s*:/u.test(nextLine);

      if (!isNextSectionDependencies && !isNextSectionPeerDependencies) {
        currentSection = null;
      }
    }

    if (line.startsWith('-') && currentSection) {
      const match = line.match(/^-\s*"([^"]+)":\s*"([^"]+)"/u);
      if (match) {
        const [, dep, version] = match;
        const key = `${currentFile}:${currentSection}:${dep}`;
        removedDeps.set(key, {
          version,
          section: currentSection,
        });
      }
    }

    if (line.startsWith('+') && currentSection) {
      const match = line.match(/^\+\s*"([^"]+)":\s*"([^"]+)"/u);
      if (match) {
        const [, dep, newVersion] = match;
        const key = `${currentFile}:${currentSection}:${dep}`;
        const removed = removedDeps.get(key);

        if (removed && removed.version !== newVersion) {
          const packageMatch = currentFile.match(/packages\/([^/]+)\//u);
          if (packageMatch) {
            const packageDirName = packageMatch[1];
            const changeId = `${packageDirName}:${currentSection}:${dep}:${newVersion}`;

            if (processedChanges.has(changeId)) {
              continue;
            }
            processedChanges.add(changeId);

            if (!changes[packageDirName]) {
              const manifestPath = path.join(
                projectRoot,
                'packages',
                packageDirName,
                'package.json',
              );
              const packageManifest = await readPackageManifest(manifestPath);

              const pkgInfo: PackageInfo = {
                packageName: packageManifest.name ?? packageDirName,
                dependencyChanges: [],
              };
              const packageNewVersion = packageVersionsMap.get(packageDirName);
              if (packageNewVersion) {
                pkgInfo.newVersion = packageNewVersion;
              }

              changes[packageDirName] = pkgInfo;
            }

            const sectionType = currentSection;
            const existingChange = changes[
              packageDirName
            ].dependencyChanges.find(
              (dependencyChange) =>
                dependencyChange.dependency === dep &&
                dependencyChange.type === sectionType,
            );

            if (!existingChange) {
              changes[packageDirName].dependencyChanges.push({
                package: packageDirName,
                dependency: dep,
                type: currentSection,
                oldVersion: removed.version,
                newVersion,
              });
            }
          }
        }
      }
    }
  }

  return changes;
}

/**
 * Gets the current git branch name.
 *
 * @param projectRoot - Working directory for the command.
 * @returns The current branch name.
 */
async function getCurrentBranchName(projectRoot: string): Promise<string> {
  return await getStdoutFromCommand(
    'git',
    ['rev-parse', '--abbrev-ref', 'HEAD'],
    projectRoot,
  );
}

/**
 * Gets the merge base between HEAD and the base branch.
 *
 * @param baseBranch - The base branch reference (e.g., 'origin/main', 'upstream/develop').
 * @param projectRoot - Working directory for the command.
 * @returns The merge base commit SHA.
 */
async function getMergeBase(
  baseBranch: string,
  projectRoot: string,
): Promise<string> {
  return await getStdoutFromCommand(
    'git',
    ['merge-base', 'HEAD', baseBranch],
    projectRoot,
  );
}

/**
 * Resolves the repository URL from arguments or package.json.
 *
 * @param projectRoot - Root directory of the project.
 * @param repoUrl - Optional repository URL override.
 * @returns The resolved repository URL.
 */
async function resolveRepositoryUrl(
  projectRoot: string,
  repoUrl?: string | null,
): Promise<string> {
  if (repoUrl) {
    return repoUrl;
  }

  const autoRepoUrl = getRepositoryUrl();
  if (autoRepoUrl) {
    return autoRepoUrl;
  }

  const manifestPath = path.join(projectRoot, 'package.json');
  try {
    const manifest = await readPackageManifest(manifestPath);
    if (typeof manifest.repository === 'string') {
      return manifest.repository.replace(/\.git$/u, '');
    }
    if (manifest.repository?.url) {
      return manifest.repository.url.replace(/\.git$/u, '');
    }
  } catch (error) {
    throw new Error(
      `Repository URL not found. Provide --repo or add repository to ${manifestPath}.`,
    );
  }

  throw new Error(
    `Repository URL not found. Provide --repo or add repository to ${manifestPath}.`,
  );
}

/**
 * Check dependency bumps between two git references and verify changelog entries.
 *
 * @param options - Options.
 * @param options.projectRoot - Root directory containing packages.
 * @param options.fromRef - Starting git ref (defaults to merge base with base branch).
 * @param options.toRef - Ending git ref (defaults to HEAD).
 * @param options.remote - Remote name (defaults to 'origin').
 * @param options.baseBranch - Base branch reference (defaults to '<remote>/main').
 * @param options.formatter - Formatter to use for changelog entries.
 * @param options.fix - Whether to add missing changelog entries.
 * @param options.prNumber - PR number to include when adding entries.
 * @param options.repoUrl - Repository URL override.
 * @param options.stdout - Output stream.
 * @param options.stderr - Error stream.
 * @returns Map of package changes.
 */
export async function checkDependencyBumps({
  projectRoot,
  fromRef,
  toRef = 'HEAD',
  remote = 'origin',
  baseBranch,
  formatter,
  fix = false,
  prNumber,
  repoUrl,
  stdout,
  stderr,
}: CheckDependencyBumpsOptions): Promise<PackageChanges> {
  const actualBaseBranch = baseBranch ?? `${remote}/main`;
  let actualFromRef = fromRef ?? '';

  if (!actualFromRef) {
    const currentBranch = await getCurrentBranchName(projectRoot);
    stdout.write(`\n📌 Current branch: '${currentBranch}'\n`);

    if (currentBranch === actualBaseBranch) {
      stdout.write(
        `⚠️  You are on the ${actualBaseBranch} branch. Provide --from or switch to a feature branch.\n`,
      );
      return {};
    }

    try {
      actualFromRef = await getMergeBase(actualBaseBranch, projectRoot);
      stdout.write(
        `📍 Comparing against merge base with ${actualBaseBranch}: ${actualFromRef.substring(0, 8)}...\n`,
      );
    } catch {
      stderr.write(
        `❌ Could not find merge base with ${actualBaseBranch}. Provide --from or --base-branch.\n`,
      );
      return {};
    }
  }

  stdout.write(
    `\n🔍 Checking dependency changes from ${actualFromRef.substring(
      0,
      8,
    )} to ${toRef}...\n\n`,
  );

  const diff = await getManifestGitDiff(actualFromRef, toRef, projectRoot);
  if (!diff) {
    stdout.write('No package.json changes found.\n');
    return {};
  }

  const changes = await parseDependencyDiff(diff, projectRoot);
  if (Object.keys(changes).length === 0) {
    stdout.write('No dependency version bumps found.\n');
    return {};
  }

  const resolvedRepoUrl = await resolveRepositoryUrl(projectRoot, repoUrl);

  stdout.write('\n\n📊 JSON Output:\n');
  stdout.write('==============\n');
  stdout.write(JSON.stringify(changes, null, 2));
  stdout.write('\n');

  stdout.write('\n\n🔍 Validating changelogs...\n');
  stdout.write('==========================\n');

  const validationResults = await validateDependencyChangelogs(
    changes,
    projectRoot,
    resolvedRepoUrl,
    formatter,
  );

  let hasErrors = false;
  for (const result of validationResults) {
    if (!result.hasChangelog) {
      stderr.write(`❌ ${result.package}: CHANGELOG.md not found\n`);
      hasErrors = true;
    } else if (!result.hasUnreleasedSection) {
      const sectionName = result.checkedVersion
        ? `[${result.checkedVersion}]`
        : '[Unreleased]';
      stderr.write(`❌ ${result.package}: No ${sectionName} section found\n`);
      hasErrors = true;
    } else if (result.missingEntries.length > 0) {
      stderr.write(
        `❌ ${result.package}: Missing ${result.missingEntries.length} changelog ${
          result.missingEntries.length === 1 ? 'entry' : 'entries'
        }:\n`,
      );
      for (const entry of result.missingEntries) {
        stderr.write(`   - ${entry.dependency}\n`);
      }
      hasErrors = true;
    } else {
      stdout.write(`✅ ${result.package}: All entries present\n`);
    }
  }

  if (hasErrors && !fix) {
    stderr.write('\n💡 Run with --fix to automatically update changelogs\n');
  }

  if (fix) {
    stdout.write('\n\n🔧 Updating changelogs...\n');
    stdout.write('========================\n');

    const updatedCount = await updateDependencyChangelogs(changes, {
      projectRoot,
      prNumber,
      repoUrl: resolvedRepoUrl,
      formatter,
      stdout,
      stderr,
    });

    if (updatedCount > 0) {
      stdout.write(
        `\n✅ Updated ${updatedCount} changelog${updatedCount === 1 ? '' : 's'}\n`,
      );
      if (!prNumber) {
        stdout.write(
          '\n💡 Placeholder PR numbers (XXXXX) were used. Provide --pr to set a PR number.\n',
        );
      }
    } else {
      stdout.write('\n✅ All changelogs are up to date\n');
    }
  }

  return changes;
}
