import _outdent from 'outdent';

import { generateDiff } from './generate-diff';

const outdent = _outdent({ trimTrailingNewline: false });

const testCases = [
  {
    description: 'should return an empty string when comparing empty files',
    before: '\n',
    after: '\n',
    expected: '',
  },
  {
    description: 'should return an empty string when comparing identical files',
    before: 'abc\n',
    after: 'abc\n',
    expected: '',
  },
  {
    description: 'should display one-line diff',
    before: 'abc\n',
    after: '123\n',
    expected: '-abc\n+123',
  },
  {
    description:
      'should display one-line diff of file without trailing newlines',
    before: 'abc',
    after: '123',
    expected: outdent`
      -abc
      \\ No newline at end of file
      +123
      \\ No newline at end of file`,
  },
  {
    description: 'should display multi-line diff',
    before: outdent`
      a
      b
      c
      `,
    after: outdent`
      1
      2
      3
      `,
    expected: outdent`
      -a
      -b
      -c
      +1
      +2
      +3`,
  },
  {
    description: 'should display multi-line diff without trailing newline',
    before: outdent`
      a
      b
      c`,
    after: outdent`
      1
      2
      3`,
    expected: outdent`
      -a
      -b
      -c
      \\ No newline at end of file
      +1
      +2
      +3
      \\ No newline at end of file`,
  },
  {
    description: 'should display multi-line diff with added trailing newline',
    before: outdent`
      a
      b
      c`,
    after: outdent`
      1
      2
      3
      `,
    expected: outdent`
      -a
      -b
      -c
      \\ No newline at end of file
      +1
      +2
      +3`,
  },
  {
    description: 'should display multi-line diff with removed trailing newline',
    before: outdent`
      a
      b
      c
      `,
    after: outdent`
      1
      2
      3`,
    expected: outdent`
      -a
      -b
      -c
      +1
      +2
      +3
      \\ No newline at end of file`,
  },
  {
    description: 'should display multi-line diff with removed middle newline',
    before: outdent`
      a
      b

      c
      `,
    after: outdent`
      1
      2
      3
      `,
    expected: outdent`
      -a
      -b
      -
      -c
      +1
      +2
      +3`,
  },
  {
    description: 'should display multi-line diff with added middle newline',
    before: outdent`
      a
      b
      c
      `,
    after: outdent`
      1
      2

      3
      `,
    expected: outdent`
      -a
      -b
      -c
      +1
      +2
      +
      +3`,
  },
  {
    description: 'should display diff of added newline in middle of file',
    before: outdent`
      a
      b
      c
      `,
    after: outdent`
      a
      b

      c
      `,
    expected: outdent`
      ${outdent}
       a
       b
      +
       c`,
  },
  {
    description: 'should display diff of added newline at end of file',
    before: outdent`
      a
      b
      c`,
    after: outdent`
      a
      b
      c
      `,
    expected: outdent`
      ${outdent}
       a
       b
      -c
      \\ No newline at end of file
      +c`,
  },
  {
    description: 'should display diff of removed newline at end of file',
    before: outdent`
      a
      b
      c
      `,
    after: outdent`
      a
      b
      c`,
    expected: outdent`
      ${outdent}
       a
       b
      -c
      +c
      \\ No newline at end of file`,
  },
  {
    description: 'should display one line of context before and after change',
    before: outdent`
      a
      b
      c
      `,
    after: outdent`
      a
      c
      `,
    expected: outdent`
      ${outdent}
       a
      -b
       c`,
  },
  {
    description: 'should display two lines of context before and after change',
    before: outdent`
      a
      b
      c
      d
      e
      f
      g
      `,
    after: outdent`
      a
      b
      c
      e
      f
      g
      `,
    expected: outdent`
      ${outdent}
       b
       c
      -d
       e
       f`,
  },
  {
    description: 'should not repeat context of changes one line apart',
    before: outdent`
      a
      b
      c
      `,
    after: outdent`
      b
      `,
    expected: outdent`
      -a
       b
      -c`,
  },
  {
    description: 'should not repeat context of changes two lines apart',
    before: outdent`
      a
      b
      c
      d
      `,
    after: outdent`
      b
      c
      `,
    expected: outdent`
      -a
       b
       c
      -d`,
  },
  {
    description: 'should not repeat context of changes three lines apart',
    before: outdent`
      a
      b
      c
      d
      e
      `,
    after: outdent`
      b
      c
      d
      `,
    expected: outdent`
      -a
       b
       c
       d
      -e`,
  },
];

describe('generateDiff', () => {
  for (const { description, before, after, expected } of testCases) {
    it(`${description}`, async () => {
      const diff = generateDiff(before, after);
      expect(diff).toStrictEqual(expected);
    });
  }
});
