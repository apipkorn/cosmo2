// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import graphics from '../../assets/catalogs/graphics.json';
import transportation from '../../assets/catalogs/transportation.json';
import {
  badge,
  buildIndex,
  buildLibrary,
  dateLabel,
  folderPath,
  formatSize,
  isCatalog,
  isRecent,
  search,
  type Catalog,
} from './catalog';

const sample: Catalog = {
  version: 't1',
  folders: [
    { id: 'films', name: 'Films', parent: null, description: '', assetIds: ['1'] },
    { id: 'films-wrap', name: 'Wrap', parent: 'films', description: '', assetIds: ['1', '2'] },
    { id: 'clean', name: 'Cleaning', parent: null, description: '', assetIds: ['3', 'missing'] },
    { id: 'empty', name: 'Empty', parent: null, description: '', assetIds: [] },
    { id: 'films-empty', name: 'Also empty', parent: 'films', description: '', assetIds: ['missing'] },
  ],
  assets: [
    { id: '1', title: 'Wrap Film 1080 Bulletin', kind: 'pdf', url: 'https://x.test/1.pdf', created: '2024-05-01', docType: 'Instruction Bulletin' },
    { id: '2', title: 'Bubble Removal', kind: 'video', url: 'https://x.test/2', description: 'Using wrap film series 1080', created: '2025-01-01' },
    { id: '3', title: 'Floor Pad', kind: 'pdf', url: 'https://x.test/3.pdf', lit: '75-3470', docType: '3M Warranty' },
  ],
};
const index = buildIndex(sample);

test('folder tree and counts', () => {
  assert.deepEqual(index.roots.map((f) => f.id), ['films', 'clean']); // empty folders are hidden
  assert.deepEqual(index.children.get('films')?.map((f) => f.id), ['films-wrap']);
  assert.equal(index.totals.get('films'), 2); // asset 1 is counted once
  assert.equal(index.totals.get('clean'), 1); // unknown ids are ignored
  assert.deepEqual(index.placements.get('1')?.map((f) => f.id), ['films', 'films-wrap']);
  assert.deepEqual(folderPath(index, 'films-wrap').map((f) => f.name), ['Films', 'Wrap']);
});

test('search needs every word and ranks title matches first', () => {
  assert.deepEqual(search(index, 'wrap 1080').map((a) => a.id), ['1', '2']);
  assert.deepEqual(search(index, '75-3470').map((a) => a.id), ['3']);
  assert.deepEqual(search(index, 'wrap floor'), []);
  assert.deepEqual(search(index, '   '), []);
});

test('formatSize', () => {
  assert.equal(formatSize(undefined), '');
  assert.equal(formatSize(2048), '2 KB');
  assert.equal(formatSize(5 * 1024 * 1024), '5.0 MB');
});

test('isCatalog rejects bad downloads', () => {
  assert.equal(isCatalog(sample), true);
  assert.equal(isCatalog({ version: 'x', folders: [], assets: [{ id: 1 }] }), false);
  assert.equal(isCatalog('<html>Not found</html>'), false);
  assert.equal(isCatalog(null), false);
});

for (const [name, bundled] of Object.entries({ graphics, transportation })) {
  test(`the ${name} catalog is valid and every folder reference resolves`, () => {
    assert.equal(isCatalog(bundled), true);
    const real = buildIndex(bundled as Catalog);
    for (const f of real.folders.values()) {
      for (const id of f.assetIds) assert.ok(real.assets.has(id), `${f.id} -> ${id}`);
    }
    assert.ok(buildLibrary(real, () => true, 'new').length > 0);
  });
}
test('library groups parts > categories > subfolders and sorts', () => {
  const parts = buildLibrary(index, () => true, 'new');
  assert.deepEqual(parts.map((p) => p.name), ['Films', 'Cleaning']);
  // Films has items of its own, so it is a category too, before its subfolders.
  assert.deepEqual(parts[0].categories.map((c) => [c.name, c.count]), [['Films', 1], ['Wrap', 2]]);
  assert.deepEqual(parts[0].categories[1].groups[0].assets.map((a) => a.id), ['2', '1']); // newest first
  const az = buildLibrary(index, () => true, 'az');
  assert.deepEqual(az[0].categories[1].groups[0].assets.map((a) => a.id), ['2', '1']); // B before W
  const filtered = buildLibrary(index, (a) => a.id === '3', 'new');
  assert.deepEqual(filtered.map((p) => p.name), ['Cleaning']);
});

test('dates and badges', () => {
  assert.equal(dateLabel('2025-12-08'), 'Dec 2025');
  assert.equal(dateLabel(undefined), 'n.d.');
  assert.equal(isRecent('2026-06-01', new Date('2026-11-18')), true);
  assert.equal(isRecent('2024-06-01', new Date('2026-11-18')), false);
  assert.equal(isRecent(undefined), false);
  assert.deepEqual(badge(sample.assets[0]), { text: 'Instruction Bulletin', style: 'red' });
  assert.deepEqual(badge(sample.assets[1]), { text: 'Video', style: 'black' });
  assert.deepEqual(badge(sample.assets[2]), { text: '3M Warranty', style: 'outline' });
});

