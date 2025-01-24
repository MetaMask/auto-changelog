// Place this at the very top of your test file
jest.mock('./update-changelog', () => {
  const originalModule = jest.requireActual('./update-changelog'); // Get the actual module
  return {
    ...originalModule, // spread all actual exports
    getNewChangeEntries: jest.fn().mockResolvedValue([
      'fix: Fixed a critical bug',
      'feat: Added new feature [PR#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/123)'
    ])
  };
});

import * as ChangeLogManager from './update-changelog';


const emptyChangelog = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
`;

describe('updateChangelog', () => {

  it('should contain conventional support mappings categorization when autoCategorize is true', async () => {

    // TRIED WITH AND WITHOUT THIS LINE
    jest.spyOn(ChangeLogManager, 'getNewChangeEntries').mockResolvedValue([
      'fix: Fixed a critical bug',
'feat: Added new feature [PR#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/123)'
]);

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
    
    // TRIED WITH AND WITHOUT THIS LINE
    jest.spyOn(ChangeLogManager, 'getNewChangeEntries').mockResolvedValue([
            'fix: Fixed a critical bug',
      'feat: Added new feature [PR#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/123)'
    ]);

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
