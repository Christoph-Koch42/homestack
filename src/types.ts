export type PlaceType = 'zone' | 'shelf' | 'board' | 'box' | 'other';

export interface Room {
  id: string;
  name: string;
  sortOrder: number;
}

// A place sits directly in a room (parentId null) or inside another place.
// roomId is only authoritative on top-level places; nested places inherit
// their room from the top of their chain (see search.ts roomOfPlace), so
// moving a shelf to another room is a single write.
export interface Place {
  id: string;
  code: string | null; // printed label, e.g. P-0042
  name: string;
  type: PlaceType;
  roomId: string;
  parentId: string | null;
  category: string;
  keywords: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export type ItemStatus = 'active' | 'removed';

// Same rule as places: placeId null means "loose in the room" (roomId).
export interface Item {
  id: string;
  name: string;
  category: string;
  placeId: string | null;
  roomId: string;
  quantity: number;
  notes: string;
  code: string | null; // item label I-0042 (release 2)
  status: ItemStatus;
  removedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface Counters {
  nextP: number;
  nextI: number;
}

// Where something lives: a room or a place.
export type Container = { kind: 'room'; id: string } | { kind: 'place'; id: string };

export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  zone: 'Zone',
  shelf: 'Shelf',
  board: 'Board',
  box: 'Box',
  other: 'Other',
};

export const DEFAULT_CATEGORIES = [
  'Werkzeug',
  'Elektro',
  'Saisonal/Weihnachten',
  'Sport',
  'Camping',
  'Haushalt',
  'Garten',
  'Dokumente',
  'Diverses',
];
