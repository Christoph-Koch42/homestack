import { useMemo, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { useStore } from './store';
import { useScan } from './scan';
import { normalize, placeLabel } from './search';
import { PLACE_TYPE_LABELS, type Container, type Place } from './types';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import Field from './ui/Field';
import CodeTag from './ui/CodeTag';
import './PlacePicker.css';

interface Props {
  open: boolean;
  title: string;
  // Places that may not be chosen (a place itself and everything inside it).
  blocked?: Set<string>;
  current?: Container | null;
  onPick: (c: Container) => void;
  onClose: () => void;
}

interface Option {
  c: Container;
  depth: number;
  name: string;
  code: string | null;
  type: string;
  search: string;
}

// Choose a target room or place: scan its label, or pick from the tree.
export default function PlacePicker({ open, title, blocked, current, onPick, onClose }: Props) {
  const { roomList, places, placeByCode } = useStore();
  const scan = useScan();
  const [filter, setFilter] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);

  const options = useMemo(() => {
    const children = new Map<string, Place[]>();
    const sorted = [...places.values()].sort((a, b) => placeLabel(a).localeCompare(placeLabel(b), 'de'));
    const roots = new Map<string, Place[]>();
    for (const p of sorted) {
      if (p.parentId && places.has(p.parentId)) {
        children.set(p.parentId, [...(children.get(p.parentId) ?? []), p]);
      } else {
        roots.set(p.roomId, [...(roots.get(p.roomId) ?? []), p]);
      }
    }
    const out: Option[] = [];
    const walk = (list: Place[], depth: number, seen: Set<string>) => {
      for (const p of list) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push({
          c: { kind: 'place', id: p.id },
          depth,
          name: placeLabel(p),
          code: p.code,
          type: PLACE_TYPE_LABELS[p.type],
          search: normalize(`${p.name} ${p.code ?? ''}`),
        });
        walk(children.get(p.id) ?? [], depth + 1, seen);
      }
    };
    for (const r of roomList) {
      out.push({ c: { kind: 'room', id: r.id }, depth: 0, name: r.name, code: null, type: 'Room', search: normalize(r.name) });
      walk(roots.get(r.id) ?? [], 1, new Set());
    }
    return out;
  }, [roomList, places]);

  const q = normalize(filter.trim());
  const shown = q ? options.filter((o) => o.search.includes(q)) : options;

  const isBlocked = (c: Container) => c.kind === 'place' && Boolean(blocked?.has(c.id));
  const isCurrent = (c: Container) => current?.kind === c.kind && current.id === c.id;

  const pick = (c: Container) => {
    setFilter('');
    setScanError(null);
    onPick(c);
  };

  const scanTarget = () =>
    scan({
      title: 'Scan the target',
      onCode: (code) => {
        const p = placeByCode.get(code);
        if (!p) {
          setScanError(`${code} is not registered yet. Register it first, or pick from the list.`);
          return;
        }
        const c: Container = { kind: 'place', id: p.id };
        if (isBlocked(c)) {
          setScanError("Can't move a place into itself or into something inside it.");
          return;
        }
        pick(c);
      },
    });

  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <div className="picker">
        <Button variant="primary" size="lg" block icon={<ScanLine strokeWidth={2.5} />} onClick={scanTarget}>
          Scan target label
        </Button>
        {scanError && <p className="picker__error">{scanError}</p>}
        <Field label="Or find it in the list" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter" />
        <ul className="picker__list">
          {shown.map((o) => {
            const disabled = isBlocked(o.c) || isCurrent(o.c);
            return (
              <li key={`${o.c.kind}:${o.c.id}`}>
                <button
                  type="button"
                  className={`picker__opt ${o.c.kind === 'room' ? 'picker__opt--room' : ''}`}
                  style={{ paddingLeft: `calc(var(--s-2) + ${q ? 0 : o.depth} * var(--s-4))` }}
                  disabled={disabled}
                  onClick={() => pick(o.c)}
                >
                  {o.code && <CodeTag code={o.code} />}
                  <span className="picker__name">{o.name}</span>
                  <span className="label picker__type">{isCurrent(o.c) ? 'Here now' : o.type}</span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="picker__empty">Nothing matches.</li>}
        </ul>
        <Button variant="secondary" block onClick={onClose} autoFocus>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
