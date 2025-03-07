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

#### Update the current release section of the changelog

`yarn run auto-changelog update --rc`

or

`npm run auto-changelog update --rc`

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
