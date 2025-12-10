import execa from 'execa';
import fs from 'fs';
import os from 'os';
import _outdent from 'outdent';
import path from 'path';

import { checkDependencyBumps } from '../../src/check-dependency-bumps';

const outdent = _outdent({ trimTrailingNewline: false });

/**
 * Builds a changelog by filling in the first part automatically, which never
 * changes.
 *
 * @param variantContent - The part of the changelog that can change depending
 * on what is expected or what sort of changes have been made to the repo so
 * far.
 * @returns The full changelog.
 */
function buildChangelog(variantContent: string): string {
  const invariantContent = outdent`
    # Changelog
    All notable changes to this project will be documented in this file.

    The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
    and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
  `;

  return `${invariantContent}\n${variantContent}`;
}

type WritableBuffer = { buffer: string; write: (chunk: string) => boolean };

/**
 * Create a writable buffer that mimics a WriteStream interface.
 *
 * @returns Writable buffer collector.
 */
function createBuffer(): WritableBuffer {
  return {
    buffer: '',
    write(chunk: string) {
      this.buffer += chunk;
      return true;
    },
  };
}

const TEST_REPO_URL = 'https://github.com/example-org/example-repo';
const formatter = async (content: string) => content;

type PackageDefinition = {
  name: string;
  dir: string;
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type RepoEnvironment = {
  projectRoot: string;
  baseRef: string;
  /**
   * Run a git command in the project.
   *
   * @param args - Git command arguments.
   */
  git: (args: string[]) => Promise<void>;
  /**
   * Write JSON to a file relative to project root.
   *
   * @param relativePath - Path relative to project root.
   * @param data - Data to serialize.
   */
  writeJson: (relativePath: string, data: unknown) => Promise<void>;
  /**
   * Write text to a file relative to project root.
   *
   * @param relativePath - Path relative to project root.
   * @param content - Content to write.
   */
  writeFile: (relativePath: string, content: string) => Promise<void>;
  /**
   * Read a file relative to project root.
   *
   * @param relativePath - Path relative to project root.
   * @returns File content.
   */
  readFile: (relativePath: string) => Promise<string>;
};

type RepoSetupOptions = {
  packages: PackageDefinition[];
  changelogContent?: Record<string, string>;
};

/**
 * Sets up a temporary repo for testing, runs the callback, and cleans up.
 *
 * @param options - Setup options for packages and changelogs.
 * @param fn - Test function that receives the environment.
 */
async function withRepo(
  options: RepoSetupOptions,
  fn: (env: RepoEnvironment) => Promise<void>,
): Promise<void> {
  const projectRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'auto-changelog-check-deps-'),
  );

  try {
    // Scoped helper functions
    const git = async (args: string[]) => {
      await execa('git', args, { cwd: projectRoot });
    };

    const writeJson = async (relativePath: string, data: unknown) => {
      const fullPath = path.join(projectRoot, relativePath);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(
        fullPath,
        `${JSON.stringify(data, null, 2)}\n`,
        'utf8',
      );
    };

    const writeFile = async (relativePath: string, content: string) => {
      const fullPath = path.join(projectRoot, relativePath);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, content, 'utf8');
    };

    const readFile = async (relativePath: string) => {
      return fs.promises.readFile(path.join(projectRoot, relativePath), 'utf8');
    };

    // Set up root package.json
    await writeJson('package.json', {
      name: 'root',
      version: '1.0.0',
      private: true,
      workspaces: ['packages/*'],
      repository: TEST_REPO_URL,
    });

    // Set up packages
    for (const pkg of options.packages) {
      await writeJson(`packages/${pkg.dir}/package.json`, {
        name: pkg.name,
        version: pkg.version,
        ...(pkg.dependencies ? { dependencies: pkg.dependencies } : {}),
        ...(pkg.peerDependencies
          ? { peerDependencies: pkg.peerDependencies }
          : {}),
      });

      if (options.changelogContent?.[pkg.dir]) {
        await writeFile(
          `packages/${pkg.dir}/CHANGELOG.md`,
          options.changelogContent[pkg.dir],
        );
      }
    }

    // Initialize git repo
    await git(['init']);
    await git(['config', 'user.email', 'test@example.com']);
    await git(['config', 'user.name', 'Tester']);
    await git(['add', '.']);
    await git(['commit', '-m', 'Initial commit']);

    const baseRef = (
      await execa('git', ['rev-parse', 'HEAD'], { cwd: projectRoot })
    ).stdout.trim();

    // Run the test callback
    const env: RepoEnvironment = {
      projectRoot,
      baseRef,
      git,
      writeJson,
      writeFile,
      readFile,
    };
    await fn(env);
  } finally {
    // Cleanup temp directory
    await fs.promises.rm(projectRoot, { recursive: true, force: true });
  }
}

