# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Correctly calculate the most recent git tag ([#87](https://github.com/MetaMask/auto-changelog/pull/87)) ([#87](https://github.com/MetaMask/auto-changelog/pull/87))
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
- The initial `auto-changelog` implementation, adapted from the original `auto-changelog.js` script in  `metamask-extension` ([#8](https://github.com/MetaMask/auto-changelog/pull/8)).
Includes the following features:
  - An `update` command ([#26](https://github.com/MetaMask/auto-changelog/pull/26))
  - A `validate` command ([#28](https://github.com/MetaMask/auto-changelog/pull/28))
  - Monorepo support ([#41](https://github.com/MetaMask/auto-changelog/pull/41))
  - Configurable repository URL, version, and changelog file path ([#33](https://github.com/MetaMask/auto-changelog/pull/33), [#31](https://github.com/MetaMask/auto-changelog/pull/31), [#30](https://github.com/MetaMask/auto-changelog/pull/30))

[Unreleased]: https://github.com/MetaMask/auto-changelog/compare/v2.5.0...HEAD
[2.5.0]: https://github.com/MetaMask/auto-changelog/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/MetaMask/auto-changelog/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/MetaMask/auto-changelog/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/MetaMask/auto-changelog/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/MetaMask/auto-changelog/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/MetaMask/auto-changelog/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/MetaMask/auto-changelog/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/MetaMask/auto-changelog/releases/tag/v1.0.0
