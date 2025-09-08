import * as markdown from 'prettier/plugins/markdown';
import { format as formatWithPrettier } from 'prettier/standalone';
import semver from 'semver';

import {
  ChangeCategory,
  orderedChangeCategories,
  unreleased,
  Version,
} from './constants';
import { PackageRename } from './shared-types';

/**
 * Format a Markdown changelog string.
 *
 * @param changelog - The changelog string to format.
 * @returns The formatted changelog string.
 */
export async function format(changelog: string): Promise<string> {
  return formatWithPrettier(changelog, {
    parser: 'markdown',
    plugins: [markdown],
  });
}

/**
 * `Object.getOwnPropertyNames()` is intentionally generic: it returns the
 * immediate property names of an object, but it cannot make guarantees about
 * the contents of that object, so the type of the property names is merely
 * `string[]`. While this is technically accurate, it is also unnecessary if we
 * have an object with a type that we own (such as an enum).
 *
 * IMPORTANT: This is copied from `@metamask/utils` in order to avoid a circular
 * dependency between this package and `@metamask/utils`.
 *
 * @param object - The plain object.
 * @returns The own property names of the object which are assigned a type
 * derived from the object itself.
 */
export function getKnownPropertyNames<Key extends PropertyKey>(
  object: Partial<Record<Key, any>>,
): Key[] {
  return Object.getOwnPropertyNames(object) as Key[];
}

const changelogTitle = '# Changelog';
const changelogDescription = `All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).`;

/**
 * Formatter function that formats a Markdown changelog string.
 */
export type Formatter = (changelog: string) => string | Promise<string>;

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
 * A single change in the changelog.
 */
export type Change = {
  /**
   * The description of the change.
   */
  description: string;

  /**
   * Pull requests within the repo that are associated with this change.
   */
  prNumbers: string[];
};

/**
 * Release changes, organized by category.
 */
type ReleaseChanges = Partial<Record<ChangeCategory, Change[]>>;

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
 * @param repoUrl - The URL of the repository.
 * @param useShortPrLink - Whether to use short PR links in the changelog entries.
 * @returns The stringified category section.
 */
function stringifyCategory(
  category: ChangeCategory,
  changes: Change[],
  repoUrl: string,
  useShortPrLink: boolean,
) {
  const categoryHeader = `### ${category}`;
  if (changes.length === 0) {
    return categoryHeader;
  }
  const changeDescriptions = changes
    .map(({ description, prNumbers }) => {
      const [firstLine, ...otherLines] = description.split('\n');
      const stringifiedPrLinks = prNumbers
        .map((prNumber) =>
          useShortPrLink
            ? `#${prNumber}`
            : `[#${prNumber}](${repoUrl}/pull/${prNumber})`,
        )
        .join(', ');
      const parenthesizedPrLinks =
        stringifiedPrLinks.length > 0 ? ` (${stringifiedPrLinks})` : '';
      return [`- ${firstLine}${parenthesizedPrLinks}`, ...otherLines].join(
        '\n',
      );
    })
    .join('\n');
  return `${categoryHeader}\n${changeDescriptions}`;
}

/**
 * Stringify a changelog release section.
 *
 * @param version - The release version.
 * @param categories - The categories of changes included in this release.
 * @param repoUrl - The URL of the repository.
 * @param useShortPrLink - Whether to use short PR links in the changelog entries.
 * @param options - Additional release options.
 * @param options.date - The date of the release.
 * @param options.status - The status of the release (e.g., "DEPRECATED").
 * @returns The stringified release section.
 */
