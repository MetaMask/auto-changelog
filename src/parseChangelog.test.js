const _outdent = require('outdent');
const { parseChangelog } = require('./parseChangelog');

const outdent = _outdent({ trimTrailingNewline: false });

describe('parseChangelog', () => {
  it('should parse empty changelog', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleases()).toStrictEqual([]);
    expect(changelog.getUnreleasedChanges()).toStrictEqual({});
  });

  it('should parse changelog missing title', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleases()).toStrictEqual([]);
    expect(changelog.getUnreleasedChanges()).toStrictEqual({});
  });

  it('should parse changelog missing changelog description', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog

        ## [Unreleased]

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleases()).toStrictEqual([]);
    expect(changelog.getUnreleasedChanges()).toStrictEqual({});
  });

  it('should parse changelog with releases', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
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
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleases()).toStrictEqual([
      { date: '2020-01-01', status: undefined, version: '1.0.0' },
      { date: '2020-01-01', status: undefined, version: '0.0.2' },
      { date: '2020-01-01', status: undefined, version: '0.0.1' },
    ]);
    expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
      Changed: ['Something else'],
    });
    expect(changelog.getReleaseChanges('0.0.2')).toStrictEqual({
      Fixed: ['Something'],
    });
    expect(changelog.getReleaseChanges('0.0.1')).toStrictEqual({
      Changed: ['Something'],
    });
    expect(changelog.getUnreleasedChanges()).toStrictEqual({});
  });

  it('should parse changelog missing reference link definitions for releases', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
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
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleases()).toStrictEqual([
      { date: '2020-01-01', status: undefined, version: '1.0.0' },
      { date: '2020-01-01', status: undefined, version: '0.0.2' },
      { date: '2020-01-01', status: undefined, version: '0.0.1' },
    ]);
    expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
      Changed: ['Something else'],
    });
    expect(changelog.getReleaseChanges('0.0.2')).toStrictEqual({
      Fixed: ['Something'],
    });
    expect(changelog.getReleaseChanges('0.0.1')).toStrictEqual({
      Changed: ['Something'],
    });
    expect(changelog.getUnreleasedChanges()).toStrictEqual({});
  });

  it('should parse changelog with release statuses', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        ## [1.0.0] - 2020-01-01 [BETA]
        ### Changed
        - Something else

        ## [0.0.2] - 2020-01-01 [WITHDRAWN]
        ### Fixed
        - Something

        ## [0.0.1] - 2020-01-01 [DEPRECATED]
        ### Changed
        - Something

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
        [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
        [0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2
        [0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleases()).toStrictEqual([
      { date: '2020-01-01', status: 'BETA', version: '1.0.0' },
      { date: '2020-01-01', status: 'WITHDRAWN', version: '0.0.2' },
      { date: '2020-01-01', status: 'DEPRECATED', version: '0.0.1' },
    ]);
  });

  it('should parse changelog with multi-line change description', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        ## [1.0.0] - 2020-01-01
        ### Changed
        - Something else
        Further explanation of changes

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
        [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
      Changed: ['Something else\nFurther explanation of changes'],
    });
  });

  it('should parse changelog with a change description that has a sub-bullet', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        ## [1.0.0] - 2020-01-01
        ### Changed
        - Something else
          - Further explanation of changes

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
        [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
      Changed: ['Something else\n  - Further explanation of changes'],
    });
  });

  it('should parse changelog with a change description that includes a trailing newline', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        ## [1.0.0] - 2020-01-01
        ### Changed
        - Something else
          - Further explanation of changes


        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
        [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
      Changed: ['Something else\n  - Further explanation of changes\n'],
    });
  });

  it('should not mistake newline between sections as part of change entry', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        ## [1.0.0] - 2020-01-01
        ### Changed
        - Something else
          - Further explanation of changes

        ### Fixed
        - Not including newline between change categories as part of change entry

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
        [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
      Changed: ['Something else\n  - Further explanation of changes'],
      Fixed: [
        'Not including newline between change categories as part of change entry',
      ],
    });
  });

  it('should not mistake newline between releases as part of change entry', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        ## [1.0.0] - 2020-01-01
        ### Changed
        - Something else
          - Further explanation of changes

        ## [0.0.1] - 2020-01-01
        ### Changed
        - Initial release

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
        [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
      Changed: ['Something else\n  - Further explanation of changes'],
    });
  });

  it('should parse changelog missing newlines between sections', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
        ## [Unreleased]
        ## [1.0.0] - 2020-01-01
        ### Changed
        - Something else
        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
        [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleases()).toStrictEqual([
      { date: '2020-01-01', status: undefined, version: '1.0.0' },
    ]);
    expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
      Changed: ['Something else'],
    });
    expect(changelog.getUnreleasedChanges()).toStrictEqual({});
  });

  it('should throw if Unreleased header is missing', () => {
    const brokenChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
      `;
    expect(() =>
      parseChangelog({
        changelogContent: brokenChangelog,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      }),
    ).toThrow('Failed to find Unreleased header');
  });

  it('should throw if Unreleased reference link definition is missing', () => {
    const brokenChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]
      `;
    expect(() =>
      parseChangelog({
        changelogContent: brokenChangelog,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      }),
    ).toThrow('Failed to find Unreleased link reference definition');
  });

  it('should throw if release header is missing square brackets', () => {
    const brokenChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      ## 1.0.0 - 2020-01-01
      ### Changed
      - Something else

      [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
      [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
      `;
    expect(() =>
      parseChangelog({
        changelogContent: brokenChangelog,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      }),
    ).toThrow(`Unrecognized line: '## 1.0.0 - 2020-01-01'`);
  });

  it('should throw if release header is missing trailing square bracket', () => {
    const brokenChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      ## [1.0.0 - 2020-01-01
      ### Changed
      - Something else

      [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
      [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
      `;
    expect(() =>
      parseChangelog({
        changelogContent: brokenChangelog,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      }),
    ).toThrow(`Malformed release header: '## [1.0.0 - 2020-01-01'`);
  });

  it('should throw if release header uses the wrong header level', () => {
    const brokenChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      # [1.0.0] - 2020-01-01
      ### Changed
      - Something else

      [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
      [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
      `;
    expect(() =>
      parseChangelog({
        changelogContent: brokenChangelog,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      }),
    ).toThrow(`Unrecognized line: '# [1.0.0] - 2020-01-01'`);
  });

  it('should throw if a change category is missing', () => {
    const brokenChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      ## [1.0.0] - 2020-01-01
      - Something else

      [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
      [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
      `;
    expect(() =>
      parseChangelog({
        changelogContent: brokenChangelog,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      }),
    ).toThrow(`Category missing for change: '- Something else'`);
  });

  it('should throw if a change category is at wrong header level', () => {
    const brokenChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      ## [1.0.0] - 2020-01-01
      #### Changed
      - Something else

      [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
      [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
      `;
    expect(() =>
      parseChangelog({
        changelogContent: brokenChangelog,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      }),
    ).toThrow(`Unrecognized line: '#### Changed'`);
  });

  it('should throw if a change category is unrecognized', () => {
    const brokenChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      ## [1.0.0] - 2020-01-01
      ### Ch-Ch-Ch-Ch-Changes
      - Something else

      [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
      [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
      `;
    expect(() =>
      parseChangelog({
        changelogContent: brokenChangelog,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      }),
    ).toThrow(`Malformed category header: '### Ch-Ch-Ch-Ch-Changes'`);
  });

  it('should throw if a change starts with the wrong prefix', () => {
    const brokenChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      ## [1.0.0] - 2020-01-01
      ### Changed
      * Something else

      [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
      [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
      `;
    expect(() =>
      parseChangelog({
        changelogContent: brokenChangelog,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      }),
    ).toThrow(`Unrecognized line: '* Something else'`);
  });

  it('should truncate line in error message to 80 characters', () => {
    const brokenChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      ## [1.0.0] - 2020-01-01
      ### Changed
      * Very very very very very very very very very very very very very very very very very very very very long line

      [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
      [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.0.0
      `;
    expect(() =>
      parseChangelog({
        changelogContent: brokenChangelog,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      }),
    ).toThrow(
      `Unrecognized line: '* Very very very very very very very very very very very very very very very ver...'`,
    );
  });
});
