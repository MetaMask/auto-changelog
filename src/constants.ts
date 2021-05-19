/**
 * A [SemVer](https://semver.org/spec/v2.0.0.html)-compatible version string.
 */
export type Version = string;

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
