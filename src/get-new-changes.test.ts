import { getNewChangeEntries } from './get-new-changes';
import { runCommand, runCommandAndSplit } from './run-command';

jest.mock('./run-command');

const mockRunCommand = runCommand as jest.MockedFunction<typeof runCommand>;
const mockRunCommandAndSplit = runCommandAndSplit as jest.MockedFunction<
  typeof runCommandAndSplit
>;

const repoUrl = 'https://github.com/MetaMask/metamask-mobile';

describe('getNewChangeEntries', () => {
  beforeEach(() => {
    mockRunCommandAndSplit.mockResolvedValue([]);
  });

  describe('PR-tagged commits', () => {
    it('should include commits with PR numbers', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);
      mockRunCommand
        .mockResolvedValueOnce('add feature (#12345)')
        .mockResolvedValueOnce('bug fix (#12346)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toStrictEqual([
        {
          description:
            'add feature ([#12345](https://github.com/MetaMask/metamask-mobile/pull/12345))',
          subject: 'add feature (#12345)',
        },
        {
          description:
            'bug fix ([#12346](https://github.com/MetaMask/metamask-mobile/pull/12346))',
          subject: 'bug fix (#12346)',
        },
      ]);
    });

    it('should exclude commits with PR numbers already in changelog', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);
      mockRunCommand
        .mockResolvedValueOnce('add feature (#12345)')
        .mockResolvedValueOnce('bug fix (#12346)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: ['12345'],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toStrictEqual([
        {
          description:
            'bug fix ([#12346](https://github.com/MetaMask/metamask-mobile/pull/12346))',
          subject: 'bug fix (#12346)',
        },
      ]);
    });
  });

  describe('direct commits (no PR numbers)', () => {
    it('should include direct commits', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);
      mockRunCommand
        .mockResolvedValueOnce('Update Attributions')
        .mockResolvedValueOnce('Bump version to 7.58.0');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toStrictEqual([
        {
          description: 'Update Attributions',
          subject: 'Update Attributions',
        },
        {
          description: 'Bump version to 7.58.0',
          subject: 'Bump version to 7.58.0',
        },
      ]);
    });

    it('should exclude direct commits already in changelog', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);
      mockRunCommand
        .mockResolvedValueOnce('Update Attributions')
        .mockResolvedValueOnce('Bump version to 7.58.0');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: ['Update Attributions'],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toStrictEqual([
        {
          description: 'Bump version to 7.58.0',
          subject: 'Bump version to 7.58.0',
        },
      ]);
    });
  });

  describe('merge commits', () => {
    it('should extract PR numbers from merge commits', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);
      mockRunCommand
        .mockResolvedValueOnce('Merge pull request #12345 from feature-branch')
        .mockResolvedValueOnce('Merge pull request #12346 from fix-branch');
      // Mock body fetches for merge commits
      mockRunCommandAndSplit
        .mockResolvedValueOnce(['implement new feature'])
        .mockResolvedValueOnce(['fix critical bug']);

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toStrictEqual([
        {
          description:
            'implement new feature ([#12345](https://github.com/MetaMask/metamask-mobile/pull/12345))',
          subject: 'implement new feature',
        },
        {
          description:
            'fix critical bug ([#12346](https://github.com/MetaMask/metamask-mobile/pull/12346))',
          subject: 'fix critical bug',
        },
      ]);
    });
  });

  describe('squash merge deduplication', () => {
    it('should skip direct commit when PR-tagged commit with same description exists', async () => {
      // Simulates squash merge where both original and merged commits appear
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);
      mockRunCommand
        .mockResolvedValueOnce('add new feature') // Direct commit (no PR)
        .mockResolvedValueOnce('add new feature (#12345)'); // PR-tagged commit with same description

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should only include the PR-tagged version
      expect(result).toStrictEqual([
        {
          description:
            'add new feature ([#12345](https://github.com/MetaMask/metamask-mobile/pull/12345))',
          subject: 'add new feature (#12345)',
        },
      ]);
    });
  });

  describe('duplicate detection', () => {
    it('should return empty array when all commits are duplicates', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce([
        'commit1',
        'commit2',
        'commit3',
      ]);
      mockRunCommand
        .mockResolvedValueOnce('add feature (#12345)')
        .mockResolvedValueOnce('Update Attributions')
        .mockResolvedValueOnce('Bump version');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: ['12345'],
        loggedDescriptions: ['Update Attributions', 'Bump version'],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toStrictEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should return empty array when there are no commits', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce([]);

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toStrictEqual([]);
    });

    it('should use HEAD as commit range when no tag is available', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand.mockResolvedValueOnce('add feature (#12345)');

      const result = await getNewChangeEntries({
        mostRecentTag: null,
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(mockRunCommandAndSplit).toHaveBeenCalledWith('git', [
        'rev-list',
        'HEAD',
      ]);
      expect(result).toStrictEqual([
        {
          description:
            'add feature ([#12345](https://github.com/MetaMask/metamask-mobile/pull/12345))',
          subject: 'add feature (#12345)',
        },
      ]);
    });

    it('should throw error when git show returns empty subject', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand.mockResolvedValueOnce('');

      await expect(
        getNewChangeEntries({
          mostRecentTag: 'v1.0.0',
          repoUrl,
          loggedPrNumbers: [],
          loggedDescriptions: [],
          useChangelogEntry: false,
          useShortPrLink: false,
        }),
      ).rejects.toThrow(
        '"git show" returned empty subject for commit "commit1".',
      );
    });
  });

  describe('PR link formatting', () => {
    it('should include full PR link when useShortPrLink is false', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand.mockResolvedValueOnce('add feature (#12345)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toStrictEqual([
        {
          description:
            'add feature ([#12345](https://github.com/MetaMask/metamask-mobile/pull/12345))',
          subject: 'add feature (#12345)',
        },
      ]);
    });

    it('should use short PR link when useShortPrLink is true', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand.mockResolvedValueOnce('add feature (#12345)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: true,
      });

      expect(result).toStrictEqual([
        {
          description: 'add feature (#12345)',
          subject: 'add feature (#12345)',
        },
      ]);
    });

    it('should not add PR link suffix for direct commits', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand.mockResolvedValueOnce('Update Attributions');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toStrictEqual([
        {
          description: 'Update Attributions',
          subject: 'Update Attributions',
        },
      ]);
    });
  });
});
