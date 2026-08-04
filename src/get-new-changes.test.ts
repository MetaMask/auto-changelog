import { Octokit } from '@octokit/rest';

import { getNewChangeEntries } from './get-new-changes';
import { runCommand, runCommandAndSplit } from './run-command';

jest.mock('./run-command');

// Mock Octokit so the `useChangelogEntry` path (which fetches PR labels) does
// not make network calls. The Jest config has `resetMocks: true`, so the
// constructor implementation is re-established in `beforeEach` below.
const mockPullsGet = jest.fn();
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(),
}));

const mockOctokit = Octokit as unknown as jest.Mock;

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
            'Added feature ([#12345](https://github.com/MetaMask/metamask-mobile/pull/12345))',
          subject: 'add feature (#12345)',
          hasChangelogEntry: false,
        },
        {
          description:
            'bug fix ([#12346](https://github.com/MetaMask/metamask-mobile/pull/12346))',
          subject: 'bug fix (#12346)',
          hasChangelogEntry: false,
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
          hasChangelogEntry: false,
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
          description: 'Updated Attributions',
          subject: 'Update Attributions',
          hasChangelogEntry: false,
        },
        {
          description: 'Bumped version to 7.58.0',
          subject: 'Bump version to 7.58.0',
          hasChangelogEntry: false,
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
          description: 'Bumped version to 7.58.0',
          subject: 'Bump version to 7.58.0',
          hasChangelogEntry: false,
        },
      ]);
    });

    it('excludes normalized direct commits already in changelog', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand.mockResolvedValueOnce('Update Attributions');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: ['Updated Attributions'],
        useChangelogEntry: false,
        useShortPrLink: false,
      });

      expect(result).toStrictEqual([]);
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
            'Implemented new feature ([#12345](https://github.com/MetaMask/metamask-mobile/pull/12345))',
          subject: 'implement new feature',
          hasChangelogEntry: false,
        },
        {
          description:
            'Fixed critical bug ([#12346](https://github.com/MetaMask/metamask-mobile/pull/12346))',
          subject: 'fix critical bug',
          hasChangelogEntry: false,
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
            'Added new feature ([#12345](https://github.com/MetaMask/metamask-mobile/pull/12345))',
          subject: 'add new feature (#12345)',
          hasChangelogEntry: false,
        },
      ]);
    });
  });

  describe('cherry-pick deduplication', () => {
    beforeEach(() => {
      // eslint-disable-next-line node/no-process-env
      process.env.GITHUB_TOKEN = 'test-token';
      // `resetMocks: true` wipes the constructor implementation between tests.
      mockOctokit.mockImplementation(() => ({
        rest: { pulls: { get: mockPullsGet } },
      }));
      mockPullsGet.mockResolvedValue({ data: { labels: [] } });
    });

    afterEach(() => {
      // eslint-disable-next-line node/no-process-env
      delete process.env.GITHUB_TOKEN;
    });

    /**
     * Run an original commit and its cherry-pick (both carrying the same
     * `CHANGELOG entry:`) through `getNewChangeEntries`.
     *
     * @param originalSubject - Subject of the original, `main`-targeting commit.
     * @param cherryPickSubject - Subject of the release-automation cherry-pick.
     * @param entry - The shared `CHANGELOG entry:` text.
     * @returns The resulting change entries.
     */
    async function runOriginalAndCherryPick(
      originalSubject: string,
      cherryPickSubject: string,
      entry: string,
    ) {
      mockRunCommandAndSplit.mockResolvedValueOnce(['original', 'cherrypick']);
      mockRunCommand
        .mockResolvedValueOnce(originalSubject) // original %s
        .mockResolvedValueOnce(`CHANGELOG entry: ${entry}`) // original %b
        .mockResolvedValueOnce(cherryPickSubject) // cherry-pick %s
        .mockResolvedValueOnce(`CHANGELOG entry: ${entry}`); // cherry-pick %b

      return getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: true,
        useShortPrLink: true,
      });
    }

    it('drops an extension release(runway) cherry-pick in favor of the original', async () => {
      const result = await runOriginalAndCherryPick(
        'feat: added decimal validation (#44602)',
        'release(runway): cherry-pick feat: added decimal validation cp-13.41.0 (#44604)',
        'Added decimal validation',
      );

      expect(result).toStrictEqual([
        {
          description: 'Added decimal validation (#44602)',
          subject: 'Added decimal validation',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('drops a mobile chore(runway) cherry-pick in favor of the original', async () => {
      const result = await runOriginalAndCherryPick(
        'fix: MUSD deposit from money home page (#33437)',
        'chore(runway): cherry-pick fix: MUSD deposit from money home page cp-8.3.0 (#33500)',
        'Fixed MUSD deposit from the money home page',
      );

      expect(result).toStrictEqual([
        {
          description: 'Fixed MUSD deposit from the money home page (#33437)',
          subject: 'Fixed MUSD deposit from the money home page',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('drops a release(cp) cherry-pick in favor of the original', async () => {
      const result = await runOriginalAndCherryPick(
        'chore: bump axios to ^1.18.0 (#33540)',
        'release(cp): chore: bump axios to ^1.18.0 (#33541)',
        'Bumped axios to `^1.18.0`',
      );

      expect(result).toStrictEqual([
        {
          description: 'Bumped axios to `^1.18.0` (#33540)',
          subject: 'Bumped axios to `^1.18.0`',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('drops a freeform "Cherry-picking commits from" commit in favor of the original', async () => {
      const result = await runOriginalAndCherryPick(
        'fix: something important (#33289)',
        'Cherry-picking commits from main to release/8.2.1-ota for PR #33289 (#33328)',
        'Fixed something important',
      );

      expect(result).toStrictEqual([
        {
          description: 'Fixed something important (#33289)',
          subject: 'Fixed something important',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('keeps two distinct PRs that merely share a description when neither is a cherry-pick', async () => {
      // The feared false positive: distinct PRs with an identical terse entry
      // must both survive, because neither commit is a cherry-pick.
      mockRunCommandAndSplit.mockResolvedValueOnce(['first', 'second']);
      mockRunCommand
        .mockResolvedValueOnce('feat: decimal validation (#44602)')
        .mockResolvedValueOnce('CHANGELOG entry: Added decimal validation')
        .mockResolvedValueOnce('feat: decimal validation elsewhere (#44700)')
        .mockResolvedValueOnce('CHANGELOG entry: Added decimal validation');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: true,
        useShortPrLink: true,
      });

      expect(result).toStrictEqual([
        {
          description: 'Added decimal validation (#44602)',
          subject: 'Added decimal validation',
          hasChangelogEntry: true,
        },
        {
          description: 'Added decimal validation (#44700)',
          subject: 'Added decimal validation',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('keeps a cherry-pick when its original is not in the same batch', async () => {
      // If only the cherry-pick is present (original already released), the
      // change must still be recorded rather than silently dropped.
      mockRunCommandAndSplit.mockResolvedValueOnce(['cherrypick']);
      mockRunCommand
        .mockResolvedValueOnce(
          'release(runway): cherry-pick feat: added decimal validation cp-13.41.0 (#44604)',
        )
        .mockResolvedValueOnce('CHANGELOG entry: Added decimal validation');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: true,
        useShortPrLink: true,
      });

      expect(result).toStrictEqual([
        {
          description: 'Added decimal validation (#44604)',
          subject: 'Added decimal validation',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('keeps a cherry-pick when only an unrelated commit shares its description', async () => {
      mockRunCommandAndSplit.mockResolvedValueOnce(['unrelated', 'cherrypick']);
      mockRunCommand
        .mockResolvedValueOnce('feat: another validation (#44700)')
        .mockResolvedValueOnce('CHANGELOG entry: Added decimal validation')
        .mockResolvedValueOnce(
          'release(runway): cherry-pick feat: added decimal validation cp-13.41.0 (#44604)',
        )
        .mockResolvedValueOnce('CHANGELOG entry: Added decimal validation');

      const result = await getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: true,
        useShortPrLink: true,
      });

      expect(result).toStrictEqual([
        {
          description: 'Added decimal validation (#44700)',
          subject: 'Added decimal validation',
          hasChangelogEntry: true,
        },
        {
          description: 'Added decimal validation (#44604)',
          subject: 'Added decimal validation',
          hasChangelogEntry: true,
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
            'Added feature ([#12345](https://github.com/MetaMask/metamask-mobile/pull/12345))',
          subject: 'add feature (#12345)',
          hasChangelogEntry: false,
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
            'Added feature ([#12345](https://github.com/MetaMask/metamask-mobile/pull/12345))',
          subject: 'add feature (#12345)',
          hasChangelogEntry: false,
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
          description: 'Added feature (#12345)',
          subject: 'add feature (#12345)',
          hasChangelogEntry: false,
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
          description: 'Updated Attributions',
          subject: 'Update Attributions',
          hasChangelogEntry: false,
        },
      ]);
    });
  });

  describe('CHANGELOG entry parsing (useChangelogEntry: true)', () => {
    beforeEach(() => {
      // eslint-disable-next-line node/no-process-env
      process.env.GITHUB_TOKEN = 'test-token';
      // `resetMocks: true` wipes the constructor implementation between tests,
      // so re-establish it here.
      mockOctokit.mockImplementation(() => ({
        rest: { pulls: { get: mockPullsGet } },
      }));
      // Default: PRs have no labels.
      mockPullsGet.mockResolvedValue({ data: { labels: [] } });
    });

    afterEach(() => {
      // eslint-disable-next-line node/no-process-env
      delete process.env.GITHUB_TOKEN;
    });

    /**
     * Run a single PR-tagged commit through `getNewChangeEntries` with the
     * `useChangelogEntry` path enabled.
     *
     * @param subject - The commit subject line (`git show %s`).
     * @param body - The commit body (`git show %b`).
     * @returns The resulting change entries.
     */
    async function runWithEntry(subject: string, body: string) {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      mockRunCommand
        .mockResolvedValueOnce(subject) // %s
        .mockResolvedValueOnce(body); // %b

      return getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: true,
        useShortPrLink: true,
      });
    }

    it('extracts a simple single-line entry', async () => {
      const result = await runWithEntry(
        'chore: do a thing (#100)',
        'Some description\n\nCHANGELOG entry: Added a new tab\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Added a new tab (#100)',
          subject: 'Added a new tab',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('excludes an entry marked null even when a Fixes: line follows it', async () => {
      // Regression: the old regex swallowed the following line into the entry,
      // turning `null` into `null Fixes: <url>` and defeating the null check.
      const result = await runWithEntry(
        'perf: refactor selectors (#44110)',
        'CHANGELOG entry: null\nFixes: https://example.com/issues/6500\n\nBody text',
      );

      expect(result).toStrictEqual([]);
    });

    it('excludes an entry marked null when it is the first line of the body', async () => {
      // Regression: the old regex required a leading newline, so an entry on
      // the first line of the body was never matched.
      const result = await runWithEntry(
        'perf(6916): refactor core UX selectors (#44235)',
        'CHANGELOG entry: null\nFixes: https://example.com/issues/6916',
      );

      expect(result).toStrictEqual([]);
    });

    it('excludes an entry marked null with no space after the colon', async () => {
      // Regression: the old regex required exactly one whitespace character
      // after the colon, so `CHANGELOG entry:null` was never matched.
      const result = await runWithEntry(
        'chore: setup codeownership (#44131)',
        'Some body\n\nCHANGELOG entry:null',
      );

      expect(result).toStrictEqual([]);
    });

    it('extracts an entry that is the last line of the body', async () => {
      // Regression: the old regex required a trailing blank line.
      const result = await runWithEntry(
        'chore: remove old flow (#43712)',
        'Body text\n\nCHANGELOG entry: Removed old token import flow',
      );

      expect(result).toStrictEqual([
        {
          description: 'Removed old token import flow (#43712)',
          subject: 'Removed old token import flow',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('joins a hard-wrapped multi-line entry into a single line', async () => {
      // Regression: `.replace('\n', ' ')` only replaced the first newline,
      // leaving orphan continuation lines and splitting the sentence.
      const result = await runWithEntry(
        'feat: show onboarding once (#44232)',
        [
          '## Changelog',
          '',
          'CHANGELOG entry: Fixed an issue where users who closed the extension on',
          'the wallet-ready screen without tapping Done were shown the celebration',
          'screen again on reopen',
          '',
        ].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description:
            'Fixed an issue where users who closed the extension on the wallet-ready screen without tapping Done were shown the celebration screen again on reopen (#44232)',
          subject:
            'Fixed an issue where users who closed the extension on the wallet-ready screen without tapping Done were shown the celebration screen again on reopen',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('joins a hard-wrapped multi-line entry that uses CRLF line endings', async () => {
      // Squash-merge commit messages composed in GitHub's web UI use `\r\n`.
      // Without CRLF normalization the stray `\r` became a `""` line that was
      // read as a blank-line boundary, truncating the entry at the first line.
      const result = await runWithEntry(
        'feat: show nfts (#44240)',
        'CHANGELOG entry: Added a new tab that lets users\r\nsee their NFTs in a grid\r\n\r\nFixes: #1',
      );

      expect(result).toStrictEqual([
        {
          description:
            'Added a new tab that lets users see their NFTs in a grid (#44240)',
          subject: 'Added a new tab that lets users see their NFTs in a grid',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('joins two CHANGELOG entry lines with a semicolon', async () => {
      // A second `CHANGELOG entry:` line starts a new entry; both are kept and
      // joined with `; ` rather than concatenated into one run-on sentence or
      // truncated to the first.
      const result = await runWithEntry(
        'feat: two entries (#44241)',
        'CHANGELOG entry: Fixed such and such\nCHANGELOG entry: Updated such and such',
      );

      expect(result).toStrictEqual([
        {
          description: 'Fixed such and such; Updated such and such (#44241)',
          subject: 'Fixed such and such; Updated such and such',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('strips a trailing period from each joined entry', async () => {
      const result = await runWithEntry(
        'feat: two entries with periods (#44241)',
        [
          'CHANGELOG entry: Added the first thing.',
          'CHANGELOG entry: Fixed the second thing.',
        ].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description: 'Added the first thing; Fixed the second thing (#44241)',
          subject: 'Added the first thing.; Fixed the second thing.',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('normalizes every joined entry independently', async () => {
      const result = await runWithEntry(
        'feat: two entries with prefixes (#44249)',
        [
          'CHANGELOG entry: feat: Add the first thing.',
          'CHANGELOG entry: fix: Fix the second thing.',
        ].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description: 'Added the first thing; Fixed the second thing (#44249)',
          subject: 'feat: Add the first thing.; fix: Fix the second thing.',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('joins three or more CHANGELOG entry lines with semicolons', async () => {
      // Authors occasionally list several entries, one per line; every entry
      // is preserved and joined with `; `.
      const result = await runWithEntry(
        'feat: three entries (#44242)',
        [
          'CHANGELOG entry: Added the first thing',
          'CHANGELOG entry: Fixed the second thing',
          'CHANGELOG entry: Removed the third thing',
        ].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description:
            'Added the first thing; Fixed the second thing; Removed the third thing (#44242)',
          subject:
            'Added the first thing; Fixed the second thing; Removed the third thing',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('joins multiple hard-wrapped CHANGELOG entries with semicolons', async () => {
      // Each entry may itself be hard-wrapped; continuation lines join with
      // spaces within an entry, and distinct entries join with `; `.
      const result = await runWithEntry(
        'feat: wrapped entries (#44243)',
        [
          'CHANGELOG entry: Added a tab that lets users',
          'see their NFTs',
          'CHANGELOG entry: Fixed a crash on the',
          'settings screen',
        ].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description:
            'Added a tab that lets users see their NFTs; Fixed a crash on the settings screen (#44243)',
          subject:
            'Added a tab that lets users see their NFTs; Fixed a crash on the settings screen',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('ignores null and empty entries when other entries are present', async () => {
      // A `null` or empty sibling entry must not add a stray `; ` or defeat the
      // real entries.
      const result = await runWithEntry(
        'feat: mixed entries (#44244)',
        [
          'CHANGELOG entry: null',
          'CHANGELOG entry: Added the real change',
          'CHANGELOG entry:',
        ].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description: 'Added the real change (#44244)',
          subject: 'Added the real change',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('excludes the commit when every entry is null', async () => {
      // Multiple `null` entries still signal a full no-changelog opt-out.
      const result = await runWithEntry(
        'perf: nothing user facing (#44245)',
        'CHANGELOG entry: null\nCHANGELOG entry: null',
      );

      expect(result).toStrictEqual([]);
    });

    it('excludes an entry whose value is the N/A placeholder', async () => {
      // Authors sometimes write `N/A` (rather than `null`) to mean "no
      // changelog entry". It is treated as an opt-out and the commit is
      // excluded instead of emitting a literal `- N/A (#...)` bullet.
      const result = await runWithEntry(
        'chore: no user facing change (#44656)',
        'CHANGELOG entry: N/A',
      );

      expect(result).toStrictEqual([]);
    });

    it('excludes entries using other opt-out placeholders (TBD, none, na)', async () => {
      // The opt-out set covers a few unambiguous placeholders. Each on its own
      // opts the commit out just like `null`.
      for (const placeholder of ['TBD', 'none', 'na', 'N\\A']) {
        const result = await runWithEntry(
          'chore: placeholder (#44660)',
          `CHANGELOG entry: ${placeholder}`,
        );

        expect(result).toStrictEqual([]);
      }
    });

    it('keeps an entry that merely contains an opt-out word', async () => {
      // Only an entry whose ENTIRE value is a placeholder opts out; a real
      // sentence that happens to contain "none" is preserved.
      const result = await runWithEntry(
        'feat: remove option (#44661)',
        'CHANGELOG entry: Removed the none option from the dropdown',
      );

      expect(result).toStrictEqual([
        {
          description: 'Removed the none option from the dropdown (#44661)',
          subject: 'Removed the none option from the dropdown',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('ignores a commented-out CHANGELOG entry inside an HTML comment', async () => {
      // Regression (#44646): the PR template offers a commented-out
      // `CHANGELOG entry: null` alternative. The `<!--`/`-->` block (and the
      // `null` line inside it) must be ignored so the real entry is not joined
      // with a stray `; null -->`.
      const result = await runWithEntry(
        'feat: high-rate alert (#44646)',
        [
          '## Changelog',
          '',
          'CHANGELOG entry: Added a high-rate alert warning',
          '',
          '<!-- Alternatively, if this is internal, use:',
          'CHANGELOG entry: null',
          '-->',
          '',
          'Fixes: #43681',
        ].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description: 'Added a high-rate alert warning (#44646)',
          subject: 'Added a high-rate alert warning',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('ignores an entire entry that is inside an HTML comment', async () => {
      // When the ONLY `CHANGELOG entry:` line is commented out, there is no
      // real entry, so the commit falls back to its subject.
      const result = await runWithEntry(
        'chore: add a widget (#44662)',
        ['<!--', 'CHANGELOG entry: this is commented out', '-->'].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description: 'Added a widget (#44662)',
          subject: 'chore: add a widget (#44662)',
          hasChangelogEntry: false,
        },
      ]);
    });

    it('joins a hard-wrapped continuation line that begins with a URL', async () => {
      // `https:` matches the `word:` metadata-field boundary by coincidence;
      // a bare URL continuation is exempt so the wrapped link is kept.
      const result = await runWithEntry(
        'feat: link docs (#44246)',
        [
          'CHANGELOG entry: Added a docs link, see',
          'https://example.com/docs for details',
        ].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description:
            'Added a docs link, see https://example.com/docs for details (#44246)',
          subject:
            'Added a docs link, see https://example.com/docs for details',
          hasChangelogEntry: true,
        },
      ]);
    });

    it.each(['null', 'N/A'])(
      'keeps %s followed by a URL as an opt-out',
      async (entry) => {
        const result = await runWithEntry(
          'chore: internal-only change (#44248)',
          [`CHANGELOG entry: ${entry}`, 'https://example.com/tracker'].join(
            '\n',
          ),
        );

        expect(result).toStrictEqual([]);
      },
    );

    it('joins a Markdown link label split by a blank line', async () => {
      // GitHub's commit-message wrapping can insert a blank line inside the
      // link label on a runway cherry-pick. Keeping the label intact preserves
      // an identical description for the original and its cherry-pick.
      const result = await runWithEntry(
        'fix: patch client utils (#45006)',
        [
          'CHANGELOG entry: [patch for missing slip44 entries in core',
          '',
          'client-utils](https://example.com/pull/45006/changes/abc123)',
          '',
          'Fixes: #44993',
        ].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description:
            'Patch for missing slip44 entries in core client-utils (#45006)',
          subject: 'patch for missing slip44 entries in core client-utils',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('still truncates at a non-URL word: continuation line', async () => {
      // The URL exemption is deliberately narrow: a `Note:` continuation is
      // still treated as a metadata boundary, so the entry stops before it.
      // This keeps the `null` no-changelog opt-out safe from unlisted fields.
      const result = await runWithEntry(
        'feat: note after entry (#44247)',
        [
          'CHANGELOG entry: Added the primary change',
          'Note: only applies to mainnet',
        ].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description: 'Added the primary change (#44247)',
          subject: 'Added the primary change',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('strips a conventional prefix from the entry description but keeps it for categorization', async () => {
      const result = await runWithEntry(
        'fix: something (#44188)',
        'Body\n\nCHANGELOG entry: fix: rejected tx showing transaction id link',
      );

      expect(result).toStrictEqual([
        {
          description: 'Rejected tx showing transaction id link (#44188)',
          // Categorization source retains the raw entry (with prefix).
          subject: 'fix: rejected tx showing transaction id link',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('uses the raw entry as the categorization source, overriding the subject', async () => {
      const result = await runWithEntry(
        'chore: use delay on the global spinner (#44120)',
        'Body\n\nCHANGELOG entry: chore: defer global spinners',
      );

      expect(result).toStrictEqual([
        {
          description: 'Defer global spinners (#44120)',
          subject: 'chore: defer global spinners',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('normalizes the fallback description from the subject when no entry is present', async () => {
      const result = await runWithEntry(
        'chore: update transaction id copied translation (#44313)',
        'Body with no changelog entry line',
      );

      expect(result).toStrictEqual([
        {
          description: 'Updated transaction id copied translation (#44313)',
          subject: 'chore: update transaction id copied translation (#44313)',
          hasChangelogEntry: false,
        },
      ]);
    });

    it('strips a leading list marker written with a space (regression #27201)', async () => {
      // The author formatted the entry as a Markdown list item; without the
      // fix this produced a doubled bullet (`- - Integrated ...`).
      const result = await runWithEntry(
        'feat: dynamic network registry (#27201)',
        [
          'CHANGELOG entry: - Integrated the dynamic network registry into MetaMask',
          'Extension',
          '  - some internal sub-bullet that should be dropped',
        ].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description:
            'Integrated the dynamic network registry into MetaMask Extension (#27201)',
          // The marker is stripped from the extracted entry, so the raw entry
          // used as the categorization source no longer carries it.
          subject:
            'Integrated the dynamic network registry into MetaMask Extension',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('strips a leading list marker written without a space (regression #33116)', async () => {
      const result = await runWithEntry(
        'fix: bridge quote (#33116)',
        [
          'CHANGELOG entry: -Fixed bridge quote refresh when the source token',
          'changes mid-flight',
        ].join('\n'),
      );

      expect(result).toStrictEqual([
        {
          description:
            'Fixed bridge quote refresh when the source token changes mid-flight (#33116)',
          subject:
            'Fixed bridge quote refresh when the source token changes mid-flight',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('falls back to the subject when the entry label is present but empty (regression #33128)', async () => {
      // The `CHANGELOG entry:` label is present with nothing after it. Without
      // the empty-entry guard this emitted a bare `(#33128)` bullet. The
      // subject is used instead (keyword-based exclusion happens downstream).
      const result = await runWithEntry(
        'chore: add a widget (#33128)',
        'Some PR body\n\nCHANGELOG entry:\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Added a widget (#33128)',
          subject: 'chore: add a widget (#33128)',
          hasChangelogEntry: false,
        },
      ]);
    });

    it('does not absorb a following field line into an empty entry (regression #33120)', async () => {
      // The line after the empty entry is a bare URL (a new field), which the
      // boundary logic must not fold into the entry. The empty entry then
      // falls back to the subject rather than emitting the URL.
      const result = await runWithEntry(
        'chore: fix assets bug (#33120)',
        'CHANGELOG entry:\nhttps://example.com/browse/ASSETS-3612\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Fixed assets bug (#33120)',
          subject: 'chore: fix assets bug (#33120)',
          hasChangelogEntry: false,
        },
      ]);
    });

    it('strips a redundant trailing period from a single-sentence entry', async () => {
      const result = await runWithEntry(
        'feat: add tab (#200)',
        'CHANGELOG entry: Added a new NFT tab.\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Added a new NFT tab (#200)',
          subject: 'Added a new NFT tab.',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('keeps the trailing period on a multi-sentence entry', async () => {
      const result = await runWithEntry(
        'feat: add tab (#201)',
        'CHANGELOG entry: Added a new NFT tab. It shows all collectibles.\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Added a new NFT tab. It shows all collectibles. (#201)',
          subject: 'Added a new NFT tab. It shows all collectibles.',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('does not treat an abbreviation period as a sentence boundary', async () => {
      // `e.g.` must not be read as a sentence end, so the entry is still
      // single-sentence and its trailing period is stripped.
      const result = await runWithEntry(
        'feat: add option (#202)',
        'CHANGELOG entry: Added support for more networks, e.g. Base.\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Added support for more networks, e.g. Base (#202)',
          subject: 'Added support for more networks, e.g. Base.',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('does not strip a trailing ellipsis', async () => {
      const result = await runWithEntry(
        'feat: add option (#203)',
        'CHANGELOG entry: Added a thing...\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Added a thing... (#203)',
          subject: 'Added a thing...',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('keeps the period of a terminal abbreviation', async () => {
      // The final period of "U.S." belongs to the abbreviation, not a
      // redundant sentence terminator, so it must not be stripped.
      const result = await runWithEntry(
        'feat: add region (#204)',
        'CHANGELOG entry: Added deposit support in the U.S.\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Added deposit support in the U.S. (#204)',
          subject: 'Added deposit support in the U.S.',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('converts a regular imperative leading verb to past tense', async () => {
      const result = await runWithEntry(
        'chore: migrate events (#300)',
        'CHANGELOG entry: Migrate perps events\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Migrated perps events (#300)',
          subject: 'Migrate perps events',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('converts a doubled-consonant verb correctly', async () => {
      const result = await runWithEntry(
        'chore: skip step (#301)',
        'CHANGELOG entry: Skip Android AAB for non-production builds\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Skipped Android AAB for non-production builds (#301)',
          subject: 'Skip Android AAB for non-production builds',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('converts an irregular verb correctly', async () => {
      const result = await runWithEntry(
        'feat: hide balance (#302)',
        'CHANGELOG entry: Hide perps balance when privacy mode is enabled\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Hid perps balance when privacy mode is enabled (#302)',
          subject: 'Hide perps balance when privacy mode is enabled',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('converts a third-person present verb to past tense', async () => {
      const result = await runWithEntry(
        'feat: adds tab (#303)',
        'CHANGELOG entry: Adds a new NFT tab\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Added a new NFT tab (#303)',
          subject: 'Adds a new NFT tab',
          hasChangelogEntry: true,
        },
      ]);
    });

    it.each([
      ['Store', 'Stored'],
      ['Centralize', 'Centralized'],
      ['Merge', 'Merged'],
      ['Reorder', 'Reordered'],
    ])('converts the leading verb %s to %s', async (imperative, pastTense) => {
      const result = await runWithEntry(
        `chore: change thing (#310)`,
        `CHANGELOG entry: ${imperative} the watchlist section\n`,
      );

      expect(result).toStrictEqual([
        {
          description: `${pastTense} the watchlist section (#310)`,
          subject: `${imperative} the watchlist section`,
          hasChangelogEntry: true,
        },
      ]);
    });

    it('leaves an already-past-tense entry unchanged', async () => {
      const result = await runWithEntry(
        'feat: add tab (#304)',
        'CHANGELOG entry: Added a new NFT tab\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Added a new NFT tab (#304)',
          subject: 'Added a new NFT tab',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('leaves an unrecognized leading word unchanged', async () => {
      const result = await runWithEntry(
        'chore: vs code (#305)',
        'CHANGELOG entry: VS Code color settings\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'VS Code color settings (#305)',
          subject: 'VS Code color settings',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('does not convert when the leading word is a noun (followed by "for")', async () => {
      const result = await runWithEntry(
        'feat: fix flow (#306)',
        'CHANGELOG entry: Fix for the crash on startup\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Fix for the crash on startup (#306)',
          subject: 'Fix for the crash on startup',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('does not convert when the leading word is a noun (followed by "of")', async () => {
      const result = await runWithEntry(
        'fix: alignment (#309)',
        'CHANGELOG entry: Update of the deprecated dependency\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Update of the deprecated dependency (#309)',
          subject: 'Update of the deprecated dependency',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('does not convert when the leading verb is followed by a colon', async () => {
      // "Update:" is a label, not a sentence-leading verb; converting it to
      // "Updated:" would read wrongly.
      const result = await runWithEntry(
        'chore: label (#310)',
        'CHANGELOG entry: Update: refreshed the settings layout\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Update: refreshed the settings layout (#310)',
          subject: 'Update: refreshed the settings layout',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('does not convert when the leading verb is followed by a comma', async () => {
      const result = await runWithEntry(
        'chore: fragment (#311)',
        'CHANGELOG entry: Fix, then re-run the failing suite\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Fix, then re-run the failing suite (#311)',
          subject: 'Fix, then re-run the failing suite',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('does not convert when a coordinated second verb would be left present tense', async () => {
      const result = await runWithEntry(
        'chore: cleanup (#307)',
        'CHANGELOG entry: Remove legacy route messenger and migrate defaultProps\n',
      );

      expect(result).toStrictEqual([
        {
          description:
            'Remove legacy route messenger and migrate defaultProps (#307)',
          subject: 'Remove legacy route messenger and migrate defaultProps',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('converts the leading verb and strips a redundant trailing period together', async () => {
      const result = await runWithEntry(
        'feat: enable input (#308)',
        'CHANGELOG entry: Enable withdraw amount input without wallet tokens.\n',
      );

      expect(result).toStrictEqual([
        {
          description:
            'Enabled withdraw amount input without wallet tokens (#308)',
          subject: 'Enable withdraw amount input without wallet tokens.',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('converts a "Change" entry with a direct object', async () => {
      const result = await runWithEntry(
        'chore: rbtc icon (#309)',
        'CHANGELOG entry: Change the native asset icon (RBTC) for Rootstock\n',
      );

      expect(result).toStrictEqual([
        {
          description:
            'Changed the native asset icon (RBTC) for Rootstock (#309)',
          subject: 'Change the native asset icon (RBTC) for Rootstock',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('does not convert a plural "Changes ..." entry (not a known verb)', async () => {
      const result = await runWithEntry(
        'chore: assets (#310)',
        'CHANGELOG entry: Changes to display tron assets with new AssetsController\n',
      );

      expect(result).toStrictEqual([
        {
          description:
            'Changes to display tron assets with new AssetsController (#310)',
          subject: 'Changes to display tron assets with new AssetsController',
          hasChangelogEntry: true,
        },
      ]);
    });

    it('does not convert a "Change to ..." noun entry', async () => {
      const result = await runWithEntry(
        'chore: flow (#311)',
        'CHANGELOG entry: Change to the network selection flow\n',
      );

      expect(result).toStrictEqual([
        {
          description: 'Change to the network selection flow (#311)',
          subject: 'Change to the network selection flow',
          hasChangelogEntry: true,
        },
      ]);
    });
  });

  describe('GitHub token resolution (useChangelogEntry: true)', () => {
    const originalGithubToken = process.env.GITHUB_TOKEN; // eslint-disable-line node/no-process-env
    const originalCi = process.env.CI; // eslint-disable-line node/no-process-env

    beforeEach(() => {
      mockOctokit.mockImplementation(() => ({
        rest: { pulls: { get: mockPullsGet } },
      }));
      mockPullsGet.mockResolvedValue({ data: { labels: [] } });
      // eslint-disable-next-line node/no-process-env
      delete process.env.GITHUB_TOKEN;
      // eslint-disable-next-line node/no-process-env
      delete process.env.CI;
    });

    afterEach(() => {
      // eslint-disable-next-line node/no-process-env
      if (originalGithubToken === undefined) {
        // eslint-disable-next-line node/no-process-env
        delete process.env.GITHUB_TOKEN;
      } else {
        // eslint-disable-next-line node/no-process-env
        process.env.GITHUB_TOKEN = originalGithubToken;
      }
      // eslint-disable-next-line node/no-process-env
      if (originalCi === undefined) {
        // eslint-disable-next-line node/no-process-env
        delete process.env.CI;
      } else {
        // eslint-disable-next-line node/no-process-env
        process.env.CI = originalCi;
      }
    });

    /**
     * Run a single PR-tagged commit through `getNewChangeEntries` with the
     * `useChangelogEntry` path enabled and no explicit `%s`/`%b` mocks queued.
     *
     * @returns The resulting change entries.
     */
    async function run() {
      mockRunCommandAndSplit.mockResolvedValueOnce(['commit1']);
      return getNewChangeEntries({
        mostRecentTag: 'v1.0.0',
        repoUrl,
        loggedPrNumbers: [],
        loggedDescriptions: [],
        useChangelogEntry: true,
        useShortPrLink: true,
      });
    }

    it('falls back to `gh auth token` when GITHUB_TOKEN is unset and not on CI', async () => {
      // First `runCommand` call resolves the `gh auth token`, then the `%s`
      // and `%b` git calls for the single commit.
      mockRunCommand
        .mockResolvedValueOnce('gh-cli-token\n') // gh auth token
        .mockResolvedValueOnce('feat: do a thing (#500)') // %s
        .mockResolvedValueOnce(''); // %b

      await run();

      expect(mockRunCommand).toHaveBeenCalledWith('gh', ['auth', 'token']);
      expect(mockOctokit).toHaveBeenCalledWith({ auth: 'gh-cli-token' });
    });

    it('prefers GITHUB_TOKEN over the gh CLI when it is set', async () => {
      // eslint-disable-next-line node/no-process-env
      process.env.GITHUB_TOKEN = 'env-token';
      mockRunCommand
        .mockResolvedValueOnce('feat: do a thing (#501)') // %s
        .mockResolvedValueOnce(''); // %b

      await run();

      expect(mockRunCommand).not.toHaveBeenCalledWith('gh', ['auth', 'token']);
      expect(mockOctokit).toHaveBeenCalledWith({ auth: 'env-token' });
    });

    it('does not fall back to the gh CLI on CI and throws instead', async () => {
      // eslint-disable-next-line node/no-process-env
      process.env.CI = 'true';

      await expect(run()).rejects.toThrow(
        'GITHUB_TOKEN environment variable is not set',
      );
      expect(mockRunCommand).not.toHaveBeenCalledWith('gh', ['auth', 'token']);
    });

    it('throws when the gh CLI is unavailable or unauthenticated', async () => {
      mockRunCommand.mockRejectedValueOnce(new Error('gh: command not found'));

      await expect(run()).rejects.toThrow(
        'GITHUB_TOKEN environment variable is not set',
      );
    });
  });
});
