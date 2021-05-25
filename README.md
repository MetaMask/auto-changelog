# @metamask/auto-changelog

Utilities for validating and updating \"Keep a Changelog\" formatted changelogs.

This package has a CLI (`auto-changelog`), and an API.

## Installation

`yarn add --dev @metamask/auto-changelog`

or

`npm install --save-dev @metamask/auto-changelog`

## CLI Usage

### Update

To update the 'Unreleased' section of the changelog:

`npx @metamask/auto-changelog update`

To update the current release section of the changelog:

`npx @metamask/auto-changelog update --rc`

### Validate

To validate the changelog:

`npx @metamask/auto-changelog validate`

To validate the changelog in a release candidate environment:

`npx @metamask/auto-changelog validate --rc`

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
const updatedChangelog = updateChangelog({
  changelogContent: oldChangelog,
  currentVersion: '1.0.0',
  repoUrl: 'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
  isReleaseCandidate: false,
});
await fs.writeFile('CHANGELOG.md', updatedChangelog);
```

### `validateChangelog`

This command validates the changelog

```javascript
import { promises as fs } from 'fs';
import { validateChangelog } from '@metamask/auto-changelog';

const oldChangelog = await fs.readFile('CHANGELOG.md', {
  encoding: 'utf8',
});
try {
  validateChangelog({
    changelogContent: oldChangelog,
    currentVersion: '1.0.0',
    repoUrl:
      'https://github.com/ExampleUsernameOrOrganization/ExampleRepository',
    isReleaseCandidate: false,
  });
  // changelog is valid!
} catch (error) {
  // changelog is invalid
}
```

## Contributing

### Setup

- Install [Node.js](https://nodejs.org) version 12
  - If you are using [nvm](https://github.com/creationix/nvm#installation) (recommended) running `nvm use` will automatically choose the right node version for you.
- Install [Yarn v1](https://yarnpkg.com/en/docs/install)
- Run `yarn setup` to install dependencies and run any requried post-install scripts
  - **Warning**: Do not use the `yarn` / `yarn install` command directly. Use `yarn setup` instead. The normal install command will skip required post-install scripts, leaving your development environment in an invalid state.

### Testing and Linting

Run `yarn test` to run the tests once. To run tests on file changes, run `yarn test:watch`.

Run `yarn lint` to run the linter, or run `yarn lint:fix` to run the linter and fix any automatically fixable issues.

### Release & Publishing

The project follows the same release process as the other libraries in the MetaMask organization:

1. Create a release branch

   - For a typical release, this would be based on `main`
   - To update an older maintained major version, base the release branch on the major version branch (e.g. `1.x`)

2. Update the changelog
3. Update version in package.json file (e.g. `yarn version --minor --no-git-tag-version`)
4. Create a pull request targeting the base branch (e.g. master or 1.x)
5. Code review and QA
6. Once approved, the PR is squashed & merged
7. The commit on the base branch is tagged
8. The tag can be published as needed