function stringifyRelease(
  version: Version | typeof unreleased,
  categories: ReleaseChanges,
  repoUrl: string,
  useShortPrLink: boolean,
  { date, status }: Partial<ReleaseMetadata> = {},
) {
  const releaseHeader = `## [${version}]${date ? ` - ${date}` : ''}${
    status ? ` [${status}]` : ''
  }`;
  const categorizedChanges = orderedChangeCategories
    .filter((category) => categories[category])
    .map((category) => {
      const changes = categories[category] ?? [];
      return stringifyCategory(category, changes, repoUrl, useShortPrLink);
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
 * @param repoUrl - The URL of the repository.
 * @param useShortPrLink - Whether to use short PR links in the changelog entries.
 * @returns The stringified set of release sections.
 */
function stringifyReleases(
  releases: ReleaseMetadata[],
  changes: ChangelogChanges,
  repoUrl: string,
  useShortPrLink: boolean,
) {
  const stringifiedUnreleased = stringifyRelease(
    unreleased,
    changes[unreleased],
    repoUrl,
    useShortPrLink,
  );
  const stringifiedReleases = releases.map(({ version, date, status }) => {
    const categories = changes[version];
    return stringifyRelease(version, categories, repoUrl, useShortPrLink, {
      date,
      status,
    });
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
 * @param packageRename - The package rename properties
 * An optional, which is required only in case of package renamed.
 * @returns The stringified release link definitions.
 */
function stringifyLinkReferenceDefinitions(
  repoUrl: string,
  tagPrefix: string,
  releases: ReleaseMetadata[],
  packageRename?: PackageRename,
) {
  const unreleasedLinkReferenceDefinition =
    getUnreleasedLinkReferenceDefinition(
      repoUrl,
      tagPrefix,
      releases,
      packageRename,
    );

  const releaseLinkReferenceDefinitions = getReleaseLinkReferenceDefinitions(
    repoUrl,
    tagPrefix,
    releases,
    packageRename,
  ).join('\n');
  return `${unreleasedLinkReferenceDefinition}\n${releaseLinkReferenceDefinitions}${
    releases.length > 0 ? '\n' : ''
  }`;
}

/**
 * Get a string of unreleased link reference definition.
 *
 * @param repoUrl - The URL for the GitHub repository.
 * @param tagPrefix - The prefix used in tags before the version number.
 * @param releases - The releases to generate link definitions for.
 * @param packageRename - The package rename properties.
 * @returns A unreleased link reference definition string.
 */
function getUnreleasedLinkReferenceDefinition(
  repoUrl: string,
  tagPrefix: string,
  releases: ReleaseMetadata[],
  packageRename?: PackageRename,
): string {
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

  // A list of release versions in descending SemVer order
  const descendingSemverVersions = releases
    .map(({ version }) => version)
    .sort((a: Version, b: Version) => {
      return semver.gt(a, b) ? -1 : 1;
    });
  const latestSemverVersion = descendingSemverVersions[0];
  const hasReleases = descendingSemverVersions.length > 0;
  // if there is a package renamed, the tag prefix before the rename will be considered for compare
  // [Unreleased]: https://github.com/ExampleUsernameOrOrganization/ExampleRepository/compare/test@0.0.2...HEAD
  const tagPrefixToCompare =
    packageRename && packageRename.versionBeforeRename === latestSemverVersion
      ? packageRename.tagPrefixBeforeRename
      : tagPrefix;

  return `[${unreleased}]: ${
    hasReleases
      ? getCompareUrl(
          repoUrl,
          `${tagPrefixToCompare}${latestSemverVersion}`,
          'HEAD',
        )
      : withTrailingSlash(repoUrl)
  }`;
}

/**
 * Get a list of release link reference definitions.
 *
 * @param repoUrl - The URL for the GitHub repository.
 * @param tagPrefix - The prefix used in tags before the version number.
 * @param releases - The releases to generate link definitions for.
 * @param packageRename - The package rename properties.
 * @returns A list of release link reference definitions.
 */
function getReleaseLinkReferenceDefinitions(
  repoUrl: string,
  tagPrefix: string,
  releases: ReleaseMetadata[],
  packageRename?: PackageRename,
): string[] {
  // The "previous" release that should be used for comparison is not always
  // the most recent release chronologically. The _highest_ version that is
  // lower than the current release is used as the previous release, so that
  // patch releases on older releases can be accomodated.
  const chronologicalVersions = releases.map(({ version }) => version);
  let tagPrefixToCompare = tagPrefix;
  const releaseLinkReferenceDefinitions = releases.map(({ version }) => {
    let diffUrl;
    // once the version matches with versionBeforeRename, rest of the lines in changelog will be assumed as migrated tags
    if (packageRename && packageRename.versionBeforeRename === version) {
      tagPrefixToCompare = packageRename.tagPrefixBeforeRename;
    }

    if (version === chronologicalVersions[chronologicalVersions.length - 1]) {
      diffUrl = getTagUrl(repoUrl, `${tagPrefixToCompare}${version}`);
    } else {
      const versionIndex = chronologicalVersions.indexOf(version);
      const previousVersion = chronologicalVersions
        .slice(versionIndex)
        .find((releaseVersion: Version) => {
          return semver.gt(version, releaseVersion);
        });

      if (previousVersion) {
        if (
          packageRename &&
          packageRename.versionBeforeRename === previousVersion
        ) {
          // The package was renamed at this version
          // (the tag prefix holds the new name).
          diffUrl = getCompareUrl(
            repoUrl,
            `${packageRename.tagPrefixBeforeRename}${previousVersion}`,
            `${tagPrefix}${version}`,
          );
        } else {
          // If the package was ever renamed, it was not renamed at this version,
          // so use either the old tag prefix or the new tag prefix.
          // If the package was never renamed, use the tag prefix as it is.
          diffUrl = getCompareUrl(
            repoUrl,
            `${tagPrefixToCompare}${previousVersion}`,
            `${tagPrefixToCompare}${version}`,
          );
        }
      } else {
        // This is the smallest release.
        diffUrl = getTagUrl(repoUrl, `${tagPrefixToCompare}${version}`);
      }
    }
    return `[${version}]: ${diffUrl}`;
  });

  return releaseLinkReferenceDefinitions;
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
  prNumbers?: string[];
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

  readonly #packageRename: PackageRename | undefined;

  /**
   * Construct an empty changelog.
   *
   * @param options - Changelog options.
   * @param options.repoUrl - The GitHub repository URL for the current project.
   * @param options.tagPrefix - The prefix used in tags before the version number.
   * @param options.formatter - A function that formats the changelog string.
   * @param options.packageRename - The package rename properties.
   * An optional, which is required only in case of package renamed.
   */
  constructor({
    repoUrl,
    tagPrefix = 'v',
    formatter = (changelog) => changelog,
    packageRename,
  }: {
    repoUrl: string;
    tagPrefix?: string;
    formatter?: Formatter;
    packageRename?: PackageRename;
  }) {
    this.#releases = [];
    this.#changes = { [unreleased]: {} };
    this.#repoUrl = repoUrl;
    this.#tagPrefix = tagPrefix;
    this.#formatter = formatter;
    this.#packageRename = packageRename;
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
   * @param options.prNumbers - The pull request numbers associated with the
   * change.
   */
  addChange({
    addToStart = true,
    category,
    description,
    version,
    prNumbers = [],
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
    const releaseCategory = release[category] ?? [];

    releaseCategory[addToStart ? 'unshift' : 'push']({
      description,
      prNumbers,
    });

    release[category] = releaseCategory;
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

    for (const category of getKnownPropertyNames(unreleasedChanges)) {
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
   * @param useShortPrLink - Whether to use short PR links in the changelog entries.
   * @returns The stringified release, as it appears in the changelog.
   */
  getStringifiedRelease(version: Version, useShortPrLink: boolean) {
    const release = this.getRelease(version);
    if (!release) {
      throw new Error(`Specified release version does not exist: '${version}'`);
    }
    const releaseChanges = this.getReleaseChanges(version);
    return stringifyRelease(
      version,
      releaseChanges,
      this.#repoUrl,
      useShortPrLink,
      release,
    );
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
   * @param useShortPrLink - Whether to use short PR links in the changelog entries.
   * @returns The stringified changelog.
   */
  async toString(useShortPrLink: boolean): Promise<string> {
    const changelog = `${changelogTitle}
${changelogDescription}

${stringifyReleases(this.#releases, this.#changes, this.#repoUrl, useShortPrLink)}

${stringifyLinkReferenceDefinitions(
  this.#repoUrl,
  this.#tagPrefix,
  this.#releases,
  this.#packageRename,
)}`;

    return await this.#formatter(changelog);
  }
}
