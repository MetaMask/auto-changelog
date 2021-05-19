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

interface ReleaseMetadata {
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
}

/**
 * Release changes, organized by category.
 */
type ReleaseChanges = Record<ChangeCategory, string[]>;

/**
 * Changelog changes, organized by release and by category.
 */
type ChangelogChanges = Record<Version, ReleaseChanges> & {
  [unreleased]: ReleaseChanges;
};

// Stringification helpers

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
      const changes = categories[category];
      return stringifyCategory(category, changes);
    })
    .join('\n\n');
  if (categorizedChanges === '') {
    return releaseHeader;
  }
  return `${releaseHeader}\n${categorizedChanges}`;
}

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

function withTrailingSlash(url: string) {
  return url.endsWith('/') ? url : `${url}/`;
}

function getCompareUrl(repoUrl: string, firstRef: string, secondRef: string) {
  return `${withTrailingSlash(repoUrl)}compare/${firstRef}...${secondRef}`;
}

function getTagUrl(repoUrl: string, tag: string) {
  return `${withTrailingSlash(repoUrl)}releases/tag/${tag}`;
}

function stringifyLinkReferenceDefinitions(
  repoUrl: string,
  releases: ReleaseMetadata[],
) {
  const releasesOrderedByVersion = releases
    .map(({ version }) => version)
    .sort((a: Version, b: Version) => {
      return semver.gt(a, b) ? -1 : 1;
    });
  const orderedReleases = releases.map(({ version }) => version);
  const hasReleases = orderedReleases.length > 0;

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
      ? getCompareUrl(repoUrl, `v${releasesOrderedByVersion[0]}`, 'HEAD')
      : withTrailingSlash(repoUrl)
  }`;

  // The "previous" release that should be used for comparison is not always
  // the most recent release chronologically. The _highest_ version that is
  // lower than the current release is used as the previous release, so that
  // patch releases on older releases can be accomodated.
  const releaseLinkReferenceDefinitions = releases
    .map(({ version }) => {
      if (version === orderedReleases[orderedReleases.length - 1]) {
        return `[${version}]: ${getTagUrl(repoUrl, `v${version}`)}`;
      }
      const versionIndex = orderedReleases.indexOf(version);
      const previousVersion = orderedReleases
        .slice(versionIndex)
        .find((releaseVersion: Version) => {
          return semver.gt(version, releaseVersion);
        });
      return `[${version}]: ${getCompareUrl(
        repoUrl,
        `v${previousVersion}`,
        `v${version}`,
      )}`;
    })
    .join('\n');
  return `${unreleasedLinkReferenceDefinition}\n${releaseLinkReferenceDefinitions}${
    releases.length > 0 ? '\n' : ''
  }`;
}

interface AddReleaseOptions {
  addToStart?: boolean;
  date?: string;
  status?: string;
  version: Version;
}

interface AddChangeOptions {
  addToStart?: boolean;
  category: ChangeCategory;
  description: string;
  version?: Version;
}

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
  private _releases: ReleaseMetadata[];

  private _changes: ChangelogChanges;

  private _repoUrl: string;

  /**
   * Construct an empty changelog
   *
   * @param options
   * @param options.repoUrl - The GitHub repository URL for the current project
   */
  constructor({ repoUrl }: { repoUrl: string }) {
    this._releases = [];
    this._changes = { [unreleased]: {} as ReleaseChanges };
    this._repoUrl = repoUrl;
  }

  /**
   * Add a release to the changelog
   *
   * @param options
   * @param options.addToStart - Determines whether the change is added to the
   * top or bottom of the list of changes in this category. This defaults to
   * `true` because changes should be in reverse-chronological order. This
   * should be set to `false` when parsing a changelog top-to-bottom.
   * @param options.date - An ISO-8601 formatted date, representing the release
   * date.
   * @param options.status - The status of the release (e.g. 'WITHDRAWN',
   * 'DEPRECATED')
   * @param options.version - The version of the current release, which should
   * be a [SemVer](https://semver.org/spec/v2.0.0.html)-compatible version.
   */
  addRelease({ addToStart = true, date, status, version }: AddReleaseOptions) {
    if (!version) {
      throw new Error('Version required');
    } else if (semver.valid(version) === null) {
      throw new Error(`Not a valid semver version: '${version}'`);
    } else if (this._changes[version]) {
      throw new Error(`Release already exists: '${version}'`);
    }

    this._changes[version] = {} as ReleaseChanges;
    const newRelease = { version, date, status };
    if (addToStart) {
      this._releases.unshift(newRelease);
    } else {
      this._releases.push(newRelease);
    }
  }

  /**
   * Add a change to the changelog
   *
   * @param options
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
    } else if (version !== undefined && !this._changes[version]) {
      throw new Error(`Specified release version does not exist: '${version}'`);
    }

    const release = version
      ? this._changes[version]
      : this._changes[unreleased];

    if (!release[category]) {
      release[category] = [];
    }
    if (addToStart) {
      release[category].unshift(description);
    } else {
      release[category].push(description);
    }
  }

  /**
   * Migrate all unreleased changes to a release section.
   *
   * Changes are migrated in their existing categories, and placed above any
   * pre-existing changes in that category.
   *
   * @param version - The release version to migrate unreleased
   * changes to.
   */
  migrateUnreleasedChangesToRelease(version: Version) {
    const releaseChanges = this._changes[version];
    if (!releaseChanges) {
      throw new Error(`Specified release version does not exist: '${version}'`);
    }

    const unreleasedChanges = this._changes[unreleased];

    for (const category of Object.keys(unreleasedChanges) as ChangeCategory[]) {
      if (releaseChanges[category]) {
        releaseChanges[category] = [
          ...unreleasedChanges[category],
          ...releaseChanges[category],
        ];
      } else {
        releaseChanges[category] = unreleasedChanges[category];
      }
    }
    this._changes[unreleased] = {} as ReleaseChanges;
  }

  /**
   * Gets the metadata for all releases.
   * @returns The metadata for each release.
   */
  getReleases() {
    return this._releases;
  }

  /**
   * Gets the changes in the given release, organized by category.
   * @param version - The version of the release being retrieved.
   * @returns The changes included in the given released.
   */
  getReleaseChanges(version: Version) {
    return this._changes[version];
  }

  /**
   * Gets all changes that have not yet been released
   * @returns The changes that have not yet been released.
   */
  getUnreleasedChanges() {
    return this._changes[unreleased];
  }

  /**
   * The stringified changelog, formatted according to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
   * @returns The stringified changelog.
   */
  toString() {
    return `${changelogTitle}
${changelogDescription}

${stringifyReleases(this._releases, this._changes)}

${stringifyLinkReferenceDefinitions(this._repoUrl, this._releases)}`;
  }
}
