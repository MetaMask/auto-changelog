import { ChangeCategory } from './constants';
import * as ChangeLogUtils from './get-new-changes';
import * as ChangeLogManager from './update-changelog';
import { getCategory } from './update-changelog';

const emptyChangelog = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
`;

const getNewChangeEntriesMockData = [
  {
    description: 'Fixed a critical bug (#123)',
    subject: 'fix: Fixed a critical bug (#123)',
    hasChangelogEntry: false,
  },
  {
    description: 'New cool feature (#124)',
    subject: 'feat: New cool feature (#124)',
    hasChangelogEntry: false,
  },
  {
    description: 'Release thingy (#124)',
    subject: 'release: Release thingy (#124)',
    hasChangelogEntry: false,
  },
];

const changelogData = {
  changelogContent: emptyChangelog,
  currentVersion: '1.0.0',
  repoUrl: 'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
  isReleaseCandidate: true,
  autoCategorize: true,
  useChangelogEntry: false,
  useShortPrLink: true,
};

const releaseChangelog = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0]

### Fixed
- A previously listed change (#123)

[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
[1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.9.0...v1.0.0
`;

describe('updateChangelog', () => {
  it('should contain conventional support mappings categorization when autoCategorize is true', async () => {
    jest
      .spyOn(ChangeLogUtils, 'getNewChangeEntries')
      .mockResolvedValue(getNewChangeEntriesMockData);

    const result = await ChangeLogManager.updateChangelog({
      ...changelogData,
      autoCategorize: true,
    });

    expect(result).toContain('### Fixed');
    expect(result).toContain('### Added');
    expect(result).not.toContain('### Uncategorized');
  });

  it('should not contain conventional support mappings categorization when autoCategorize is false', async () => {
    jest
      .spyOn(ChangeLogUtils, 'getNewChangeEntries')
      .mockResolvedValue(getNewChangeEntriesMockData);

    const result = await ChangeLogManager.updateChangelog({
      ...changelogData,
      autoCategorize: false,
    });

    expect(result).toContain('### Uncategorized');
    expect(result).not.toContain('### Fixed');
    expect(result).not.toContain('### Added');
  });

  it('should support useChangelogEntry=true', async () => {
    jest
      .spyOn(ChangeLogUtils, 'getNewChangeEntries')
      .mockResolvedValue(getNewChangeEntriesMockData);

    const result = await ChangeLogManager.updateChangelog({
      ...changelogData,
      useChangelogEntry: true,
    });

    expect(result).toContain('### Added\n- New cool feature (#124)');
    expect(result).toContain('### Fixed\n- Fixed a critical bug (#123)');
  });

  it('should have default values for useChangelogEntry and useShortPrLink', async () => {
    jest
      .spyOn(ChangeLogUtils, 'getNewChangeEntries')
      .mockResolvedValue(getNewChangeEntriesMockData);

    const result = await ChangeLogManager.updateChangelog({
      ...changelogData,
      useChangelogEntry: undefined,
      useShortPrLink: undefined,
    });

    expect(result).toContain('### Added\n- New cool feature (#124)');
    expect(result).toContain('### Fixed\n- Fixed a critical bug (#123)');
  });

  it('logs emitted changelog entries when verbose is enabled', async () => {
    jest
      .spyOn(ChangeLogUtils, 'getNewChangeEntries')
      .mockResolvedValue(getNewChangeEntriesMockData);
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await ChangeLogManager.updateChangelog({
      ...changelogData,
      verbose: true,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      '[auto-changelog] emitted category=Fixed description="Fixed a critical bug (#123)"',
    );
    errorSpy.mockRestore();
  });

  it('passes only target release PRs to the backfill guard', async () => {
    const getNewChangeEntriesSpy = jest
      .spyOn(ChangeLogUtils, 'getNewChangeEntries')
      .mockResolvedValue([]);

    await ChangeLogManager.updateChangelog({
      ...changelogData,
      changelogContent: releaseChangelog,
      currentVersion: '1.0.0',
      preventBackfill: true,
    });

    expect(getNewChangeEntriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        preventBackfill: true,
        targetSectionPrNumbers: ['123'],
      }),
    );
  });
});

