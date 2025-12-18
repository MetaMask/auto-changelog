# @metamask/auto-changelog

Utilities for validating and updating \"Keep a Changelog\" formatted changelogs.

This package has a CLI (`auto-changelog`), and an API.

## Installation

`yarn add --dev @metamask/auto-changelog`

or

`npm install --save-dev @metamask/auto-changelog`

## CLI Usage

### Update

#### Update the "Unreleased" section of the changelog

`yarn run auto-changelog update`

or

`npm run auto-changelog update`

#### Use Conventional Commits prefixes to auto-categorize changes

`yarn run auto-changelog update --autoCategorize`

#### Read the "CHANGELOG entry:" on the PR

`yarn run auto-changelog update --useChangelogEntry`

#### Use Short PR links

- Like `(#247)` instead of `([#247](https://github.com/MetaMask/auto-changelog/pull/247))`

`yarn run auto-changelog update --useShortPrLink`

#### Require PR numbers (filter out commits without PR numbers)

- Only include commits that have associated PR numbers in the changelog
- Commits without PR numbers (like direct commits) will be filtered out
- This is useful for projects that want to ensure all changelog entries come from reviewed pull requests

`yarn run auto-changelog update --requirePrNumbers`

#### Update the current release section of the changelog

`yarn run auto-changelog update --rc`

or

`npm run auto-changelog update --rc`

### Deluxe, as used in metamask-extension

`yarn run auto-changelog update --autoCategorize --useChangelogEntry --useShortPrLink --rc`

### With requirePrNumbers (for stricter PR-based workflows)

`yarn run auto-changelog update --autoCategorize --useChangelogEntry --useShortPrLink --requirePrNumbers --rc`

#### Update the changelog for a renamed package

This option is designed to be used for packages that live in a monorepo.

For instance, if your package is called `polling-controller` and was renamed to `@metamask/polling-controller` at version 0.2.3, and thus the Git tags followed suit:

`yarn run auto-changelog update --tag-prefix-before-package-rename "polling-controller@" --version-before-package-name 0.2.3 --tag-prefix "@metamask/polling-controller@"`

or

`npm run auto-changelog update --tag-prefix-before-package-rename "polling-controller@" --version-before-package-name 0.2.3 --tag-prefix "@metamask/polling-controller@"`

### Validate

#### Validate the changelog simply

`yarn run auto-changelog validate`

or

`npm run auto-changelog validate`

#### Validate the changelog for a release candidate

`yarn run auto-changelog validate --rc`

or

`npm run auto-changelog validate --rc`

#### Validate the changelog with package-specific Git tags

This option is designed to be used for packages that live in a monorepo.

For instance, if your package is called `@metamask/polling-controller` and thus all Git tags for this package are prefixed with `@metamask/polling-controller@`:

`yarn run auto-changelog validate --tag-prefix "@metamask/polling-controller@"`

or

`npm run auto-changelog validate --tag-prefix "@metamask/polling-controller@"`

#### Validate the changelog for a renamed package

This option is designed to be used for packages that live in a monorepo.

For instance, if your package is called `polling-controller` and was renamed to `@metamask/polling-controller` at version 0.2.3, and thus the Git tags followed suit:

`yarn run auto-changelog validate --tag-prefix-before-package-rename "polling-controller@" --version-before-package-name 0.2.3 --tag-prefix "@metamask/polling-controller@"`

or

`npm run auto-changelog validate --tag-prefix-before-package-rename "polling-controller@" --version-before-package-name 0.2.3 --tag-prefix "@metamask/polling-controller@"`

#### Validate that each changelog entry has one or more associated pull requests

`yarn run auto-changelog validate --pr-links`

or

`npm run auto-changelog validate --pr-links`

### Check Dependencies

#### Check and validate dependency bump changelog entries

The `validate` command supports checking that changelog entries exist for dependency version bumps. This works on a single package's changelog at a time.

`yarn run auto-changelog validate --checkDeps`

or

`npm run auto-changelog validate --checkDeps`

#### Auto-fix missing dependency bump entries

