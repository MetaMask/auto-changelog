import execa from 'execa';
import * as fs from 'fs';
import path from 'path';

import { checkDependencyBumps } from './check-dependency-bumps';
import {
  updateDependencyChangelogs,
  validateDependencyChangelogs,
} from './dependency-changelog';

jest.mock('execa');
jest.mock('./dependency-changelog');

const execaMock = execa as unknown as jest.MockedFunction<typeof execa>;
const validateMock = validateDependencyChangelogs as jest.MockedFunction<
  typeof validateDependencyChangelogs
>;
const updateMock = updateDependencyChangelogs as jest.MockedFunction<
  typeof updateDependencyChangelogs
>;

const stdout = { write: jest.fn() };
const stderr = { write: jest.fn() };

describe('check-dependency-bumps', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    stdout.write.mockReset();
    stderr.write.mockReset();
  });

  it('returns empty when on default branch without fromRef', async () => {
    execaMock.mockResolvedValueOnce({ stdout: 'main' } as any);

    const result = await checkDependencyBumps({
      projectRoot: '/repo',
      stdout,
      stderr,
    });

    expect(result).toStrictEqual({});
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      expect.objectContaining({ cwd: '/repo' }),
    );
  });

  it('returns empty when no package.json changes are found', async () => {
    execaMock.mockResolvedValueOnce({ stdout: '' } as any);

    const result = await checkDependencyBumps({
      projectRoot: '/repo',
      fromRef: 'abc123',
      stdout,
      stderr,
    });

    expect(result).toStrictEqual({});
    expect(stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('No package.json changes found'),
    );
  });

  it('detects dependency bumps and triggers validation and fixing', async () => {
    const diffWithDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
index 1234567..890abcd 100644
--- a/packages/controller-utils/package.json
+++ b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   },
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diffWithDeps } as any);

    jest
      .spyOn(fs.promises, 'readFile')
      .mockImplementation(
        async (filePath: fs.PathLike | fs.promises.FileHandle) => {
          const asString = filePath.toString();

          if (
            asString.endsWith(
              path.join('packages', 'controller-utils', 'package.json'),
            )
          ) {
            return JSON.stringify({ name: '@metamask/controller-utils' });
          }

          throw new Error(`Unexpected read: ${asString}`);
        },
      );

    validateMock.mockResolvedValue([
      {
        package: 'controller-utils',
        hasChangelog: true,
        hasUnreleasedSection: true,
        missingEntries: [],
        existingEntries: ['@metamask/transaction-controller'],
        checkedVersion: null,
      },
    ]);
    updateMock.mockResolvedValue(1);

    const result = await checkDependencyBumps({
      projectRoot: '/repo',
      fromRef: 'abc123',
      repoUrl: 'https://github.com/example/repo',
      fix: true,
      stdout,
      stderr,
    });

    expect(result).toStrictEqual({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'controller-utils': {
        packageName: '@metamask/controller-utils',
        dependencyChanges: [
          {
            package: 'controller-utils',
            dependency: '@metamask/transaction-controller',
            type: 'dependencies',
            oldVersion: '^61.0.0',
            newVersion: '^62.0.0',
          },
        ],
      },
    });
    expect(validateMock).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ repoUrl: 'https://github.com/example/repo' }),
    );
  });
});
