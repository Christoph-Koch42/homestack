import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import LoginForm, { signOutUser, useAuthUser } from './auth';
import { StoreProvider, useStore } from './store';
import { ScanProvider } from './scan';
import { useRoute } from './nav';
import { ToastProvider } from './ui/Toast';
import IconBox from './ui/IconBox';
import Home from './Home';
import PlaceView from './PlaceView';
import PlaceForm from './PlaceForm';
import { CategoriesAdmin, RoomsAdmin } from './ListAdmin';
import Labels from './Labels';
import './App.css';

export default function App() {
  const { user, loading } = useAuthUser();

  if (loading) return <div className="splash label">HomeStack</div>;
  if (!user) return <LoginForm />;

  return (
    <StoreProvider>
      <ToastProvider>
        <ScanProvider>
          <Shell />
        </ScanProvider>
      </ToastProvider>
    </StoreProvider>
  );
}

function Shell() {
  const route = useRoute();
  const { loaded } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const [a, b, c] = route.parts;
  let page;
  // Forms read their initial values from the store, so wait for the first snapshot.
  if (!loaded) page = <p className="label">Loading…</p>;
  else if (a === 'room' && b) page = <PlaceView key={b} container={{ kind: 'room', id: b }} highlight={route.query.get('hl')} />;
  else if (a === 'place' && b === 'new') page = <PlaceForm key="new" query={route.query} />;
  else if (a === 'place' && b && c === 'edit') page = <PlaceForm key={`edit-${b}`} placeId={b} query={route.query} />;
  else if (a === 'place' && b) page = <PlaceView key={b} container={{ kind: 'place', id: b }} highlight={route.query.get('hl')} />;
  else if (a === 'rooms') page = <RoomsAdmin />;
  else if (a === 'categories') page = <CategoriesAdmin />;
  else if (a === 'labels') page = <Labels />;
  else page = <Home />;

  return (
    <div className="shell swiss-noise">
      <header className="topbar">
        <a href="#/" className="topbar__mark" aria-label="HomeStack home">
          <span className="topbar__dot" aria-hidden="true" />
          HomeStack
        </a>
        <SyncStatus />
        <IconBox
          label={menuOpen ? 'Close menu' : 'Menu'}
          aria-expanded={menuOpen}
          aria-controls="main-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X strokeWidth={2.5} /> : <Menu strokeWidth={2.5} />}
        </IconBox>
      </header>
      {menuOpen && (
        // Any click inside the menu (a link or Sign out) closes it.
        <nav id="main-menu" className="menu swiss-grid" aria-label="Main" onClick={() => setMenuOpen(false)}>
          <a href="#/" className="menu__link"><span className="menu__num num">01</span>Search</a>
          <a href="#/rooms" className="menu__link"><span className="menu__num num">02</span>Rooms</a>
          <a href="#/categories" className="menu__link"><span className="menu__num num">03</span>Categories</a>
          <a href="#/labels" className="menu__link"><span className="menu__num num">04</span>Labels</a>
          <button type="button" className="menu__link" onClick={() => signOutUser()}>
            <span className="menu__num num">05</span>Sign out
          </button>
        </nav>
      )}
      <main className="page">{page}</main>
    </div>
  );
}

// "Offline · 3 waiting" in the basement, "Synced" upstairs.
function SyncStatus() {
  const { pending, offline, loaded } = useStore();
  let text = 'Synced';
  if (!loaded) text = 'Loading';
  else if (pending > 0) text = `${offline ? 'Offline · ' : ''}${pending} waiting`;
  else if (offline) text = 'Offline';
  return (
    <p className={`topbar__sync label ${offline || pending ? 'topbar__sync--warn' : ''}`} role="status">
      <span className="topbar__sync-dot" aria-hidden="true" />
      {text}
    </p>
  );
}
