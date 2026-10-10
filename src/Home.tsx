import { useMemo, useState } from 'react';
import { Package, ScanLine } from 'lucide-react';
import { useStore } from './store';
import { useScanAndOpen } from './scan';
import { containerPath, itemContainer, itemsInRoom, search } from './search';
import { containerHref } from './nav';
import Field from './ui/Field';
import Section from './ui/Section';
import ListRow, { RowList } from './ui/ListRow';
import CodeTag from './ui/CodeTag';
import Button from './ui/Button';
import Composition from './ui/Composition';
import './Home.css';

export default function Home() {
  const store = useStore();
  const scanAndOpen = useScanAndOpen();
  const [query, setQuery] = useState('');

  const hits = useMemo(() => search(query, store), [query, store]);
  const recent = useMemo(
    () =>
      store.items
        .filter((i) => i.status === 'active')
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8),
    [store.items],
  );

  const searching = query.trim().length > 0;

  return (
    <>
      <div className="home__search">
        <Field
          label="Search"
          hideLabel
          big
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find anything"
          enterKeyHint="search"
          autoComplete="off"
        />
      </div>

      {searching ? (
        <Section num={1} title={`Results ${hits.length ? `(${hits.length})` : ''}`}>
          {hits.length === 0 ? (
            <p className="home__none">Nothing found for “{query}”.</p>
          ) : (
            <RowList>
              {hits.map((h) =>
                h.kind === 'item' ? (
                  <ListRow
                    key={`i-${h.item.id}`}
                    href={`${containerHref(itemContainer(h.item))}?hl=${h.item.id}`}
                    lead={<Package strokeWidth={2.5} size={20} aria-hidden="true" />}
                    title={h.item.name}
                    meta={h.path.join(' › ')}
                  />
                ) : (
                  <ListRow
                    key={`p-${h.place.id}`}
                    href={`#/place/${h.place.id}`}
                    lead={h.place.code ? <CodeTag code={h.place.code} /> : undefined}
                    title={h.place.name || h.place.code}
                    meta={h.path.join(' › ')}
                  />
                ),
              )}
            </RowList>
          )}
        </Section>
      ) : store.loaded && store.roomList.length === 0 ? (
        <div className="empty">
          <Composition size={120} />
          <p className="empty__text">Start with your rooms: basement, bike room, attic.</p>
          <Button variant="primary" size="lg" onClick={() => (window.location.hash = '#/rooms')}>
            Add rooms
          </Button>
        </div>
      ) : (
        <div className="home__grid">
          <Section num={1} title="Rooms">
            <ul className="tiles">
              {store.roomList.map((r) => (
                <li key={r.id}>
                  <a className="tile" href={`#/room/${r.id}`}>
                    <span className="tile__count num">{itemsInRoom(r.id, store)}</span>
                    <span className="tile__name">{r.name}</span>
                    <span className="label tile__unit">{itemsInRoom(r.id, store) === 1 ? 'Item' : 'Items'}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Section>

          {recent.length > 0 && (
            <Section num={2} title="Recently added" className="home__recent">
              <RowList>
                {recent.map((i) => (
                  <ListRow
                    key={i.id}
                    href={`${containerHref(itemContainer(i))}?hl=${i.id}`}
                    title={i.name}
                    meta={containerPath(itemContainer(i), store).join(' › ')}
                  />
                ))}
              </RowList>
            </Section>
          )}
        </div>
      )}

      <div className="bottombar bottombar--bare">
        <Button variant="accent" size="lg" block icon={<ScanLine strokeWidth={2.5} />} onClick={scanAndOpen}>
          Scan
        </Button>
      </div>
    </>
  );
}
