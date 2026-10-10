import { useEffect, useState } from 'react';
import type { Container } from './types';

// Hash routing: GitHub Pages serves one static index.html, so #/place/abc
// survives a reload without any server rewrite rules.
export interface Route {
  parts: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const [path, qs = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string, replace = false) {
  const hash = `#/${path.replace(/^\//, '')}`;
  if (replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

export function containerHref(c: Container): string {
  return `#/${c.kind}/${c.id}`;
}

export function containerParam(c: Container): string {
  return `${c.kind}:${c.id}`;
}

export function parseContainerParam(v: string | null): Container | null {
  const m = v?.match(/^(room|place):(.+)$/);
  return m ? { kind: m[1] as Container['kind'], id: m[2] } : null;
}

// The last room/place you looked at: the default spot for a newly scanned
// label. Per-device convenience only, so sessionStorage is enough.
const LAST_KEY = 'homestack.lastContainer';

export function rememberContainer(c: Container) {
  try {
    sessionStorage.setItem(LAST_KEY, containerParam(c));
  } catch {
    // Storage blocked: the form then just asks for the location.
  }
}

export function lastContainer(): Container | null {
  try {
    return parseContainerParam(sessionStorage.getItem(LAST_KEY));
  } catch {
    return null;
  }
}
