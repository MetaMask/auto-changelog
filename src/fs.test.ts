import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { readFile, writeFile } from './fs';

describe('fs', () => {
  describe('readFile', () => {
    let tempDir: string;
    let changelogPath: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-test-'));
      changelogPath = path.join(tempDir, 'CHANGELOG.md');
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('reads changelog file successfully', async () => {
      const changelogContent = `# Changelog
  All notable changes to this project will be documented in this file.

  ## [Unreleased]
  `;

      await writeFile(changelogPath, changelogContent);

      const result = await readFile(changelogPath);

      expect(result).toBe(changelogContent);
    });

    it('reads changelog file with UTF-8 encoding', async () => {
      const changelogContent = `# Changelog
  All notable changes to this project will be documented in this file.

  ## [Unreleased]
  ### Added
  - ✨ New feature with emoji
  - 日本語のテスト
  `;

      await writeFile(changelogPath, changelogContent);

      const result = await readFile(changelogPath);

      expect(result).toBe(changelogContent);
    });

    it('reads empty file successfully', async () => {
      await writeFile(changelogPath, '');

      const result = await readFile(changelogPath);

      expect(result).toBe('');
    });

    it('reads file with only whitespace', async () => {
      const whitespaceContent = '   \n\t  \n  ';

      await writeFile(changelogPath, whitespaceContent);

      const result = await readFile(changelogPath);

      expect(result).toBe(whitespaceContent);
    });

    it('reads file with special characters and newlines', async () => {
      const specialContent = `Line 1
Line 2 with "quotes" and 'apostrophes'
Line 3 with \`backticks\` and $variables
Line 4 with \\backslashes\\ and /forward/slashes
`;

      await writeFile(changelogPath, specialContent);

      const result = await readFile(changelogPath);

      expect(result).toBe(specialContent);
    });

    it('throws error with ENOENT code when file does not exist', async () => {
      const nonExistentPath = path.join(tempDir, 'NONEXISTENT.md');

      await expect(readFile(nonExistentPath)).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });
  });

  describe('writeFile', () => {
    let tempDir: string;
    let filePath: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-file-test-'));
      filePath = path.join(tempDir, 'test-file.md');
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('writes file successfully', async () => {
      const content = `# Test File
This is a test file.
`;

      await writeFile(filePath, content);

      const result = await fs.readFile(filePath, 'utf8');
      expect(result).toBe(content);
    });

    it('writes file with UTF-8 encoding', async () => {
      const content = `# Test File
- ✨ New feature with emoji
- 日本語のテスト
- Café résumé
`;

      await writeFile(filePath, content);

      const result = await fs.readFile(filePath, 'utf8');
      expect(result).toBe(content);
    });

    it('writes empty file successfully', async () => {
      await writeFile(filePath, '');

      const result = await fs.readFile(filePath, 'utf8');
      expect(result).toBe('');
    });

    it('writes file with only whitespace', async () => {
      const whitespaceContent = '   \n\t  \n  ';

      await writeFile(filePath, whitespaceContent);

      const result = await fs.readFile(filePath, 'utf8');
      expect(result).toBe(whitespaceContent);
    });

    it('writes file with special characters and newlines', async () => {
      const specialContent = `Line 1
Line 2 with "quotes" and 'apostrophes'
Line 3 with \`backticks\` and $variables
Line 4 with \\backslashes\\ and /forward/slashes
`;

      await writeFile(filePath, specialContent);

      const result = await fs.readFile(filePath, 'utf8');
      expect(result).toBe(specialContent);
    });

    it('overwrites existing file', async () => {
      const initialContent = 'Initial content';
      const newContent = 'New content';

      await writeFile(filePath, initialContent);
      await writeFile(filePath, newContent);

      const result = await fs.readFile(filePath, 'utf8');
      expect(result).toBe(newContent);
      expect(result).not.toBe(initialContent);
    });

    it('creates file in nested directory', async () => {
      const nestedDir = path.join(tempDir, 'nested', 'subdir');
      const nestedFilePath = path.join(nestedDir, 'file.md');
      const content = 'Nested file content';

      await fs.mkdir(nestedDir, { recursive: true });
      await writeFile(nestedFilePath, content);

      const result = await fs.readFile(nestedFilePath, 'utf8');
      expect(result).toBe(content);
    });

    it('writes large file content', async () => {
      const largeContent = `${'A'.repeat(10000)}\n${'B'.repeat(10000)}`;

      await writeFile(filePath, largeContent);

      const result = await fs.readFile(filePath, 'utf8');
      expect(result).toBe(largeContent);
      expect(result).toHaveLength(largeContent.length);
    });
  });
});
