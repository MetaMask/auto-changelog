import { promises as fs } from 'fs';
import os from 'os';
import _outdent from 'outdent';
import path from 'path';

import { updateChangelogWithDependencies } from './dependency-changelog';
import type { DependencyChange } from './dependency-types';
import { readFile, writeFile } from './fs';

const outdent = _outdent({ trimTrailingNewline: false });

const TEST_REPO_URL = 'https://github.com/example-org/example-repo';
const formatter = async (content: string) => content;

/**
 * Builds a changelog by filling in the header automatically.
 *
 * @param variantContent - The part of the changelog that can change.
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

describe('updateChangelogWithDependencies', () => {
  let tempDir: string;
  let changelogPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'dependency-changelog-test-'),
    );
    changelogPath = path.join(tempDir, 'CHANGELOG.md');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('adds missing dependency entry to changelog', async () => {
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );

    const dependencyChanges: DependencyChange[] = [
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges,
      prNumber: '123',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: '@scope/a@',
    });

    const changelog = await readFile(changelogPath);
    expect(changelog).toBe(
      buildChangelog(outdent`
        ## [Unreleased]
        ### Changed
        - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );
  });

  it('adds BREAKING prefix for peerDependency bumps', async () => {
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );

    const dependencyChanges: DependencyChange[] = [
      {
        dependency: '@scope/b',
        type: 'peerDependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges,
      prNumber: '123',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: '@scope/a@',
    });

    const changelog = await readFile(changelogPath);
    expect(changelog).toBe(
      buildChangelog(outdent`
        ## [Unreleased]
        ### Changed
        - **BREAKING:** Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );
  });

  it('updates existing entry with new version and concatenates PRs', async () => {
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]
        ### Changed
        - Bump \`@scope/b\` from \`1.0.0\` to \`1.5.0\` ([#100](${TEST_REPO_URL}/pull/100))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );

    const dependencyChanges: DependencyChange[] = [
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '1.5.0',
        newVersion: '2.0.0',
      },
    ];

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges,
      prNumber: '200',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: '@scope/a@',
    });

    const changelog = await readFile(changelogPath);
    expect(changelog).toBe(
      buildChangelog(outdent`

        ## [Unreleased]
        ### Changed
        - Bump \`@scope/b\` from \`1.5.0\` to \`2.0.0\` ([#100](${TEST_REPO_URL}/pull/100), [#200](${TEST_REPO_URL}/pull/200))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );
  });

  it('adds entry to release version section when currentVersion is provided', async () => {
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]

        ## [2.0.0]
        ### Added
        - New feature

        [Unreleased]: ${TEST_REPO_URL}/compare/@scope/a@2.0.0...HEAD
        [2.0.0]: ${TEST_REPO_URL}/releases/tag/@scope/a@2.0.0
      `),
    );

    const dependencyChanges: DependencyChange[] = [
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges,
      currentVersion: '2.0.0',
      prNumber: '123',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: '@scope/a@',
    });

    const changelog = await readFile(changelogPath);
    expect(changelog).toBe(
      buildChangelog(outdent`
        ## [Unreleased]

        ## [2.0.0]
        ### Added
        - New feature

        ### Changed
        - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

        [Unreleased]: ${TEST_REPO_URL}/compare/@scope/a@2.0.0...HEAD
        [2.0.0]: ${TEST_REPO_URL}/releases/tag/@scope/a@2.0.0
      `),
    );
  });

  it('adds peerDependency entry to release section with currentVersion', async () => {
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]

        ## [2.0.0]
        ### Added
        - New feature

        [Unreleased]: ${TEST_REPO_URL}/compare/@scope/a@2.0.0...HEAD
        [2.0.0]: ${TEST_REPO_URL}/releases/tag/@scope/a@2.0.0
      `),
    );

    const dependencyChanges: DependencyChange[] = [
      {
        dependency: '@scope/b',
        type: 'peerDependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges,
      currentVersion: '2.0.0',
      prNumber: '123',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: '@scope/a@',
    });

    const changelog = await readFile(changelogPath);
    expect(changelog).toBe(
      buildChangelog(outdent`
        ## [Unreleased]

        ## [2.0.0]
        ### Added
        - New feature

        ### Changed
        - **BREAKING:** Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

        [Unreleased]: ${TEST_REPO_URL}/compare/@scope/a@2.0.0...HEAD
        [2.0.0]: ${TEST_REPO_URL}/releases/tag/@scope/a@2.0.0
      `),
    );
  });

  it('throws error when currentVersion provided but version section does not exist', async () => {
    // This tests that an error is thrown when currentVersion is provided
    // but the version section doesn't exist in the changelog
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );

    const dependencyChanges: DependencyChange[] = [
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    await expect(
      updateChangelogWithDependencies({
        changelogPath,
        dependencyChanges,
        currentVersion: '2.0.0', // Version section doesn't exist yet
        prNumber: '123',
        repoUrl: TEST_REPO_URL,
        formatter,
        tagPrefix: '@scope/a@',
      }),
    ).rejects.toThrow("Specified release version does not exist: '2.0.0'");
  });

  it('orders BREAKING changes before regular dependency changes', async () => {
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );

    const dependencyChanges: DependencyChange[] = [
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
      {
        dependency: '@scope/c',
        type: 'peerDependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges,
      prNumber: '123',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: '@scope/a@',
    });

    const changelog = await readFile(changelogPath);
    expect(changelog).toBe(
      buildChangelog(outdent`
        ## [Unreleased]
        ### Changed
        - **BREAKING:** Bump \`@scope/c\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))
        - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );
  });

  it('handles multiple dependency bumps', async () => {
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );

    const dependencyChanges: DependencyChange[] = [
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
      {
        dependency: '@scope/c',
        type: 'dependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges,
      prNumber: '777',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: '@scope/a@',
    });

    const changelog = await readFile(changelogPath);
    expect(changelog).toBe(
      buildChangelog(outdent`
        ## [Unreleased]
        ### Changed
        - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#777](${TEST_REPO_URL}/pull/777))
        - Bump \`@scope/c\` from \`1.0.0\` to \`2.0.0\` ([#777](${TEST_REPO_URL}/pull/777))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );
  });

  it('handles non-scoped package dependency bumps', async () => {
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );

    const dependencyChanges: DependencyChange[] = [
      {
        dependency: 'lodash',
        type: 'dependencies',
        oldVersion: '4.17.20',
        newVersion: '4.17.21',
      },
    ];

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges,
      prNumber: '789',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: '@scope/a@',
    });

    const changelog = await readFile(changelogPath);
    expect(changelog).toBe(
      buildChangelog(outdent`
        ## [Unreleased]
        ### Changed
        - Bump \`lodash\` from \`4.17.20\` to \`4.17.21\` ([#789](${TEST_REPO_URL}/pull/789))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );
  });

  it('throws error when changelog does not exist', async () => {
    const nonExistentPath = path.join(tempDir, 'nonexistent', 'CHANGELOG.md');

    const dependencyChanges: DependencyChange[] = [
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    await expect(
      updateChangelogWithDependencies({
        changelogPath: nonExistentPath,
        dependencyChanges,
        prNumber: '123',
        repoUrl: TEST_REPO_URL,
        formatter,
        tagPrefix: '@scope/a@',
      }),
    ).rejects.toThrow('Changelog not found');
  });

  it('skips entries that already exist with exact match', async () => {
    const initialChangelog = buildChangelog(outdent`

      ## [Unreleased]
      ### Changed
      - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

      [Unreleased]: ${TEST_REPO_URL}/
    `);

    await writeFile(changelogPath, initialChangelog);

    const dependencyChanges: DependencyChange[] = [
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges,
      prNumber: '123',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: '@scope/a@',
    });

    const changelog = await readFile(changelogPath);
    // Changelog should remain unchanged
    expect(changelog).toBe(initialChangelog);
  });

  it('updates existing entry AND adds new entry simultaneously', async () => {
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]
        ### Changed
        - Bump \`@scope/b\` from \`1.0.0\` to \`1.5.0\` ([#100](${TEST_REPO_URL}/pull/100))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );

    const dependencyChanges: DependencyChange[] = [
      // This one needs updating (version changed)
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '1.5.0',
        newVersion: '2.0.0',
      },
      // This one is completely new
      {
        dependency: '@scope/c',
        type: 'dependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges,
      prNumber: '200',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: '@scope/a@',
    });

    const changelog = await readFile(changelogPath);
    expect(changelog).toBe(
      buildChangelog(outdent`
        ## [Unreleased]
        ### Changed
        - Bump \`@scope/c\` from \`1.0.0\` to \`2.0.0\` ([#200](${TEST_REPO_URL}/pull/200))
        - Bump \`@scope/b\` from \`1.5.0\` to \`2.0.0\` ([#100](${TEST_REPO_URL}/pull/100), [#200](${TEST_REPO_URL}/pull/200))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );
  });

  it('uses packageRename when provided', async () => {
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );

    const dependencyChanges: DependencyChange[] = [
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges,
      prNumber: '123',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: '@scope/a@',
      packageRename: {
        versionBeforeRename: '0.5.0',
        tagPrefixBeforeRename: 'old-a@',
      },
    });

    const changelog = await readFile(changelogPath);
    expect(changelog).toBe(
      buildChangelog(outdent`
        ## [Unreleased]
        ### Changed
        - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );
  });

  it('updates existing peerDependency entry with exact match to new versions', async () => {
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]
        ### Changed
        - **BREAKING:** Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#100](${TEST_REPO_URL}/pull/100))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges: [
        {
          dependency: '@scope/b',
          type: 'peerDependencies',
          oldVersion: '1.0.0',
          newVersion: '3.0.0', // Updated version
        },
      ],
      prNumber: '200',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: 'v',
    });

    const changelog = await readFile(changelogPath);
    expect(changelog).toBe(
      buildChangelog(outdent`

        ## [Unreleased]
        ### Changed
        - **BREAKING:** Bump \`@scope/b\` from \`1.0.0\` to \`3.0.0\` ([#100](${TEST_REPO_URL}/pull/100), [#200](${TEST_REPO_URL}/pull/200))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );
  });

  it('updates existing peerDependency entry with stale version match', async () => {
    // Test the branch where we have a non-exact match (stale entry) for a BREAKING peerDependency
    await writeFile(
      changelogPath,
      buildChangelog(outdent`

        ## [Unreleased]
        ### Changed
        - **BREAKING:** Bump \`@scope/b\` from \`0.9.0\` to \`1.0.0\` ([#100](${TEST_REPO_URL}/pull/100))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );

    await updateChangelogWithDependencies({
      changelogPath,
      dependencyChanges: [
        {
          dependency: '@scope/b',
          type: 'peerDependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0', // New target version
        },
      ],
      prNumber: '200',
      repoUrl: TEST_REPO_URL,
      formatter,
      tagPrefix: 'v',
    });

    const changelog = await readFile(changelogPath);
    expect(changelog).toBe(
      buildChangelog(outdent`

        ## [Unreleased]
        ### Changed
        - **BREAKING:** Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#100](${TEST_REPO_URL}/pull/100), [#200](${TEST_REPO_URL}/pull/200))

        [Unreleased]: ${TEST_REPO_URL}/
      `),
    );
  });
});
