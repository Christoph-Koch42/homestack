import { useId, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { deleteCategory, deleteRoom, genId, saveCategory, saveRoom, useStore } from './store';
import { itemsInRoom, normalize } from './search';
import type { Room } from './types';
import Section from './ui/Section';
import IconBox from './ui/IconBox';
import { useToast } from './ui/Toast';
import './ListAdmin.css';

function AddForm({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (name: string) => string | null }) {
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = value.trim();
    if (!name) return;
    const err = onAdd(name);
    setError(err);
    if (!err) setValue('');
  };
  return (
    <form className="la__add" onSubmit={submit}>
      <label className="visually-hidden" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="la__input"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      <IconBox label={label} type="submit" className="la__plus" disabled={!value.trim()}>
        <Plus strokeWidth={3} />
      </IconBox>
      {error && <p className="la__error" role="alert">{error}</p>}
    </form>
  );
}

export function RoomsAdmin() {
  const store = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const rooms = store.roomList;

  const exists = (name: string, except?: string) =>
    rooms.some((r) => r.id !== except && normalize(r.name) === normalize(name));

  const add = (name: string) => {
    if (exists(name)) return `“${name}” already exists.`;
    const last = rooms.at(-1);
    saveRoom({ id: genId(), name, sortOrder: (last?.sortOrder ?? 0) + 10 });
    return null;
  };

  // Swap sort positions with the neighbour; rewrite both so equal values can't stick.
  const shift = (index: number, dir: -1 | 1) => {
    const other = rooms[index + dir];
    if (!other) return;
    saveRoom({ ...rooms[index], sortOrder: (index + dir) * 10 });
    saveRoom({ ...other, sortOrder: index * 10 });
  };

  const rename = (room: Room) => {
    const name = draft.trim();
    if (name && !exists(name, room.id)) saveRoom({ ...room, name });
    setEditing(null);
  };

  const inUse = (roomId: string) =>
    itemsInRoom(roomId, store) > 0 || [...store.places.values()].some((p) => !p.parentId && p.roomId === roomId);

  return (
    <>
      <h1 className="page-title">Rooms</h1>
      <Section num={1} title="Add a room">
        <AddForm label="Add room" placeholder="z.B. Keller, Veloraum, Estrich" onAdd={add} />
      </Section>
      <Section num={2} title={`Your rooms (${rooms.length})`} className="la__section">
        <ol className="la__list">
          {rooms.map((r, i) => (
            <li key={r.id} className="la__row">
              <span className="la__idx num">{String(i + 1).padStart(2, '0')}</span>
              {editing === r.id ? (
                <form
                  className="la__rename"
                  onSubmit={(e) => {
                    e.preventDefault();
                    rename(r);
                  }}
                >
                  <label className="visually-hidden" htmlFor={`rename-${r.id}`}>New name</label>
                  <input id={`rename-${r.id}`} className="la__input" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                  <IconBox label="Save name" type="submit"><Check strokeWidth={2.5} /></IconBox>
                  <IconBox label="Cancel rename" onClick={() => setEditing(null)}><X strokeWidth={2.5} /></IconBox>
                </form>
              ) : (
                <>
                  <a className="la__name" href={`#/room/${r.id}`}>{r.name}</a>
                  <span className="la__tools">
                    <IconBox label={`Move ${r.name} up`} disabled={i === 0} onClick={() => shift(i, -1)}><ArrowUp strokeWidth={2.5} size={18} /></IconBox>
                    <IconBox label={`Move ${r.name} down`} disabled={i === rooms.length - 1} onClick={() => shift(i, 1)}><ArrowDown strokeWidth={2.5} size={18} /></IconBox>
                    <IconBox
                      label={`Rename ${r.name}`}
                      onClick={() => {
                        setDraft(r.name);
                        setEditing(r.id);
                      }}
                    >
                      <Pencil strokeWidth={2.5} size={18} />
                    </IconBox>
                    <IconBox
                      label={inUse(r.id) ? `${r.name} is not empty` : `Delete ${r.name}`}
                      disabled={inUse(r.id)}
                      onClick={() => {
                        deleteRoom(r.id);
                        toast(`Deleted ${r.name}`, { label: 'Undo', run: () => saveRoom(r) });
                      }}
                    >
                      <Trash2 strokeWidth={2.5} size={18} />
                    </IconBox>
                  </span>
                </>
              )}
            </li>
          ))}
        </ol>
        {rooms.length > 0 && <p className="label la__note">Only empty rooms can be deleted.</p>}
      </Section>
    </>
  );
}

export function CategoriesAdmin() {
  const { categories } = useStore();
  const toast = useToast();

  const add = (name: string) => {
    if (categories.some((c) => normalize(c.name) === normalize(name))) return `“${name}” already exists.`;
    saveCategory(name);
    return null;
  };

  return (
    <>
      <h1 className="page-title">Categories</h1>
      <Section num={1} title="Add a category">
        <AddForm label="Add category" placeholder="z.B. Velo, Fotografie" onAdd={add} />
      </Section>
      <Section num={2} title={`Categories (${categories.length})`} className="la__section">
        <ul className="la__chips">
          {categories.map((c) => (
            <li key={c.id} className="la__chip">
              <span>{c.name}</span>
              <button
                type="button"
                className="la__chipx"
                aria-label={`Delete ${c.name}`}
                onClick={() => {
                  deleteCategory(c.id);
                  toast(`Deleted ${c.name}`, { label: 'Undo', run: () => saveCategory(c.name) });
                }}
              >
                <X strokeWidth={3} size={16} />
              </button>
            </li>
          ))}
        </ul>
        <p className="label la__note">Deleting a category keeps it on items that already use it.</p>
      </Section>
    </>
  );
}