Use the `--fix` and `--currentPr` flags to automatically add missing changelog entries for detected dependency bumps:

`yarn run auto-changelog validate --checkDeps --fix --currentPr 123`

Options:

- `--checkDeps` - Enable dependency bump changelog entry checking
- `--fromRef <ref>` - Starting git reference (commit, branch, or tag). If not provided, auto-detects from merge base with default branch.
- `--toRef <ref>` - Ending git reference (default: HEAD)
- `--remote <name>` - Remote name for auto-detection (default: origin)
- `--baseBranch <branch>` - Base branch reference for auto-detection
- `--fix` - Automatically update changelogs with missing dependency bump entries
- `--currentPr <number>` - PR number to use in changelog entries (required when using --fix with --checkDeps)

Features:

- Automatically detects dependency/peerDependency version changes (skips devDependencies/optionalDependencies)
- Validates changelog entries with exact version matching (catches stale entries)
- Marks peerDependency bumps as **BREAKING** changes
- Smart PR concatenation when same dependency is bumped multiple times
- Detects package releases and adds entries to correct section (Unreleased vs specific version)
- Handles renamed packages via package.json script hints

## API Usage

Each supported command is a separate named export.

### `updateChangelog`

This command updates the changelog.

```javascript
import { promises as fs } from 'fs';
import { updateChangelog } from '@metamask/auto-changelog';

const oldChangelog = await fs.readFile('CHANGELOG.md', {
  encoding: 'utf8',
});
const updatedChangelog = await updateChangelog({
  changelogContent: oldChangelog,
  currentVersion: '1.0.0',
  repoUrl: 'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
  isReleaseCandidate: false,
  requirePrNumbers: false, // Optional: set to true to filter out commits without PR numbers
});
await fs.writeFile('CHANGELOG.md', updatedChangelog);
```

### `validateChangelog`

This command validates the changelog.

```javascript
import { promises as fs } from 'fs';
import { validateChangelog } from '@metamask/auto-changelog';

const oldChangelog = await fs.readFile('CHANGELOG.md', {
  encoding: 'utf8',
});
try {
  await validateChangelog({
    changelogContent: oldChangelog,
    currentVersion: '1.0.0',
    repoUrl:
      'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    isReleaseCandidate: false,
    ensureValidPrLinksPresent: true,
  });
  // changelog is valid!
} catch (error) {
  // changelog is invalid
}
```

## Contributing

### Setup

