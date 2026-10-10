import { useState, type FormEvent } from 'react';
import { MapPin, Trash2 } from 'lucide-react';
import { deletePlace, genId, savePlace, useStore } from './store';
import { containerPath, contentsCount, descendants, placeContainer, roomOfPlace } from './search';
import { lastContainer, navigate, parseContainerParam } from './nav';
import { parseTyped } from './codes';
import { PLACE_TYPE_LABELS, type Container, type Place, type PlaceType } from './types';
import PlacePicker from './PlacePicker';
import Field, { SelectField } from './ui/Field';
import Button from './ui/Button';
import Dialog from './ui/Dialog';
import Section from './ui/Section';
import { useToast } from './ui/Toast';
import './PlaceForm.css';

const TYPES = Object.keys(PLACE_TYPE_LABELS) as PlaceType[];

interface Props {
  placeId?: string;
  query: URLSearchParams;
}

// Register a freshly scanned label, or edit an existing place.
export default function PlaceForm({ placeId, query }: Props) {
  const store = useStore();
  const toast = useToast();
  const existing = placeId ? store.places.get(placeId) : undefined;

  const initialLocation = (): Container | null => {
    if (existing) return placeContainer(existing);
    const c = parseContainerParam(query.get('in')) ?? lastContainer();
    if (c && (c.kind === 'room' ? store.rooms.has(c.id) : store.places.has(c.id))) return c;
    return store.roomList[0] ? { kind: 'room', id: store.roomList[0].id } : null;
  };

  const [code, setCode] = useState(existing?.code ?? query.get('code') ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<PlaceType>(existing?.type ?? 'box');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [location, setLocation] = useState<Container | null>(initialLocation);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!store.loaded) return <p className="label">Loading…</p>;
  if (placeId && !existing) return <p className="empty__text">This place no longer exists.</p>;

  if (store.roomList.length === 0) {
    return (
      <div className="empty">
        <p className="empty__text">Add a room first, then register places in it.</p>
        <Button variant="primary" size="lg" onClick={() => navigate('rooms')}>
          Add rooms
        </Button>
      </div>
    );
  }

  const blocked = existing ? new Set([existing.id, ...descendants(existing.id, store.places)]) : undefined;
  const contents = existing ? contentsCount(existing.id, store) : null;
  const canDelete = contents !== null && contents.items === 0 && contents.places === 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalizedCode = code.trim() ? parseTyped(code, 'P') : null;
    if (code.trim() && (!normalizedCode || !normalizedCode.startsWith('P-'))) {
      setError('Label code must look like P-0042.');
      return;
    }
    const owner = normalizedCode ? store.placeByCode.get(normalizedCode) : undefined;
    if (owner && owner.id !== existing?.id) {
      setError(`${normalizedCode} already belongs to “${owner.name || owner.code}”.`);
      return;
    }
    if (!name.trim() && !normalizedCode) {
      setError('Give it a name or a label code.');
      return;
    }
    if (!location) {
      setError('Choose where it is.');
      return;
    }
    const now = Date.now();
    const place: Place = {
      id: existing?.id ?? genId(),
      code: normalizedCode,
      name: name.trim(),
      type,
      roomId: location.kind === 'room' ? location.id : (roomOfPlace(location.id, store.places) ?? ''),
      parentId: location.kind === 'place' ? location.id : null,
      category,
      keywords: existing?.keywords ?? [],
      notes: notes.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    savePlace(place);
    toast(existing ? 'Saved' : `${place.code ?? place.name} registered`);
    navigate(`place/${place.id}`, true);
  };

  const remove = () => {
    if (!existing) return;
    const back = placeContainer(existing);
    deletePlace(existing.id);
    setConfirmDelete(false);
    toast(`Deleted ${existing.code ?? existing.name}`);
    navigate(`${back.kind}/${back.id}`, true);
  };

  return (
    <>
      <p className="label pf__kicker">{existing ? 'Edit place' : 'New place'}</p>
      <h1 className="page-title num">{code.trim() ? (parseTyped(code, 'P') ?? code) : existing ? 'Edit' : 'New place'}</h1>

      <form className="pf" onSubmit={submit} noValidate>
        <Section num={1} title="What">
          <fieldset className="pf__types">
            <legend className="label">Type</legend>
            {TYPES.map((t) => (
              <label key={t} className={`pf__type ${type === t ? 'pf__type--on' : ''}`}>
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="visually-hidden"
                />
                {PLACE_TYPE_LABELS[t]}
              </label>
            ))}
          </fieldset>
          <div className="pf__fields">
            <Field
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Weihnachtsdeko, Regal links"
              autoFocus={!existing}
            />
            <SelectField label="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">None</option>
              {store.categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </SelectField>
            <Field
              label="Label code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="P-0042"
              autoCapitalize="characters"
              hint="Optional. Scanned labels fill this in."
            />
          </div>
        </Section>

        <Section num={2} title="Where">
          <div className="pf__where">
            <p className="pf__path">{location ? containerPath(location, store).join(' › ') : 'Not chosen'}</p>
            <Button variant="secondary" icon={<MapPin strokeWidth={2.5} size={18} />} onClick={() => setPicking(true)}>
              Change
            </Button>
          </div>
        </Section>

        <Section num={3} title="Notes">
          <label className="visually-hidden" htmlFor="pf-notes">Notes</label>
          <textarea
            id="pf-notes"
            className="pf__notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </Section>

        {error && <p className="pf__error" role="alert">{error}</p>}

        <div className="pf__actions">
          <Button variant="secondary" size="lg" onClick={() => history.back()}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" size="lg">
            {existing ? 'Save' : 'Register'}
          </Button>
        </div>

        {existing && (
          <div className="pf__danger">
            <Button
              variant="ghost"
              icon={<Trash2 strokeWidth={2.5} size={18} />}
              disabled={!canDelete}
              onClick={() => setConfirmDelete(true)}
            >
              Delete place
            </Button>
            {!canDelete && <p className="label">Empty it first: move or remove what's inside.</p>}
          </div>
        )}
      </form>

      <PlacePicker
        open={picking}
        title="Where is it?"
        blocked={blocked}
        current={location}
        onPick={(c) => {
          setLocation(c);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />

      <Dialog open={confirmDelete} title="Delete this place?" onClose={() => setConfirmDelete(false)}>
        <p className="pf__confirm">{existing?.code ?? existing?.name} will be gone. Its label can be registered again later.</p>
        <div className="dialog__actions">
          <Button variant="secondary" size="lg" onClick={() => setConfirmDelete(false)} autoFocus>
            Cancel
          </Button>
          <Button variant="accent" size="lg" onClick={remove}>
            Delete
          </Button>
        </div>
      </Dialog>
    </>
  );
}
