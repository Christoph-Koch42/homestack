import type { Container, Item, Place, Room } from './types';

// Case- and umlaut-insensitive: "Maße", "MASSE", "masse" match; "ä" = "ae" = "a".
// Applied to both the query and the text, so the ae -> a folding stays consistent.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u');
}

export interface Lookup {
  rooms: Map<string, Room>;
  places: Map<string, Place>;
  items: Item[];
}

// Ancestors of a place, top first, ending with the place itself. Cycle-safe.
export function placeChain(placeId: string, places: Map<string, Place>): Place[] {
  const chain: Place[] = [];
  const seen = new Set<string>();
  let cur = places.get(placeId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? places.get(cur.parentId) : undefined;
  }
  return chain;
}

export function roomOfPlace(placeId: string, places: Map<string, Place>): string | undefined {
  return placeChain(placeId, places)[0]?.roomId;
}

export function roomOfItem(item: Item, places: Map<string, Place>): string {
  return (item.placeId && roomOfPlace(item.placeId, places)) || item.roomId;
}

export function placeLabel(p: Place): string {
  return p.name || p.code || 'Unnamed';
}

// Human path, e.g. ["Keller", "Regal 1", "Brett 2", "Weihnachten"]
export function containerPath(c: Container | null, lk: Lookup): string[] {
  if (!c) return [];
  if (c.kind === 'room') return [lk.rooms.get(c.id)?.name ?? '?'];
  const chain = placeChain(c.id, lk.places);
  const room = chain[0] ? (lk.rooms.get(chain[0].roomId)?.name ?? '?') : '?';
  return [room, ...chain.map(placeLabel)];
}

export function itemContainer(item: Item): Container {
  return item.placeId ? { kind: 'place', id: item.placeId } : { kind: 'room', id: item.roomId };
}

export function placeContainer(p: Place): Container {
  return p.parentId ? { kind: 'place', id: p.parentId } : { kind: 'room', id: p.roomId };
}

// All places below a place (not including itself).
export function descendants(placeId: string, places: Map<string, Place>): Set<string> {
  const children = new Map<string, string[]>();
  for (const p of places.values()) {
    if (p.parentId) children.set(p.parentId, [...(children.get(p.parentId) ?? []), p.id]);
  }
  const out = new Set<string>();
  const stack = [...(children.get(placeId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

// What moves along when a place moves: sub-places and active items in it or below.
export function contentsCount(placeId: string, lk: Lookup): { places: number; items: number } {
  const below = descendants(placeId, lk.places);
  const inside = new Set([placeId, ...below]);
  const items = lk.items.filter(
    (i) => i.status === 'active' && i.placeId !== null && inside.has(i.placeId),
  ).length;
  return { places: below.size, items };
}

export function itemsInRoom(roomId: string, lk: Lookup): number {
  return lk.items.filter((i) => i.status === 'active' && roomOfItem(i, lk.places) === roomId)
    .length;
}

export type SearchHit =
  | { kind: 'item'; item: Item; path: string[]; score: number }
  | { kind: 'place'; place: Place; path: string[]; score: number };

// Every query word must appear somewhere; hits in the name rank higher.
export function search(query: string, lk: Lookup, limit = 50): SearchHit[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: SearchHit[] = [];

  const scoreOf = (name: string, rest: string): number | null => {
    const n = normalize(name);
    const all = `${n} ${normalize(rest)}`;
    if (!words.every((w) => all.includes(w))) return null;
    let score = 0;
    for (const w of words) {
      if (n.startsWith(w)) score += 3;
      else if (n.includes(w)) score += 2;
      else score += 1;
    }
    return score;
  };

  for (const item of lk.items) {
    if (item.status !== 'active') continue;
    const path = containerPath(itemContainer(item), lk);
    const s = scoreOf(item.name, `${item.category} ${item.notes} ${path.join(' ')}`);
    if (s !== null) hits.push({ kind: 'item', item, path, score: s });
  }
  for (const place of lk.places.values()) {
    const path = containerPath(placeContainer(place), lk);
    const s = scoreOf(
      `${place.name} ${place.code ?? ''}`,
      `${place.category} ${place.keywords.join(' ')} ${place.notes} ${path.join(' ')}`,
    );
    if (s !== null) hits.push({ kind: 'place', place, path, score: s + 0.5 });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

// "1 item", "3 items"
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
