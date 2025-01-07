import os from 'os';
import {
  directoryExists,
  ensureDirectoryStructureExists,
  forceRemove,
} from '@metamask/utils/node';
import path from 'path';

import { ROOT_DIR } from './constants';
import Environment, { EnvironmentOptions } from './environment';

/**
 * Information about the file sandbox provided to tests that need temporary
 * access to the filesystem.
 */
export type FileSandbox = {
  directoryPath: string;
  withinSandbox: (
    fn: (args: { directoryPath: string }) => Promise<void>,
  ) => Promise<void>;
};

/**
 * Builds a project in a temporary directory, then calls the given function with
 * information about that project.
 *
 * @param options - The configuration options for the environment.
 * @param fn - A function which will be called with an object that can be
 * used to interact with the project.
 */
export async function withinProjectEnvironment(
  options: Omit<EnvironmentOptions, 'directoryPath'>,
  fn: (environment: Environment) => Promise<void>,
): Promise<void>;

/**
 * Builds a project in a temporary directory, then calls the given function with
 * information about that project.
 *
 * @param fn - A function which will be called with an object that can be
 * used to interact with the project.
 */
export async function withinProjectEnvironment(
  fn: (environment: Environment) => void | Promise<void>,
): Promise<void>;

// Documentation is provided above.
// eslint-disable-next-line jsdoc/require-jsdoc
export async function withinProjectEnvironment(
  ...args:
    | [
        Omit<EnvironmentOptions, 'directoryPath'>,
        (environment: Environment) => void | Promise<void>,
      ]
    | [(environment: Environment) => void | Promise<void>]
): Promise<void> {
  const [options, fn] = args.length === 2 ? args : [{}, args[0]];

  const { withinSandbox } = createSandbox('auto-changelog-tests');

  return await withinSandbox(async ({ directoryPath }) => {
    const environment = new Environment({
      directoryPath,
      ...options,
    });
    await environment.initialize();
    return await fn(environment);
  });
}

/**
 * Construct a sandbox object which can be used in tests that need temporary
 * access to the filesystem.
 *
 * Copied from `@metamask/utils` so that we can place the sandbox in a known
 * place and view files created inside of it after the test ends.
 *
 * @param projectName - The name of the project.
 * @returns The sandbox object. This contains a `withinSandbox` function which
 * can be used in tests (see example).
 * @example
 * ```typescript
 * const { withinSandbox } = createSandbox('utils');
 *
 * // ... later ...
 *
 * it('does something with the filesystem', async () => {
 *   await withinSandbox(async ({ directoryPath }) => {
 *     await fs.promises.writeFile(
 *       path.join(directoryPath, 'some-file'),
 *       'some content',
 *       'utf8'
 *     );
 *   })
 * });
 * ```
 */
function createSandbox(projectName: string): FileSandbox {
  const directoryPath = path.join('/tmp', projectName);

  return {
    directoryPath,
    async withinSandbox(
      test: (args: { directoryPath: string }) => Promise<void>,
    ) {
      await forceRemove(directoryPath);
      await ensureDirectoryStructureExists(directoryPath);

      await test({ directoryPath });
    },
  };
}
