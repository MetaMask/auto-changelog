import {
  ensureDirectoryStructureExists,
  Json,
  writeFile,
  writeJsonFile,
} from '@metamask/utils/node';
import execa, { ExecaChildProcess, Options as ExecaOptions } from 'execa';
import path from 'path';
import { log } from './logging';

/**
 * A set of configuration options for a {@link Repo}.
 *
 * @property environmentDirectoryPath - The directory that holds the environment
 * that created this repo.
 */
export type RepoOptions = {
  environmentDirectoryPath: string;
};

/**
 * A facade for a Git repository.
 */
export default abstract class Repo {
  /**
   * The directory that holds the environment that created this repo.
   */
  protected environmentDirectoryPath: RepoOptions['environmentDirectoryPath'];

  constructor({ environmentDirectoryPath }: RepoOptions) {
    this.environmentDirectoryPath = environmentDirectoryPath;
  }

  /**
   * Sets up the repo.
   */
  async initialize() {
    await this.create();
    await this.afterCreate();
  }

  /**
   * Creates or overwrites a file in the project that is expected to hold JSON
   * data, with JSON deserialization/serialization handled automatically.
   *
   * @param partialFilePath - The path to the file, with the path to the project
   * directory omitted.
   * @param object - The new object that the file should represent.
   * @returns The result of `fs.promises.writeFile`.
   */
  async writeJsonFile(partialFilePath: string, object: Json): Promise<void> {
    const fullFilePath = this.pathTo(partialFilePath);
    await ensureDirectoryStructureExists(path.dirname(fullFilePath));
    return await writeJsonFile(fullFilePath, object);
  }

  /**
   * Creates or overwrites a file in the project. If the directory where the
   * file is located does not exist, it will be created.
   *
   * @param partialFilePath - The path to the file, with the path to the project
   * directory omitted.
   * @param contents - The desired contents of the file.
   * @returns The result of `fs.promises.writeFile`.
   */
  async writeFile(partialFilePath: string, contents: string): Promise<void> {
    const fullFilePath = this.pathTo(partialFilePath);
    await ensureDirectoryStructureExists(path.dirname(fullFilePath));
    return await writeFile(fullFilePath, contents);
  }

  /**
   * Runs a command within the context of the project.
   *
   * @param executableName - The executable to run.
   * @param args - The arguments to the executable.
   * @param options - Options to `execa`.
   * @returns The result of the command.
   */
  async runCommand(
    executableName: string,
    args?: readonly string[] | undefined,
    options?: ExecaOptions | undefined,
  ): Promise<ExecaChildProcess> {
    const { env, ...remainingOptions } =
      options === undefined ? { env: {} } : options;

    log(
      `[In ${this.getWorkingDirectoryPath()}] Running command \`%s %s\`...`,
      executableName,
      args
        ? args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ')
        : '',
    );

    const result = await execa(executableName, args, {
      all: true,
      cwd: this.getWorkingDirectoryPath(),
      env: {
        ...env,
        DEBUG_COLORS: '1',
      },
      preferLocal: true,
      ...remainingOptions,
    });

    log(
      'Completed command `%s %s`',
      executableName,
      args?.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' '),
    );

    return result;
  }

  /**
   * Custom logic with which to create the repo. Can be overridden in
   * subclasses.
   */
  protected async create(): Promise<void> {
    // no-op
  }

  /**
   * Custom logic with which to further initialize the repo after it is created.
   * By default, this configures Git to use an email and name for commits, and
   * disables GPG signing, which may cause problems in local environments.
   * Can be overridden in subclasses.
   */
  protected async afterCreate(): Promise<void> {
    // no-op
  }

  /**
   * Constructs the path of a file or directory within the project.
   *
   * @param partialEntryPath - The path to the file or directory, with the path
   * to the project directory omitted.
   * @returns The full path to the file or directory.
   */
  protected pathTo(partialEntryPath: string): string {
    return path.resolve(this.getWorkingDirectoryPath(), partialEntryPath);
  }

  /**
   * Returns the directory where the repo is located. Overridden in subclasses.
   */
  abstract getWorkingDirectoryPath(): string;
}
