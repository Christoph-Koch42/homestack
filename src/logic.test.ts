// Quick logic checks: node --experimental-strip-types src/logic.test.ts
import assert from 'node:assert/strict';
import { formatCode, parseCodeList, parseScanned, parseTyped } from './codes.ts';
import { containerPath, contentsCount, descendants, normalize, search, type Lookup } from './search.ts';
import type { Item, Place, Room } from './types.ts';

// codes
assert.equal(formatCode('P', 42), 'P-0042');
assert.deepEqual(parseScanned('P-0042'), { type: 'P', code: 'P-0042' });
assert.equal(parseScanned('https://example.com'), null);
assert.equal(parseScanned('P-42'), null);
assert.equal(parseTyped('42'), 'P-0042');
assert.equal(parseTyped('p42'), 'P-0042');
assert.equal(parseTyped('P 42'), 'P-0042');
assert.equal(parseTyped('P-0042'), 'P-0042');
assert.equal(parseTyped('i7'), 'I-0007');
assert.equal(parseTyped('hello'), null);
assert.deepEqual(parseCodeList('12, 15-17, P-0031', 'P'), ['P-0012', 'P-0015', 'P-0016', 'P-0017', 'P-0031']);

// normalize: case, umlauts, ß
assert.equal(normalize('Maße'), normalize('MASSE'));
assert.equal(normalize('Schläuche'), normalize('Schlaeuche'));
assert.equal(normalize('Schläuche'), normalize('schlauche'));

// data
const room = (id: string, name: string): Room => ({ id, name, sortOrder: 0 });
const place = (id: string, name: string, roomId: string, parentId: string | null, code: string | null = null): Place => ({
  id, code, name, type: 'box', roomId, parentId, category: '', keywords: [], notes: '', createdAt: 0, updatedAt: 0,
});
const item = (id: string, name: string, placeId: string | null, roomId: string): Item => ({
  id, name, category: 'Saisonal/Weihnachten', placeId, roomId, quantity: 1, notes: '', code: null,
  status: 'active', removedAt: null, createdAt: 0, updatedAt: 0,
});
const places = [
  place('shelf', 'Regal 1', 'keller', null, 'P-0001'),
  place('board', 'Brett 2', 'stale-room', 'shelf'), // nested: roomId ignored
  place('box', 'Weihnachtsdeko', 'stale-room', 'board', 'P-0042'),
];
const lk: Lookup = {
  rooms: new Map([['keller', room('keller', 'Keller')]]),
  places: new Map(places.map((p) => [p.id, p])),
  items: [item('a', 'Lichterkette', 'box', ''), item('b', 'Christbaumständer', 'box', ''), item('c', 'Velopumpe', null, 'keller')],
};

assert.deepEqual(containerPath({ kind: 'place', id: 'box' }, lk), ['Keller', 'Regal 1', 'Brett 2', 'Weihnachtsdeko']);
assert.deepEqual([...descendants('shelf', lk.places)].sort(), ['board', 'box']);
assert.deepEqual(contentsCount('shelf', lk), { places: 2, items: 2 });

const hits = search('lichter', lk);
assert.equal(hits[0].kind, 'item');
assert.deepEqual(hits[0].path, ['Keller', 'Regal 1', 'Brett 2', 'Weihnachtsdeko']);
assert.equal(search('staender', lk)[0]?.kind, 'item'); // ä typed as ae
assert.equal(search('P-0042', lk)[0]?.kind, 'place');
assert.equal(search('weihnacht', lk).length >= 3, true); // box + items via category/path
assert.equal(search('nothing-here', lk).length, 0);

// cycle safety: a corrupted parent loop must not hang
const loop = new Map([['x', place('x', 'X', 'keller', 'y')], ['y', place('y', 'Y', 'keller', 'x')]]);
assert.equal(descendants('x', loop).size, 2);
assert.ok(containerPath({ kind: 'place', id: 'x' }, { ...lk, places: loop }).length <= 3);

console.log('all logic checks passed');
