# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/MetaMask/auto-changelog/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/MetaMask/auto-changelog/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/MetaMask/auto-changelog/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/MetaMask/auto-changelog/releases/tag/v1.0.0
