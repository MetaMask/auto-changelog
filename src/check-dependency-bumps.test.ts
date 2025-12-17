import execa from 'execa';
import fs from 'fs/promises';
import os from 'os';
import _outdent from 'outdent';
import path from 'path';

import {
  getDependencyChangesForPackage,
  updateSinglePackageChangelog,
} from './check-dependency-bumps';

const outdent = _outdent({ trimTrailingNewline: false });

jest.mock('execa');

const execaMock = execa as jest.MockedFunction<typeof execa>;

const testFormatter = async (content: string) => content;

describe('getDependencyChangesForPackage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns null when on base branch without fromRef', async () => {
    // Mock getCurrentBranchName to return 'origin/main'
    execaMock.mockResolvedValueOnce({ stdout: 'origin/main' } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
    });

    expect(result).toBeNull();
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      expect.objectContaining({ cwd: '/repo/packages/a' }),
    );
  });

  it('returns null when merge-base fails', async () => {
    // Mock getCurrentBranchName to return a feature branch
    execaMock.mockResolvedValueOnce({ stdout: 'feature-branch' } as never);
    // Mock getMergeBase to fail
    execaMock.mockRejectedValueOnce(new Error('no merge base'));

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
    });

    expect(result).toBeNull();
  });

  it('returns empty when no diff is found', async () => {
    execaMock.mockResolvedValueOnce({ stdout: '' } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result).toStrictEqual({
      dependencyChanges: [],
      versionBump: undefined,
    });
  });

  it('returns empty array when diff has no dependency changes', async () => {
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,5 +1,5 @@
 {
   "name": "@scope/a",
-  "version": "1.0.0"
+  "version": "1.0.1"
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toStrictEqual([]);
  });

  it('detects dependency version bump', async () => {
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,7 +1,7 @@
 {
   "name": "@scope/a",
   "dependencies": {
-    "@scope/b": "1.0.0"
+    "@scope/b": "2.0.0"
   }
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result).toStrictEqual({
      dependencyChanges: [
        {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        },
      ],
      versionBump: undefined,
    });
  });

  it('detects peerDependency version bump', async () => {
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,7 +1,7 @@
 {
   "name": "@scope/a",
   "peerDependencies": {
-    "@scope/b": "1.0.0"
+    "@scope/b": "2.0.0"
   }
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result).toStrictEqual({
      dependencyChanges: [
        {
          dependency: '@scope/b',
          type: 'peerDependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        },
      ],
      versionBump: undefined,
    });
  });

  it('detects multiple dependency bumps', async () => {
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,8 +1,8 @@
 {
   "name": "@scope/a",
   "dependencies": {
-    "@scope/b": "1.0.0",
-    "@scope/c": "1.0.0"
+    "@scope/b": "2.0.0",
+    "@scope/c": "2.0.0"
   }
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toHaveLength(2);
    expect(result?.dependencyChanges).toContainEqual({
      dependency: '@scope/b',
      type: 'dependencies',
      oldVersion: '1.0.0',
      newVersion: '2.0.0',
    });
    expect(result?.dependencyChanges).toContainEqual({
      dependency: '@scope/c',
      type: 'dependencies',
      oldVersion: '1.0.0',
      newVersion: '2.0.0',
    });
  });

  it('detects both dependency and peerDependency bumps', async () => {
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,10 +1,10 @@
 {
   "name": "@scope/a",
   "dependencies": {
-    "@scope/b": "1.0.0"
+    "@scope/b": "2.0.0"
   },
   "peerDependencies": {
-    "@scope/c": "1.0.0"
+    "@scope/c": "2.0.0"
   }
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toHaveLength(2);
    expect(result?.dependencyChanges).toContainEqual({
      dependency: '@scope/b',
      type: 'dependencies',
      oldVersion: '1.0.0',
      newVersion: '2.0.0',
    });
    expect(result?.dependencyChanges).toContainEqual({
      dependency: '@scope/c',
      type: 'peerDependencies',
      oldVersion: '1.0.0',
      newVersion: '2.0.0',
    });
  });

  it('ignores devDependencies changes', async () => {
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,7 +1,7 @@
 {
   "name": "@scope/a",
   "devDependencies": {
-    "jest": "28.0.0"
+    "jest": "29.0.0"
   }
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toStrictEqual([]);
  });

  it('ignores optionalDependencies changes', async () => {
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,7 +1,7 @@
 {
   "name": "@scope/a",
   "optionalDependencies": {
-    "fsevents": "2.0.0"
+    "fsevents": "2.1.0"
   }
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toStrictEqual([]);
  });

  it('detects package version bump', async () => {
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,5 +1,5 @@
 {
   "name": "@scope/a",
-  "version": "1.0.0"
+  "version": "2.0.0"
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.versionBump).toBe('2.0.0');
  });

  it('detects both package version bump and dependency changes', async () => {
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,8 +1,8 @@
 {
   "name": "@scope/a",
-  "version": "1.0.0",
+  "version": "2.0.0",
   "dependencies": {
-    "@scope/b": "1.0.0"
+    "@scope/b": "2.0.0"
   }
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.versionBump).toBe('2.0.0');
    expect(result?.dependencyChanges).toStrictEqual([
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ]);
  });

  it('handles non-scoped package dependencies', async () => {
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,7 +1,7 @@
 {
   "name": "@scope/a",
   "dependencies": {
-    "lodash": "4.17.20"
+    "lodash": "4.17.21"
   }
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toStrictEqual([
      {
        dependency: 'lodash',
        type: 'dependencies',
        oldVersion: '4.17.20',
        newVersion: '4.17.21',
      },
    ]);
  });

  it('handles caret version ranges', async () => {
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,7 +1,7 @@
 {
   "name": "@scope/a",
   "dependencies": {
-    "@scope/b": "^1.0.0"
+    "@scope/b": "^2.0.0"
   }
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toStrictEqual([
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '^1.0.0',
        newVersion: '^2.0.0',
      },
    ]);
  });

  it('does not detect change when version is the same', async () => {
    // This simulates a diff where a line was removed and re-added with same version
    // (e.g., due to reordering)
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,7 +1,7 @@
 {
   "name": "@scope/a",
   "dependencies": {
-    "@scope/b": "1.0.0"
+    "@scope/b": "1.0.0"
   }
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    expect(result?.dependencyChanges).toStrictEqual([]);
  });

  it('deduplicates when same dependency appears multiple times in diff', async () => {
    // This simulates a complex diff where the same dependency change appears in multiple hunks
    const diff = `
diff --git a/packages/a/package.json b/packages/a/package.json
index 1234567..890abcd 100644
--- a/packages/a/package.json
+++ b/packages/a/package.json
@@ -1,10 +1,10 @@
 {
   "name": "@scope/a",
   "dependencies": {
-    "@scope/b": "1.0.0",
+    "@scope/b": "2.0.0",
     "@scope/c": "1.0.0"
   }
 }
@@ -15,5 +15,5 @@
   "dependencies": {
-    "@scope/b": "1.0.0"
+    "@scope/b": "2.0.0"
   }
 }
`;

    execaMock.mockResolvedValueOnce({ stdout: diff } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      fromRef: 'abc123',
    });

    // Should only have one entry for @scope/b, not two
    expect(result?.dependencyChanges).toStrictEqual([
      {
        dependency: '@scope/b',
        type: 'dependencies',
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      },
    ]);
  });

  it('auto-detects fromRef using merge-base when on feature branch', async () => {
    // Mock getCurrentBranchName
    execaMock.mockResolvedValueOnce({ stdout: 'feature-branch' } as never);
    // Mock getMergeBase
    execaMock.mockResolvedValueOnce({ stdout: 'merge-base-sha' } as never);
    // Mock git diff
    execaMock.mockResolvedValueOnce({ stdout: '' } as never);

    const result = await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
    });

    expect(result).toStrictEqual({
      dependencyChanges: [],
      versionBump: undefined,
    });
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['merge-base', 'HEAD', 'origin/main'],
      expect.objectContaining({ cwd: '/repo/packages/a' }),
    );
  });

  it('uses custom baseBranch for auto-detection', async () => {
    // Mock getCurrentBranchName
    execaMock.mockResolvedValueOnce({ stdout: 'feature-branch' } as never);
    // Mock getMergeBase
    execaMock.mockResolvedValueOnce({ stdout: 'merge-base-sha' } as never);
    // Mock git diff
    execaMock.mockResolvedValueOnce({ stdout: '' } as never);

    await getDependencyChangesForPackage({
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
    // Mock getCurrentBranchName
    execaMock.mockResolvedValueOnce({ stdout: 'feature-branch' } as never);
    // Mock getMergeBase
    execaMock.mockResolvedValueOnce({ stdout: 'merge-base-sha' } as never);
    // Mock git diff
    execaMock.mockResolvedValueOnce({ stdout: '' } as never);

    await getDependencyChangesForPackage({
      manifestPath: '/repo/packages/a/package.json',
      remote: 'upstream',
    });

    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['merge-base', 'HEAD', 'upstream/main'],
      expect.objectContaining({ cwd: '/repo/packages/a' }),
    );
  });
});

describe('updateSinglePackageChangelog', () => {
  let tempDir: string;
  let changelogPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'changelog-test-'));
    changelogPath = path.join(tempDir, 'CHANGELOG.md');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('updates changelog with dependency changes', async () => {
    const initialChangelog = outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      [Unreleased]: https://github.com/test/repo/
    `;

    await fs.writeFile(changelogPath, initialChangelog);

    const result = await updateSinglePackageChangelog({
      changelogPath,
      dependencyChanges: [
        {
          dependency: '@scope/b',
          type: 'dependencies',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
        },
      ],
      prNumber: '123',
      repoUrl: 'https://github.com/test/repo',
      formatter: testFormatter,
      tagPrefix: 'v',
    });

    expect(result).toContain('Bump `@scope/b` from `1.0.0` to `2.0.0`');
    expect(result).toContain('#123');
  });
});
