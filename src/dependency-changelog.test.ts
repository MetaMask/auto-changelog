import { promises as fs } from 'fs';
import os from 'os';
import _outdent from 'outdent';
import path from 'path';

import {
  updateDependencyChangelogs,
  validateDependencyChangelogs,
} from './dependency-changelog';
import type { PackageChanges } from './dependency-types';

const outdent = _outdent({ trimTrailingNewline: false });

const TEST_REPO_URL = 'https://github.com/example-org/example-repo';

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

describe('dependency-changelog', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'dependency-changelog-test-'),
    );
    await fs.mkdir(path.join(projectRoot, 'packages', 'a'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  /**
   * Helper to write a package.json file for a package.
   *
   * @param packageDir - Package directory name.
   * @param manifest - Package manifest content.
   */
  async function writePackageManifest(
    packageDir: string,
    manifest: Record<string, unknown>,
  ): Promise<void> {
    const packagePath = path.join(projectRoot, 'packages', packageDir);
    await fs.mkdir(packagePath, { recursive: true });
    await fs.writeFile(
      path.join(packagePath, 'package.json'),
      JSON.stringify(manifest, null, 2),
    );
  }

  /**
   * Helper to write a changelog file for a package.
   *
   * @param packageDir - Package directory name.
   * @param content - Changelog content.
   */
  async function writeChangelog(
    packageDir: string,
    content: string,
  ): Promise<void> {
    const packagePath = path.join(projectRoot, 'packages', packageDir);
    await fs.mkdir(packagePath, { recursive: true });
    await fs.writeFile(path.join(packagePath, 'CHANGELOG.md'), content);
  }

  /**
   * Helper to read a changelog file for a package.
   *
   * @param packageDir - Package directory name.
   * @returns Changelog content.
   */
  async function readChangelog(packageDir: string): Promise<string> {
    return fs.readFile(
      path.join(projectRoot, 'packages', packageDir, 'CHANGELOG.md'),
      'utf8',
    );
  }

  describe('validateDependencyChangelogs', () => {
    it('reports missing changelog', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      const changes: PackageChanges = {
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
      };

      const results = await validateDependencyChangelogs(
        changes,
        projectRoot,
        TEST_REPO_URL,
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toStrictEqual({
        package: 'a',
        hasChangelog: false,
        hasUnreleasedSection: false,
        missingEntries: changes.a.dependencyChanges,
        existingEntries: [],
        checkedVersion: null,
      });
    });

    it('reports missing unreleased section', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      // Changelog without unreleased section
      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [1.0.0]
          ### Added
          - Initial release

          [1.0.0]: ${TEST_REPO_URL}/releases/tag/@scope/a@1.0.0
        `),
      );

      const changes: PackageChanges = {
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
      };

      const results = await validateDependencyChangelogs(
        changes,
        projectRoot,
        TEST_REPO_URL,
      );

      expect(results).toHaveLength(1);
      expect(results[0].hasChangelog).toBe(true);
      expect(results[0].hasUnreleasedSection).toBe(false);
    });

    it('reports all entries present when exact match found', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]
          ### Changed
          - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
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
      };

      const results = await validateDependencyChangelogs(
        changes,
        projectRoot,
        TEST_REPO_URL,
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toStrictEqual({
        package: 'a',
        hasChangelog: true,
        hasUnreleasedSection: true,
        missingEntries: [],
        existingEntries: ['@scope/b'],
        checkedVersion: null,
      });
    });

    it('reports missing entries when version does not match', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      // Changelog has entry with different version
      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]
          ### Changed
          - Bump \`@scope/b\` from \`0.9.0\` to \`1.0.0\` ([#100](${TEST_REPO_URL}/pull/100))

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
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
      };

      const results = await validateDependencyChangelogs(
        changes,
        projectRoot,
        TEST_REPO_URL,
      );

      expect(results).toHaveLength(1);
      expect(results[0].hasChangelog).toBe(true);
      expect(results[0].hasUnreleasedSection).toBe(true);
      expect(results[0].missingEntries).toHaveLength(1);
      expect(results[0].missingEntries[0].dependency).toBe('@scope/b');
    });

    it('validates against release version when package version changes', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '2.0.0',
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]

          ## [2.0.0]
          ### Changed
          - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

          [Unreleased]: ${TEST_REPO_URL}/compare/@scope/a@2.0.0...HEAD
          [2.0.0]: ${TEST_REPO_URL}/releases/tag/@scope/a@2.0.0
        `),
      );

      const changes: PackageChanges = {
        a: {
          packageName: '@scope/a',
          newVersion: '2.0.0',
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
      };

      const results = await validateDependencyChangelogs(
        changes,
        projectRoot,
        TEST_REPO_URL,
      );

      expect(results).toHaveLength(1);
      expect(results[0].checkedVersion).toBe('2.0.0');
      expect(results[0].existingEntries).toContain('@scope/b');
      expect(results[0].missingEntries).toHaveLength(0);
    });

    it('validates peerDependency entry with BREAKING prefix', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]
          ### Changed
          - **BREAKING:** Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
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
      };

      const results = await validateDependencyChangelogs(
        changes,
        projectRoot,
        TEST_REPO_URL,
      );

      expect(results).toHaveLength(1);
      expect(results[0].existingEntries).toContain('@scope/b');
      expect(results[0].missingEntries).toHaveLength(0);
    });

    it('detects stale peerDependency entry with BREAKING prefix when version differs', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      // Existing entry has different version - should detect as stale
      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]
          ### Changed
          - **BREAKING:** Bump \`@scope/b\` from \`0.9.0\` to \`1.0.0\` ([#100](${TEST_REPO_URL}/pull/100))

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
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
      };

      const results = await validateDependencyChangelogs(
        changes,
        projectRoot,
        TEST_REPO_URL,
      );

      expect(results).toHaveLength(1);
      // Should be missing because versions don't match
      expect(results[0].missingEntries).toHaveLength(1);
    });

    it('uses package rename info when available', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
        scripts: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'changelog:validate':
            'auto-changelog validate --tag-prefix-before-package-rename old-a@ --version-before-package-rename 0.5.0',
        },
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]
          ### Changed
          - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
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
      };

      const results = await validateDependencyChangelogs(
        changes,
        projectRoot,
        TEST_REPO_URL,
      );

      expect(results).toHaveLength(1);
      expect(results[0].existingEntries).toContain('@scope/b');
    });

    it('handles parsing errors gracefully', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      // Invalid changelog that will cause parsing error
      await writeChangelog('a', 'This is not a valid changelog format');

      const changes: PackageChanges = {
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
      };

      const results = await validateDependencyChangelogs(
        changes,
        projectRoot,
        TEST_REPO_URL,
      );

      expect(results).toHaveLength(1);
      expect(results[0].hasChangelog).toBe(true);
      expect(results[0].hasUnreleasedSection).toBe(false);
    });

    it('handles package with no package.json for rename info', async () => {
      // Create package directory without package.json
      await fs.mkdir(path.join(projectRoot, 'packages', 'no-manifest'), {
        recursive: true,
      });
      await writeChangelog(
        'no-manifest',
        buildChangelog(outdent`

          ## [Unreleased]
          ### Changed
          - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'no-manifest': {
          packageName: '@scope/no-manifest',
          dependencyChanges: [
            {
              package: 'no-manifest',
              dependency: '@scope/b',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          ],
        },
      };

      const results = await validateDependencyChangelogs(
        changes,
        projectRoot,
        TEST_REPO_URL,
      );

      expect(results).toHaveLength(1);
      expect(results[0].existingEntries).toContain('@scope/b');
    });

    it('handles malformed package.json for rename info', async () => {
      // Create package with malformed JSON
      const packagePath = path.join(projectRoot, 'packages', 'bad-json');
      await fs.mkdir(packagePath, { recursive: true });
      await fs.writeFile(
        path.join(packagePath, 'package.json'),
        'not valid json {{{',
      );
      await writeChangelog(
        'bad-json',
        buildChangelog(outdent`

          ## [Unreleased]
          ### Changed
          - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'bad-json': {
          packageName: '@scope/bad-json',
          dependencyChanges: [
            {
              package: 'bad-json',
              dependency: '@scope/b',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          ],
        },
      };

      const results = await validateDependencyChangelogs(
        changes,
        projectRoot,
        TEST_REPO_URL,
      );

      // Should still work, just without rename info
      expect(results).toHaveLength(1);
      expect(results[0].existingEntries).toContain('@scope/b');
    });
  });

  describe('updateDependencyChangelogs', () => {
    it('adds missing dependency entry to changelog', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
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
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      const updatedCount = await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '123',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      expect(updatedCount).toBe(1);

      const changelog = await readChangelog('a');
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
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
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
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '123',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      const changelog = await readChangelog('a');
      expect(changelog).toContain('**BREAKING:** Bump `@scope/b`');
    });

    it('updates existing entry with new version and concatenates PRs', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      // Existing entry with old version
      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]
          ### Changed
          - Bump \`@scope/b\` from \`1.0.0\` to \`1.5.0\` ([#100](${TEST_REPO_URL}/pull/100))

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
        a: {
          packageName: '@scope/a',
          dependencyChanges: [
            {
              package: 'a',
              dependency: '@scope/b',
              type: 'dependencies',
              oldVersion: '1.5.0',
              newVersion: '2.0.0',
            },
          ],
        },
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '200',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      const changelog = await readChangelog('a');
      expect(changelog).toContain('from `1.5.0` to `2.0.0`');
      expect(changelog).toContain('#100');
      expect(changelog).toContain('#200');
    });

    it('uses placeholder when no PR number provided', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
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
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      await updateDependencyChangelogs(changes, {
        projectRoot,
        // No prNumber
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      const changelog = await readChangelog('a');
      expect(changelog).toContain('#XXXXX');
    });

    it('reports when no changelog found', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      const changes: PackageChanges = {
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
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      const updatedCount = await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '123',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      expect(updatedCount).toBe(0);
      expect(stderr.buffer).toContain('No CHANGELOG.md found');
    });

    it('reports when all entries already exist', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]
          ### Changed
          - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${TEST_REPO_URL}/pull/123))

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
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
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      const updatedCount = await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '123',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      expect(updatedCount).toBe(0);
      expect(stdout.buffer).toContain('All entries already exist');
    });

    it('adds entry to release version section when package is being released', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '2.0.0',
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]

          ## [2.0.0]
          ### Added
          - New feature

          [Unreleased]: ${TEST_REPO_URL}/compare/@scope/a@2.0.0...HEAD
          [2.0.0]: ${TEST_REPO_URL}/releases/tag/@scope/a@2.0.0
        `),
      );

      const changes: PackageChanges = {
        a: {
          packageName: '@scope/a',
          newVersion: '2.0.0',
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
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '123',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      const changelog = await readChangelog('a');
      expect(changelog).toContain('## [2.0.0]');
      expect(changelog).toContain('### Changed');
      expect(changelog).toContain(
        'Bump `@scope/b` from `1.0.0` to `2.0.0` ([#123]',
      );
    });

    it('orders BREAKING changes before regular dependency changes', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
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
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '123',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      const changelog = await readChangelog('a');
      const breakingIndex = changelog.indexOf('**BREAKING:**');
      const regularIndex = changelog.indexOf('- Bump `@scope/b`');

      expect(breakingIndex).toBeGreaterThan(-1);
      expect(regularIndex).toBeGreaterThan(-1);
      // BREAKING should come before regular entry
      expect(breakingIndex).toBeLessThan(regularIndex);
    });

    it('handles multiple packages', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });
      await writePackageManifest('b', {
        name: '@scope/b',
        version: '1.0.0',
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );
      await writeChangelog(
        'b',
        buildChangelog(outdent`

          ## [Unreleased]

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
        a: {
          packageName: '@scope/a',
          dependencyChanges: [
            {
              package: 'a',
              dependency: '@scope/x',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          ],
        },
        b: {
          packageName: '@scope/b',
          dependencyChanges: [
            {
              package: 'b',
              dependency: '@scope/y',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          ],
        },
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      const updatedCount = await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '123',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      expect(updatedCount).toBe(2);

      const changelogA = await readChangelog('a');
      const changelogB = await readChangelog('b');

      expect(changelogA).toContain('@scope/x');
      expect(changelogB).toContain('@scope/y');
    });

    it('handles non-scoped package dependency bumps', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
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
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '789',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      const changelog = await readChangelog('a');
      expect(changelog).toBe(
        buildChangelog(outdent`
          ## [Unreleased]
          ### Changed
          - Bump \`lodash\` from \`4.17.20\` to \`4.17.21\` ([#789](${TEST_REPO_URL}/pull/789))

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );
    });

    it('updates existing entry AND adds new entry simultaneously', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      // Existing entry with old version that needs updating
      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]
          ### Changed
          - Bump \`@scope/b\` from \`1.0.0\` to \`1.5.0\` ([#100](${TEST_REPO_URL}/pull/100))

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
        a: {
          packageName: '@scope/a',
          dependencyChanges: [
            // This one needs updating (version changed)
            {
              package: 'a',
              dependency: '@scope/b',
              type: 'dependencies',
              oldVersion: '1.5.0',
              newVersion: '2.0.0',
            },
            // This one is completely new
            {
              package: 'a',
              dependency: '@scope/c',
              type: 'dependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          ],
        },
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      const updatedCount = await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '200',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      expect(updatedCount).toBe(1);

      const changelog = await readChangelog('a');
      // Should have both updated entry and new entry
      expect(changelog).toContain('@scope/b');
      expect(changelog).toContain('from `1.5.0` to `2.0.0`');
      expect(changelog).toContain('#100');
      expect(changelog).toContain('#200');
      expect(changelog).toContain('@scope/c');
      expect(stdout.buffer).toContain('Updated 1 and added 1');
    });

    it('updates existing entry AND adds new peerDependency entry', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      // Existing entry with old version that needs updating
      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]
          ### Changed
          - Bump \`@scope/b\` from \`1.0.0\` to \`1.5.0\` ([#100](${TEST_REPO_URL}/pull/100))

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
        a: {
          packageName: '@scope/a',
          dependencyChanges: [
            // This one needs updating (version changed)
            {
              package: 'a',
              dependency: '@scope/b',
              type: 'dependencies',
              oldVersion: '1.5.0',
              newVersion: '2.0.0',
            },
            // This one is a new peerDependency (BREAKING)
            {
              package: 'a',
              dependency: '@scope/peer',
              type: 'peerDependencies',
              oldVersion: '1.0.0',
              newVersion: '2.0.0',
            },
          ],
        },
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      const updatedCount = await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '200',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      expect(updatedCount).toBe(1);

      const changelog = await readChangelog('a');
      // Should have both updated entry and new BREAKING entry
      expect(changelog).toContain('@scope/b');
      expect(changelog).toContain('**BREAKING:** Bump `@scope/peer`');
      expect(stdout.buffer).toContain('Updated 1 and added 1');
    });

    it('handles changelog parsing errors gracefully during update', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
      });

      // Invalid changelog that will cause parsing error
      await writeChangelog('a', 'This is not a valid changelog format');

      const changes: PackageChanges = {
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
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      const updatedCount = await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '123',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      expect(updatedCount).toBe(0);
      expect(stderr.buffer).toContain('Error updating CHANGELOG.md');
    });

    it('uses package rename info during update', async () => {
      await writePackageManifest('a', {
        name: '@scope/a',
        version: '1.0.0',
        scripts: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'changelog:validate':
            'auto-changelog validate --tag-prefix-before-package-rename old-a@ --version-before-package-rename 0.5.0',
        },
      });

      await writeChangelog(
        'a',
        buildChangelog(outdent`

          ## [Unreleased]

          [Unreleased]: ${TEST_REPO_URL}/
        `),
      );

      const changes: PackageChanges = {
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
      };

      const stdout = createBuffer();
      const stderr = createBuffer();

      const updatedCount = await updateDependencyChangelogs(changes, {
        projectRoot,
        prNumber: '123',
        repoUrl: TEST_REPO_URL,
        stdout,
        stderr,
      });

      expect(updatedCount).toBe(1);
      const changelog = await readChangelog('a');
      expect(changelog).toContain('@scope/b');
    });
  });
});
