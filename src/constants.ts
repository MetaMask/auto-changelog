/**
 * A [SemVer](https://semver.org/spec/v2.0.0.html)-compatible version string.
 */
export type Version = string;

/**
 * A [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) type.
 */
export enum ConventionalCommitType {
  FEAT = 'feat', // A new feature
  FIX = 'fix', // A bug fix
  DOCS = 'docs', // Documentation only changes
  STYLE = 'style', // Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
  REFACTOR = 'refactor', // A code change that neither fixes a bug nor adds a feature
  PERF = 'perf', // A code change that improves performance
  TEST = 'test', // Adding missing tests or correcting existing tests
  BUILD = 'build', // Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)
  CI = 'ci', // Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)
  CHORE = 'chore', // Other changes that don't modify src or test files (use this sparingly)
  REVERT = 'revert', // Reverts a previous commit

  // Custom types for MetaMask
  BUMP = 'bump', // A version bump to dependencies
  RELEASE = 'release', // A release commit, made on a release branch or to0 support the release process
}

/**
 * Change categories.
 *
 * Most of these categories are from [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 * The "Uncategorized" category was added because we have many changes from
 * older releases that would be difficult to categorize.
 */
export enum ChangeCategory {
  /**
   * For new features.
   */
  Added = 'Added',

  /**
   * For changes in existing functionality.
   */
  Changed = 'Changed',

  /**
   * For soon-to-be-removed features.
   */
  Deprecated = 'Deprecated',

  /**
   * For bug fixes.
   */
  Fixed = 'Fixed',

  /**
   * For now removed features.
   */
  Removed = 'Removed',

  /**
   * In case of vulnerabilities.
   */
  Security = 'Security',

  /**
   * For any changes that have yet to be categorized.
   */
  Uncategorized = 'Uncategorized',

  /**
   * For changes that should be excluded from the changelog.
   */
  Excluded = 'Excluded',
}

/**
 * Change categories in the order in which they should be listed in the
 * changelog.
 */
export const orderedChangeCategories: ChangeCategory[] = [
  ChangeCategory.Uncategorized,
  ChangeCategory.Added,
  ChangeCategory.Changed,
  ChangeCategory.Deprecated,
  ChangeCategory.Removed,
  ChangeCategory.Fixed,
  ChangeCategory.Security,
];

/**
 * The header for the section of the changelog listing unreleased changes.
 */
export const unreleased = 'Unreleased';
