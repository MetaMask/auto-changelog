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

describe('updateChangelog', () => {
  it('should contain conventional support mappings categorization when autoCategorize is true', async () => {
    // Set up the spy and mock the implementation if needed
    jest.spyOn(ChangeLogUtils, 'getNewChangeEntries').mockResolvedValue([
      {
        description: 'Fixed a critical bug (#123)',
        subject: 'fix: Fixed a critical bug (#123)',
      },
      {
        description: 'New cool feature (#124)',
        subject: 'feat: New cool feature (#124)',
      },
    ]);

    const result = await ChangeLogManager.updateChangelog({
      changelogContent: emptyChangelog,
      currentVersion: '1.0.0',
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      isReleaseCandidate: true,
      autoCategorize: true,
      useChangelogEntry: false,
      useShortPrLink: false,
    });

    expect(result).toContain('### Fixed');
    expect(result).toContain('### Added');
    expect(result).not.toContain('### Uncategorized');
  });

  it('should not contain conventional support mappings categorization when autoCategorize is false', async () => {
    // Set up the spy and mock the implementation if needed
    jest.spyOn(ChangeLogUtils, 'getNewChangeEntries').mockResolvedValue([
      {
        description: 'Fixed a critical bug (#123)',
        subject: 'fix: Fixed a critical bug (#123)',
      },
      {
        description: 'New cool feature (#124)',
        subject: 'feat: New cool feature (#124)',
      },
    ]);

    const result = await ChangeLogManager.updateChangelog({
      changelogContent: emptyChangelog,
      currentVersion: '1.0.0',
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      isReleaseCandidate: true,
      autoCategorize: false,
      useChangelogEntry: false,
      useShortPrLink: false,
    });

    expect(result).toContain('### Uncategorized');
    expect(result).not.toContain('### Fixed');
    expect(result).not.toContain('### Added');
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
