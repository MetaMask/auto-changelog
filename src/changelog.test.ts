import Changelog from './changelog';

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
});
