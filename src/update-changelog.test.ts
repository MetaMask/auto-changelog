import * as ChangeLogManager from './update-changelog';


const emptyChangelog = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
`;

describe('updateChangelog', () => {
  let getNewChangeEntriesSpy: jest.SpyInstance;

  beforeEach(() => {
    // Setup the spy and mock before each test
    // Assuming getNewChangeEntries returns a Promise<string[]>
    getNewChangeEntriesSpy = jest.spyOn(ChangeLogManager, 'getNewChangeEntries')
      .mockResolvedValue([
        'fix: fixed a major bug',
        'feat: introduced a new feature',
        'unknown: some non-conventional commit'
      ]);
  });

  afterEach(() => {
    // Restore the original function after each test
    getNewChangeEntriesSpy.mockRestore();
  });

  it('should contain conventional support mappings categorization when autoCategorize is true', async () => {
    const result = await ChangeLogManager.updateChangelog({
      changelogContent: emptyChangelog,
      currentVersion: '1.0.0',
      repoUrl: 'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      isReleaseCandidate: true,
      autoCategorize: true,
    });

    expect(result).toContain('### Fixed');
    expect(result).toContain('### Added');
    expect(result).not.toContain('### Uncategorized');
  });

  it('should not contain conventional support mappings categorization when autoCategorize is false', async () => {
    const result = await ChangeLogManager.updateChangelog({
      changelogContent: emptyChangelog,
      currentVersion: '1.0.0',
      repoUrl: 'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      isReleaseCandidate: true,
      autoCategorize: false,
    });

    expect(result).toContain('### Uncategorized');
    expect(result).not.toContain('### Fixed');
    expect(result).not.toContain('### Added');
  });
});
