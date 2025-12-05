# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add `check-deps` command to validate and update dependency bump changelog entries ([#267](https://github.com/MetaMask/auto-changelog/pull/267))
  - Automatically detects dependency/peerDependency version changes from git diffs (skips dev/optional deps)
  - Validates changelog entries with exact version matching (catches stale entries)
  - Auto-updates changelogs with `--fix` flag, preserving PR history
  - Detects package releases and validates/updates in correct changelog section (Unreleased vs specific version)
  - Smart PR concatenation when same dependency bumped multiple times
  - Handles renamed packages via package.json script hints
  - Usage: `yarn auto-changelog check-deps --from <ref> [--fix] [--pr <number>]`

## [5.3.0]

### Added

- Add `--requirePrNumbers` flag to `auto-changelog update` CLI command for generation-time filtering ([#253](https://github.com/MetaMask/auto-changelog/pull/253))
  - When enabled, commits without PR numbers are filtered out from the changelog
  - Disabled by default for backward compatibility
  - The `updateChangelog` function also supports this option via the `requirePrNumbers` parameter

## [5.2.0]

### Added

- Deduplicate commits with no PR number in subject ([#254](https://github.com/MetaMask/auto-changelog/pull/254))
  - For commits with no PR number in the subject (non-"Squash & Merge" commits), deduplication now checks if exact description text already exists in changelog
  - Merge commits are deduplicated using commit body instead of the generic merge subject

## [5.1.0]

### Added

- Add `--useChangelogEntry` to `auto-changelog update` ([#247](https://github.com/MetaMask/auto-changelog/pull/247))
  - This will read the PR referenced in each commit message, look for `CHANGELOG entry:` in the PR description, and use this as the new changelog entry in the changelog (or skip if the `no-changelog` label is present on the PR)
  - Note that `GITHUB_TOKEN` must be set in order to use this option
  - The `updateChangelog` function also supports this option
- Add `--useShortPrLink` to `auto-changelog update` ([#247](https://github.com/MetaMask/auto-changelog/pull/247))
  - This will generate short references to PRs, e.g. `#123` instead of `[#123](https://some/repo)`
  - The `updateChangelog` function also supports this option

### Changed

- Update `auto-changelog update --autoCategorize` to exclude entries with certain phrases or Conventional Commit prefixes ([#247](https://github.com/MetaMask/auto-changelog/pull/247))
  - If commit messages have the following prefixes they will not be automatically added to the changelog:
    - `style`
    - `refactor`
    - `test`
    - `build`
    - `ci`
    - `release`
  - If commit messages have the following phrases they will not be automatically added to the changelog:
    - `Bump main version to`
    - `changelog`
    - `cherry-pick`
    - `cp-`
    - `e2e`
    - `flaky test`
    - `INFRA-`
    - `merge`
    - `New Crowdin translations`

## [5.0.2]

### Fixed

- Fix `--autoCategorize` so that commit messages with Conventional Commit prefixes are categorized correctly when the prefix contains a scope (e.g. `feat(scope): ...`) ([#240](https://github.com/MetaMask/auto-changelog/pull/240))

## [5.0.1]

### Fixed

- Fix CLI path ([#235](https://github.com/MetaMask/auto-changelog/pull/235))

## [5.0.0]

### Added

- JavaScript sources and TypeScript declarations are now available in both CommonJS- and ESM-compatible variants ([#226](https://github.com/MetaMask/auto-changelog/pull/226))
- Add option to changelog validation to ensure that each entry in the changelog links to one or more originating PRs ([#222](https://github.com/MetaMask/auto-changelog/pull/222))
  - Pass `--pr-links` to the CLI, or pass `ensureValidPrLinksPresent` to `validateChangelog` to enable this behavior, ideally in your `lint` package script or CI workflow
- Add an optional `shouldExtractPrLinks` option to `parseChangelog` ([#222](https://github.com/MetaMask/auto-changelog/pull/222))
  - When true, this will extract pull request links from the text of each entry, identify the pull numbers, and keep them in a separate array
  - See note on `Changelog.getReleaseChanges` below for more

### Changed

- **BREAKING:** `Changelog.getReleaseChanges` now returns an object whose values are objects of shape `{ description: string; prNumbers: string[] }` rather than simply `string` (the description) ([#222](https://github.com/MetaMask/auto-changelog/pull/222))
  - This affects `parseChangelog` as well, since it returns an instance of `Changelog`
- **BREAKING:** Bump minimum Node version to 18.20 ([#227](https://github.com/MetaMask/auto-changelog/pull/227))
- **BREAKING:** Custom subpath imports are no longer supported ([#226](https://github.com/MetaMask/auto-changelog/pull/226))
  - You may now only import `@metamask/auto-changelog` and `@metamask/auto-changelog/package.json`

## [4.1.0]

### Added

- Add `--autoCategorize` flag to `update` command ([#212](https://github.com/MetaMask/auto-changelog/pull/212))
  - When populating the Unreleased section, the tool will look for [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) prefixes in commit message subjects and place matching commits in corresponding categories automatically.
  - Supported prefixes are `feat` (which routes to "Added") and `fix` (which routes to "Fixed").

## [4.0.0]

### Changed

- **BREAKING:** Drop support for Node.js <18.18 ([#203](https://github.com/MetaMask/auto-changelog/pull/203))
- **BREAKING:** Require `prettier@>=3.0.0` ([#202](https://github.com/MetaMask/auto-changelog/pull/202))
  - Prettier is now a peer dependency of this package.
- **BREAKING:** Enable Prettier formatting by default ([#204](https://github.com/MetaMask/auto-changelog/pull/204))
  - Changelogs are now formatted with Prettier by default when using the CLI.
  - You can opt-out of this change by specifying `--no-prettier`.

## [3.4.4]

### Added

- Retain tag history on update command for renamed packages with new options ([#182](https://github.com/MetaMask/auto-changelog/pull/182))

  - Introduced --version-before-package-rename and --tag-prefix-before-package-rename options for update command.

## [3.4.3]

### Changed

- Place this library under the MIT / Apache 2.0 dual license ([#175](https://github.com/MetaMask/auto-changelog/pull/175))

## [3.4.2]

### Fixed

- Remove circular dependency on `@metamask/utils` ([#170](https://github.com/MetaMask/auto-changelog/pull/170))

## [3.4.1]

### Fixed

- Add missing dependency `@metamask/utils` ([#168](https://github.com/MetaMask/auto-changelog/pull/168))

## [3.4.0]

### Added

- Retain tag history for renamed packages with new validation options ([#157](https://github.com/MetaMask/auto-changelog/pull/157))

  - Introduced --version-before-package-rename and --tag-prefix-before-package-rename options for validate command.

## [3.3.0]

### Added

- Add `--prettier` option for Prettier-formatted changelogs ([#155](https://github.com/MetaMask/auto-changelog/pull/155))

## [3.2.0]

### Added

- Add `--fix` option to validate command ([#148](https://github.com/MetaMask/auto-changelog/pull/148))

## [3.1.0]

### Added

- Allow prerelease versions in release headers ([#130](https://github.com/MetaMask/auto-changelog/pull/130))

## [3.0.0]

### Added

- Support alternate tag prefixes ([#120](https://github.com/MetaMask/auto-changelog/pull/120))

### Changed

- **BREAKING:** Update minimum Node.js version to v14 ([#117](https://github.com/MetaMask/auto-changelog/pull/117))
- Get package version from manifest ([#121](https://github.com/MetaMask/auto-changelog/pull/121))

## [2.6.1]

### Fixed

- When fetching remote tags, order by date to account for miniscule time differences between tags created within automated tests ([#113](https://github.com/MetaMask/auto-changelog/pull/113))

## [2.6.0]

### Changed

- Read repository URL from package.json if `npm_package_repository_url` is not set ([#111](https://github.com/MetaMask/auto-changelog/pull/111))
  - This makes this package compatible with Yarn >1.

## [2.5.0]

### Added

- The `validate --rc` command now ensures there are no uncategorized changes in the current release entry ([#102](https://github.com/MetaMask/auto-changelog/pull/102), [#106](https://github.com/MetaMask/auto-changelog/pull/106))

## [2.4.0]

### Changed

- Permit missing separating space in "Unreleased" link reference definition ([#92](https://github.com/MetaMask/auto-changelog/pull/92))
- Use `execa` to execute git commands ([#94](https://github.com/MetaMask/auto-changelog/pull/94))
  - This may fix subtle bugs related to git command execution, especially in CI.

## [2.3.0]

### Added

- More exports to index.ts ([#86](https://github.com/MetaMask/auto-changelog/pull/86))
  - Specifically, the `Changelog` class, `createEmptyChangelog`, and `parseChangelog`.

### Fixed

- Correctly calculate the most recent git tag ([#87](https://github.com/MetaMask/auto-changelog/pull/87))
  - Previously, we passed the path to the project root directory as a parameter to an invocation of `git rev-list`. For all repositories, this caused most tags belonging to merge commits to be excluded. For monorepos, this also caused tags belonging to commits that didn't change any files belonging to the changelog's package / workspace to be excluded.

## [2.2.0]

### Added

- Add `init` command ([#77](https://github.com/MetaMask/auto-changelog/pull/77))

### Changed

- Add `@lavamoat/allow-scripts` and `setup` command ([#78](https://github.com/MetaMask/auto-changelog/pull/78))
- Detect all PRs referenced in each change description, rather than just the first ([#84](https://github.com/MetaMask/auto-changelog/pull/84))

### Fixed

- Fix broken validation and updating when the lowest SemVer release isn't the first chronological release ([#76](https://github.com/MetaMask/auto-changelog/pull/76))
- Fix PR number detection in existing change entries ([#83](https://github.com/MetaMask/auto-changelog/pull/83))

## [2.1.0]

### Added

- Add Changelog.getStringifiedRelease ([#73](https://github.com/MetaMask/auto-changelog/pull/73))

### Fixed

- Remove trailing '.git' from default repo URL ([#74](https://github.com/MetaMask/auto-changelog/pull/74))

## [2.0.1]

### Fixed

- Prevent old build files from being published ([#71](https://github.com/MetaMask/auto-changelog/pull/71))

## [2.0.0]

### Added

- TypeScript types ([#59](https://github.com/MetaMask/auto-changelog/pull/59))

### Changed

- **(BREAKING)** Move Pull Request links to end of change entries ([#66](https://github.com/MetaMask/auto-changelog/pull/66))
- Rename files to use snake-case ([#64](https://github.com/MetaMask/auto-changelog/pull/64))
- Validate change categories during parsing ([#62](https://github.com/MetaMask/auto-changelog/pull/62))
  - This causes a validation error to be thrown earlier than previously.
- Migrate to TypeScript ([#59](https://github.com/MetaMask/auto-changelog/pull/59))

### Fixed

- Release candidate tag validation ([#55](https://github.com/MetaMask/auto-changelog/pull/55))
  - The fixed check ensures that there are no existing tags for release candidates.
- Typo in CLI error message ([#65](https://github.com/MetaMask/auto-changelog/pull/65))

## [1.0.0]

### Added

- The initial `auto-changelog` implementation, adapted from the original `auto-changelog.js` script in `metamask-extension`. ([#8](https://github.com/MetaMask/auto-changelog/pull/8))
  Includes the following features:
  - An `update` command ([#26](https://github.com/MetaMask/auto-changelog/pull/26))
  - A `validate` command ([#28](https://github.com/MetaMask/auto-changelog/pull/28))
  - Monorepo support ([#41](https://github.com/MetaMask/auto-changelog/pull/41))
  - Configurable repository URL, version, and changelog file path ([#33](https://github.com/MetaMask/auto-changelog/pull/33), [#31](https://github.com/MetaMask/auto-changelog/pull/31), [#30](https://github.com/MetaMask/auto-changelog/pull/30))

[Unreleased]: https://github.com/MetaMask/auto-changelog/compare/v5.3.0...HEAD
[5.3.0]: https://github.com/MetaMask/auto-changelog/compare/v5.2.0...v5.3.0
[5.2.0]: https://github.com/MetaMask/auto-changelog/compare/v5.1.0...v5.2.0
[5.1.0]: https://github.com/MetaMask/auto-changelog/compare/v5.0.2...v5.1.0
[5.0.2]: https://github.com/MetaMask/auto-changelog/compare/v5.0.1...v5.0.2
[5.0.1]: https://github.com/MetaMask/auto-changelog/compare/v5.0.0...v5.0.1
[5.0.0]: https://github.com/MetaMask/auto-changelog/compare/v4.1.0...v5.0.0
[4.1.0]: https://github.com/MetaMask/auto-changelog/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/MetaMask/auto-changelog/compare/v3.4.4...v4.0.0
[3.4.4]: https://github.com/MetaMask/auto-changelog/compare/v3.4.3...v3.4.4
[3.4.3]: https://github.com/MetaMask/auto-changelog/compare/v3.4.2...v3.4.3
[3.4.2]: https://github.com/MetaMask/auto-changelog/compare/v3.4.1...v3.4.2
[3.4.1]: https://github.com/MetaMask/auto-changelog/compare/v3.4.0...v3.4.1
[3.4.0]: https://github.com/MetaMask/auto-changelog/compare/v3.3.0...v3.4.0
[3.3.0]: https://github.com/MetaMask/auto-changelog/compare/v3.2.0...v3.3.0
[3.2.0]: https://github.com/MetaMask/auto-changelog/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/MetaMask/auto-changelog/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/MetaMask/auto-changelog/compare/v2.6.1...v3.0.0
[2.6.1]: https://github.com/MetaMask/auto-changelog/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/MetaMask/auto-changelog/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/MetaMask/auto-changelog/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/MetaMask/auto-changelog/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/MetaMask/auto-changelog/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/MetaMask/auto-changelog/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/MetaMask/auto-changelog/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/MetaMask/auto-changelog/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/MetaMask/auto-changelog/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/MetaMask/auto-changelog/releases/tag/v1.0.0
