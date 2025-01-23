import * as ChangeLogManager from './update-changelog';

const uncategorizedChangelog = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0]
### Uncategorized
- fix: a commit of the type fix patches a bug in your codebase
- feat: a commit of the type feat introduces a new feature to the codebase
- unknown: a commit of the type unknown does not match any of the conventional commit types

[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
`;

describe('updateChangelog', () => {
  it('should contain conventional support mappings categorization', async () => {
    // Call updateChangelog, which internally calls the mocked getNewChangeEntries
    const result = await ChangeLogManager.updateChangelog({
      changelogContent: uncategorizedChangelog,
      currentVersion: '1.0.0',
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      isReleaseCandidate: true,
      autoCategorize: true,
    });

    // Verify that some of the commits are included in the result
    expect(result).toContain('### Added');
    expect(result).toContain('### Fixed');
  });

  it('should not contain conventional support mappings categorization', async () => {
    // Call updateChangelog, which internally calls the mocked getNewChangeEntries
    const result = await ChangeLogManager.updateChangelog({
      changelogContent: uncategorizedChangelog,
      currentVersion: '1.0.0',
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      isReleaseCandidate: true,
      autoCategorize: false,
    });

    // Verify that some of the commits are included in the result
    expect(result).toContain('### Uncategorized');
    expect(result).not.toContain('### Fixed');
  });
});
