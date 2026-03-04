import _outdent from 'outdent';

import { readFile, writeFile } from './fs';
import { getDependencyChangesForPackage } from './get-dependency-changes';
import { validate } from './validate-command';

const outdent = _outdent({ trimTrailingNewline: false });

// Only mock I/O and git — let internal logic (validateChangelog,
// generateDiff, updateChangelogWithDependencies) run for real.
jest.mock('./fs');
jest.mock('./get-dependency-changes');

const readFileMock = readFile as jest.MockedFunction<typeof readFile>;
const writeFileMock = writeFile as jest.MockedFunction<typeof writeFile>;
const getDependencyChangesForPackageMock =
  getDependencyChangesForPackage as jest.MockedFunction<
    typeof getDependencyChangesForPackage
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

const defaultOptions = {
  changelogPath: '/repo/CHANGELOG.md',
  currentVersion: '1.0.0' as const,
  isReleaseCandidate: false,
  repoUrl,
  tagPrefix: 'v',
  fix: false,
  formatter: async (input: string) => input,
  ensureValidPrLinksPresent: false,
  manifestPath: '/repo/package.json',
};

describe('validate', () => {
  beforeEach(() => {
    writeFileMock.mockResolvedValue(undefined);
  });

  it('returns undefined for a well-formatted changelog', async () => {
    readFileMock.mockResolvedValue(wellFormattedChangelog);

    const result = await validate(defaultOptions);

    expect(result).toBeUndefined();
  });

  it('reads from the given changelogPath', async () => {
    readFileMock.mockResolvedValue(wellFormattedChangelog);

    await validate(defaultOptions);

    expect(readFileMock).toHaveBeenCalledWith('/repo/CHANGELOG.md');
  });

  describe('dependency checking', () => {
    it('calls getDependencyChangesForPackage when checkDeps is true', async () => {
      readFileMock.mockResolvedValue(wellFormattedChangelog);
      getDependencyChangesForPackageMock.mockResolvedValue({
        dependencyChanges: [],
        prNumbers: [],
        versionChanged: false,
      });

      await validate({
        ...defaultOptions,
        checkDeps: true,
      });

      expect(getDependencyChangesForPackageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          manifestPath: '/repo/package.json',
        }),
      );
    });

    it('sets exitCode=1 when getDependencyChangesForPackage returns null', async () => {
      readFileMock.mockResolvedValue(wellFormattedChangelog);
      getDependencyChangesForPackageMock.mockResolvedValue(null);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions,
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
      readFileMock.mockResolvedValue(wellFormattedChangelog);
      getDependencyChangesForPackageMock.mockResolvedValue({
        dependencyChanges: [],
        prNumbers: [],
        versionChanged: false,
      });

      await validate({
        ...defaultOptions,
        checkDeps: true,
        fromRef: 'abc123',
        toRef: 'def456',
        remote: 'upstream',
        baseBranch: 'upstream/develop',
      });

      expect(getDependencyChangesForPackageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          fromRef: 'abc123',
          toRef: 'def456',
          remote: 'upstream',
          baseBranch: 'upstream/develop',
        }),
      );
    });

    it('does not call getDependencyChangesForPackage when checkDeps is false', async () => {
      readFileMock.mockResolvedValue(wellFormattedChangelog);

      await validate(defaultOptions);

      expect(getDependencyChangesForPackageMock).not.toHaveBeenCalled();
    });
  });

  describe('ChangelogFormattingError handling', () => {
    // A changelog with wrong link reference definition triggers formatting error
    // because the parsed+stringified output differs from the input.
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
      readFileMock.mockResolvedValue(poorlyFormattedChangelog);

      await validate({
        ...defaultOptions,
        fix: true,
      });

      expect(writeFileMock).toHaveBeenCalledWith(
        '/repo/CHANGELOG.md',
        expect.stringContaining('[1.0.0]'),
      );
    });

    it('prints diff and sets exitCode=1 when fix=false', async () => {
      readFileMock.mockResolvedValue(poorlyFormattedChangelog);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        // Do nothing
      });

      await validate(defaultOptions);

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
      readFileMock.mockResolvedValue(changelogWithoutDepEntry);
      getDependencyChangesForPackageMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: ['100'],
        versionChanged: false,
      });
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions,
        currentVersion: undefined,
        checkDeps: true,
        fix: true,
        currentPr: '200',
      });

      // updateChangelogWithDependencies runs for real, writing via writeFile
      expect(writeFileMock).toHaveBeenCalledWith(
        '/repo/CHANGELOG.md',
        expect.stringContaining('Bump `@scope/b` from `1.0.0` to `2.0.0`'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 missing dependency'),
      );
      logSpy.mockRestore();
    });

    it('adds entries to Unreleased when currentVersion is set but isReleaseCandidate is false', async () => {
      readFileMock.mockResolvedValue(changelogWithoutDepEntry);
      getDependencyChangesForPackageMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: ['100'],
        versionChanged: false,
      });
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions,
        currentVersion: '1.0.0',
        isReleaseCandidate: false,
        checkDeps: true,
        fix: true,
        currentPr: '200',
      });

      // Entry should be under Unreleased, not under 1.0.0
      const writtenContent = writeFileMock.mock.calls[0][1];
      const unreleasedIndex = writtenContent.indexOf('## [Unreleased]');
      const bumpIndex = writtenContent.indexOf('Bump `@scope/b`');
      expect(unreleasedIndex).not.toBe(-1);
      expect(bumpIndex).not.toBe(-1);
      expect(bumpIndex).toBeGreaterThan(unreleasedIndex);
      logSpy.mockRestore();
    });

    it('falls back to currentPr when dependencyCheckResult has no prNumbers', async () => {
      readFileMock.mockResolvedValue(changelogWithoutDepEntry);
      getDependencyChangesForPackageMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: [],
        versionChanged: false,
      });
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions,
        currentVersion: undefined,
        checkDeps: true,
        fix: true,
        currentPr: '200',
      });

      // With no prNumbers from git, the currentPr '200' is used
      expect(writeFileMock).toHaveBeenCalledWith(
        '/repo/CHANGELOG.md',
        expect.stringContaining('#200'),
      );
      logSpy.mockRestore();
    });

    it('prints error with fix instructions when fix=false', async () => {
      readFileMock.mockResolvedValue(changelogWithoutDepEntry);
      getDependencyChangesForPackageMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: [],
        versionChanged: false,
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions,
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
      readFileMock.mockResolvedValue(changelogWithoutDepEntry);
      getDependencyChangesForPackageMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: [],
        versionChanged: false,
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions,
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
      // Trigger UnreleasedChangesError (extends InvalidChangelogError)
      // by setting isReleaseCandidate with unreleased changes
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
      readFileMock.mockResolvedValue(changelogWithUnreleasedAndRelease);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        // Do nothing
      });

      await validate({
        ...defaultOptions,
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
      readFileMock.mockRejectedValue(new Error('ENOENT'));

      await expect(validate(defaultOptions)).rejects.toThrow('ENOENT');
    });
  });
});
