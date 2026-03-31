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
  },
  {
    description: 'New cool feature (#124)',
    subject: 'feat: New cool feature (#124)',
  },
  {
    description: 'Release thingy (#124)',
    subject: 'release: Release thingy (#124)',
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
});

describe('updateChangelog entry order', () => {
  it('should add entries in chronological order (earliest first)', async () => {
    // getNewChangeEntries returns commits in reverse chronological order
    // (newest first) because git rev-list outputs newest commits first.
    const newestFirstEntries = [
      {
        description: 'Third commit (#103)',
        subject: 'Third commit (#103)',
      },
      {
        description: 'Second commit (#102)',
        subject: 'Second commit (#102)',
      },
      {
        description: 'First commit (#101)',
        subject: 'First commit (#101)',
      },
    ];
    jest
      .spyOn(ChangeLogUtils, 'getNewChangeEntries')
      .mockResolvedValue(newestFirstEntries);

    const result = await ChangeLogManager.updateChangelog({
      ...changelogData,
      autoCategorize: false,
    });

    // In the changelog, entries should appear in forward chronological
    // order (earliest first), matching natural reading order.
    expect(result).toBeDefined();
    const changelog = result as string;
    const firstIndex = changelog.indexOf('First commit (#101)');
    const secondIndex = changelog.indexOf('Second commit (#102)');
    const thirdIndex = changelog.indexOf('Third commit (#103)');

    expect(firstIndex).toBeLessThan(secondIndex);
    expect(secondIndex).toBeLessThan(thirdIndex);
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
});
