import { getNewChangeEntries } from './get-new-changes';
import * as runCommandModule from './run-command';

// Mock the run-command module
jest.mock('./run-command');

const mockRunCommand = runCommandModule.runCommand as jest.MockedFunction<
  typeof runCommandModule.runCommand
>;
const mockRunCommandAndSplit =
  runCommandModule.runCommandAndSplit as jest.MockedFunction<
    typeof runCommandModule.runCommandAndSplit
  >;

const repoUrl = 'https://github.com/MetaMask/metamask-mobile';

describe('getNewChangeEntries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock git fetch tags
    mockRunCommandAndSplit.mockResolvedValue([]);
  });

  describe('including commits with and without PR numbers', () => {
    it('should include commits with PR numbers', async () => {
      // Mock git rev-list to return commit hashes
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);

      // Mock git show calls for each commit
      mockRunCommand
        .mockResolvedValueOnce('feat: add feature (#12345)') // subject for commit1
        .mockResolvedValueOnce('fix: bug fix (#12346)'); // subject for commit2

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should include both commits with PR numbers
      expect(result).toHaveLength(2);
      expect(result[0].description).toContain('12345');
      expect(result[1].description).toContain('12346');
    });

    it('should include commits without PR numbers (direct commits)', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);

      mockRunCommand
        .mockResolvedValueOnce('feat: important feature (#12345)') // Has PR
        .mockResolvedValueOnce('Update Attributions'); // No PR - but should be included

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(2);
      expect(result[0].description).toContain('important feature');
      expect(result[1].description).toBe('Update Attributions');
    });

    it('should handle merge commit format and include direct commits', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce([
        'commit1',
        'commit2',
        'commit3',
      ]);

      mockRunCommand
        .mockResolvedValueOnce('feat: feature (#12345)') // Squash merge
        .mockResolvedValueOnce('Merge pull request #12346 from branch') // Merge commit
        .mockResolvedValueOnce('Manual commit message'); // Direct commit

      // For merge commit (commit2), mock the body fetch
      mockRunCommand.mockResolvedValueOnce('fix: some bug fix');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should include all three commits
      expect(result).toHaveLength(3);
      expect(
        result.find((item) => item.description.includes('Manual commit')),
      ).toBeDefined();
    });
  });

  describe('duplicate detection for PR-based commits', () => {
    it('should prevent duplicate entries for already logged PRs', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);

      mockRunCommand
        .mockResolvedValueOnce('feat: add feature (#12345)')
        .mockResolvedValueOnce('fix: bug fix (#12346)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: ['12345'], // PR #12345 already logged
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should only include the new PR #12346
      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('12346');
      expect(
        result.find((item) => item.description.includes('12345')),
      ).toBeUndefined();
    });

    it('should include PRs not yet logged', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);

      mockRunCommand
        .mockResolvedValueOnce('feat: new feature (#12347)')
        .mockResolvedValueOnce('fix: new bug fix (#12348)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: ['12345', '12346'], // Different PRs logged
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should include both new PRs
      expect(result).toHaveLength(2);
      expect(result[0].description).toContain('12347');
      expect(result[1].description).toContain('12348');
    });
  });

  describe('duplicate detection for direct commits (no PR numbers)', () => {
    it('should prevent duplicate entries for direct commits already in changelog', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);

      mockRunCommand
        .mockResolvedValueOnce('feat: feature (#12345)')
        .mockResolvedValueOnce('Update Attributions'); // Direct commit

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: ['Update Attributions'], // Already logged
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should only include the PR, not the duplicate direct commit
      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('12345');
      expect(
        result.find((item) => item.description.includes('Attributions')),
      ).toBeUndefined();
    });

    it('should include direct commits not yet in changelog', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);

      mockRunCommand
        .mockResolvedValueOnce('feat: feature (#12345)')
        .mockResolvedValueOnce('Bump version to 7.58.0'); // New direct commit

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: ['Update Attributions'], // Different description
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should include both
      expect(result).toHaveLength(2);
      expect(result[0].description).toContain('feature');
      expect(result[1].description).toContain('Bump version');
    });

    it('should handle multiple direct commits with some duplicates', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce([
        'commit1',
        'commit2',
        'commit3',
      ]);

      mockRunCommand
        .mockResolvedValueOnce('Update Attributions') // Already logged
        .mockResolvedValueOnce('Bump version to 7.58.0') // New
        .mockResolvedValueOnce('Update dependencies'); // New

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: ['Update Attributions'], // Only first one logged
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should include only the new ones
      expect(result).toHaveLength(2);
      expect(
        result.find((item) => item.description.includes('Bump version')),
      ).toBeDefined();
      expect(
        result.find((item) => item.description.includes('Update dependencies')),
      ).toBeDefined();
      expect(
        result.find((item) => item.description.includes('Attributions')),
      ).toBeUndefined();
    });
  });

  describe('mixed scenarios - PR and direct commit deduplication', () => {
    it('should handle multiple runs with both PR and direct commit duplicates (INFRA-3081 fix)', async () => {
      // Simulate multiple workflow runs with accumulating commits

      // Run 1: Initial commits
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);

      mockRunCommand
        .mockResolvedValueOnce('feat: feature (#12345)')
        .mockResolvedValueOnce('Update Attributions'); // Direct commit

      const result1 = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // First run: Both should be included
      expect(result1).toHaveLength(2);
      expect(result1[0].description).toContain('12345');
      expect(result1[1].description).toBe('Update Attributions');

      // Run 2: Same commits + new one (simulating re-run after new push)
      jest.clearAllMocks();
      mockRunCommandAndSplit.mockResolvedValueOnce([
        'commit1',
        'commit2',
        'commit3',
      ]);

      mockRunCommand
        .mockResolvedValueOnce('feat: feature (#12345)') // Already logged
        .mockResolvedValueOnce('Update Attributions') // Already logged - KEY FIX
        .mockResolvedValueOnce('fix: new fix (#12346)'); // New commit

      const result2 = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: ['12345'], // First PR now logged in changelog
        loggedDescriptions: ['feat: feature (#12345)', 'Update Attributions'], // Both now logged
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should only include the new PR, NOT the duplicates
      expect(result2).toHaveLength(1);
      expect(result2[0].description).toContain('12346');
      expect(
        result2.find((item) => item.description.includes('12345')),
      ).toBeUndefined();
      expect(
        result2.find((item) => item.description.includes('Attributions')),
      ).toBeUndefined(); // CRITICAL: No duplicate of "Update Attributions"
    });

    it('should handle all commits being duplicates', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce([
        'commit1',
        'commit2',
        'commit3',
      ]);

      mockRunCommand
        .mockResolvedValueOnce('feat: feature (#12345)') // Already logged
        .mockResolvedValueOnce('Update Attributions') // Already logged
        .mockResolvedValueOnce('Bump version'); // Already logged

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: ['12345'],
        loggedDescriptions: ['Update Attributions', 'Bump version'],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should return empty array - all duplicates
      expect(result).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle no commits since last tag', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce([]); // No commits

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(0);
    });

    it('should handle null as most recent tag', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand.mockResolvedValueOnce('feat: feature (#12345)');

      const result = await getNewChangeEntries({
        mostRecentTag: null, // No previous tag
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('12345');
    });
  });

  describe('formatting with PR links', () => {
    it('should include PR link when useShortPrLink is false', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand.mockResolvedValueOnce('feat: add feature (#12345)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain(
        '[#12345](https://github.com/MetaMask/metamask-mobile/pull/12345)',
      );
    });

    it('should use short PR link when useShortPrLink is true', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand.mockResolvedValueOnce('feat: add feature (#12345)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('(#12345)');
      expect(result[0].description).not.toContain('[#12345]'); // Should not have brackets
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

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Update Attributions');
      expect(result[0].description).not.toContain('#'); // No PR reference
    });
  });

  describe('backward compatibility', () => {
    it('should work with existing changelog containing only PR-based entries', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand.mockResolvedValueOnce('feat: new feature (#12350)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: ['12345', '12346', '12347', '12348', '12349'], // Many existing PRs
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('12350');
    });

    it('should not break when all commits have PR numbers', async () => {
      // Scenario: Perfect PR-based workflow (current best practice)
      mockRunCommandAndSplit.mockResolvedValueOnce([
        'commit1',
        'commit2',
        'commit3',
      ]);

      mockRunCommand
        .mockResolvedValueOnce('feat: feature A (#20001)')
        .mockResolvedValueOnce('fix: bug B (#20002)')
        .mockResolvedValueOnce('chore: update C (#20003)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // All PRs should be included
      expect(result).toHaveLength(3);
    });
  });
});
