/* eslint-disable @typescript-eslint/no-empty-function */
import { getDependencyChangesForPackage } from './check-dependency-bumps';
import { updateChangelogWithDependencies } from './dependency-changelog';
import { readFile, writeFile } from './fs';
import { generateDiff } from './generate-diff';
import {
  ChangelogFormattingError,
  InvalidChangelogError,
  MissingDependencyEntriesError,
  validateChangelog,
} from './validate-changelog';
import { validate } from './validate-cli';

jest.mock('./fs');
jest.mock('./check-dependency-bumps');
jest.mock('./validate-changelog', () => {
  const actual = jest.requireActual('./validate-changelog');
  return {
    ...actual,
    validateChangelog: jest.fn(),
  };
});
jest.mock('./dependency-changelog');
jest.mock('./generate-diff');

const readFileMock = readFile as jest.MockedFunction<typeof readFile>;
const writeFileMock = writeFile as jest.MockedFunction<typeof writeFile>;
const getDependencyChangesForPackageMock =
  getDependencyChangesForPackage as jest.MockedFunction<
    typeof getDependencyChangesForPackage
  >;
const validateChangelogMock = validateChangelog as jest.MockedFunction<
  typeof validateChangelog
>;
const updateChangelogWithDependenciesMock =
  updateChangelogWithDependencies as jest.MockedFunction<
    typeof updateChangelogWithDependencies
  >;
const generateDiffMock = generateDiff as jest.MockedFunction<
  typeof generateDiff
>;

const defaultOptions = {
  changelogPath: '/repo/CHANGELOG.md',
  currentVersion: '1.0.0' as const,
  isReleaseCandidate: false,
  repoUrl: 'https://github.com/Org/Repo',
  tagPrefix: 'v',
  fix: false,
  formatter: async (input: string) => input,
  ensureValidPrLinksPresent: false,
  manifestPath: '/repo/package.json',
};

describe('validate', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    readFileMock.mockResolvedValue('changelog content');
    validateChangelogMock.mockResolvedValue(undefined);
  });

  it('reads the changelog and calls validateChangelog', async () => {
    await validate(defaultOptions);

    expect(readFileMock).toHaveBeenCalledWith('/repo/CHANGELOG.md');
    expect(validateChangelogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changelogContent: 'changelog content',
        repoUrl: 'https://github.com/Org/Repo',
      }),
    );
  });

  it('returns undefined on successful validation', async () => {
    const result = await validate(defaultOptions);

    expect(result).toBeUndefined();
  });

  describe('dependency checking', () => {
    it('calls getDependencyChangesForPackage when checkDeps is true', async () => {
      getDependencyChangesForPackageMock.mockResolvedValue({
        dependencyChanges: [],
        prNumbers: [],
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
      getDependencyChangesForPackageMock.mockResolvedValue(null);
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

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

    it('passes dependencyResult to validateChangelog', async () => {
      const depResult = {
        dependencyChanges: [
          {
            dependency: '@scope/b',
            type: 'dependencies' as const,
            oldVersion: '1.0.0',
            newVersion: '2.0.0',
          },
        ],
        prNumbers: ['100'],
      };
      getDependencyChangesForPackageMock.mockResolvedValue(depResult);

      await validate({
        ...defaultOptions,
        checkDeps: true,
      });

      expect(validateChangelogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dependencyResult: depResult,
        }),
      );
    });

    it('passes fromRef, toRef, remote, and baseBranch options', async () => {
      getDependencyChangesForPackageMock.mockResolvedValue({
        dependencyChanges: [],
        prNumbers: [],
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
      await validate(defaultOptions);

      expect(getDependencyChangesForPackageMock).not.toHaveBeenCalled();
    });
  });

  describe('ChangelogFormattingError handling', () => {
    it('fixes the changelog when fix=true', async () => {
      validateChangelogMock.mockRejectedValue(
        new ChangelogFormattingError({
          validChangelog: 'valid content',
          invalidChangelog: 'invalid content',
        }),
      );
      writeFileMock.mockResolvedValue(undefined);

      await validate({
        ...defaultOptions,
        fix: true,
      });

      expect(writeFileMock).toHaveBeenCalledWith(
        '/repo/CHANGELOG.md',
        'valid content',
      );
    });

    it('prints diff when fix=false', async () => {
      validateChangelogMock.mockRejectedValue(
        new ChangelogFormattingError({
          validChangelog: 'valid content',
          invalidChangelog: 'invalid content',
        }),
      );
      generateDiffMock.mockReturnValue('diff output');
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await validate(defaultOptions);

      expect(generateDiffMock).toHaveBeenCalledWith(
        'valid content',
        'invalid content',
      );
      expect(process.exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Changelog not well-formatted'),
      );
      errorSpy.mockRestore();
      process.exitCode = 0;
    });
  });

  describe('MissingDependencyEntriesError handling', () => {
    const missingEntries = [
      {
        dependency: '@scope/b',
        type: 'dependencies' as const,
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ];

    it('auto-fixes when fix=true and currentPr provided', async () => {
      getDependencyChangesForPackageMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: ['100'],
      });
      validateChangelogMock.mockRejectedValue(
        new MissingDependencyEntriesError(missingEntries),
      );
      updateChangelogWithDependenciesMock.mockResolvedValue('updated content');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await validate({
        ...defaultOptions,
        checkDeps: true,
        fix: true,
        currentPr: '200',
      });

      expect(updateChangelogWithDependenciesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dependencyChanges: missingEntries,
          prNumbers: ['100'],
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 missing dependency'),
      );
      logSpy.mockRestore();
    });

    it('falls back to currentPr when dependencyResult has no prNumbers', async () => {
      getDependencyChangesForPackageMock.mockResolvedValue({
        dependencyChanges: missingEntries,
        prNumbers: [],
      });
      validateChangelogMock.mockRejectedValue(
        new MissingDependencyEntriesError(missingEntries),
      );
      updateChangelogWithDependenciesMock.mockResolvedValue('updated content');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await validate({
        ...defaultOptions,
        checkDeps: true,
        fix: true,
        currentPr: '200',
      });

      expect(updateChangelogWithDependenciesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prNumbers: ['200'],
        }),
      );
      logSpy.mockRestore();
    });

    it('prints error with fix instructions when fix=false', async () => {
      validateChangelogMock.mockRejectedValue(
        new MissingDependencyEntriesError(missingEntries),
      );
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await validate(defaultOptions);

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
      validateChangelogMock.mockRejectedValue(
        new MissingDependencyEntriesError(missingEntries),
      );
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await validate({
        ...defaultOptions,
        fix: true,
      });

      expect(process.exitCode).toBe(1);
      errorSpy.mockRestore();
      process.exitCode = 0;
    });
  });

  describe('InvalidChangelogError handling', () => {
    it('prints the error message and exits with error', async () => {
      validateChangelogMock.mockRejectedValue(
        new InvalidChangelogError('Some validation error'),
      );
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await validate(defaultOptions);

      expect(process.exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Some validation error'),
      );
      errorSpy.mockRestore();
      process.exitCode = 0;
    });
  });

  describe('unexpected errors', () => {
    it('rethrows non-changelog errors', async () => {
      validateChangelogMock.mockRejectedValue(new Error('unexpected'));

      await expect(validate(defaultOptions)).rejects.toThrow('unexpected');
    });
  });
});
