import _outdent from 'outdent';

import Changelog from './changelog';
import { ChangeCategory } from './constants';

const outdent = _outdent({ trimTrailingNewline: false });

const emptyChangelog = `# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

[Unreleased]: fake://metamask.io/
`;

describe('Changelog', () => {
  it('should allow creating an empty changelog', async () => {
    const changelog = new Changelog({
      repoUrl: 'fake://metamask.io',
    });

    expect(await changelog.toString()).toStrictEqual(emptyChangelog);
  });

  it('should allow creating an empty changelog with a custom tag prefix', async () => {
    const changelog = new Changelog({
      repoUrl: 'fake://metamask.io',
      tagPrefix: 'example@v',
    });

    expect(await changelog.toString()).toStrictEqual(emptyChangelog);
  });

  it('should recreate pull request links for change entries based on the repo URL', async () => {
    const changelog = new Changelog({
      repoUrl: 'https://github.com/MetaMask/fake-repo',
    });
    changelog.addRelease({ version: '1.0.0' });
    changelog.addChange({
      version: '1.0.0',
      category: ChangeCategory.Changed,
      description: 'This is a cool change\n  - This is a sub-bullet',
      prNumbers: ['100', '200'],
    });
    changelog.addChange({
      version: '1.0.0',
      category: ChangeCategory.Changed,
      description: 'This is a very cool change\nAnd another line',
      prNumbers: ['300'],
    });

    expect(await changelog.toString()).toStrictEqual(outdent`
      # Changelog
      All notable changes to this project will be documented in this file.

      The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
      and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

      ## [Unreleased]

      ## [1.0.0]
      ### Changed
      - This is a very cool change ([#300](https://github.com/MetaMask/fake-repo/pull/300))
      And another line
      - This is a cool change ([#100](https://github.com/MetaMask/fake-repo/pull/100), [#200](https://github.com/MetaMask/fake-repo/pull/200))
        - This is a sub-bullet

      [Unreleased]: https://github.com/MetaMask/fake-repo/compare/v1.0.0...HEAD
      [1.0.0]: https://github.com/MetaMask/fake-repo/releases/tag/v1.0.0
    `);
  });
});