describe('check-deps functional', () => {
  it('detects dependency bumps and validates changelogs', async () => {
    await withRepo(
      {
        packages: [
          {
            name: '@scope/a',
            dir: 'a',
            version: '1.0.0',
            dependencies: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/b': '1.0.0',
            },
          },
          { name: '@scope/b', dir: 'b', version: '1.0.0' },
        ],
        changelogContent: {
          a: buildChangelog(outdent`
            ## [Unreleased]

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        },
      },
      async ({ projectRoot, baseRef, git, writeJson }) => {
        await writeJson('packages/a/package.json', {
          name: '@scope/a',
          version: '1.0.0',
          dependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/b': '2.0.0',
          },
        });
        await git(['add', '.']);
        await git(['commit', '-m', 'Bump @scope/b to 2.0.0']);

        const stdout = createBuffer();
        const stderr = createBuffer();
        const result = await checkDependencyBumps({
          projectRoot,
          fromRef: baseRef,
          repoUrl: TEST_REPO_URL,
          formatter,
          stdout,
          stderr,
        });

        expect(result).toStrictEqual({
          a: {
            packageName: '@scope/a',
            dependencyChanges: [
              {
                package: 'a',
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        });
        expect(
          stderr.buffer.includes('Missing') ||
            stderr.buffer.includes('No [Unreleased] section found'),
        ).toBe(true);
      },
    );
  });

  it('automatically fixes missing changelog entries with --fix', async () => {
    await withRepo(
      {
        packages: [
          {
            name: '@scope/a',
            dir: 'a',
            version: '1.0.0',
            dependencies: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/b': '1.0.0',
            },
          },
          { name: '@scope/b', dir: 'b', version: '1.0.0' },
        ],
        changelogContent: {
          a: buildChangelog(outdent`
            ## [Unreleased]

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        },
      },
      async ({ projectRoot, baseRef, git, writeJson, readFile }) => {
        await writeJson('packages/a/package.json', {
          name: '@scope/a',
          version: '1.0.0',
          dependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/b': '2.0.0',
          },
        });
        await git(['add', '.']);
        await git(['commit', '-m', 'Bump @scope/b to 2.0.0']);

        const stdout = createBuffer();
        const stderr = createBuffer();
        const result = await checkDependencyBumps({
          projectRoot,
          fromRef: baseRef,
          fix: true,
          prNumber: '123',
          repoUrl: TEST_REPO_URL,
          formatter,
          stdout,
          stderr,
        });

        expect(result).toStrictEqual({
          a: {
            packageName: '@scope/a',
            dependencyChanges: [
              {
                package: 'a',
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        });

        const actualChangelog = await readFile('packages/a/CHANGELOG.md');
        expect(actualChangelog).toBe(
          buildChangelog(outdent`
            ## [Unreleased]
            ### Changed
            - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        );
      },
    );
  });

  it('detects peerDependency bumps and marks them as BREAKING', async () => {
    await withRepo(
      {
        packages: [
          {
            name: '@scope/a',
            dir: 'a',
            version: '1.0.0',
            peerDependencies: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/b': '1.0.0',
            },
          },
          { name: '@scope/b', dir: 'b', version: '1.0.0' },
        ],
        changelogContent: {
          a: buildChangelog(outdent`
            ## [Unreleased]

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        },
      },
      async ({ projectRoot, baseRef, git, writeJson, readFile }) => {
        await writeJson('packages/a/package.json', {
          name: '@scope/a',
          version: '1.0.0',
          peerDependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/b': '2.0.0',
          },
        });
        await git(['add', '.']);
        await git(['commit', '-m', 'Bump @scope/b peerDep to 2.0.0']);

        const stdout = createBuffer();
        const stderr = createBuffer();
        const result = await checkDependencyBumps({
          projectRoot,
          fromRef: baseRef,
          fix: true,
          prNumber: '456',
          repoUrl: TEST_REPO_URL,
          formatter,
          stdout,
          stderr,
        });

        expect(result).toStrictEqual({
          a: {
            packageName: '@scope/a',
            dependencyChanges: [
              {
                package: 'a',
                dependency: '@scope/b',
                type: 'peerDependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        });

        const actualChangelog = await readFile('packages/a/CHANGELOG.md');
        expect(actualChangelog).toBe(
          buildChangelog(outdent`
            ## [Unreleased]
            ### Changed
            - **BREAKING:** Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#456](${TEST_REPO_URL}/pull/456))

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        );
      },
    );
  });

  it('orders peerDependency bumps (BREAKING) before regular dependencies when fixing', async () => {
    await withRepo(
      {
        packages: [
          {
            name: '@scope/a',
            dir: 'a',
            version: '1.0.0',
            dependencies: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/b': '1.0.0',
            },
            peerDependencies: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/c': '1.0.0',
            },
          },
          { name: '@scope/b', dir: 'b', version: '1.0.0' },
          { name: '@scope/c', dir: 'c', version: '1.0.0' },
        ],
        changelogContent: {
          a: buildChangelog(outdent`
            ## [Unreleased]

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        },
      },
      async ({ projectRoot, baseRef, git, writeJson, readFile }) => {
        await writeJson('packages/a/package.json', {
          name: '@scope/a',
          version: '1.0.0',
          dependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/b': '2.0.0',
          },
          peerDependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/c': '2.0.0',
          },
        });
        await git(['add', '.']);
        await git(['commit', '-m', 'Bump deps and peerDeps']);

        const stdout = createBuffer();
        const stderr = createBuffer();
        const result = await checkDependencyBumps({
          projectRoot,
          fromRef: baseRef,
          fix: true,
          prNumber: '999',
          repoUrl: TEST_REPO_URL,
          formatter,
          stdout,
          stderr,
        });

        expect(result).toStrictEqual({
          a: {
            packageName: '@scope/a',
            dependencyChanges: [
              {
                package: 'a',
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
              {
                package: 'a',
                dependency: '@scope/c',
                type: 'peerDependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        });

        const actualChangelog = await readFile('packages/a/CHANGELOG.md');
        expect(actualChangelog).toBe(
          buildChangelog(outdent`
            ## [Unreleased]
            ### Changed
            - **BREAKING:** Bump \`@scope/c\` from \`1.0.0\` to \`2.0.0\` ([#999](${TEST_REPO_URL}/pull/999))
            - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#999](${TEST_REPO_URL}/pull/999))

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        );
      },
    );
  });

  it('validates existing changelog entries correctly', async () => {
    await withRepo(
      {
        packages: [
          {
            name: '@scope/a',
            dir: 'a',
            version: '1.0.0',
            dependencies: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/b': '1.0.0',
            },
          },
          { name: '@scope/b', dir: 'b', version: '1.0.0' },
        ],
        changelogContent: {
          a: buildChangelog(outdent`
            ## [Unreleased]
            ### Changed
            - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        },
      },
      async ({ projectRoot, baseRef, git, writeJson }) => {
        await writeJson('packages/a/package.json', {
          name: '@scope/a',
          version: '1.0.0',
          dependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/b': '2.0.0',
          },
        });
        await git(['add', '.']);
        await git(['commit', '-m', 'Bump @scope/b to 2.0.0']);

        const stdout = createBuffer();
        const stderr = createBuffer();
        const result = await checkDependencyBumps({
          projectRoot,
          fromRef: baseRef,
          repoUrl: TEST_REPO_URL,
          formatter,
          stdout,
          stderr,
        });

        expect(result).toStrictEqual({
          a: {
            packageName: '@scope/a',
            dependencyChanges: [
              {
                package: 'a',
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        });
      },
    );
  });

  it('handles multiple dependency bumps in the same package', async () => {
    await withRepo(
      {
        packages: [
          {
            name: '@scope/a',
            dir: 'a',
            version: '1.0.0',
            dependencies: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/b': '1.0.0',
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/c': '1.0.0',
            },
          },
          { name: '@scope/b', dir: 'b', version: '1.0.0' },
          { name: '@scope/c', dir: 'c', version: '1.0.0' },
        ],
        changelogContent: {
          a: buildChangelog(outdent`
            ## [Unreleased]

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        },
      },
      async ({ projectRoot, baseRef, git, writeJson, readFile }) => {
        await writeJson('packages/a/package.json', {
          name: '@scope/a',
          version: '1.0.0',
          dependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/b': '2.0.0',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/c': '2.0.0',
          },
        });
        await git(['add', '.']);
        await git(['commit', '-m', 'Bump multiple dependencies']);

        const stdout = createBuffer();
        const stderr = createBuffer();
        const result = await checkDependencyBumps({
          projectRoot,
          fromRef: baseRef,
          fix: true,
          prNumber: '777',
          repoUrl: TEST_REPO_URL,
          formatter,
          stdout,
          stderr,
        });

        expect(result).toStrictEqual({
          a: {
            packageName: '@scope/a',
            dependencyChanges: [
              {
                package: 'a',
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
              {
                package: 'a',
                dependency: '@scope/c',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        });

        const actualChangelog = await readFile('packages/a/CHANGELOG.md');
        expect(actualChangelog).toBe(
          buildChangelog(outdent`
            ## [Unreleased]
            ### Changed
            - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#777](${TEST_REPO_URL}/pull/777))
            - Bump \`@scope/c\` from \`1.0.0\` to \`2.0.0\` ([#777](${TEST_REPO_URL}/pull/777))

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        );
      },
    );
  });

  it('orders BREAKING changes before regular dependencies when same dep is both dep and peerDep', async () => {
    await withRepo(
      {
        packages: [
          {
            name: '@scope/a',
            dir: 'a',
            version: '1.0.0',
            dependencies: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/b': '1.0.0',
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/c': '1.0.0',
            },
            peerDependencies: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/b': '1.0.0',
            },
          },
          { name: '@scope/b', dir: 'b', version: '1.0.0' },
          { name: '@scope/c', dir: 'c', version: '1.0.0' },
        ],
        changelogContent: {
          a: buildChangelog(outdent`
            ## [Unreleased]

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        },
      },
      async ({ projectRoot, baseRef, git, writeJson, readFile }) => {
        await writeJson('packages/a/package.json', {
          name: '@scope/a',
          version: '1.0.0',
          dependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/b': '2.0.0',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/c': '2.0.0',
          },
          peerDependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/b': '2.0.0',
          },
        });
        await git(['add', '.']);
        await git(['commit', '-m', 'Bump dependencies and peerDependencies']);

        const stdout = createBuffer();
        const stderr = createBuffer();
        const result = await checkDependencyBumps({
          projectRoot,
          fromRef: baseRef,
          fix: true,
          prNumber: '111',
          repoUrl: TEST_REPO_URL,
          formatter,
          stdout,
          stderr,
        });

        expect(result).toStrictEqual({
          a: {
            packageName: '@scope/a',
            dependencyChanges: [
              {
                package: 'a',
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
              {
                package: 'a',
                dependency: '@scope/c',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
              {
                package: 'a',
                dependency: '@scope/b',
                type: 'peerDependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        });

        const actualChangelog = await readFile('packages/a/CHANGELOG.md');
        expect(actualChangelog).toBe(
          buildChangelog(outdent`
            ## [Unreleased]
            ### Changed
            - **BREAKING:** Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#111](${TEST_REPO_URL}/pull/111))
            - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#111](${TEST_REPO_URL}/pull/111))
            - Bump \`@scope/c\` from \`1.0.0\` to \`2.0.0\` ([#111](${TEST_REPO_URL}/pull/111))

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        );
      },
    );
  });

  it('updates existing changelog entry when dependency is bumped again', async () => {
    await withRepo(
      {
        packages: [
          {
            name: '@scope/a',
            dir: 'a',
            version: '1.0.0',
            dependencies: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/b': '1.0.0',
            },
          },
          { name: '@scope/b', dir: 'b', version: '1.0.0' },
        ],
        changelogContent: {
          a: buildChangelog(outdent`
            ## [Unreleased]
            ### Changed
            - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#100](${TEST_REPO_URL}/pull/100))

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        },
      },
      async ({ projectRoot, baseRef, git, writeJson, readFile }) => {
        // Bump from 2.0.0 to 3.0.0 (the changelog already has 1.0.0 -> 2.0.0)
        await writeJson('packages/a/package.json', {
          name: '@scope/a',
          version: '1.0.0',
          dependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/b': '3.0.0',
          },
        });
        await git(['add', '.']);
        await git(['commit', '-m', 'Bump @scope/b to 3.0.0']);

        const stdout = createBuffer();
        const stderr = createBuffer();
        const result = await checkDependencyBumps({
          projectRoot,
          fromRef: baseRef,
          fix: true,
          prNumber: '200',
          repoUrl: TEST_REPO_URL,
          formatter,
          stdout,
          stderr,
        });

        expect(result).toStrictEqual({
          a: {
            packageName: '@scope/a',
            dependencyChanges: [
              {
                package: 'a',
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '3.0.0',
              },
            ],
          },
        });

        // Should update existing entry with new version and concatenate PR numbers
        const actualChangelog = await readFile('packages/a/CHANGELOG.md');
        expect(actualChangelog).toBe(
          buildChangelog(outdent`
            ## [Unreleased]
            ### Changed
            - Bump \`@scope/b\` from \`1.0.0\` to \`3.0.0\` ([#100](${TEST_REPO_URL}/pull/100), [#200](${TEST_REPO_URL}/pull/200))

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        );
      },
    );
  });

  it('handles renamed packages correctly', async () => {
    await withRepo(
      {
        packages: [
          {
            name: '@scope/renamed-package',
            dir: 'a',
            version: '6.0.0',
            dependencies: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/b': '1.0.0',
            },
          },
          { name: '@scope/b', dir: 'b', version: '1.0.0' },
        ],
        changelogContent: {
          a: buildChangelog(outdent`
            ## [Unreleased]

            ## [6.0.0]
            ### Changed
            - Some change in version 6.0.0

            ## [5.0.1]
            ### Changed
            - Package renamed from old-package-name to @scope/renamed-package

            ## [5.0.0]
            ### Changed
            - Some change in version 5.0.0 (old package name)

            [Unreleased]: ${TEST_REPO_URL}/compare/@scope/renamed-package@6.0.0...HEAD
            [6.0.0]: ${TEST_REPO_URL}/compare/old-package-name@5.0.1...@scope/renamed-package@6.0.0
            [5.0.1]: ${TEST_REPO_URL}/compare/old-package-name@5.0.0...old-package-name@5.0.1
            [5.0.0]: ${TEST_REPO_URL}/releases/tag/old-package-name@5.0.0
          `),
        },
      },
      async ({ projectRoot, baseRef, git, writeJson, readFile }) => {
        // Add script hint for package rename info
        await writeJson('packages/a/package.json', {
          name: '@scope/renamed-package',
          version: '6.0.0',
          dependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/b': '1.0.0',
          },
          scripts: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'auto-changelog':
              'auto-changelog --tag-prefix-before-package-rename old-package-name@ --version-before-package-rename 5.0.1',
          },
        });
        await git(['add', '.']);
        await git(['commit', '--amend', '--no-edit']);

        // Now bump dependency
        await writeJson('packages/a/package.json', {
          name: '@scope/renamed-package',
          version: '6.0.0',
          dependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/b': '2.0.0',
          },
          scripts: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'auto-changelog':
              'auto-changelog --tag-prefix-before-package-rename old-package-name@ --version-before-package-rename 5.0.1',
          },
        });
        await git(['add', '.']);
        await git(['commit', '-m', 'Bump @scope/b to 2.0.0']);

        const stdout = createBuffer();
        const stderr = createBuffer();
        const result = await checkDependencyBumps({
          projectRoot,
          fromRef: baseRef,
          fix: true,
          prNumber: '300',
          repoUrl: TEST_REPO_URL,
          formatter,
          stdout,
          stderr,
        });

        expect(result).toStrictEqual({
          a: {
            packageName: '@scope/renamed-package',
            dependencyChanges: [
              {
                package: 'a',
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        });

        const actualChangelog = await readFile('packages/a/CHANGELOG.md');
        expect(actualChangelog).toBe(
          buildChangelog(outdent`
            ## [Unreleased]
            ### Changed
            - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#300](${TEST_REPO_URL}/pull/300))

            ## [6.0.0]
            ### Changed
            - Some change in version 6.0.0

            ## [5.0.1]
            ### Changed
            - Package renamed from old-package-name to @scope/renamed-package

            ## [5.0.0]
            ### Changed
            - Some change in version 5.0.0 (old package name)

            [Unreleased]: ${TEST_REPO_URL}/compare/@scope/renamed-package@6.0.0...HEAD
            [6.0.0]: ${TEST_REPO_URL}/compare/old-package-name@5.0.1...@scope/renamed-package@6.0.0
            [5.0.1]: ${TEST_REPO_URL}/compare/old-package-name@5.0.0...old-package-name@5.0.1
            [5.0.0]: ${TEST_REPO_URL}/releases/tag/old-package-name@5.0.0
          `),
        );
      },
    );
  });

  it('adds changelog entry under release version when package is being released', async () => {
    await withRepo(
      {
        packages: [
          {
            name: '@scope/a',
            dir: 'a',
            version: '1.0.0',
            dependencies: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              '@scope/b': '1.0.0',
            },
          },
          { name: '@scope/b', dir: 'b', version: '1.0.0' },
        ],
        changelogContent: {
          a: buildChangelog(outdent`
            ## [Unreleased]

            ## [2.0.0]

            ## [1.0.0]
            ### Changed
            - Initial release

            [Unreleased]: ${TEST_REPO_URL}/compare/@scope/a@2.0.0...HEAD
            [2.0.0]: ${TEST_REPO_URL}/compare/@scope/a@1.0.0...@scope/a@2.0.0
            [1.0.0]: ${TEST_REPO_URL}/releases/tag/@scope/a@1.0.0
          `),
        },
      },
      async ({ projectRoot, baseRef, git, writeJson, readFile }) => {
        // Bump both package version and dependency version
        await writeJson('packages/a/package.json', {
          name: '@scope/a',
          version: '2.0.0',
          dependencies: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@scope/b': '2.0.0',
          },
        });
        await git(['add', '.']);
        await git(['commit', '-m', 'Release 2.0.0 and bump @scope/b']);

        const stdout = createBuffer();
        const stderr = createBuffer();
        const result = await checkDependencyBumps({
          projectRoot,
          fromRef: baseRef,
          fix: true,
          prNumber: '400',
          repoUrl: TEST_REPO_URL,
          formatter,
          stdout,
          stderr,
        });

        expect(result).toStrictEqual({
          a: {
            packageName: '@scope/a',
            dependencyChanges: [
              {
                package: 'a',
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
            newVersion: '2.0.0',
          },
        });

        // Should add entry under [2.0.0] section, not [Unreleased]
        const actualChangelog = await readFile('packages/a/CHANGELOG.md');
        expect(actualChangelog).toBe(
          buildChangelog(outdent`
            ## [Unreleased]

            ## [2.0.0]
            ### Changed
            - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#400](${TEST_REPO_URL}/pull/400))

            ## [1.0.0]
            ### Changed
            - Initial release

            [Unreleased]: ${TEST_REPO_URL}/compare/@scope/a@2.0.0...HEAD
            [2.0.0]: ${TEST_REPO_URL}/compare/@scope/a@1.0.0...@scope/a@2.0.0
            [1.0.0]: ${TEST_REPO_URL}/releases/tag/@scope/a@1.0.0
          `),
        );
      },
    );
  });

  it('detects non-scoped package dependency bumps', async () => {
    await withRepo(
      {
        packages: [
          {
            name: '@scope/a',
            dir: 'a',
            version: '1.0.0',
            dependencies: {
              lodash: '4.17.20',
            },
          },
        ],
        changelogContent: {
          a: buildChangelog(outdent`
            ## [Unreleased]

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        },
      },
      async ({ projectRoot, baseRef, git, writeJson, readFile }) => {
        await writeJson('packages/a/package.json', {
          name: '@scope/a',
          version: '1.0.0',
          dependencies: {
            lodash: '4.17.21',
          },
        });
        await git(['add', '.']);
        await git(['commit', '-m', 'Bump lodash to 4.17.21']);

        const stdout = createBuffer();
        const stderr = createBuffer();
        const result = await checkDependencyBumps({
          projectRoot,
          fromRef: baseRef,
          fix: true,
          prNumber: '789',
          repoUrl: TEST_REPO_URL,
          formatter,
          stdout,
          stderr,
        });

        expect(result).toStrictEqual({
          a: {
            packageName: '@scope/a',
            dependencyChanges: [
              {
                package: 'a',
                dependency: 'lodash',
                type: 'dependencies',
                oldVersion: '4.17.20',
                newVersion: '4.17.21',
              },
            ],
          },
        });

        const actualChangelog = await readFile('packages/a/CHANGELOG.md');
        expect(actualChangelog).toBe(
          buildChangelog(outdent`
            ## [Unreleased]
            ### Changed
            - Bump \`lodash\` from \`4.17.20\` to \`4.17.21\` ([#789](${TEST_REPO_URL}/pull/789))

            [Unreleased]: ${TEST_REPO_URL}/
          `),
        );
      },
    );
  });

  it('reports no changes when no dependency bumps are found', async () => {
    await withRepo(
      {
        packages: [{ name: '@scope/a', dir: 'a', version: '1.0.0' }],
      },
      async ({ projectRoot, baseRef, git, writeFile }) => {
        await writeFile('packages/a/dummy.txt', 'content');
        await git(['add', '.']);
        await git(['commit', '-m', 'Non-dependency change']);

        const stdout = createBuffer();
        const stderr = createBuffer();
        const result = await checkDependencyBumps({
          projectRoot,
          fromRef: baseRef,
          repoUrl: TEST_REPO_URL,
          formatter,
          stdout,
          stderr,
        });

        expect(result).toStrictEqual({});
      },
    );
  });
});
