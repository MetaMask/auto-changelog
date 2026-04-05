/* eslint-disable @typescript-eslint/naming-convention */
import execa from 'execa';

import { getDependencyChanges } from './get-dependency-changes';

jest.mock('execa');

const execaMock = execa as jest.MockedFunction<typeof execa>;

/**
 * Helper to build a mock for execa calls. Enqueues responses in order.
 *
 * @param responses - The mock responses to enqueue.
 */
function mockExecaResponses(...responses: ({ stdout: string } | Error)[]) {
  for (const response of responses) {
    if (response instanceof Error) {
      execaMock.mockRejectedValueOnce(response as never);
    } else {
      execaMock.mockResolvedValueOnce(response as never);
    }
  }
}

describe('getDependencyChanges', () => {
  it('throws BaseRefNotFoundError when on base branch without fromRef (SHA comparison)', async () => {
    // Mock rev-parse HEAD, rev-parse origin/main (same SHA → on base branch)
    mockExecaResponses(
      { stdout: 'abc123' }, // rev-parse HEAD
      { stdout: 'abc123' }, // rev-parse origin/main
    );

    await expect(
      getDependencyChanges({
        manifestPath: '/repo/packages/a/package.json',
      }),
    ).rejects.toThrow('Could not auto-detect git reference');
  });

  it('throws BaseRefNotFoundError when merge-base fails', async () => {
    mockExecaResponses(
      { stdout: 'abc123' }, // rev-parse HEAD
      { stdout: 'def456' }, // rev-parse origin/main (different SHA)
      new Error('no merge base'), // merge-base fails
    );

    await expect(
      getDependencyChanges({
        manifestPath: '/repo/packages/a/package.json',
      }),
    ).rejects.toThrow('Could not auto-detect git reference');
  });

  it('throws BaseRefNotFoundError when base branch ref cannot be resolved', async () => {
    mockExecaResponses(
      { stdout: 'abc123' }, // rev-parse HEAD
      new Error('unknown revision'), // rev-parse origin/main fails
    );

    await expect(
      getDependencyChanges({
        manifestPath: '/repo/packages/a/package.json',
      }),
    ).rejects.toThrow('Could not auto-detect git reference');
  });

  it('returns empty when old file does not exist (new package)', async () => {
    mockExecaResponses(
      new Error('does not exist'), // git show fromRef:path (old file missing)
    );

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result).toStrictEqual({
      dependencyChanges: [],
      prNumbers: [],
      versionChanged: true,
    });
  });

  it('returns empty array when no dependency changes', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      version: '1.0.0',
      dependencies: { '@scope/b': '1.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      version: '1.0.0',
      dependencies: { '@scope/b': '1.0.0' },
    });

    mockExecaResponses(
      { stdout: oldPkg }, // git show fromRef:path
      { stdout: newPkg }, // git show toRef:path
      { stdout: '' }, // git log (no PRs)
    );

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toStrictEqual([]);
  });

  it('detects dependency version bump', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '1.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '2.0.0' },
    });

    mockExecaResponses({ stdout: oldPkg }, { stdout: newPkg }, { stdout: '' });

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result).toStrictEqual({
      dependencyChanges: [
        {
          dependency: '@scope/b',
          isBreaking: false,
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        },
      ],
      prNumbers: [],
      versionChanged: false,
    });
  });

  it('detects peerDependency version bump', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      peerDependencies: { '@scope/b': '1.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      peerDependencies: { '@scope/b': '2.0.0' },
    });

    mockExecaResponses({ stdout: oldPkg }, { stdout: newPkg }, { stdout: '' });

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result).toStrictEqual({
      dependencyChanges: [
        {
          dependency: '@scope/b',
          isBreaking: true,
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        },
      ],
      prNumbers: [],
      versionChanged: false,
    });
  });

  it('detects multiple dependency bumps', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '1.0.0', '@scope/c': '1.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '2.0.0', '@scope/c': '2.0.0' },
    });

    mockExecaResponses({ stdout: oldPkg }, { stdout: newPkg }, { stdout: '' });

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toHaveLength(2);
    expect(result?.dependencyChanges).toContainEqual({
      dependency: '@scope/b',
      isBreaking: false,
      oldVersion: '1.0.0',
      newVersion: '2.0.0',
    });
    expect(result?.dependencyChanges).toContainEqual({
      dependency: '@scope/c',
      isBreaking: false,
      oldVersion: '1.0.0',
      newVersion: '2.0.0',
    });
  });

  it('detects both dependency and peerDependency bumps', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '1.0.0' },
      peerDependencies: { '@scope/c': '1.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '2.0.0' },
      peerDependencies: { '@scope/c': '2.0.0' },
    });

    mockExecaResponses({ stdout: oldPkg }, { stdout: newPkg }, { stdout: '' });

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toHaveLength(2);
    expect(result?.dependencyChanges).toContainEqual({
      dependency: '@scope/b',
      isBreaking: false,
      oldVersion: '1.0.0',
      newVersion: '2.0.0',
    });
    expect(result?.dependencyChanges).toContainEqual({
      dependency: '@scope/c',
      isBreaking: true,
      oldVersion: '1.0.0',
      newVersion: '2.0.0',
    });
  });

  it('ignores devDependencies changes', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      devDependencies: { jest: '28.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      devDependencies: { jest: '29.0.0' },
    });

    mockExecaResponses({ stdout: oldPkg }, { stdout: newPkg }, { stdout: '' });

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toStrictEqual([]);
  });

  it('ignores optionalDependencies changes', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      optionalDependencies: { fsevents: '2.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      optionalDependencies: { fsevents: '2.1.0' },
    });

    mockExecaResponses({ stdout: oldPkg }, { stdout: newPkg }, { stdout: '' });

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toStrictEqual([]);
  });

  it('handles non-scoped package dependencies', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { lodash: '4.17.20' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { lodash: '4.17.21' },
    });

    mockExecaResponses({ stdout: oldPkg }, { stdout: newPkg }, { stdout: '' });

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toStrictEqual([
      {
        dependency: 'lodash',
        isBreaking: false,
        oldVersion: '4.17.20',
        newVersion: '4.17.21',
      },
    ]);
  });

  it('handles caret version ranges', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '^1.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '^2.0.0' },
    });

    mockExecaResponses({ stdout: oldPkg }, { stdout: newPkg }, { stdout: '' });

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toStrictEqual([
      {
        dependency: '@scope/b',
        isBreaking: false,
        oldVersion: '^1.0.0',
        newVersion: '^2.0.0',
      },
    ]);
  });

  it('does not detect change when version is the same', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '1.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '1.0.0' },
    });

    mockExecaResponses({ stdout: oldPkg }, { stdout: newPkg }, { stdout: '' });

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toStrictEqual([]);
  });

  it('auto-detects fromRef using merge-base when on feature branch', async () => {
    const oldPkg = JSON.stringify({ name: '@scope/a' });
    const newPkg = JSON.stringify({ name: '@scope/a' });

    mockExecaResponses(
      { stdout: 'abc123' }, // rev-parse HEAD
      { stdout: 'def456' }, // rev-parse origin/main (different)
      { stdout: 'merge-base-sha' }, // merge-base
      { stdout: oldPkg }, // git show merge-base-sha:path
      { stdout: newPkg }, // git show HEAD:path
      { stdout: '' }, // git log
    );

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
    });

    expect(result).toStrictEqual({
      dependencyChanges: [],
      prNumbers: [],
      versionChanged: false,
    });
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['merge-base', 'HEAD', 'origin/main'],
      expect.objectContaining({ cwd: '/repo/packages/a' }),
    );
  });

  it('uses custom baseBranch for auto-detection', async () => {
    const oldPkg = JSON.stringify({ name: '@scope/a' });
    const newPkg = JSON.stringify({ name: '@scope/a' });

    mockExecaResponses(
      { stdout: 'abc123' }, // rev-parse HEAD
      { stdout: 'def456' }, // rev-parse upstream/develop
      { stdout: 'merge-base-sha' }, // merge-base
      { stdout: oldPkg },
      { stdout: newPkg },
      { stdout: '' },
    );

    await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      baseBranch: 'upstream/develop',
    });

    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['merge-base', 'HEAD', 'upstream/develop'],
      expect.objectContaining({ cwd: '/repo/packages/a' }),
    );
  });

  it('uses custom remote for auto-detection', async () => {
    const oldPkg = JSON.stringify({ name: '@scope/a' });
    const newPkg = JSON.stringify({ name: '@scope/a' });

    mockExecaResponses(
      { stdout: 'abc123' }, // rev-parse HEAD
      { stdout: 'def456' }, // rev-parse upstream/main
      { stdout: 'merge-base-sha' }, // merge-base
      { stdout: oldPkg },
      { stdout: newPkg },
      { stdout: '' },
    );

    await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      remote: 'upstream',
    });

    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['merge-base', 'HEAD', 'upstream/main'],
      expect.objectContaining({ cwd: '/repo/packages/a' }),
    );
  });

  it('throws error when new file cannot be read', async () => {
    const oldPkg = JSON.stringify({ name: '@scope/a' });

    mockExecaResponses(
      { stdout: oldPkg }, // git show fromRef:path (exists)
      new Error('does not exist'), // git show toRef:path (missing)
    );

    await expect(
      getDependencyChanges({
        manifestPath: '/repo/packages/a/package.json',
        fromRef: 'abc123',
      }),
    ).rejects.toThrow('Could not read');
  });

  it('extracts PR numbers from commit history', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '1.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '2.0.0' },
    });

    mockExecaResponses(
      { stdout: oldPkg },
      { stdout: newPkg },
      { stdout: 'Bump @scope/b (#100)\nBump @scope/b (#200)' },
    );

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.prNumbers).toStrictEqual(['100', '200']);
  });

  it('deduplicates PR numbers', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '1.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '2.0.0' },
    });

    mockExecaResponses(
      { stdout: oldPkg },
      { stdout: newPkg },
      { stdout: 'Bump deps (#100)\nAnother bump (#100)' },
    );

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.prNumbers).toStrictEqual(['100']);
  });

  it('extracts multiple PR numbers from a single commit line', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '1.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '2.0.0' },
    });

    mockExecaResponses(
      { stdout: oldPkg },
      { stdout: newPkg },
      { stdout: 'Bump deps (#100) (#200)' },
    );

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.prNumbers).toStrictEqual(['100', '200']);
  });

  it('throws error when old package.json contains malformed JSON', async () => {
    mockExecaResponses(
      { stdout: 'not valid json{' }, // git show fromRef:path
      { stdout: '{}' }, // git show toRef:path (would not be reached)
    );

    await expect(
      getDependencyChanges({
        manifestPath: '/repo/packages/a/package.json',
        fromRef: 'abc123',
      }),
    ).rejects.toThrow('Could not parse');
  });

  it('throws error when new package.json contains malformed JSON', async () => {
    const oldPkg = JSON.stringify({ name: '@scope/a' });

    mockExecaResponses(
      { stdout: oldPkg }, // git show fromRef:path
      { stdout: 'not valid json{' }, // git show toRef:path
    );

    await expect(
      getDependencyChanges({
        manifestPath: '/repo/packages/a/package.json',
        fromRef: 'abc123',
      }),
    ).rejects.toThrow('Could not parse');
  });

  it('returns empty prNumbers when git log fails', async () => {
    const oldPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '1.0.0' },
    });
    const newPkg = JSON.stringify({
      name: '@scope/a',
      dependencies: { '@scope/b': '2.0.0' },
    });

    mockExecaResponses(
      { stdout: oldPkg },
      { stdout: newPkg },
      new Error('git log failed'), // git log fails
    );

    const result = await getDependencyChanges({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.prNumbers).toStrictEqual([]);
    expect(result?.dependencyChanges).toHaveLength(1);
  });
});
