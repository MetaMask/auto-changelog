import semver from 'semver';

import {
  ChangeCategory,
  orderedChangeCategories,
  unreleased,
  Version,
} from './constants';

const changelogTitle = '# Changelog';
const changelogDescription = `All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).`;

/**
 * Formatter function that formats a Markdown changelog string.
 */
export type Formatter = (changelog: string) => string;

type ReleaseMetadata = {
  /**
   * The version of the current release.
   */
  version: Version;

  /**
   * An ISO-8601 formatted date, representing the
   * release date.
   */
  date?: string;

  /**
   * The status of the release (e.g. 'WITHDRAWN', 'DEPRECATED')
   */
  status?: string;
};

/**
 * Release changes, organized by category.
 */
type ReleaseChanges = Partial<Record<ChangeCategory, string[]>>;

/**
 * Changelog changes, organized by release and by category.
 */
type ChangelogChanges = Record<Version, ReleaseChanges> & {
  [unreleased]: ReleaseChanges;
};

// Stringification helpers

/**
 * Stringify a changelog category section.
 *
 * @param category - The title of the changelog category.
 * @param changes - The changes included in this category.
 * @returns The stringified category section.
 */
function stringifyCategory(category: ChangeCategory, changes: string[]) {
  const categoryHeader = `### ${category}`;
  if (changes.length === 0) {
    return categoryHeader;
  }
  const changeDescriptions = changes
    .map((description) => `- ${description}`)
    .join('\n');
  return `${categoryHeader}\n${changeDescriptions}`;
}

/**
 * Stringify a changelog release section.
 *
 * @param version - The release version.
 * @param categories - The categories of changes included in this release.
 * @param options - Additional release options.
 * @param options.date - The date of the release.
 * @param options.status - The status of the release (e.g., "DEPRECATED").
 * @returns The stringified release section.
 */
function stringifyRelease(
  version: Version | typeof unreleased,
  categories: ReleaseChanges,
  { date, status }: Partial<ReleaseMetadata> = {},
) {
  const releaseHeader = `## [${version}]${date ? ` - ${date}` : ''}${
    status ? ` [${status}]` : ''
  }`;
  const categorizedChanges = orderedChangeCategories
    .filter((category) => categories[category])
    .map((category) => {
      const changes = categories[category] ?? [];
      return stringifyCategory(category, changes);
    })
    .join('\n\n');
  if (categorizedChanges === '') {
    return releaseHeader;
  }
  return `${releaseHeader}\n${categorizedChanges}`;
}

/**
 * Stringify a set of changelog release sections.
 *
 * @param releases - The releases to stringify.
 * @param changes - The set of changes to include, organized by release.
 * @returns The stringified set of release sections.
 */
function stringifyReleases(
  releases: ReleaseMetadata[],
  changes: ChangelogChanges,
) {
  const stringifiedUnreleased = stringifyRelease(
    unreleased,
    changes[unreleased],
  );
  const stringifiedReleases = releases.map(({ version, date, status }) => {
    const categories = changes[version];
    return stringifyRelease(version, categories, { date, status });
  });

  return [stringifiedUnreleased, ...stringifiedReleases].join('\n\n');
}

/**
 * Return the given URL with a trailing slash. It is returned unaltered if it
 * already has a trailing slash.
 *
 * @param url - The URL string.
 * @returns The URL string with a trailing slash.
 */
function withTrailingSlash(url: string) {
  return url.endsWith('/') ? url : `${url}/`;
}

/**
 * Get the GitHub URL for comparing two git commits.
 *
 * @param repoUrl - The URL for the GitHub repository.
 * @param firstRef - A reference (e.g., commit hash, tag, etc.) to the first commit to compare.
 * @param secondRef - A reference (e.g., commit hash, tag, etc.) to the second commit to compare.
 * @returns The comparison URL for the two given commits.
 */
function getCompareUrl(repoUrl: string, firstRef: string, secondRef: string) {
  return `${withTrailingSlash(repoUrl)}compare/${firstRef}...${secondRef}`;
}

/**
 * Get a GitHub tag URL.
 *
 * @param repoUrl - The URL for the GitHub repository.
 * @param tag - The tag name.
 * @returns The URL for the given tag.
 */
function getTagUrl(repoUrl: string, tag: string) {
  return `${withTrailingSlash(repoUrl)}releases/tag/${tag}`;
}

/**
 * Get a stringified list of link definitions for the given set of releases. The first release is
 * linked to the corresponding tag, and each subsequent release is linked to a comparison with the
 * previous release.
 *
 * @param repoUrl - The URL for the GitHub repository.
 * @param tagPrefix - The prefix used in tags before the version number.
 * @param releases - The releases to generate link definitions for.
 * @returns The stringified release link definitions.
 */
