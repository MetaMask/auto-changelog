import prettier from 'prettier';

import { validateChangelog } from './validate-changelog';

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
  it('should not throw for any empty valid changelog', () => {
    expect(() =>
      validateChangelog({
        changelogContent: emptyChangelog,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).not.toThrow();
  });

  it('should not throw for a valid changelog with multiple releases', () => {
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithReleases,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).not.toThrow();
  });

  it('should not throw for changelog with branching releases', () => {
    expect(() =>
      validateChangelog({
        changelogContent: branchingChangelog,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).not.toThrow();
  });

  it('should not throw when the first release is not the first numerically', () => {
    expect(() =>
      validateChangelog({
        changelogContent: backportChangelog,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).not.toThrow();
  });

  it('should throw for an empty string', () => {
    expect(() =>
      validateChangelog({
        changelogContent: '',
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Failed to find Unreleased header');
  });

  it('should throw when the title is different', () => {
    const changelogWithDifferentTitle = changelogWithReleases.replace(
      '# Changelog',
      '# Custom Title',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithDifferentTitle,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Changelog is not well-formatted');
  });

  it('should throw when the changelog description is different', () => {
    const changelogWithDifferentDescription = changelogWithReleases.replace(
      'All notable changes',
      'A random assortment of changes',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithDifferentDescription,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Changelog is not well-formatted');
  });

  it('should throw when there are whitespace changes', () => {
    const changelogWithExtraWhitespace = `${changelogWithReleases}\n`;
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithExtraWhitespace,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Changelog is not well-formatted');
  });

  it('should throw when a release header is malformed', () => {
    const changelogWithMalformedReleaseHeader = changelogWithReleases.replace(
      '[1.0.0] - 2020-01-01',
      '1.0.0 - 2020-01-01',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithMalformedReleaseHeader,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow(`Unrecognized line: '## 1.0.0 - 2020-01-01'`);
  });

  it('should throw when there are extraneous header contents', () => {
    const changelogWithExtraHeaderContents = changelogWithReleases.replace(
      '[1.0.0] - 2020-01-01',
      '[1.0.0] - 2020-01-01 [extra contents]',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithExtraHeaderContents,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Changelog is not well-formatted');
  });

  it('should throw when a change category is unrecognized', () => {
    const changelogWithUnrecognizedChangeCategory =
      changelogWithReleases.replace('### Changed', '### Updated');
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithUnrecognizedChangeCategory,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow(`Invalid change category: 'Updated'`);
  });

  it('should throw when the Unreleased section is missing', () => {
    const changelogWithoutUnreleased = changelogWithReleases.replace(
      /## \[Unreleased\]\n\n/u,
      '',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithoutUnreleased,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Failed to find Unreleased header');
  });

  it('should throw if the wrong repo URL is used', () => {
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithReleases,
        currentVersion: '1.0.0',
        repoUrl: 'https://github.com/DifferentOrganization/DifferentRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Changelog is not well-formatted');
  });

  it('should throw if a comparison release link is missing', () => {
    const changelogWithoutReleaseLink = changelogWithReleases.replace(
      '[1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0\n',
      '',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithoutReleaseLink,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Changelog is not well-formatted');
  });

  it('should throw if the first release link is missing', () => {
    const changelogWithoutFirstReleaseLink = changelogWithReleases.replace(
      '[0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1\n',
      '',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithoutFirstReleaseLink,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Changelog is not well-formatted');
  });

  it('should throw if release links are in a different order than the release headers', () => {
    const thirdReleaseLink =
      '[1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0';
    const secondReleaseLink =
      '[0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2';
    const changelogWithoutFirstReleaseLink = changelogWithReleases.replace(
      `${thirdReleaseLink}\n${secondReleaseLink}`,
      `${secondReleaseLink}\n${thirdReleaseLink}`,
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithoutFirstReleaseLink,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Changelog is not well-formatted');
  });

  it(`should throw if the highest version isn't compared with the Unreleased changes`, () => {
    const changelogWithInvalidUnreleasedComparison = branchingChangelog.replace(
      '[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD',
      '[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.3...HEAD',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithInvalidUnreleasedComparison,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Changelog is not well-formatted');
  });

  it('should throw if there are decreasing comparisons', () => {
    const changelogWithDecreasingComparison = branchingChangelog.replace(
      '[0.0.3]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v0.0.3',
      '[0.0.3]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...v0.0.3',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithDecreasingComparison,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Changelog is not well-formatted');
  });

  it('should throw if the unreleased link points at anything other than the bare repository when there are no releases', () => {
    const changelogWithIncorrectUnreleasedLink = emptyChangelog.replace(
      '[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/',
      '[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithIncorrectUnreleasedLink,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Changelog is not well-formatted');
  });

  it('should throw if the bare unreleased link is missing a trailing slash', () => {
    const changelogWithoutUnreleasedLinkTrailingSlash = emptyChangelog.replace(
      '[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/',
      '[Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithoutUnreleasedLinkTrailingSlash,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow('Changelog is not well-formatted');
  });

  it('should throw if a change category is missing', () => {
    const changelogWithoutChangeCategory = changelogWithReleases.replace(
      '### Changed\n',
      '',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithoutChangeCategory,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow("Category missing for change: '- Something else'");
  });

  it("should throw if a change isn't prefixed by '- '", () => {
    const changelogWithInvalidChangePrefix = changelogWithReleases.replace(
      '- Something',
      'Something',
    );
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithInvalidChangePrefix,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
      }),
    ).toThrow(`Unrecognized line: 'Something else'`);
  });

  describe('is not a release candidate', () => {
    it('should not throw if the current version release header is missing', () => {
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithReleases,
          currentVersion: '1.0.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).not.toThrow();
    });

    it('should not throw if the changelog is empty', () => {
      expect(() =>
        validateChangelog({
          changelogContent: emptyChangelog,
          currentVersion: '1.0.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).not.toThrow();
    });

    it('should not throw if the changelog has an empty release', () => {
      const changelogWithEmptyRelease = changelogWithReleases.replace(
        '## [1.0.0] - 2020-01-01\n### Changed\n- Something else\n',
        '## [1.0.0] - 2020-01-01\n',
      );
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithEmptyRelease,
          currentVersion: '1.0.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).not.toThrow();
    });

    it('should throw if the changelog has an empty change category', () => {
      const changelogWithEmptyChangeCategory = changelogWithReleases.replace(
        '## [1.0.0] - 2020-01-01\n### Changed\n- Something else\n',
        '## [1.0.0] - 2020-01-01\n### Changed\n',
      );
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithEmptyChangeCategory,
          currentVersion: '1.0.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).toThrow('Changelog is not well-formatted');
    });

    it('should not throw if there are unreleased changes', () => {
      const changelogWithUnreleasedChanges = changelogWithReleases.replace(
        '## [Unreleased]',
        '## [Unreleased]\n### Changed\n- More changes',
      );
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithUnreleasedChanges,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).not.toThrow();
    });

    it('should not throw if there are uncategorized changes in the current release', () => {
      const changelogWithUnreleasedChanges = changelogWithReleases.replace(
        '## [1.0.0] - 2020-01-01',
        '## [1.0.0] - 2020-01-01\n### Uncategorized\n- More changes\n',
      );
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithUnreleasedChanges,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).not.toThrow();
    });

    it('should not throw if there are uncategorized changes in an older release', () => {
      const changelogWithUnreleasedChanges = changelogWithReleases.replace(
        '## [0.0.2] - 2020-01-01',
        '## [0.0.2] - 2020-01-01\n### Uncategorized\n- More changes\n',
      );
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithUnreleasedChanges,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).not.toThrow();
    });
  });

  describe('is a release candidate', () => {
    it('should not throw for a valid changelog with multiple releases', () => {
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithReleases,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: true,
        }),
      ).not.toThrow();
    });

    it('should not throw if the changelog has an empty release', () => {
      const changelogWithEmptyRelease = changelogWithReleases.replace(
        '## [1.0.0] - 2020-01-01\n### Changed\n- Something else\n',
        '## [1.0.0] - 2020-01-01\n',
      );
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithEmptyRelease,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: true,
        }),
      ).not.toThrow();
    });

    it('should throw if the changelog has an empty change category', () => {
      const changelogWithEmptyChangeCategory = changelogWithReleases.replace(
        '## [1.0.0] - 2020-01-01\n### Changed\n- Something else\n',
        '## [1.0.0] - 2020-01-01\n### Changed\n',
      );
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithEmptyChangeCategory,
          currentVersion: '1.0.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
        }),
      ).toThrow('Changelog is not well-formatted');
    });

    it('should throw if the current version release header is missing', () => {
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithReleases,
          currentVersion: '1.0.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: true,
        }),
      ).toThrow(`Current version missing from changelog: '1.0.1'`);
    });

    it('should throw if there are unreleased changes', () => {
      const changelogWithUnreleasedChanges = changelogWithReleases.replace(
        '## [Unreleased]',
        '## [Unreleased]\n### Changed\n- More changes',
      );
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithUnreleasedChanges,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: true,
        }),
      ).toThrow('Unreleased changes present in the changelog');
    });

    it('should throw if there are uncategorized changes in the current release', () => {
      const changelogWithUnreleasedChanges = changelogWithReleases.replace(
        '## [1.0.0] - 2020-01-01',
        '## [1.0.0] - 2020-01-01\n### Uncategorized\n- More changes\n',
      );
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithUnreleasedChanges,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: true,
        }),
      ).toThrow('Uncategorized changes present in the changelog');
    });

    it('should not throw if there are uncategorized changes in an older release', () => {
      const changelogWithUnreleasedChanges = changelogWithReleases.replace(
        '## [0.0.2] - 2020-01-01',
        '## [0.0.2] - 2020-01-01\n### Uncategorized\n- More changes\n',
      );
      expect(() =>
        validateChangelog({
          changelogContent: changelogWithUnreleasedChanges,
          currentVersion: '1.0.0',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: true,
        }),
      ).not.toThrow();
    });
  });

  describe('formatted changelog', () => {
    it("doesn't throw if the changelog is formatted with prettier", () => {
      expect(() =>
        validateChangelog({
          changelogContent: prettierChangelog,
          currentVersion: '1.1.1',
          repoUrl:
            'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
          isReleaseCandidate: false,
          formatter: (changelog) =>
            prettier.format(changelog, { parser: 'markdown' }),
        }),
      ).not.toThrow();
    });
  });

  // when the package has been renamed from `test` to `@metamast/test`
  it('should not throw for a valid changelog with renamed package', () => {
    expect(() =>
      validateChangelog({
        changelogContent: changelogWithRenamedPackage,
        currentVersion: '1.0.0',
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        isReleaseCandidate: false,
        tagPrefix: '@metamask/test@',
        versionBeforePkgRename: '0.0.2',
        tagPrefixBeforePkgRename: 'test@',
      }),
    ).not.toThrow();
  });
});
