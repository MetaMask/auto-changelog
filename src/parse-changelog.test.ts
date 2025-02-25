import _outdent from 'outdent';

import { parseChangelog } from './parse-changelog';

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

  it('should parse changelog with poorly formatted link reference', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        [Unreleased]:https://github.com/ExampleUsernameOrOrganization/ExampleRepository/
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
      Changed: [
        {
          description: 'Something else',
          prNumbers: [],
        },
      ],
    });

    expect(changelog.getReleaseChanges('0.0.2')).toStrictEqual({
      Fixed: [
        {
          description: 'Something',
          prNumbers: [],
        },
      ],
    });

    expect(changelog.getReleaseChanges('0.0.1')).toStrictEqual({
      Changed: [
        {
          description: 'Something',
          prNumbers: [],
        },
      ],
    });

    expect(changelog.getRelease('1.0.0')).toStrictEqual({
      date: '2020-01-01',
      status: undefined,
      version: '1.0.0',
    });

    expect(changelog.getStringifiedRelease('1.0.0')).toStrictEqual(outdent`
    ## [1.0.0] - 2020-01-01
    ### Changed
    - Something else`);
    expect(changelog.getRelease('2.0.0')).toBeUndefined();
    expect(() => changelog.getStringifiedRelease('2.0.0')).toThrow(
      "Specified release version does not exist: '2.0.0'",
    );
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
      Changed: [
        {
          description: 'Something else',
          prNumbers: [],
        },
      ],
    });

    expect(changelog.getReleaseChanges('0.0.2')).toStrictEqual({
      Fixed: [
        {
          description: 'Something',
          prNumbers: [],
        },
      ],
    });

    expect(changelog.getReleaseChanges('0.0.1')).toStrictEqual({
      Changed: [
        {
          description: 'Something',
          prNumbers: [],
        },
      ],
    });
    expect(changelog.getUnreleasedChanges()).toStrictEqual({});
  });

  it('should parse changelog with prereleases', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
        All notable changes to this project will be documented in this file.

        The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
        and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

        ## [Unreleased]

        ## [1.0.0-rc.1] - 2020-01-01
        ### Changed
        - Something else

        ## [0.0.2-beta.1] - 2020-01-01
        ### Fixed
        - Something

        ## [0.0.1-alpha.1] - 2020-01-01
        ### Changed
        - Something

        [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0-rc.1...HEAD
        [1.0.0-rc.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2-beta.1...v1.0.0-rc.1
        [0.0.2-beta.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1-alpha.1...v0.0.2-beta.1
        [0.0.1-alpha.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1-alpha.1
        `,
      repoUrl:
        'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    });

    expect(changelog.getReleases()).toStrictEqual([
      { date: '2020-01-01', status: undefined, version: '1.0.0-rc.1' },
      { date: '2020-01-01', status: undefined, version: '0.0.2-beta.1' },
      { date: '2020-01-01', status: undefined, version: '0.0.1-alpha.1' },
    ]);
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
      Changed: [
        {
          description: 'Something else\nFurther explanation of changes',
          prNumbers: [],
        },
      ],
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
      Changed: [
        {
          description: 'Something else\n  - Further explanation of changes',
          prNumbers: [],
        },
      ],
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
      Changed: [
        {
          description: 'Something else\n  - Further explanation of changes\n',
          prNumbers: [],
        },
      ],
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
      Changed: [
        {
          description: 'Something else\n  - Further explanation of changes',
          prNumbers: [],
        },
      ],
      Fixed: [
        {
          description:
            'Not including newline between change categories as part of change entry',
          prNumbers: [],
        },
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
      Changed: [
        {
          description: 'Something else\n  - Further explanation of changes',
          prNumbers: [],
        },
      ],
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
      Changed: [
        {
          description: 'Something else',
          prNumbers: [],
        },
      ],
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

  it('should throw if version in release header is not SemVer-compatible', () => {
    const brokenChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      ## [1.2.3.4]
      ### Changed
      - Something else

      [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.2.3.4...HEAD
      [1.2.3.4]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v1.2.3.4
      `;
    expect(() =>
      parseChangelog({
        changelogContent: brokenChangelog,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
      }),
    ).toThrow(`Invalid SemVer version in release header: '## [1.2.3.4]`);
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

  it('should throw if a change category is malformed', () => {
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

  it('should throw if a change category is unrecognized', () => {
    const brokenChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      ## [1.0.0] - 2020-01-01
      ### Invalid
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
    ).toThrow(`Invalid change category: 'Invalid'`);
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

  it('should parse changelog with releases which has renamed package', () => {
    const changelog = parseChangelog({
      changelogContent: outdent`
        # Changelog
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
      Changed: [
        {
          description: 'package renamed',
          prNumbers: [],
        },
      ],
    });

    expect(changelog.getReleaseChanges('0.0.2')).toStrictEqual({
      Fixed: [
        {
          description: 'Something',
          prNumbers: [],
        },
      ],
    });

    expect(changelog.getReleaseChanges('0.0.1')).toStrictEqual({
      Changed: [
        {
          description: 'Something',
          prNumbers: [],
        },
      ],
    });

    expect(changelog.getRelease('1.0.0')).toStrictEqual({
      date: '2020-01-01',
      status: undefined,
      version: '1.0.0',
    });

    expect(changelog.getStringifiedRelease('1.0.0')).toStrictEqual(outdent`
    ## [1.0.0] - 2020-01-01
    ### Changed
    - package renamed`);
    expect(changelog.getRelease('2.0.0')).toBeUndefined();
    expect(() => changelog.getStringifiedRelease('2.0.0')).toThrow(
      "Specified release version does not exist: '2.0.0'",
    );
    expect(changelog.getUnreleasedChanges()).toStrictEqual({});
  });

  describe('when shouldExtractPrLinks is true', () => {
    it('should parse changelog with pull request links after changelog entries', () => {
      const changelog = parseChangelog({
        changelogContent: outdent`
          # Changelog
          All notable changes to this project will be documented in this file.

          The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
          and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

          ## [Unreleased]

          ## [1.0.0]
          ### Changed
          - Change something else ([#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100), [#200](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/200))

          ## [0.0.2]
          ### Fixed
          - Fix something

          ## [0.0.1]
          ### Added
          - Initial release ([#456](anything goes here actually))

          [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
          [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
          [0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2
          [0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1
        `,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        shouldExtractPrLinks: true,
      });

      expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
        Changed: [
          {
            description: 'Change something else',
            prNumbers: ['100', '200'],
          },
        ],
      });
      expect(changelog.getReleaseChanges('0.0.1')).toStrictEqual({
        Added: [
          {
            description: 'Initial release',
            prNumbers: ['456'],
          },
        ],
      });
    });

    it('should parse changelog with pull request links at end of first line of multi-line change description', () => {
      const changelog = parseChangelog({
        changelogContent: outdent`
          # Changelog
          All notable changes to this project will be documented in this file.

          The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
          and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

          ## [Unreleased]

          ## [1.0.0]
          ### Changed
          - Change something ([#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100), [#200](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/200))
          This is a cool change, you will really like it.

          [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
          [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
        `,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        shouldExtractPrLinks: true,
      });

      expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
        Changed: [
          {
            description:
              'Change something\nThis is a cool change, you will really like it.',
            prNumbers: ['100', '200'],
          },
        ],
      });
    });

    it('should parse changelog with pull request links at end of first line of change description with sub-bullets', () => {
      const changelog = parseChangelog({
        changelogContent: outdent`
          # Changelog
          All notable changes to this project will be documented in this file.

          The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
          and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

          ## [Unreleased]

          ## [1.0.0]
          ### Changed
          - Change something ([#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100), [#200](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/200))
            - This is a cool change, you will really like it.

          [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
          [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
        `,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        shouldExtractPrLinks: true,
      });

      expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
        Changed: [
          {
            description:
              'Change something\n  - This is a cool change, you will really like it.',
            prNumbers: ['100', '200'],
          },
        ],
      });
    });

    it('should preserve links within sub-bullets', () => {
      const changelog = parseChangelog({
        changelogContent: outdent`
          # Changelog
          All notable changes to this project will be documented in this file.

          The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
          and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

          ## [Unreleased]

          ## [1.0.0]
          ### Changed
          - Change something
            - This is a cool change, you will really like it. ([#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100))

          [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
          [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
        `,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        shouldExtractPrLinks: true,
      });

      expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
        Changed: [
          {
            description:
              'Change something\n  - This is a cool change, you will really like it. ([#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100))',
            prNumbers: [],
          },
        ],
      });
    });

    it('should parse changelog with pull request links somewhere within entry, not just at end', () => {
      const changelog = parseChangelog({
        changelogContent: outdent`
          # Changelog
          All notable changes to this project will be documented in this file.

          The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
          and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

          ## [Unreleased]

          ## [1.0.0]
          ### Changed
          - Change something ([#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100), [#200](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/200)). And something else.

          [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
          [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
        `,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        shouldExtractPrLinks: true,
      });

      expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
        Changed: [
          {
            description: 'Change something. And something else.',
            prNumbers: ['100', '200'],
          },
        ],
      });
    });

    it('should combine multiple pull request lists', () => {
      const changelog = parseChangelog({
        changelogContent: outdent`
          # Changelog
          All notable changes to this project will be documented in this file.

          The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
          and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

          ## [Unreleased]

          ## [1.0.0]
          ### Changed
          - Change something ([#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100), [#200](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/200)) ([#300](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/300))

          [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
          [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
        `,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        shouldExtractPrLinks: true,
      });

      expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
        Changed: [
          {
            description: 'Change something',
            prNumbers: ['100', '200', '300'],
          },
        ],
      });
    });

    it('should de-duplicate pull request links in same list', () => {
      const changelog = parseChangelog({
        changelogContent: outdent`
          # Changelog
          All notable changes to this project will be documented in this file.

          The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
          and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

          ## [Unreleased]

          ## [1.0.0]
          ### Changed
          - Change something ([#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100), [#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100))

          [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
          [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
        `,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        shouldExtractPrLinks: true,
      });

      expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
        Changed: [
          {
            description: 'Change something',
            prNumbers: ['100'],
          },
        ],
      });
    });

    it('should de-duplicate pull request links in separate lists', () => {
      const changelog = parseChangelog({
        changelogContent: outdent`
          # Changelog
          All notable changes to this project will be documented in this file.

          The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
          and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

          ## [Unreleased]

          ## [1.0.0]
          ### Changed
          - Change something ([#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100)) ([#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100))

          [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
          [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
        `,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        shouldExtractPrLinks: true,
      });

      expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
        Changed: [
          {
            description: 'Change something',
            prNumbers: ['100'],
          },
        ],
      });
    });

    it('should preserve non-pull request links or malformed link syntax after changelog entries as part of the entry text itself', () => {
      const changelog = parseChangelog({
        changelogContent: outdent`
          # Changelog
          All notable changes to this project will be documented in this file.

          The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
          and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

          ## [Unreleased]

          ## [1.0.0]
          ### Changed
          - Change something else ([123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository))

          ## [0.0.3]
          ### Deprecated
          - Deprecate whatever([#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository))

          ## [0.0.2]
          ### Fixed
          - Fix something

          ## [0.0.1]
          ### Added
          - Initial release ([#789](https://example.com)

          [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
          [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.3...v1.0.0
          [0.0.3]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v0.0.3
          [0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2
          [0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1
        `,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        shouldExtractPrLinks: true,
      });

      expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
        Changed: [
          {
            // Missing '#'
            description:
              'Change something else ([123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository))',
            prNumbers: [],
          },
        ],
      });
      expect(changelog.getReleaseChanges('0.0.3')).toStrictEqual({
        Deprecated: [
          {
            // Missing space before link
            description:
              'Deprecate whatever([#123](https://github.com/ExampleUsernameOrOrganization/ExampleRepository))',
            prNumbers: [],
          },
        ],
      });
      expect(changelog.getReleaseChanges('0.0.2')).toStrictEqual({
        Fixed: [
          {
            // Missing link
            description: 'Fix something',
            prNumbers: [],
          },
        ],
      });
      expect(changelog.getReleaseChanges('0.0.1')).toStrictEqual({
        Added: [
          {
            // Incorrect URL
            description: 'Initial release ([#789](https://example.com)',
            prNumbers: [],
          },
        ],
      });
    });
  });

  describe('when shouldExtractPrLinks is false', () => {
    it('should not parse pull request links after changelog entries specially', () => {
      const changelog = parseChangelog({
        changelogContent: outdent`
          # Changelog
          All notable changes to this project will be documented in this file.

          The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
          and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

          ## [Unreleased]

          ## [1.0.0]
          ### Changed
          - Change something else ([#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100), [#200](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/200))

          ## [0.0.2]
          ### Fixed
          - Fix something

          ## [0.0.1]
          ### Added
          - Initial release ([#456](anything goes here actually))

          [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v1.0.0...HEAD
          [1.0.0]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.2...v1.0.0
          [0.0.2]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/v0.0.1...v0.0.2
          [0.0.1]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/releases/tag/v0.0.1
        `,
        repoUrl:
          'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
        shouldExtractPrLinks: false,
      });

      expect(changelog.getReleaseChanges('1.0.0')).toStrictEqual({
        Changed: [
          {
            description:
              'Change something else ([#100](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/100), [#200](https://github.com/ExampleUsernameOrOrganization/ExampleRepository/pull/200))',
            prNumbers: [],
          },
        ],
      });
      expect(changelog.getReleaseChanges('0.0.1')).toStrictEqual({
        Added: [
          {
            description:
              'Initial release ([#456](anything goes here actually))',
            prNumbers: [],
          },
        ],
      });
    });
  });
});