function stringifyLinkReferenceDefinitions(
  repoUrl: string,
  tagPrefix: string,
  releases: ReleaseMetadata[],
) {
  // A list of release versions in descending SemVer order
  const descendingSemverVersions = releases
    .map(({ version }) => version)
    .sort((a: Version, b: Version) => {
      return semver.gt(a, b) ? -1 : 1;
    });
  const latestSemverVersion = descendingSemverVersions[0];
  // A list of release versions in chronological order
  const chronologicalVersions = releases.map(({ version }) => version);
  const hasReleases = chronologicalVersions.length > 0;

  // The "Unreleased" section represents all changes made since the *highest*
  // release, not the most recent release. This is to accomodate patch releases
  // of older versions that don't represent the latest set of changes.
  //
  // For example, if a library has a v2.0.0 but the v1.0.0 release needed a
  // security update, the v1.0.1 release would then be the most recent, but the
  // range of unreleased changes would remain `v2.0.0...HEAD`.
  //
  // If there have not been any releases yet, the repo URL is used directly as
  // the link definition.
  const unreleasedLinkReferenceDefinition = `[${unreleased}]: ${
    hasReleases
      ? getCompareUrl(repoUrl, `${tagPrefix}${latestSemverVersion}`, 'HEAD')
      : withTrailingSlash(repoUrl)
  }`;

  // The "previous" release that should be used for comparison is not always
  // the most recent release chronologically. The _highest_ version that is
  // lower than the current release is used as the previous release, so that
  // patch releases on older releases can be accomodated.
  const releaseLinkReferenceDefinitions = releases
    .map(({ version }) => {
      let diffUrl;
      if (version === chronologicalVersions[chronologicalVersions.length - 1]) {
        diffUrl = getTagUrl(repoUrl, `${tagPrefix}${version}`);
      } else {
        const versionIndex = chronologicalVersions.indexOf(version);
        const previousVersion = chronologicalVersions
          .slice(versionIndex)
          .find((releaseVersion: Version) => {
            return semver.gt(version, releaseVersion);
          });
        diffUrl = previousVersion
          ? getCompareUrl(
              repoUrl,
              `${tagPrefix}${previousVersion}`,
              `${tagPrefix}${version}`,
            )
          : getTagUrl(repoUrl, `${tagPrefix}${version}`);
      }
      return `[${version}]: ${diffUrl}`;
    })
    .join('\n');
  return `${unreleasedLinkReferenceDefinition}\n${releaseLinkReferenceDefinitions}${
    releases.length > 0 ? '\n' : ''
  }`;
}

type AddReleaseOptions = {
  addToStart?: boolean;
  date?: string;
  status?: string;
  version: Version;
};

type AddChangeOptions = {
  addToStart?: boolean;
  category: ChangeCategory;
  description: string;
  version?: Version;
};

/**
 * A changelog that complies with the
 * ["Keep a Changelog" v1.1.0 guidelines](https://keepachangelog.com/en/1.0.0/).
 *
 * This changelog starts out completely empty, and allows new releases and
 * changes to be added such that the changelog remains compliant at all times.
 * This can be used to help validate the contents of a changelog, normalize
 * formatting, update a changelog, or build one from scratch.
 */
export default class Changelog {
  readonly #releases: ReleaseMetadata[];

  #changes: ChangelogChanges;

  readonly #repoUrl: string;

  readonly #tagPrefix: string;

  #formatter: Formatter;

  /**
   * Construct an empty changelog.
   *
   * @param options - Changelog options.
   * @param options.repoUrl - The GitHub repository URL for the current project.
   * @param options.tagPrefix - The prefix used in tags before the version number.
   * @param options.formatter - A function that formats the changelog string.
   */
  constructor({
    repoUrl,
    tagPrefix = 'v',
    formatter = (changelog) => changelog,
  }: {
    repoUrl: string;
    tagPrefix?: string;
    formatter?: Formatter;
  }) {
    this.#releases = [];
    this.#changes = { [unreleased]: {} };
    this.#repoUrl = repoUrl;
    this.#tagPrefix = tagPrefix;
    this.#formatter = formatter;
  }