describe('getCategory', () => {
  it('categorizes feat: prefix as Added', () => {
    const description = 'feat: add new feature';
    expect(getCategory(description)).toBe(ChangeCategory.Added);
  });

  it('categorizes fix: prefix as Fixed', () => {
    const description = 'fix: resolve bug issue';
    expect(getCategory(description)).toBe(ChangeCategory.Fixed);
  });

  it('finds category even if title has spaces', () => {
    const description = 'feat : add new feature';
    expect(getCategory(description)).toBe(ChangeCategory.Added);
  });

  it('returns Uncategorized for unknown prefix', () => {
    const description = 'foo: update documentation';
    expect(getCategory(description)).toBe(ChangeCategory.Uncategorized);
  });

  it('returns Uncategorized for title without colon', () => {
    const description = 'just a regular commit message';
    expect(getCategory(description)).toBe(ChangeCategory.Uncategorized);
  });

  it('returns Uncategorized for empty title', () => {
    const description = '';
    expect(getCategory(description)).toBe(ChangeCategory.Uncategorized);
  });

  it('returns category in title with multiple colons', () => {
    const description = 'feat: add new feature: with details';
    expect(getCategory(description)).toBe(ChangeCategory.Added);
  });

  // according to Conventional Commit practice, category can be followed by a scope
  // see https://www.conventionalcommits.org/en/v1.0.0/
  it('returns category with category scope', () => {
    const description = 'feat(bridge): add new feature for the bridge scope';
    expect(getCategory(description)).toBe(ChangeCategory.Added);
  });

  describe('leading-verb categorization (no usable prefix)', () => {
    it('categorizes an entry starting with "Fixed" as Fixed', () => {
      expect(getCategory('Fixed a bug in the send flow')).toBe(
        ChangeCategory.Fixed,
      );
    });

    it('categorizes an entry starting with "Added" as Added', () => {
      expect(getCategory('Added a new settings tab')).toBe(
        ChangeCategory.Added,
      );
    });

    it('categorizes an entry starting with "Removed" as Removed', () => {
      expect(getCategory('Removed old token import flow')).toBe(
        ChangeCategory.Removed,
      );
    });

    it('categorizes an entry starting with "Updated" as Changed', () => {
      expect(getCategory('Updated the notifications UI')).toBe(
        ChangeCategory.Changed,
      );
    });

    it.each(['Update the notifications UI', 'Bump the controller version'])(
      'categorizes an imperative %s entry as Changed',
      (description) => {
        expect(getCategory(description)).toBe(ChangeCategory.Changed);
      },
    );

    it('categorizes an entry starting with "Deprecated" as Deprecated', () => {
      expect(getCategory('Deprecated the legacy API')).toBe(
        ChangeCategory.Deprecated,
      );
    });

    it('categorizes an entry starting with "Improved" as Changed', () => {
      expect(getCategory('Improved the swap confirmation screen')).toBe(
        ChangeCategory.Changed,
      );
    });

    it.each([
      'Migrated asset routes to CAIP-19 identifiers',
      'Migrate asset routes to CAIP-19 identifiers',
    ])('categorizes %s as Changed', (description) => {
      expect(getCategory(description)).toBe(ChangeCategory.Changed);
    });

    it('is case-insensitive on the leading verb', () => {
      expect(getCategory('fixed a lowercase-verb entry')).toBe(
        ChangeCategory.Fixed,
      );
    });

    it('lets the leading verb categorize a chore entry with a changelog entry', () => {
      // A `chore:` prefix carries no category, so when the author wrote a
      // `CHANGELOG entry:` the leading verb of the remaining text is used.
      expect(getCategory('chore: Removed old token import flow', true)).toBe(
        ChangeCategory.Removed,
      );
    });

    it('does not guess a category for an entry without a recognized verb', () => {
      expect(getCategory('Ux changes')).toBe(ChangeCategory.Uncategorized);
    });

    it('prefers a concrete conventional prefix over the leading verb', () => {
      // `fix:` maps to Fixed regardless of the following verb.
      expect(getCategory('fix: Added handling for the edge case')).toBe(
        ChangeCategory.Fixed,
      );
    });

    it('categorizes a category-less prefix (perf) by its leading verb', () => {
      // `perf:` carries no category, so the prefix is stripped and the
      // remaining leading verb ("Improved") categorizes the entry.
      expect(getCategory('perf: Improved the swap load time')).toBe(
        ChangeCategory.Changed,
      );
    });

    it('categorizes a category-less prefix (docs) by its leading verb', () => {
      expect(getCategory('docs: Added a troubleshooting guide')).toBe(
        ChangeCategory.Added,
      );
    });

    it('categorizes a bump prefix by its leading verb', () => {
      expect(getCategory('bump: Bumped the base controller to v10')).toBe(
        ChangeCategory.Changed,
      );
    });

    it('returns Uncategorized for a category-less prefix without a recognized verb', () => {
      expect(getCategory('perf: micro-optimize the render loop')).toBe(
        ChangeCategory.Uncategorized,
      );
    });
  });

  describe('chore commits without a CHANGELOG entry', () => {
    it('excludes a chore commit that has no authored changelog entry', () => {
      expect(
        getCategory(
          'chore: migrate MOBILE_BUNDLESIZE_TOKEN to OIDC token exchange',
          false,
        ),
      ).toBe(ChangeCategory.Excluded);
    });

    it('includes a chore commit by default when it has no changelog entry', () => {
      expect(getCategory('chore: bump some internal dependency')).toBe(
        ChangeCategory.Changed,
      );
    });

    it('includes a chore commit when an authored changelog entry exists', () => {
      expect(getCategory('chore: some internal refactor', true)).toBe(
        ChangeCategory.Uncategorized,
      );
    });

    it('includes a scoped chore commit by default when it has no changelog entry', () => {
      expect(getCategory('chore(deps): bump lockfile', false)).toBe(
        ChangeCategory.Changed,
      );
    });

    it('excludes a chore commit with no changelog entry when enabled', () => {
      expect(
        getCategory('chore: bump some internal dependency', false, true),
      ).toBe(ChangeCategory.Excluded);
    });

    it('excludes a scoped chore commit with no changelog entry when enabled', () => {
      expect(getCategory('chore(deps): bump lockfile', false, true)).toBe(
        ChangeCategory.Excluded,
      );
    });
  });

  describe('exclusion keyword matching', () => {
    it('excludes an entry whose description contains a keyword as a whole word', () => {
      expect(getCategory('Migrated a token to OIDC token exchange', true)).toBe(
        ChangeCategory.Excluded,
      );
    });

    it('does not exclude an entry that merely contains a keyword as a substring', () => {
      // "oidc" appears inside "avoidcache" but must not trigger exclusion.
      expect(getCategory('Fixed avoidcache logic', true)).toBe(
        ChangeCategory.Fixed,
      );
    });

    it('still matches a hyphenated ticket-style keyword (cp-, INFRA-)', () => {
      expect(getCategory('cp-1234 backport the fix', true)).toBe(
        ChangeCategory.Excluded,
      );
      expect(getCategory('INFRA-999 update the pipeline', true)).toBe(
        ChangeCategory.Excluded,
      );
    });

    it('does not exclude a longer word that merely starts with a keyword', () => {
      // "e2ee" must not be excluded by the "e2e" keyword.
      expect(getCategory('Improved the e2ee handshake', true)).toBe(
        ChangeCategory.Changed,
      );
    });
  });
});
