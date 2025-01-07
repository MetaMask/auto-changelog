import path from 'path';

import { CHANGELOG_PRELUDE } from './constants';
import Repo, { RepoOptions } from './repo';

/**
 * A set of configuration options for a {@link LocalRepo}. In addition to the
 * options listed in {@link RepoOptions}, these include:
 *
 * @property remoteRepoDirectoryPath - The directory that holds the "remote"
 * companion of this repo.
 */
export type LocalRepoOptions = {
  remoteRepoDirectoryPath: string;
} & RepoOptions;

/**
 * A facade for the "local" repo, which is the repo with which the tool
 * interacts.
 */
export default class LocalRepo extends Repo {
  /**
   * The directory that holds the "remote" companion of this repo.
   */
  #remoteRepoDirectoryPath: string;

  constructor({ remoteRepoDirectoryPath, ...rest }: LocalRepoOptions) {
    super(rest);
    this.#remoteRepoDirectoryPath = remoteRepoDirectoryPath;
  }

  /**
   * Clones the "remote" repo.
   */
  protected async create() {
    await this.runCommand(
      'git',
      ['clone', this.#remoteRepoDirectoryPath, this.getWorkingDirectoryPath()],
      { cwd: path.resolve(this.getWorkingDirectoryPath(), '..') },
    );
  }

  /**
   * Writes an initial `packageon` (based on the configured name and version)
   * and changelog. Also creates an initial commit if this repo was configured
   * with `createInitialCommit: true`.
   */
  protected async afterCreate() {
    await super.afterCreate();

    // We reconfigure the repo such that it ostensibly has a remote that points
    // to a https:// or git:// URL, yet secretly points to the repo cloned
    // above. This way the tool is able to verify that the URL of `origin` is
    // correct, but we don't actually have to hit the internet when we run `git
    // fetch --tags`, etc.
    await this.runCommand('git', ['remote', 'remove', 'origin']);
    await this.runCommand('git', [
      'remote',
      'add',
      'origin',
      'https://github.com/example-org/example-repo',
    ]);
    await this.runCommand('git', [
      'config',
      `url.${this.#remoteRepoDirectoryPath}.insteadOf`,
      'https://github.com/example-org/example-repo',
    ]);

    await this.writeJsonFile('package.json', {
      name: 'example-package',
      version: '1.0.0',
      repository: {
        type: 'git',
        url: 'https://github.com/example-org/example-repo.git',
      },
      packageManager: 'yarn@4.0.0',
    });

    await this.writeFile(
      'CHANGELOG.md',
      `
${CHANGELOG_PRELUDE}

## [Unreleased]

[Unreleased]: https://github.com/example-org/example-repo/
`.slice(1),
    );

    await this.runCommand('yarn');
  }

  /**
   * Returns the path of the directory where this repo is located.
   *
   * @returns `local-repo` within the environment directory.
   */
  getWorkingDirectoryPath() {
    return path.join(this.environmentDirectoryPath, 'local-repo');
  }
}