  /**
   * Add a release to the changelog.
   *
   * @param options - Release options.
   * @param options.addToStart - Determines whether the change is added to the
   * top or bottom of the list of changes in this category. This defaults to
   * `true` because changes should be in reverse-chronological order. This
   * should be set to `false` when parsing a changelog top-to-bottom.
   * @param options.date - An ISO-8601 formatted date, representing the release
   * date.
   * @param options.status - The status of the release (e.g., 'WITHDRAWN',
   * 'DEPRECATED').
   * @param options.version - The version of the current release, which should
   * be a [SemVer](https://semver.org/spec/v2.0.0.html)-compatible version.
   */
  addRelease({ addToStart = true, date, status, version }: AddReleaseOptions) {
    if (!version) {
      throw new Error('Version required');
    } else if (semver.valid(version) === null) {
      throw new Error(`Not a valid semver version: '${version}'`);
    } else if (this.#changes[version]) {
      throw new Error(`Release already exists: '${version}'`);
    }

    this.#changes[version] = {};
    const newRelease = { version, date, status };
    if (addToStart) {
      this.#releases.unshift(newRelease);
    } else {
      this.#releases.push(newRelease);
    }
  }

  /**
   * Add a change to the changelog.
   *
   * @param options - Change options.
   * @param options.addToStart - Determines whether the change is added to the
   * top or bottom of the list of changes in this category. This defaults to
   * `true` because changes should be in reverse-chronological order. This
   * should be set to `false` when parsing a changelog top-to-bottom.
   * @param options.category - The category of the change.
   * @param options.description - The description of the change.
   * @param options.version - The version this change was released in. If this
   * is not given, the change is assumed to be unreleased.
   */
  addChange({
    addToStart = true,
    category,
    description,
    version,
  }: AddChangeOptions) {
    if (!category) {
      throw new Error('Category required');
    } else if (!orderedChangeCategories.includes(category)) {
      throw new Error(`Unrecognized category: '${category}'`);
    } else if (!description) {
      throw new Error('Description required');
    } else if (version !== undefined && !this.#changes[version]) {
      throw new Error(`Specified release version does not exist: '${version}'`);
    }

    const release = version
      ? this.#changes[version]
      : this.#changes[unreleased];

    if (!release[category]) {
      release[category] = [];
    }

    if (addToStart) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      release[category]!.unshift(description);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      release[category]!.push(description);
    }
  }

  /**
   * Migrate all unreleased changes to a release section.
   *
   * Changes are migrated in their existing categories, and placed above any
   * pre-existing changes in that category.
   *
   * @param version - The release version to migrate unreleased changes to.
   */
  migrateUnreleasedChangesToRelease(version: Version) {
    const releaseChanges = this.#changes[version];
    if (!releaseChanges) {
      throw new Error(`Specified release version does not exist: '${version}'`);
    }

    const unreleasedChanges = this.#changes[unreleased];

    for (const category of Object.keys(unreleasedChanges) as ChangeCategory[]) {
      if (releaseChanges[category]) {
        releaseChanges[category] = [
          ...(unreleasedChanges[category] ?? []),
          ...(releaseChanges[category] ?? []),
        ];
      } else {
        releaseChanges[category] = unreleasedChanges[category];
      }
    }
    this.#changes[unreleased] = {};
  }

  /**
   * Gets the metadata for all releases.
   *
   * @returns The metadata for each release.
   */
  getReleases() {
    return this.#releases;
  }

  /**
   * Gets the release of the given version.
   *
   * @param version - The version of the release to retrieve.
   * @returns The specified release, or undefined if no such release exists.
   */
  getRelease(version: Version) {
    return this.getReleases().find(
      ({ version: _version }) => _version === version,
    );
  }

  /**
   * Gets the stringified release of the given version.
   * Throws an error if no such release exists.
   *
   * @param version - The version of the release to stringify.
   * @returns The stringified release, as it appears in the changelog.
   */
  getStringifiedRelease(version: Version) {
    const release = this.getRelease(version);
    if (!release) {
      throw new Error(`Specified release version does not exist: '${version}'`);
    }
    const releaseChanges = this.getReleaseChanges(version);
    return stringifyRelease(version, releaseChanges, release);
  }

  /**
   * Gets the changes in the given release, organized by category.
   *
   * @param version - The version of the release being retrieved.
   * @returns The changes included in the given released.
   */
  getReleaseChanges(version: Version) {
    return this.#changes[version];
  }

  /**
   * Gets all changes that have not yet been released.
   *
   * @returns The changes that have not yet been released.
   */
  getUnreleasedChanges() {
    return this.#changes[unreleased];
  }

  /**
   * The stringified changelog, formatted according to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
   *
   * @returns The stringified changelog.
   */
  toString(): string {
    const changelog = `${changelogTitle}
${changelogDescription}

${stringifyReleases(this.#releases, this.#changes)}

${stringifyLinkReferenceDefinitions(
  this.#repoUrl,
  this.#tagPrefix,
  this.#releases,
)}`;

    return this.#formatter(changelog);
  }
}
