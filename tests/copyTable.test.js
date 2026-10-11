import { test, expect } from 'bun:test';
import { buildTable } from '../scripts/copy-table.js';
import { BOT } from '../tgcloud/lib/i18n.js';
import en from '../src/lib/strings/en.js';

const lines = buildTable().split('\n');
/** @param {string} l */
const split = (l) => l.replace(/^\| /, '').replace(/\|$/, '').split(/(?<!\\) \| /);

test('every key from both sources appears exactly once, with 4 cells and no raw newline or bare pipe', () => {
  /** @param {string} section */
  const rowsOf = (section) => {
    const s = lines.findIndex((l) => l === `## ${section}`);
    return lines.slice(s + 4, lines.indexOf('', s + 4)).map(split);
  };
  for (const [section, keys] of /** @type {[string, string[]][]} */ ([['Bot messages', Object.keys(BOT.en)], ['App', Object.keys(en)]])) {
    const rows = rowsOf(section);
    expect(rows.map((r) => r[0]).sort()).toEqual([...keys].sort());
    for (const r of rows) expect(r).toHaveLength(4);
  }
  // single-line rows only; pipes inside cells are escaped
  for (const l of lines.filter((/** @type {string} */ l) => l.startsWith('|'))) expect(split(l).length).toBeGreaterThanOrEqual(4);
});
