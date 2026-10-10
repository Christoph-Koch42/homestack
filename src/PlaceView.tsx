import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRightLeft, Pencil, Plus, ScanLine, Trash2 } from 'lucide-react';
import { addItem, patchItem, patchPlace, useStore } from './store';
import { useScanAndOpen } from './scan';
import {
  containerPath,
  contentsCount,
  descendants,
  placeChain,
  placeContainer,
  placeLabel,
  plural,
  roomOfPlace,
} from './search';
import { containerParam, rememberContainer } from './nav';
import { PLACE_TYPE_LABELS, type Container, type Item, type Place } from './types';
import PlacePicker from './PlacePicker';
import Section from './ui/Section';
import ListRow, { RowList } from './ui/ListRow';
import CodeTag from './ui/CodeTag';
import Button from './ui/Button';
import IconBox from './ui/IconBox';
import Dialog from './ui/Dialog';
import Composition from './ui/Composition';
import { useToast } from './ui/Toast';
import './PlaceView.css';

const LAST_CATEGORY_KEY = 'homestack.lastCategory';

interface Props {
  container: Container;
  highlight: string | null;
}

// One screen for a room or a place: what's inside, add, move, remove.
export default function PlaceView({ container, highlight }: Props) {
  const store = useStore();
  const toast = useToast();
  const scanAndOpen = useScanAndOpen();

  const room = container.kind === 'room' ? store.rooms.get(container.id) : undefined;
  const place = container.kind === 'place' ? store.places.get(container.id) : undefined;

  const [movingItem, setMovingItem] = useState<Item | null>(null);
  const [movingPlace, setMovingPlace] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Container | null>(null);

  useEffect(() => rememberContainer(container), [container]);

  const subPlaces = useMemo(
    () =>
      [...store.places.values()]
        .filter((p) =>
          container.kind === 'place'
            ? p.parentId === container.id
            : !p.parentId && p.roomId === container.id,
        )
        .sort((a, b) => placeLabel(a).localeCompare(placeLabel(b), 'de')),
    [store.places, container],
  );

  const items = useMemo(
    () =>
      store.items
        .filter(
          (i) =>
            i.status === 'active' &&
            (container.kind === 'place'
              ? i.placeId === container.id
              : !i.placeId && i.roomId === container.id),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [store.items, container],
  );

  if (!store.loaded) return <p className="label">Loading…</p>;
  if (!room && !place) {
    return (
      <div className="empty">
        <p className="empty__text">This place no longer exists.</p>
        <Button onClick={() => (window.location.hash = '#/')}>Home</Button>
      </div>
    );
  }

  const roomId = place ? (roomOfPlace(place.id, store.places) ?? place.roomId) : container.id;
  const crumbs: { label: string; href: string }[] = [];
  if (place) {
    const chain = placeChain(place.id, store.places);
    crumbs.push({ label: store.rooms.get(chain[0]?.roomId ?? '')?.name ?? '?', href: `#/room/${chain[0]?.roomId}` });
    for (const p of chain.slice(0, -1)) crumbs.push({ label: placeLabel(p), href: `#/place/${p.id}` });
  }

  // ---- Moves ----
  const moveItemTo = (item: Item, target: Container) => {
    const before = { placeId: item.placeId, roomId: item.roomId };
    patchItem(item.id, targetFields(target, store.places));
    setMovingItem(null);
    toast(`Moved to ${containerPath(target, store).join(' › ')}`, {
      label: 'Undo',
      run: () => patchItem(item.id, before),
    });
  };

  const removeItem = (item: Item) => {
    patchItem(item.id, { status: 'removed', removedAt: Date.now() });
    toast(`Removed “${item.name}”`, {
      label: 'Undo',
      run: () => patchItem(item.id, { status: 'active', removedAt: null }),
    });
  };

  const confirmPlaceMove = () => {
    if (!place || !confirmTarget) return;
    const before = { parentId: place.parentId, roomId: place.roomId };
    const fields = confirmTarget.kind === 'room'
      ? { parentId: null, roomId: confirmTarget.id }
      : { parentId: confirmTarget.id, roomId: roomOfPlace(confirmTarget.id, store.places) ?? '' };
    patchPlace(place.id, fields);
    setConfirmTarget(null);
    toast(`Moved to ${containerPath(confirmTarget, store).join(' › ')}`, {
      label: 'Undo',
      run: () => patchPlace(place.id, before),
    });
  };

  const blocked = place ? new Set([place.id, ...descendants(place.id, store.places)]) : undefined;
  const moving = place ? contentsCount(place.id, store) : { places: 0, items: 0 };

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="crumbs label">
          <li><a href="#/">Home</a></li>
          {crumbs.map((c) => (
            <li key={c.href}><a href={c.href}>{c.label}</a></li>
          ))}
        </ol>
      </nav>

      <header className="pv__hero">
        {place?.code ? (
          <>
            <h1 className="pv__code num">{place.code}</h1>
            <p className="pv__name">{place.name || 'Unnamed'}</p>
          </>
        ) : (
          <h1 className="pv__title">{room?.name ?? place?.name}</h1>
        )}
        <p className="label pv__type">
          {place ? PLACE_TYPE_LABELS[place.type] : 'Room'}
          {place?.category ? ` · ${place.category}` : ''}
        </p>
      </header>

      <div className="pv__grid">
        <div className="pv__main">
          <Section
            num={1}
            title={`Inside ${subPlaces.length ? `(${subPlaces.length})` : ''}`}
            action={
              <Button
                variant="secondary"
                icon={<Plus strokeWidth={2.5} size={18} />}
                onClick={() => (window.location.hash = `#/place/new?in=${containerParam(container)}`)}
              >
                Place
              </Button>
            }
          >
            {subPlaces.length === 0 ? (
              <p className="pv__hint">No shelves or boxes here yet.</p>
            ) : (
              <RowList>
                {subPlaces.map((p) => {
                  const n = contentsCount(p.id, store);
                  return (
                    <ListRow
                      key={p.id}
                      href={`#/place/${p.id}`}
                      lead={p.code ? <CodeTag code={p.code} /> : undefined}
                      title={placeLabel(p)}
                      meta={`${PLACE_TYPE_LABELS[p.type]} · ${plural(n.items, 'item', 'items')}${n.places ? ` · ${plural(n.places, 'place', 'places')}` : ''}`}
                    />
                  );
                })}
              </RowList>
            )}
          </Section>

          <Section num={2} title={`Items ${items.length ? `(${items.length})` : ''}`}>
            {items.length === 0 ? (
              <div className="empty">
                <Composition size={80} />
                <p className="pv__hint">Empty. Add items with the field at the bottom.</p>
              </div>
            ) : (
              <RowList>
                {items.map((i) => (
                  <ItemRow
                    key={i.id}
                    item={i}
                    highlight={i.id === highlight}
                    onMove={() => setMovingItem(i)}
                    onRemove={() => removeItem(i)}
                  />
                ))}
              </RowList>
            )}
          </Section>
        </div>

        <aside className="pv__side swiss-dots">
          <p className="label">Location</p>
          <p className="pv__path">
            {place ? containerPath(placeContainer(place), store).join(' › ') : 'Top level'}
          </p>
          {place?.notes && (
            <>
              <p className="label">Notes</p>
              <p className="pv__notes">{place.notes}</p>
            </>
          )}
          {place && (
            <div className="actions">
              <Button variant="secondary" icon={<Pencil strokeWidth={2.5} size={18} />} onClick={() => (window.location.hash = `#/place/${place.id}/edit`)}>
                Edit
              </Button>
              <Button variant="secondary" icon={<ArrowRightLeft strokeWidth={2.5} size={18} />} onClick={() => setMovingPlace(true)}>
                Move
              </Button>
            </div>
          )}
        </aside>
      </div>

      <BatchAdd container={container} roomId={roomId} onScan={scanAndOpen} />

      <PlacePicker
        open={movingItem !== null}
        title={`Move “${movingItem?.name ?? ''}”`}
        current={container}
        onPick={(target) => movingItem && moveItemTo(movingItem, target)}
        onClose={() => setMovingItem(null)}
      />

      {place && (
        <>
          <PlacePicker
            open={movingPlace}
            title={`Move ${place.code ?? placeLabel(place)}`}
            blocked={blocked}
            current={placeContainer(place)}
            onPick={(target) => {
              setMovingPlace(false);
              setConfirmTarget(target);
            }}
            onClose={() => setMovingPlace(false)}
          />
          <MoveConfirm
            place={place}
            target={confirmTarget}
            moving={moving}
            onCancel={() => setConfirmTarget(null)}
            onConfirm={confirmPlaceMove}
          />
        </>
      )}
    </>
  );
}

