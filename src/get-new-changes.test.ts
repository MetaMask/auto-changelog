import * as runCommandModule from './run-command';
import { getNewChangeEntries } from './get-new-changes';

// Mock the run-command module
jest.mock('./run-command');

const mockRunCommand = runCommandModule.runCommand as jest.MockedFunction<
  typeof runCommandModule.runCommand
>;
const mockRunCommandAndSplit = runCommandModule.runCommandAndSplit as jest.MockedFunction<
  typeof runCommandModule.runCommandAndSplit
>;

const repoUrl = 'https://github.com/MetaMask/metamask-mobile';

describe('getNewChangeEntries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock git fetch tags
    mockRunCommandAndSplit.mockResolvedValue([]);
  });

  describe('filtering commits without PR numbers', () => {
    it('should exclude commits without PR numbers', async () => {
      // Mock git rev-list to return commit hashes
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2', 'commit3']);

      // Mock git show calls for each commit
      // Commit 1: Has PR number (squash & merge format)
      mockRunCommand
        .mockResolvedValueOnce('feat: add feature (#12345)') // subject for commit1
        .mockResolvedValueOnce('fix: bug fix (#12346)') // subject for commit2
        .mockResolvedValueOnce('Update Attributions'); // subject for commit3 (NO PR NUMBER)

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should only include commits with PR numbers
      expect(result).toHaveLength(2);
      expect(result[0].description).toContain('12345');
      expect(result[1].description).toContain('12346');
      expect(result.find((r) => r.description.includes('Attributions'))).toBeUndefined();
    });

    it('should exclude direct commits even with meaningful messages', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);

      mockRunCommand
        .mockResolvedValueOnce('feat: important feature (#12345)') // Has PR
        .mockResolvedValueOnce('Bump version to 7.58.0'); // No PR

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('important feature');
      expect(result.find((r) => r.description.includes('Bump version'))).toBeUndefined();
    });

    it('should handle merge commit format and exclude direct commits', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2', 'commit3']);

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
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should include both PR-based commits but not the direct commit
      expect(result).toHaveLength(2);
      expect(result.find((r) => r.description.includes('Manual commit'))).toBeUndefined();
    });
  });

  describe('idempotency with PR numbers', () => {
    it('should prevent duplicate entries for already logged PRs', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);

      mockRunCommand
        .mockResolvedValueOnce('feat: add feature (#12345)')
        .mockResolvedValueOnce('fix: bug fix (#12346)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: ['12345'], // PR #12345 already logged
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should only include the new PR #12346
      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('12346');
      expect(result.find((r) => r.description.includes('12345'))).toBeUndefined();
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
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should include both new PRs
      expect(result).toHaveLength(2);
      expect(result[0].description).toContain('12347');
      expect(result[1].description).toContain('12348');
    });

    it('should handle empty logged PR list', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);

      mockRunCommand.mockResolvedValueOnce('feat: first feature (#12345)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [], // No PRs logged yet
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('12345');
    });
  });

  describe('mixed scenarios - the regression test', () => {
    it('should only include PRs and exclude direct commits even when re-run multiple times', async () => {
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
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result1).toHaveLength(1);
      expect(result1[0].description).toContain('12345');
      expect(result1.find((r) => r.description.includes('Attributions'))).toBeUndefined();

      // Run 2: Same commits + new one (simulating re-run after new push)
      jest.clearAllMocks();
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2', 'commit3']);

      mockRunCommand
        .mockResolvedValueOnce('feat: feature (#12345)') // Already logged
        .mockResolvedValueOnce('Update Attributions') // Direct commit (still there)
        .mockResolvedValueOnce('fix: new fix (#12346)'); // New commit

      const result2 = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: ['12345'], // First PR now logged
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should only include the new PR, not the duplicate or direct commit
      expect(result2).toHaveLength(1);
      expect(result2[0].description).toContain('12346');
      expect(result2.find((r) => r.description.includes('12345'))).toBeUndefined(); // Excluded due to idempotency
      expect(result2.find((r) => r.description.includes('Attributions'))).toBeUndefined(); // Excluded due to no PR number
    });

    it('should handle all commits being either duplicates or direct commits', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2', 'commit3']);

      mockRunCommand
        .mockResolvedValueOnce('feat: feature (#12345)') // Already logged
        .mockResolvedValueOnce('Update Attributions') // Direct commit
        .mockResolvedValueOnce('Bump version'); // Direct commit

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: ['12345'],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should return empty array
      expect(result).toHaveLength(0);
    });
  });

  describe('PR number extraction patterns', () => {
    it('should extract PR number from squash & merge format', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand.mockResolvedValueOnce('feat: add feature (#12345)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('12345');
    });

    it('should extract PR number from merge commit format', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      
      mockRunCommand
        .mockResolvedValueOnce('Merge pull request #12346 from feature-branch')
        .mockResolvedValueOnce('fix: actual fix description'); // body

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('12346');
    });

    it('should exclude commits with no recognizable PR pattern', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2', 'commit3']);

      mockRunCommand
        .mockResolvedValueOnce('Regular commit message')
        .mockResolvedValueOnce('Another commit')
        .mockResolvedValueOnce('chore: update something');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // All should be excluded (no PR numbers)
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
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('12345');
    });

    it('should handle commits with multiple PR references', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      
      // Commit message with multiple PR numbers - takes the last one
      mockRunCommand.mockResolvedValueOnce('feat: feature with refs (#12345) (#12346)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should still extract and include based on pattern match
      expect(result).toHaveLength(1);
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
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('[#12345](https://github.com/MetaMask/metamask-mobile/pull/12345)');
    });

    it('should use short PR link when useShortPrLink is true', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand.mockResolvedValueOnce('feat: add feature (#12345)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        useChangelogEntry: false,
        useShortPrLink: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('(#12345)');
      expect(result[0].description).not.toContain('[#12345]'); // Should not have brackets
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical MetaMask Mobile release with mixed commits', async () => {
      // Simulate a release branch with various commit types
      mockRunCommandAndSplit.mockResolvedValueOnce([
        'hash1',
        'hash2',
        'hash3',
        'hash4',
        'hash5',
      ]);

      mockRunCommand
        .mockResolvedValueOnce('feat: add wallet feature (#20001)') // Feature PR
        .mockResolvedValueOnce('fix: resolve crash (#20002)') // Bug fix PR
        .mockResolvedValueOnce('Update Attributions') // Direct commit - SHOULD BE EXCLUDED
        .mockResolvedValueOnce('chore: dependency update (#20003)') // Chore PR
        .mockResolvedValueOnce('Bump version to 7.58.0'); // Version bump - SHOULD BE EXCLUDED

      const result = await getNewChangeEntries({
        mostRecentTag: 'v7.57.0',
        repoUrl,
        loggedPrNumbers: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Should only include the 3 PRs, not the 2 direct commits
      expect(result).toHaveLength(3);
      expect(result.find((r) => r.description.includes('20001'))).toBeDefined();
      expect(result.find((r) => r.description.includes('20002'))).toBeDefined();
      expect(result.find((r) => r.description.includes('20003'))).toBeDefined();
      expect(result.find((r) => r.description.includes('Attributions'))).toBeUndefined();
      expect(result.find((r) => r.description.includes('Bump version'))).toBeUndefined();
    });

    it('should handle attribution workflow commits gracefully', async () => {
      // Attribution updates are common direct commits in MetaMask Mobile
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);

      mockRunCommand
        .mockResolvedValueOnce('feat: user-facing feature (#20001)')
        .mockResolvedValueOnce('chore: update attributions file'); // Direct attribution commit

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('user-facing feature');
      expect(result.find((r) => r.description.includes('attributions'))).toBeUndefined();
    });

    it('should demonstrate the fix - no duplicates on subsequent runs', async () => {
      // This is the critical test that demonstrates the bug fix
      
      // First run
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2']);
      mockRunCommand
        .mockResolvedValueOnce('feat: feature (#12345)')
        .mockResolvedValueOnce('Update Attributions');

      const firstRun = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // First run: Only PR is included
      expect(firstRun).toHaveLength(1);
      expect(firstRun[0].description).toContain('12345');

      // Second run - simulate another push to release branch
      jest.clearAllMocks();
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2', 'commit3']);
      mockRunCommand
        .mockResolvedValueOnce('feat: feature (#12345)') // Already logged
        .mockResolvedValueOnce('Update Attributions') // Direct commit (still in history)
        .mockResolvedValueOnce('fix: new fix (#12346)'); // New PR

      const secondRun = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: ['12345'], // First PR now logged
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Second run: Only new PR, no duplicate of #12345, no duplicate of "Update Attributions"
      expect(secondRun).toHaveLength(1);
      expect(secondRun[0].description).toContain('12346');
      expect(secondRun.find((r) => r.description.includes('12345'))).toBeUndefined();
      expect(secondRun.find((r) => r.description.includes('Attributions'))).toBeUndefined();

      // Third run - one more push
      jest.clearAllMocks();
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2', 'commit3', 'commit4']);
      mockRunCommand
        .mockResolvedValueOnce('feat: feature (#12345)')
        .mockResolvedValueOnce('Update Attributions')
        .mockResolvedValueOnce('fix: new fix (#12346)')
        .mockResolvedValueOnce('feat: another feature (#12347)'); // New PR

      const thirdRun = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: ['12345', '12346'], // Both PRs now logged
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // Third run: Only the newest PR
      expect(thirdRun).toHaveLength(1);
      expect(thirdRun[0].description).toContain('12347');
      
      // Critical: "Update Attributions" NEVER appears in any run
      // This proves idempotency is maintained even without PR numbers
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
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain('12350');
    });

    it('should not break when all commits have PR numbers', async () => {
      // Scenario: Perfect PR-based workflow (current best practice)
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1', 'commit2', 'commit3']);
      
      mockRunCommand
        .mockResolvedValueOnce('feat: feature A (#20001)')
        .mockResolvedValueOnce('fix: bug B (#20002)')
        .mockResolvedValueOnce('chore: update C (#20003)');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      // All PRs should be included
      expect(result).toHaveLength(3);
    });
  });
});


