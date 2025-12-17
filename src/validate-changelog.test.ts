/* eslint-disable jest/no-restricted-matchers */

import _outdent from 'outdent';

import { format } from './changelog';
import { validateChangelog } from './validate-changelog';

const outdent = _outdent({ trimTrailingNewline: false });

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

const branchingChangelog = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.3] - 2020-01-01
### Fixed
- Security fix

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
[0.0.3]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v0.0.3
[1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
[0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1
`;

const backportChangelog = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.3] - 2020-01-01
### Fixed
- Security fix

## [0.0.2] - 2020-01-01
### Fixed
- Something

## [1.0.0] - 2020-01-01
### Changed
- Something else

[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
[0.0.3]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.2
[1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
`;

const prettierChangelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1] - 2023-03-05

### Added

- Feature A
- Feature B

### Changed

- Feature D

### Fixed

- Bug C

## [1.0.0] - 2017-06-20

### Added

- Feature A
- Feature B

[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...v1.1.1
[1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
`;

const changelogWithRenamedPackage = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2020-01-01
### Changed
- package renamed

## [0.0.2] - 2020-01-01
### Fixed
- Something

## [0.0.1] - 2020-01-01
### Changed
- Something

[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/@metamask/test@1.0.0...HEAD
[1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/test@0.0.2...@metamask/test@1.0.0
[0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/test@0.0.1...test@0.0.2
[0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/test@0.0.1
`;

describe('validateChangelog', () => {
  it('should not throw for any empty valid changelog', async () => {
    await expect(
      validateChangelog({
        changelogContent: emptyChangelog,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).resolves.not.toThrow();
  });

  it('should not throw for a valid changelog with multiple releases', async () => {
    await expect(
      validateChangelog({
        changelogContent: changelogWithReleases,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).resolves.not.toThrow();
  });

  it('should not throw for changelog with branching releases', async () => {
    await expect(
      validateChangelog({
        changelogContent: branchingChangelog,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).resolves.not.toThrow();
  });

  it('should not throw when the first release is not the first numerically', async () => {
    await expect(
      validateChangelog({
        changelogContent: backportChangelog,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).resolves.not.toThrow();
  });

  it('should throw for an empty string', async () => {
    await expect(
      validateChangelog({
        changelogContent: '',
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Failed to find Unreleased header');
  });

  it('should throw when the title is different', async () => {
    const changelogWithDifferentTitle = changelogWithReleases.replace(
      '# Changelog',
      '# Custom Title',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithDifferentTitle,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Changelog is not well-formatted');
  });

  it('should throw when the changelog description is different', async () => {
    const changelogWithDifferentDescription = changelogWithReleases.replace(
      'All notable changes',
      'A random assortment of changes',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithDifferentDescription,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Changelog is not well-formatted');
  });

  it('should throw when there are whitespace changes', async () => {
    const changelogWithExtraWhitespace = `${changelogWithReleases}\n`;
    await expect(
      validateChangelog({
        changelogContent: changelogWithExtraWhitespace,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Changelog is not well-formatted');
  });

  it('should throw when a release header is malformed', async () => {
    const changelogWithMalformedReleaseHeader = changelogWithReleases.replace(
      '[1.0.0] - 2020-01-01',
      '1.0.0 - 2020-01-01',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithMalformedReleaseHeader,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow(`Unrecognized line: '## 1.0.0 - 2020-01-01'`);
  });

  it('should throw when there are extraneous header contents', async () => {
    const changelogWithExtraHeaderContents = changelogWithReleases.replace(
      '[1.0.0] - 2020-01-01',
      '[1.0.0] - 2020-01-01 [extra contents]',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithExtraHeaderContents,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Changelog is not well-formatted');
  });

  it('should throw when a change category is unrecognized', async () => {
    const changelogWithUnrecognizedChangeCategory =
      changelogWithReleases.replace('### Changed', '### Updated');
    await expect(
      validateChangelog({
        changelogContent: changelogWithUnrecognizedChangeCategory,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow(`Invalid change category: 'Updated'`);
  });

  it('should throw when the Unreleased section is missing', async () => {
    const changelogWithoutUnreleased = changelogWithReleases.replace(
      /## \[Unreleased\]\n\n/u,
      '',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithoutUnreleased,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Failed to find Unreleased header');
  });

  it('should throw if the wrong repo URL is used', async () => {
    await expect(
      validateChangelog({
        changelogContent: changelogWithReleases,
        currentVersion: '1.0.0',
        repoUrl: 'https://github.com/DifferentOrganization/DifferentRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Changelog is not well-formatted');
  });

  it('should throw if a comparison release link is missing', async () => {
    const changelogWithoutReleaseLink = changelogWithReleases.replace(
      '[1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0\n',
      '',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithoutReleaseLink,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Changelog is not well-formatted');
  });

  it('should throw if the first release link is missing', async () => {
    const changelogWithoutFirstReleaseLink = changelogWithReleases.replace(
      '[0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1\n',
      '',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithoutFirstReleaseLink,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Changelog is not well-formatted');
  });

  it('should throw if release links are in a different order than the release headers', async () => {
    const thirdReleaseLink =
      '[1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0';
    const secondReleaseLink =
      '[0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2';
    const changelogWithoutFirstReleaseLink = changelogWithReleases.replace(
      `${thirdReleaseLink}\n${secondReleaseLink}`,
      `${secondReleaseLink}\n${thirdReleaseLink}`,
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithoutFirstReleaseLink,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Changelog is not well-formatted');
  });

  it(`should throw if the highest version isn't compared with the Unreleased changes`, async () => {
    const changelogWithInvalidUnreleasedComparison = branchingChangelog.replace(
      '[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD',
      '[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.3...HEAD',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithInvalidUnreleasedComparison,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Changelog is not well-formatted');
  });

  it('should throw if there are decreasing comparisons', async () => {
    const changelogWithDecreasingComparison = branchingChangelog.replace(
      '[0.0.3]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v0.0.3',
      '[0.0.3]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...v0.0.3',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithDecreasingComparison,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Changelog is not well-formatted');
  });

  it('should throw if the unreleased link points at anything other than the bare repository when there are no releases', async () => {
    const changelogWithIncorrectUnreleasedLink = emptyChangelog.replace(
      '[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/',
      '[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithIncorrectUnreleasedLink,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Changelog is not well-formatted');
  });

  it('should throw if the bare unreleased link is missing a trailing slash', async () => {
    const changelogWithoutUnreleasedLinkTrailingSlash = emptyChangelog.replace(
      '[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/',
      '[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithoutUnreleasedLinkTrailingSlash,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow('Changelog is not well-formatted');
  });

  it('should throw if a change category is missing', async () => {
    const changelogWithoutChangeCategory = changelogWithReleases.replace(
      '### Changed\n',
      '',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithoutChangeCategory,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow("Category missing for change: '- Something else'");
  });

  it("should throw if a change isn't prefixed by '- '", async () => {
    const changelogWithInvalidChangePrefix = changelogWithReleases.replace(
      '- Something',
      'Something',
    );
    await expect(
      validateChangelog({
        changelogContent: changelogWithInvalidChangePrefix,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).rejects.toThrow(`Unrecognized line: 'Something else'`);
  });

  describe('is not a release candidate', () => {
    it('should not throw if the current version release header is missing', async () => {
      await expect(
        validateChangelog({
          changelogContent: changelogWithReleases,
          currentVersion: '1.0.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).resolves.not.toThrow();
    });

    it('should not throw if the changelog is empty', async () => {
      await expect(
        validateChangelog({
          changelogContent: emptyChangelog,
          currentVersion: '1.0.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).resolves.not.toThrow();
    });

    it('should not throw if the changelog has an empty release', async () => {
      const changelogWithEmptyRelease = changelogWithReleases.replace(
        '## [1.0.0] - 2020-01-01\n### Changed\n- Something else\n',
        '## [1.0.0] - 2020-01-01\n',
      );
      await expect(
        validateChangelog({
          changelogContent: changelogWithEmptyRelease,
          currentVersion: '1.0.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).resolves.not.toThrow();
    });

    it('should throw if the changelog has an empty change category', async () => {
      const changelogWithEmptyChangeCategory = changelogWithReleases.replace(
        '## [1.0.0] - 2020-01-01\n### Changed\n- Something else\n',
        '## [1.0.0] - 2020-01-01\n### Changed\n',
      );
      await expect(
        validateChangelog({
          changelogContent: changelogWithEmptyChangeCategory,
          currentVersion: '1.0.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).rejects.toThrow('Changelog is not well-formatted');
    });

    it('should not throw if there are unreleased changes', async () => {
      const changelogWithUnreleasedChanges = changelogWithReleases.replace(
        '## [Unreleased]',
        '## [Unreleased]\n### Changed\n- More changes',
      );
      await expect(
        validateChangelog({
          changelogContent: changelogWithUnreleasedChanges,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).resolves.not.toThrow();
    });

    it('should not throw if there are uncategorized changes in the current release', async () => {
      const changelogWithUnreleasedChanges = changelogWithReleases.replace(
        '## [1.0.0] - 2020-01-01',
        '## [1.0.0] - 2020-01-01\n### Uncategorized\n- More changes\n',
      );
      await expect(
        validateChangelog({
          changelogContent: changelogWithUnreleasedChanges,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).resolves.not.toThrow();
    });

    it('should not throw if there are uncategorized changes in an older release', async () => {
      const changelogWithUnreleasedChanges = changelogWithReleases.replace(
        '## [0.0.2] - 2020-01-01',
        '## [0.0.2] - 2020-01-01\n### Uncategorized\n- More changes\n',
      );
      await expect(
        validateChangelog({
          changelogContent: changelogWithUnreleasedChanges,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('is a release candidate', () => {
    it('should not throw for a valid changelog with multiple releases', async () => {
      await expect(
        validateChangelog({
          changelogContent: changelogWithReleases,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: true,
        }),
      ).resolves.not.toThrow();
    });

    it('should not throw if the changelog has an empty release', async () => {
      const changelogWithEmptyRelease = changelogWithReleases.replace(
        '## [1.0.0] - 2020-01-01\n### Changed\n- Something else\n',
        '## [1.0.0] - 2020-01-01\n',
      );
      await expect(
        validateChangelog({
          changelogContent: changelogWithEmptyRelease,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: true,
        }),
      ).resolves.not.toThrow();
    });

    it('should throw if the changelog has an empty change category', async () => {
      const changelogWithEmptyChangeCategory = changelogWithReleases.replace(
        '## [1.0.0] - 2020-01-01\n### Changed\n- Something else\n',
        '## [1.0.0] - 2020-01-01\n### Changed\n',
      );
      await expect(
        validateChangelog({
          changelogContent: changelogWithEmptyChangeCategory,
          currentVersion: '1.0.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).rejects.toThrow('Changelog is not well-formatted');
    });

    it('should throw if the current version release header is missing', async () => {
      await expect(
        validateChangelog({
          changelogContent: changelogWithReleases,
          currentVersion: '1.0.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: true,
        }),
      ).rejects.toThrow(`Current version missing from changelog: '1.0.1'`);
    });

    it('should throw if there are unreleased changes', async () => {
      const changelogWithUnreleasedChanges = changelogWithReleases.replace(
        '## [Unreleased]',
        '## [Unreleased]\n### Changed\n- More changes',
      );
      await expect(
        validateChangelog({
          changelogContent: changelogWithUnreleasedChanges,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: true,
        }),
      ).rejects.toThrow('Unreleased changes present in the changelog');
    });

    it('should throw if there are uncategorized changes in the current release', async () => {
      const changelogWithUnreleasedChanges = changelogWithReleases.replace(
        '## [1.0.0] - 2020-01-01',
        '## [1.0.0] - 2020-01-01\n### Uncategorized\n- More changes\n',
      );
      await expect(
        validateChangelog({
          changelogContent: changelogWithUnreleasedChanges,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: true,
        }),
      ).rejects.toThrow('Uncategorized changes present in the changelog');
    });

    it('should not throw if there are uncategorized changes in an older release', async () => {
      const changelogWithUnreleasedChanges = changelogWithReleases.replace(
        '## [0.0.2] - 2020-01-01',
        '## [0.0.2] - 2020-01-01\n### Uncategorized\n- More changes\n',
      );
      await expect(
        validateChangelog({
          changelogContent: changelogWithUnreleasedChanges,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: true,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('formatted changelog', () => {
    it("doesn't throw if the changelog is formatted with prettier", async () => {
      await expect(
        validateChangelog({
          changelogContent: prettierChangelog,
          currentVersion: '1.1.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
          formatter: format,
        }),
      ).resolves.not.toThrow();
    });
  });

  // when the package has been renamed from `test` to `@metamast/test`
  it('should not throw for a valid changelog with renamed package', async () => {
    await expect(
      validateChangelog({
        changelogContent: changelogWithRenamedPackage,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
        tagPrefix: '@metamask/test@',
        packageRename: {
          versionBeforeRename: '0.0.2',
          tagPrefixBeforeRename: 'test@',
        },
      }),
    ).resolves.not.toThrow();
  });

  describe('if ensureValidPrLinksPresent is true', () => {
    it('should throw if some entries in the changelog have no PR links', async () => {
      const changelogContent = outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        ## [1.0.0]
        ### Changed
        - Change something else ([#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/123))

        ## [0.0.2]
        ### Fixed
        - Fix something

        ## [0.0.1]
        ### Added
        - Initial release ([#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/123))

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
        [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
        [0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2
        [0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1
      `;

      await expect(
        validateChangelog({
          changelogContent,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
          ensureValidPrLinksPresent: true,
        }),
      ).rejects.toThrow(
        "Pull request link(s) missing for change: 'Fix something' (in 0.0.2)",
      );
    });

    it('should throw if some entries in the changelog have PR links to the wrong repo', async () => {
      const changelogContent = outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        ## [1.0.0]
        ### Changed
        - Change something else ([#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/123))

        ## [0.0.2]
        ### Fixed
        - Fix something ([#123](https://github.com/foo/bar/pull/123))

        ## [0.0.1]
        ### Added
        - Initial release ([#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/123))

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
        [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
        [0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2
        [0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1
      `;

      // The links to other repos are not recognized as PR links, which is why in this example
      // the error is about 'missing PR link', not invalid one.
      await expect(
        validateChangelog({
          changelogContent,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
          ensureValidPrLinksPresent: true,
        }),
      ).rejects.toThrow(
        `Pull request link(s) missing for change: 'Fix something ([#123](https://github.com/foo/bar/pull/123))' (in 0.0.2)`,
      );
    });
  });

  describe('if ensureValidPrLinksPresent is false', () => {
    it('should not throw if some entries in the changelog have no PR links', async () => {
      const changelogContent = outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        ## [1.0.0]
        ### Changed
        - Change something else ([#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/123))

        ## [0.0.2]
        ### Fixed
        - Fix something

        ## [0.0.1]
        ### Added
        - Initial release ([#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/123))

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
        [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
        [0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2
        [0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1
      `;

      await expect(
        validateChangelog({
          changelogContent,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
          ensureValidPrLinksPresent: false,
        }),
      ).resolves.not.toThrow();
    });

    it('should not throw if some entries in the changelog have PR links to the wrong repo', async () => {
      const changelogContent = outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        ## [1.0.0]
        ### Changed
        - Change something else ([#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/123))

        ## [0.0.2]
        ### Fixed
        - Fix something ([#123](https://github.com/foo/bar/pull/123))

        ## [0.0.1]
        ### Added
        - Initial release ([#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/123))

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
        [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
        [0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2
        [0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1
      `;

      await expect(
        validateChangelog({
          changelogContent,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
          ensureValidPrLinksPresent: false,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('dependency bump validation', () => {
    const repoUrl =
      'https://github.com/ExampleUsernameOrOrganization/ExampleRepository';

    it('passes when dependency changes are found in changelog', async () => {
      const changelogContent = outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]
        ### Changed
        - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${repoUrl}/pull/123))

        [Unreleased]: ${repoUrl}/
      `;

      await expect(
        validateChangelog({
          changelogContent,
          repoUrl,
          isReleaseCandidate: false,
          dependencyResult: {
            dependencyChanges: [
              {
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        }),
      ).resolves.not.toThrow();
    });

    it('throws MissingDependencyEntriesError when dependency entry is missing', async () => {
      const changelogContent = outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        [Unreleased]: ${repoUrl}/
      `;

      await expect(
        validateChangelog({
          changelogContent,
          repoUrl,
          isReleaseCandidate: false,
          dependencyResult: {
            dependencyChanges: [
              {
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        }),
      ).rejects.toThrow('Missing changelog entries for dependency bumps');
    });

    it('validates peerDependency entry with BREAKING prefix', async () => {
      const changelogContent = outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]
        ### Changed
        - **BREAKING:** Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${repoUrl}/pull/123))

        [Unreleased]: ${repoUrl}/
      `;

      await expect(
        validateChangelog({
          changelogContent,
          repoUrl,
          isReleaseCandidate: false,
          dependencyResult: {
            dependencyChanges: [
              {
                dependency: '@scope/b',
                type: 'peerDependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        }),
      ).resolves.not.toThrow();
    });

    it('fails when peerDependency entry lacks BREAKING prefix', async () => {
      const changelogContent = outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]
        ### Changed
        - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${repoUrl}/pull/123))

        [Unreleased]: ${repoUrl}/
      `;

      await expect(
        validateChangelog({
          changelogContent,
          repoUrl,
          isReleaseCandidate: false,
          dependencyResult: {
            dependencyChanges: [
              {
                dependency: '@scope/b',
                type: 'peerDependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        }),
      ).rejects.toThrow('Missing changelog entries for dependency bumps');
    });

    it('validates entry in release version section when versionBump provided', async () => {
      const changelogContent = outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        ## [2.0.0]
        ### Changed
        - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${repoUrl}/pull/123))

        [Unreleased]: ${repoUrl}/compare/v2.0.0...HEAD
        [2.0.0]: ${repoUrl}/releases/tag/v2.0.0
      `;

      await expect(
        validateChangelog({
          changelogContent,
          currentVersion: '2.0.0',
          repoUrl,
          isReleaseCandidate: false,
          dependencyResult: {
            dependencyChanges: [
              {
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
            versionBump: '2.0.0',
          },
        }),
      ).resolves.not.toThrow();
    });

    it('treats all entries as missing when Unreleased section is empty', async () => {
      const changelogContent = outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        [Unreleased]: ${repoUrl}/
      `;

      await expect(
        validateChangelog({
          changelogContent,
          repoUrl,
          isReleaseCandidate: false,
          dependencyResult: {
            dependencyChanges: [
              {
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        }),
      ).rejects.toThrow('Missing changelog entries for dependency bumps');
    });

    it('rejects regular dependency entry that has BREAKING prefix', async () => {
      const changelogContent = outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]
        ### Changed
        - **BREAKING:** Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](${repoUrl}/pull/123))

        [Unreleased]: ${repoUrl}/
      `;

      // Regular dependency should NOT have BREAKING prefix
      await expect(
        validateChangelog({
          changelogContent,
          repoUrl,
          isReleaseCandidate: false,
          dependencyResult: {
            dependencyChanges: [
              {
                dependency: '@scope/b',
                type: 'dependencies',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
              },
            ],
          },
        }),
      ).rejects.toThrow('Missing changelog entries for dependency bumps');
    });

    it('does not validate dependency changes when none provided', async () => {
      await expect(
        validateChangelog({
          changelogContent: emptyChangelog,
          repoUrl,
          isReleaseCandidate: false,
        }),
      ).resolves.not.toThrow();
    });
  });
});
