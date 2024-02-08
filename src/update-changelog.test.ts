import { updateChangelog } from './update-changelog';

const emptyChangelog = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
`;

const changelogWithReleases = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2020-01-01
### Changed
- Something else

## [0.0.2] - 2020-01-01
### Fixed
- Something

## [0.0.1] - 2020-01-01
### Changed
- Something

[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
[0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1
`;

const changelogWithUnreleasedChanges = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- Something unreleased

### Fixed
- Something else unreleased

## [1.0.0] - 2020-01-01
### Changed
- Something else

## [0.0.2] - 2020-01-01
### Fixed
- Something

## [0.0.1] - 2020-01-01
### Changed
- Something

[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
[0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1
`;

const updatedChangelog = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1]
### Changed
- Something unreleased

### Fixed
- Something else unreleased

## [1.0.0] - 2020-01-01
### Changed
- Something else

## [0.0.2] - 2020-01-01
### Fixed
- Something

## [0.0.1] - 2020-01-01
### Changed
- Something

[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
[1.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
[0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1
`;

describe('updateChangelog', () => {
  describe('is a release candidate', () => {
    it.only('should throw if the `currentVersion` option is not specified', async () => {
      expect(
        // @ts-expect-error - We're testing invalid input.
        await updateChangelog({
          isReleaseCandidate: true,
          changelogContent: emptyChangelog,
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        }),
      ).toThrow(`A version must be specified if 'isReleaseCandidate' is set.`);
    });

    it('should throw if the `currentVersion` option is set to the same version as the most recent tag.', async () => {
      expect(
        await updateChangelog({
          isReleaseCandidate: true,
          changelogContent: changelogWithReleases,
          currentVersion: '1.0.0',
          tagPrefixes: ['v'],
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        }),
      ).toThrow(
        `Current version already has a tag ('v1.0.0'), which is unexpected for a release candidate.`,
      );
    });
  });

  it('should return undefined if there are no unreleased changes', async () => {
    const result = await updateChangelog({
      isReleaseCandidate: false,
      changelogContent: changelogWithReleases,
      currentVersion: '1.0.1',
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });
    expect(result).toBeUndefined();
  });

  it('should return an updated changelog that includes all unreleased changes under the `currentVersion` header', async () => {
    const result = await updateChangelog({
      isReleaseCandidate: false,
      changelogContent: changelogWithUnreleasedChanges,
      currentVersion: '1.0.0',
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });
    expect(result).toBe(updatedChangelog);
  });
});
