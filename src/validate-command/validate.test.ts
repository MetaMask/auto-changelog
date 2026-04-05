import { promises as fs } from 'fs';
import os from 'os';
import _outdent from 'outdent';
import path from 'path';

import {
  BaseRefNotFoundError,
  getDependencyChanges,
} from '../get-dependency-changes';
import { validate } from './validate';

const outdent = _outdent({ trimTrailingNewline: false });

// Only mock the getDependencyChanges function — keep BaseRefNotFoundError real.
jest.mock('../get-dependency-changes', () => {
  const actual = jest.requireActual('../get-dependency-changes');
  return {
    ...actual,
    getDependencyChanges: jest.fn(),
  };
});

const getDependencyChangesMock = getDependencyChanges as jest.MockedFunction<
  typeof getDependencyChanges
>;

const repoUrl = 'https://github.com/Org/Repo';

const wellFormattedChangelog = outdent`
  # Changelog
  All notable changes to this project will be documented in this file.

  The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
  and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

  ## [Unreleased]

  [Unreleased]: ${repoUrl}/
`;

describe('validate', () => {
  let tmpDir: string;
  let changelogPath: string;

  /**
   * Write changelog content to the temp file.
   *
   * @param content - The changelog content.
   */
  async function writeChangelog(content: string) {
    await fs.writeFile(changelogPath, content, 'utf-8');
  }

  /**
   * Read changelog content from the temp file.
   *
   * @returns The changelog content.
   */
  async function readChangelog(): Promise<string> {
    return fs.readFile(changelogPath, 'utf-8');
  }

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validate-test-'));
    changelogPath = path.join(tmpDir, 'CHANGELOG.md');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * Build default validate options using the temp changelog path.
   *
   * @returns Default validate options.
   */
  function defaultOptions() {
    return {
      changelogPath,
      currentVersion: '1.0.0' as const,
      isReleaseCandidate: false,
      repoUrl,
      tagPrefix: 'v',
      fix: false,
      formatter: async (input: string) => input,
      ensureValidPrLinksPresent: false,
      manifestPath: '/repo/package.json',
    };
  }

  it('returns undefined for a well-formatted changelog', async () => {
    await writeChangelog(wellFormattedChangelog);

    const result = await validate(defaultOptions());

    expect(result).toBeUndefined();
  });

  describe('dependency checking', () => {
    it('calls getDependencyChanges when checkDeps is true', async () => {
      await writeChangelog(wellFormattedChangelog);
      getDependencyChangesMock.mockResolvedValue({
        dependencyChanges: [],
        prNumbers: [],
        versionChanged: false,
      });

      await validate({
        ...defaultOptions(),
        checkDeps: true,
      });

      expect(getDependencyChangesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          manifestPath: '/repo/package.json',
        }),
      );
    });

    it('sets exitCode=1 when getDependencyChanges throws BaseRefNotFoundError', async () => {
      await writeChangelog(wellFormattedChangelog);
      getDependencyChangesMock.mockRejectedValue(
        new BaseRefNotFoundError('on base branch'),
      );
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions(),
        checkDeps: true,
      });

      expect(process.exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not auto-detect'),
      );
      errorSpy.mockRestore();
      process.exitCode = 0;
    });

    it('passes fromRef, toRef, remote, and baseBranch options', async () => {
      await writeChangelog(wellFormattedChangelog);
      getDependencyChangesMock.mockResolvedValue({
        dependencyChanges: [],
        prNumbers: [],
        versionChanged: false,
      });

      await validate({
        ...defaultOptions(),
        checkDeps: true,
        fromRef: 'abc123',
        toRef: 'def456',
        remote: 'upstream',
        baseBranch: 'upstream/develop',
      });

      expect(getDependencyChangesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          fromRef: 'abc123',
          toRef: 'def456',
          remote: 'upstream',
          baseBranch: 'upstream/develop',
        }),
      );
    });

    it('does not call getDependencyChanges when checkDeps is false', async () => {
      await writeChangelog(wellFormattedChangelog);

      await validate(defaultOptions());

      expect(getDependencyChangesMock).not.toHaveBeenCalled();
    });
  });

  describe('ChangelogFormattingError handling', () => {
    const poorlyFormattedChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      ## [1.0.0]
      ### Changed
      - Something changed ([#1](${repoUrl}/pull/1))

      [Unreleased]: ${repoUrl}/compare/v1.0.0...HEAD
      [1.0.0]: ${repoUrl}/releases/tag/v1.0.0
      extra trailing line
    `;

    it('fixes the changelog when fix=true', async () => {
      await writeChangelog(poorlyFormattedChangelog);

      await validate({
        ...defaultOptions(),
        fix: true,
      });

      const written = await readChangelog();
      expect(written).toContain('[1.0.0]');
      expect(written).not.toContain('extra trailing line');
    });

    it('prints diff and sets exitCode=1 when fix=false', async () => {
      await writeChangelog(poorlyFormattedChangelog);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        // Do nothing
      });

      await validate(defaultOptions());

      expect(process.exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Changelog not well-formatted'),
      );
      errorSpy.mockRestore();
      process.exitCode = 0;
    });
  });

  describe('MissingDependencyEntriesError handling', () => {
    const changelogWithoutDepEntry = wellFormattedChangelog;

    const missingEntries = [
      {
        dependency: '@scope/b',
        isBreaking: false,
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    it('auto-fixes when fix=true and currentPr provided', async () => {
      await writeChangelog(changelogWithoutDepEntry);
      getDependencyChangesMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: ['100'],
        versionChanged: false,
      });
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions(),
        currentVersion: undefined,
        checkDeps: true,
        fix: true,
        currentPr: '200',
      });

      const written = await readChangelog();
      expect(written).toContain('Bump `@scope/b` from `1.0.0` to `2.0.0`');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 missing dependency'),
      );
      logSpy.mockRestore();
    });

    it('adds entries to Unreleased when currentVersion is set but isReleaseCandidate is false', async () => {
      await writeChangelog(changelogWithoutDepEntry);
      getDependencyChangesMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: ['100'],
        versionChanged: false,
      });
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions(),
        currentVersion: '1.0.0',
        isReleaseCandidate: false,
        checkDeps: true,
        fix: true,
        currentPr: '200',
      });

      const written = await readChangelog();
      const unreleasedIndex = written.indexOf('## [Unreleased]');
      const bumpIndex = written.indexOf('Bump `@scope/b`');
      expect(unreleasedIndex).not.toBe(-1);
      expect(bumpIndex).not.toBe(-1);
      expect(bumpIndex).toBeGreaterThan(unreleasedIndex);
      logSpy.mockRestore();
    });

    it('adds entries to Unreleased when versionChanged is true but release header is missing', async () => {
      await writeChangelog(changelogWithoutDepEntry);
      getDependencyChangesMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: ['100'],
        versionChanged: true,
      });
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions(),
        currentVersion: '2.0.0',
        isReleaseCandidate: false,
        checkDeps: true,
        fix: true,
        currentPr: '200',
      });

      const written = await readChangelog();
      const unreleasedIndex = written.indexOf('## [Unreleased]');
      const bumpIndex = written.indexOf('Bump `@scope/b`');
      expect(unreleasedIndex).not.toBe(-1);
      expect(bumpIndex).not.toBe(-1);
      expect(bumpIndex).toBeGreaterThan(unreleasedIndex);
      expect(written).not.toContain('## [2.0.0]');
      logSpy.mockRestore();
    });

    it('falls back to currentPr when dependencyCheckResult has no prNumbers', async () => {
      await writeChangelog(changelogWithoutDepEntry);
      getDependencyChangesMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: [],
        versionChanged: false,
      });
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions(),
        currentVersion: undefined,
        checkDeps: true,
        fix: true,
        currentPr: '200',
      });

      const written = await readChangelog();
      expect(written).toContain('#200');
      logSpy.mockRestore();
    });

    it('prints error with fix instructions when fix=false', async () => {
      await writeChangelog(changelogWithoutDepEntry);
      getDependencyChangesMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: [],
        versionChanged: false,
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions(),
        checkDeps: true,
      });

      expect(process.exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing dependency bump entries'),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('--fix --currentPr'),
      );
      errorSpy.mockRestore();
      process.exitCode = 0;
    });

    it('prints error when fix=true but no currentPr', async () => {
      await writeChangelog(changelogWithoutDepEntry);
      getDependencyChangesMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: [],
        versionChanged: false,
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions(),
        checkDeps: true,
        fix: true,
      });

      expect(process.exitCode).toBe(1);
      errorSpy.mockRestore();
      process.exitCode = 0;
    });
  });

  describe('InvalidChangelogError handling', () => {
    it('prints the error message and exits with error', async () => {
      const changelogWithUnreleasedAndRelease = outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]
        ### Changed
        - Something unreleased ([#1](${repoUrl}/pull/1))

        ## [1.0.0]
        ### Changed
        - Initial release ([#2](${repoUrl}/pull/2))

        [Unreleased]: ${repoUrl}/compare/v1.0.0...HEAD
        [1.0.0]: ${repoUrl}/releases/tag/v1.0.0
      `;
      await writeChangelog(changelogWithUnreleasedAndRelease);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions(),
        isReleaseCandidate: true,
      });

      expect(process.exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Changelog is invalid'),
      );
      errorSpy.mockRestore();
      process.exitCode = 0;
    });
  });

  describe('unexpected errors', () => {
    it('rethrows non-changelog errors', async () => {
      // Use a path that doesn't exist to trigger a real fs error
      const opts = defaultOptions();
      opts.changelogPath = path.join(tmpDir, 'nonexistent', 'CHANGELOG.md');

      await expect(validate(opts)).rejects.toThrow('ENOENT');
    });
  });
});