function targetFields(target: Container, places: Map<string, Place>) {
  return target.kind === 'room'
    ? { placeId: null, roomId: target.id }
    : { placeId: target.id, roomId: roomOfPlace(target.id, places) ?? '' };
}

function ItemRow({ item, highlight, onMove, onRemove }: { item: Item; highlight: boolean; onMove: () => void; onRemove: () => void }) {
  useEffect(() => {
    if (highlight) document.getElementById(`item-${item.id}`)?.scrollIntoView({ block: 'center' });
  }, [highlight, item.id]);
  return (
    <ListRow
      id={`item-${item.id}`}
      highlight={highlight}
      title={item.name}
      meta={[item.category, item.quantity > 1 ? `${item.quantity}×` : ''].filter(Boolean).join(' · ') || ' '}
      trail={
        <span className="pv__rowactions">
          <IconBox label={`Move ${item.name}`} onClick={onMove}>
            <ArrowRightLeft strokeWidth={2.5} size={18} />
          </IconBox>
          <IconBox label={`Remove ${item.name}`} onClick={onRemove}>
            <Trash2 strokeWidth={2.5} size={18} />
          </IconBox>
        </span>
      }
    />
  );
}

// Moving a container moves everything inside: say so, and make Cancel the default.
function MoveConfirm({
  place,
  target,
  moving,
  onCancel,
  onConfirm,
}: {
  place: Place;
  target: Container | null;
  moving: { places: number; items: number };
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const store = useStore();
  const from = containerPath(placeContainer(place), store);
  const to = target ? containerPath(target, store) : [];
  return (
    <Dialog open={target !== null} title={`Move ${place.code ?? placeLabel(place)}?`} onClose={onCancel}>
      <dl className="mc">
        <dt className="label">From</dt>
        <dd className="mc__path">{from.join(' › ')}</dd>
        <dt className="label">To</dt>
        <dd className="mc__path mc__path--to">{to.join(' › ')}</dd>
      </dl>
      <p className="mc__count">
        <span className="mc__num num">{moving.items}</span>
        <span className="mc__what">
          {moving.items === 1 ? 'item' : 'items'}
          {moving.places > 0 ? ` and ${plural(moving.places, 'place', 'places')}` : ''} move with it
        </span>
      </p>
      <div className="dialog__actions">
        <Button variant="secondary" size="lg" onClick={onCancel} autoFocus>
          Cancel
        </Button>
        <Button variant="accent" size="lg" onClick={onConfirm}>
          Move
        </Button>
      </div>
    </Dialog>
  );
}

function BatchAdd({ container, roomId, onScan }: { container: Container; roomId: string; onScan: () => void }) {
  const { categories } = useStore();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(() => {
    try {
      return localStorage.getItem(LAST_CATEGORY_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addItem({
      name: trimmed,
      category,
      placeId: container.kind === 'place' ? container.id : null,
      roomId,
    });
    setName('');
    inputRef.current?.focus();
  };

  return (
    <form className="bottombar batch" onSubmit={submit} aria-label="Add items">
      <label className="visually-hidden" htmlFor="batch-name">New item</label>
      <input
        id="batch-name"
        ref={inputRef}
        className="batch__name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add item"
        enterKeyHint="enter"
        autoComplete="off"
      />
      <label className="visually-hidden" htmlFor="batch-cat">Category</label>
      <select
        id="batch-cat"
        className="batch__cat"
        value={category}
        onChange={(e) => {
          setCategory(e.target.value);
          try {
            localStorage.setItem(LAST_CATEGORY_KEY, e.target.value);
          } catch {
            // Remembering the category is a convenience only.
          }
        }}
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>
      <IconBox label="Add item" type="submit" className="batch__add" disabled={!name.trim()}>
        <Plus strokeWidth={3} />
      </IconBox>
      <IconBox label="Scan a label" onClick={onScan}>
        <ScanLine strokeWidth={2.5} />
      </IconBox>
    </form>
  );
}

