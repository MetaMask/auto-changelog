import { ExecaReturnValue } from 'execa';
import path from 'path';

import { TOOL_EXECUTABLE_PATH, TSX_PATH } from './constants';
import LocalRepo from './local-repo';
import { log } from './logging';
import RemoteRepo from './remote-repo';

/**
 * A set of configuration options for an {@link Environment}.
 *
 * @property directoryPath - The directory out of which this environment will
 * operate.
 */
export type EnvironmentOptions = {
  directoryPath: string;
};

/**
 * This class sets up each test and acts as a facade to all of the actions that
 * we need to take from within the test.
 */
export default class Environment {
  protected directoryPath: EnvironmentOptions['directoryPath'];

  protected remoteRepo: RemoteRepo;

  protected localRepo: LocalRepo;

  tempDirectoryPath: string;

  constructor(options: EnvironmentOptions) {
    const { directoryPath } = options;
    this.directoryPath = directoryPath;
    this.remoteRepo = new RemoteRepo({
      environmentDirectoryPath: directoryPath,
    });
    this.localRepo = new LocalRepo({
      environmentDirectoryPath: this.directoryPath,
      remoteRepoDirectoryPath: this.remoteRepo.getWorkingDirectoryPath(),
    });
    this.tempDirectoryPath = path.join(
      this.localRepo.getWorkingDirectoryPath(),
      'tmp',
    );
  }

  /**
   * Creates two repos: a "remote" repo so that the tool can run commands such
   * as `git fetch --tags`, and a "local" repo, which is the one against which
   * the tool is run.
   */
  async initialize() {
    await this.remoteRepo.initialize();
    await this.localRepo.initialize();
  }

  /**
   * Runs the tool within the context of the project, editing the generated
   * release spec template automatically with the given information before
   * continuing.
   *
   * @param args - The arguments to this function.
   * @param args.args - Additional arguments to pass to the command.
   * @returns The result of the command.
   */
  async runTool({
    args: additionalArgs = [],
  }: {
    args?: string[];
  } = {}): Promise<ExecaReturnValue> {
    const args = ['exec', 'tsx', TOOL_EXECUTABLE_PATH, ...additionalArgs];
    const result = await this.localRepo.runCommand('yarn', args);

    log(
      ['---- START OUTPUT -----', result.all, '---- END OUTPUT -----'].join(
        '\n',
      ),
    );

    return result;
  }
}
