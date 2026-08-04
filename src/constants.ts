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

/**
 * Lowercase keywords that indicate a commit should be excluded from the changelog.
 */
export const keywordsToIndicateExcluded: string[] = [
  'Bump main version to',
  'changelog',
  'cherry-pick',
  'cp-',
  'e2e',
  'flaky test',
  'INFRA-',
  'Merge pull request',
  'New Crowdin translations',
  'oidc',
  'sync stable into',
].map((word) => word.toLowerCase());

/**
 * Maps a lowercase leading verb of a "Keep a Changelog"-style entry to its
 * category. The MetaMask PR template asks authors to write user-facing entries
 * in the past tense (e.g. "Added a new tab...", "Fixed a bug..."), so when a
 * commit has no usable Conventional Commit prefix we can still categorize the
 * entry deterministically from its first word.
 *
 * Only unambiguous, closed-set verbs are included; entries that do not begin
 * with one of these words remain uncategorized rather than being guessed.
 */
export const changelogVerbToCategory: Record<string, ChangeCategory> = {
  added: ChangeCategory.Added,
  adds: ChangeCategory.Added,
  add: ChangeCategory.Added,
  fixed: ChangeCategory.Fixed,
  fixes: ChangeCategory.Fixed,
  fix: ChangeCategory.Fixed,
  removed: ChangeCategory.Removed,
  removes: ChangeCategory.Removed,
  remove: ChangeCategory.Removed,
  deprecated: ChangeCategory.Deprecated,
  changed: ChangeCategory.Changed,
  change: ChangeCategory.Changed,
  updated: ChangeCategory.Changed,
  update: ChangeCategory.Changed,
  bumped: ChangeCategory.Changed,
  bump: ChangeCategory.Changed,
  improved: ChangeCategory.Changed,
  improves: ChangeCategory.Changed,
  improve: ChangeCategory.Changed,
};

/**
 * Maps a lowercase leading verb (imperative or third-person present) of a
 * changelog entry to its past-tense form.
 *
 * The MetaMask PR template asks for past-tense, user-facing entries, but many
 * entries fall back to a commit subject written in the imperative mood
 * ("Add ...", "Fix ...", "Migrate ..."). This map lets us convert only the
 * leading verb to past tense so the rendered changelog reads consistently.
 *
 * Design constraints.
 *
 * Every past form is spelled out explicitly (no generative morphology), so
 * irregular verbs and doubled-consonant spellings are always correct.
 *
 * The set is intentionally closed and conservative. Words whose first token is
 * commonly a noun as well as a verb (e.g. "support", "display", "show",
 * "swap", "set", "use", "filter", "change", "handle") are deliberately
 * omitted: converting them risks producing garbage such as "Supported for
 * Solana snaps". Unknown leading words are left untouched.
 *
 * The value is the capitalized past form, since descriptions have already been
 * capitalized by the time conversion runs.
 */
export const leadingVerbToPastTense: Record<string, string> = {
  add: 'Added',
  adds: 'Added',
  align: 'Aligned',
  aligns: 'Aligned',
  allow: 'Allowed',
  allows: 'Allowed',
  bump: 'Bumped',
  bumps: 'Bumped',
  centralize: 'Centralized',
  centralizes: 'Centralized',
  change: 'Changed',
  clean: 'Cleaned',
  cleans: 'Cleaned',
  compress: 'Compressed',
  compresses: 'Compressed',
  convert: 'Converted',
  converts: 'Converted',
  correct: 'Corrected',
  corrects: 'Corrected',
  create: 'Created',
  creates: 'Created',
  disable: 'Disabled',
  disables: 'Disabled',
  enable: 'Enabled',
  enables: 'Enabled',
  enhance: 'Enhanced',
  enhances: 'Enhanced',
  fix: 'Fixed',
  fixes: 'Fixed',
  gate: 'Gated',
  gates: 'Gated',
  harden: 'Hardened',
  hardens: 'Hardened',
  hide: 'Hid',
  hides: 'Hid',
  hoist: 'Hoisted',
  hoists: 'Hoisted',
  implement: 'Implemented',
  implements: 'Implemented',
  improve: 'Improved',
  improves: 'Improved',
  integrate: 'Integrated',
  integrates: 'Integrated',
  introduce: 'Introduced',
  introduces: 'Introduced',
  memoize: 'Memoized',
  memoizes: 'Memoized',
  merge: 'Merged',
  merges: 'Merged',
  migrate: 'Migrated',
  migrates: 'Migrated',
  move: 'Moved',
  moves: 'Moved',
  navigate: 'Navigated',
  navigates: 'Navigated',
  prevent: 'Prevented',
  prevents: 'Prevented',
  refactor: 'Refactored',
  refactors: 'Refactored',
  remove: 'Removed',
  removes: 'Removed',
  reorder: 'Reordered',
  reorders: 'Reordered',
  replace: 'Replaced',
  replaces: 'Replaced',
  resolve: 'Resolved',
  resolves: 'Resolved',
  skip: 'Skipped',
  skips: 'Skipped',
  stabilize: 'Stabilized',
  stabilizes: 'Stabilized',
  store: 'Stored',
  stores: 'Stored',
  suppress: 'Suppressed',
  suppresses: 'Suppressed',
  update: 'Updated',
  updates: 'Updated',
  upgrade: 'Upgraded',
  upgrades: 'Upgraded',
};
