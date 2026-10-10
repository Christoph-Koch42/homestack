import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { formatCode, type CodeType } from './codes';
import { normalize, type Lookup } from './search';
import {
  DEFAULT_CATEGORIES,
  type Category,
  type Counters,
  type Item,
  type Place,
  type Room,
} from './types';

// crypto.randomUUID() only exists in secure contexts (HTTPS/localhost),
// so it throws when testing over a plain http://<lan-ip> dev server.
export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Writes are fire-and-forget on purpose: Firestore applies them to the local
// cache immediately, but the promise only settles once the server confirms,
// which never happens in the basement. Awaiting would freeze the UI offline.
function fire(p: Promise<unknown>, what: string) {
  p.catch((err) => console.error(`HomeStack: ${what} failed`, err));
}

interface Snap<T> {
  list: T[];
  pending: number;
  fromCache: boolean;
  loaded: boolean;
}

const EMPTY = { list: [], pending: 0, fromCache: true, loaded: false };

function useCollection<T>(name: string, fill: (d: DocumentData, id: string) => T): Snap<T> {
  const [snap, setSnap] = useState<Snap<T>>(EMPTY);
  useEffect(
    () =>
      onSnapshot(
        collection(db, name),
        { includeMetadataChanges: true },
        (s) =>
          setSnap({
            list: s.docs.map((d) => fill(d.data(), d.id)),
            pending: s.docs.filter((d) => d.metadata.hasPendingWrites).length,
            fromCache: s.metadata.fromCache,
            loaded: true,
          }),
        (err) => {
          // E.g. permission denied: show what we have instead of "Loading" forever.
          console.error(`HomeStack: reading ${name} failed`, err);
          setSnap((prev) => ({ ...prev, loaded: true }));
        },
      ),
    [name, fill],
  );
  return snap;
}

// Fill in fields added after some documents were already saved.
const fillRoom = (d: DocumentData, id: string): Room => ({
  id,
  name: d.name ?? '',
  sortOrder: d.sortOrder ?? 0,
});

const fillPlace = (d: DocumentData, id: string): Place => ({
  id,
  code: d.code ?? null,
  name: d.name ?? '',
  type: d.type ?? 'box',
  roomId: d.roomId ?? '',
  parentId: d.parentId ?? null,
  category: d.category ?? '',
  keywords: d.keywords ?? [],
  notes: d.notes ?? '',
  createdAt: d.createdAt ?? 0,
  updatedAt: d.updatedAt ?? 0,
});

const fillItem = (d: DocumentData, id: string): Item => ({
  id,
  name: d.name ?? '',
  category: d.category ?? '',
  placeId: d.placeId ?? null,
  roomId: d.roomId ?? '',
  quantity: d.quantity ?? 1,
  notes: d.notes ?? '',
  code: d.code ?? null,
  status: d.status ?? 'active',
  removedAt: d.removedAt ?? null,
  createdAt: d.createdAt ?? 0,
  updatedAt: d.updatedAt ?? 0,
});

const fillCategory = (d: DocumentData, id: string): Category => ({ id, name: d.name ?? '' });

const fillMeta = (d: DocumentData, id: string): Counters & { id: string } => ({
  id,
  nextP: d.nextP ?? 1,
  nextI: d.nextI ?? 1,
});

export interface Store extends Lookup {
  roomList: Room[];
  categories: Category[];
  counters: Counters;
  pending: number;
  offline: boolean;
  loaded: boolean;
  placeByCode: Map<string, Place>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const rooms = useCollection('rooms', fillRoom);
  const places = useCollection('places', fillPlace);
  const items = useCollection('items', fillItem);
  const categories = useCollection('categories', fillCategory);
  const meta = useCollection('meta', fillMeta);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // First run: seed the German default categories, but only once the server
  // has confirmed the collection is really empty (not just an empty cache).
  // Ids derive from the name, so a second device seeding too changes nothing.
  useEffect(() => {
    if (categories.loaded && !categories.fromCache && categories.list.length === 0) {
      const batch = writeBatch(db);
      for (const name of DEFAULT_CATEGORIES) {
        batch.set(doc(db, 'categories', categoryId(name)), { name });
      }
      fire(batch.commit(), 'seeding categories');
    }
  }, [categories]);

  const store = useMemo<Store>(() => {
    const placeMap = new Map(places.list.map((p) => [p.id, p]));
    const counters = meta.list.find((m) => m.id === 'counters');
    return {
      rooms: new Map(rooms.list.map((r) => [r.id, r])),
      roomList: [...rooms.list].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'de'),
      ),
      places: placeMap,
      placeByCode: new Map(places.list.filter((p) => p.code).map((p) => [p.code!, p])),
      items: items.list,
      categories: [...categories.list].sort((a, b) => a.name.localeCompare(b.name, 'de')),
      counters: { nextP: counters?.nextP ?? 1, nextI: counters?.nextI ?? 1 },
      pending: rooms.pending + places.pending + items.pending + categories.pending,
      offline: !online || (rooms.loaded && rooms.fromCache),
      loaded: rooms.loaded && places.loaded && items.loaded,
    };
  }, [rooms, places, items, categories, meta, online]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export function categoryId(name: string): string {
  return `cat-${normalize(name).replace(/[^a-z0-9]+/g, '-')}`;
}

// ---- Writes ----

export function saveRoom(room: Room) {
  const { id, ...data } = room;
  fire(setDoc(doc(db, 'rooms', id), data), 'saving room');
}

export function deleteRoom(id: string) {
  fire(deleteDoc(doc(db, 'rooms', id)), 'deleting room');
}

export function saveCategory(name: string) {
  fire(setDoc(doc(db, 'categories', categoryId(name)), { name }), 'saving category');
}

export function deleteCategory(id: string) {
  fire(deleteDoc(doc(db, 'categories', id)), 'deleting category');
}

export function savePlace(place: Place) {
  const { id, ...data } = place;
  fire(setDoc(doc(db, 'places', id), { ...data, updatedAt: Date.now() }), 'saving place');
}

export function patchPlace(id: string, patch: Partial<Omit<Place, 'id'>>) {
  fire(updateDoc(doc(db, 'places', id), { ...patch, updatedAt: Date.now() }), 'updating place');
}

export function deletePlace(id: string) {
  fire(deleteDoc(doc(db, 'places', id)), 'deleting place');
}

export function addItem(fields: Pick<Item, 'name' | 'category' | 'placeId' | 'roomId'>): string {
  const id = genId();
  const now = Date.now();
  const item: Omit<Item, 'id'> = {
    ...fields,
    quantity: 1,
    notes: '',
    code: null,
    status: 'active',
    removedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  fire(setDoc(doc(db, 'items', id), item), 'adding item');
  return id;
}

export function patchItem(id: string, patch: Partial<Omit<Item, 'id'>>) {
  fire(updateDoc(doc(db, 'items', id), { ...patch, updatedAt: Date.now() }), 'updating item');
}

// Hands out the next label numbers. Needs a connection (a transaction must
// talk to the server), which is fine: labels are printed upstairs.
export async function reserveCodes(type: CodeType, count: number): Promise<string[]> {
  if (!navigator.onLine) throw new Error('offline');
  const ref = doc(db, 'meta', 'counters');
  const field = type === 'P' ? 'nextP' : 'nextI';
  const start = await Promise.race([
    runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const next: number = snap.exists() ? (snap.data()[field] ?? 1) : 1;
      tx.set(ref, { [field]: next + count }, { merge: true });
      return next;
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
  ]);
  return Array.from({ length: count }, (_, i) => formatCode(type, start + i));
}