- Install [Node.js](https://nodejs.org) version 18
  - If you are using [nvm](https://github.com/creationix/nvm#installation) (recommended) running `nvm use` will automatically choose the right node version for you.
- Install [Yarn v3](https://yarnpkg.com/getting-started/install)
- Run `yarn install` to install dependencies and run any required post-install scripts

### Testing and Linting

Run `yarn test` to run the tests once. To run tests on file changes, run `yarn test:watch`.

Run `yarn lint` to run the linter, or run `yarn lint:fix` to run the linter and fix any automatically fixable issues.

### Release & Publishing

The project follows the same release process as the other libraries in the MetaMask organization. The GitHub Actions [`action-create-release-pr`](https://github.com/MetaMask/action-create-release-pr) and [`action-publish-release`](https://github.com/MetaMask/action-publish-release) are used to automate the release process; see those repositories for more information about how they work.

1. Choose a release version.

   - The release version should be chosen according to SemVer. Analyze the changes to see whether they include any breaking changes, new features, or deprecations, then choose the appropriate SemVer version. See [the SemVer specification](https://semver.org/) for more information.

2. If this release is backporting changes onto a previous release, then ensure there is a major version branch for that version (e.g. `1.x` for a `v1` backport release).

   - The major version branch should be set to the most recent release with that major version. For example, when backporting a `v1.0.2` release, you'd want to ensure there was a `1.x` branch that was set to the `v1.0.1` tag.

3. Trigger the [`workflow_dispatch`](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#workflow_dispatch) event [manually](https://docs.github.com/en/actions/managing-workflow-runs/manually-running-a-workflow) for the `Create Release Pull Request` action to create the release PR.

   - For a backport release, the base branch should be the major version branch that you ensured existed in step 2. For a normal release, the base branch should be the main branch for that repository (which should be the default value).
   - This should trigger the [`action-create-release-pr`](https://github.com/MetaMask/action-create-release-pr) workflow to create the release PR.

4. Update the changelog to move each change entry into the appropriate change category ([See here](https://keepachangelog.com/en/1.0.0/#types) for the full list of change categories, and the correct ordering), and edit them to be more easily understood by users of the package.

   - Generally any changes that don't affect consumers of the package (e.g. lockfile changes or development environment changes) are omitted. Exceptions may be made for changes that might be of interest despite not having an effect upon the published package (e.g. major test improvements, security improvements, improved documentation, etc.).
   - Try to explain each change in terms that users of the package would understand (e.g. avoid referencing internal variables/concepts).
   - Consolidate related changes into one change entry if it makes it easier to explain.
   - Run `yarn auto-changelog validate --rc` to check that the changelog is correctly formatted.

5. Review and QA the release.

   - If changes are made to the base branch, the release branch will need to be updated with these changes and review/QA will need to restart again. As such, it's probably best to avoid merging other PRs into the base branch while review is underway.

6. Squash & Merge the release.

   - This should trigger the [`action-publish-release`](https://github.com/MetaMask/action-publish-release) workflow to tag the final release commit and publish the release on GitHub.

7. Publish the release on npm.

   - Wait for the `publish-release` GitHub Action workflow to finish. This should trigger a second job (`publish-npm`), which will wait for a run approval by the [`npm publishers`](https://github.com/orgs/MetaMask/teams/npm-publishers) team.
   - Approve the `publish-npm` job (or ask somebody on the npm publishers team to approve it for you).
   - Once the `publish-npm` job has finished, check npm to verify that it has been published.

### Testing changes in other projects using preview builds

If you are working on a pull request and want to test changes in another project before you publish them, you can create a _preview build_ and then configure your project to use it.

#### Creating a preview build

1. Within your pull request, post a comment with the text `@metamaskbot publish-preview`. This starts the `publish-preview` GitHub action, which will create a preview build and publish it to NPM.
2. After a few minutes, the action should complete and you will see a new comment. Note two things:
   - The name is scoped to `@metamask-previews` instead of `@metamask`.
   - The ID of the last commit in the branch is appended to the version, e.g. `1.2.3-preview-e2df9b4` instead of `1.2.3`.

#### Using a preview build

To use a preview build within a project, you need to override the resolution logic for your package manager so that the "production" version of that package is replaced with the preview version. Here's how you do that:

1. Open `package.json` in the project and locate the entry for this package in `dependencies`.
2. Locate the section responsible for resolution overrides (or create it if it doesn't exist). If you're using Yarn, this is `resolutions`; if you're using NPM or any other package manager, this is `overrides`.
3. Add a line to this section that mirrors the dependency entry on the left-hand side and points to the preview version on the right-hand side. Note the exact format of the left-hand side will differ based on which version of Yarn or NPM you are using. For example:
   - For Yarn Modern, you will add something like this to `resolutions`:
     ```
     "@metamask/auto-changelog@^1.2.3": "npm:@metamask-previews/auto-changelog@1.2.3-preview-abcdefg"
     ```
   - For Yarn Classic, you will add something like this to `resolutions`:
     ```
     "@metamask/auto-changelog": "npm:@metamask-previews/auto-changelog@1.2.3-preview-abcdefg"
     ```
   - For NPM, you will add something like this to `overrides`:
     ```
     "@metamask/auto-changelog": "npm:@metamask-previews/auto-changelog@1.2.3-preview-abcdefg"
     ```
4. Run `yarn install`.

#### Updating a preview build

If you make more changes to your pull request and want to create a new preview build:

1. Post another `@metamaskbot` comment on the pull request and wait for the response.
2. Update the version of the preview build in your project's `package.json`. Make sure to re-run `yarn install`!
