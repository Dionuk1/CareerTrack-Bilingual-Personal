import { useCallback, useEffect, useState } from 'react';

function readPath(): string {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function navigate(path: string): void {
  const target = path.startsWith('/') ? path : `/${path}`;
  if (readPath() === target) return;
  window.location.hash = target;
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export function useRoute(): string {
  const [path, setPath] = useState<string>(readPath);

  const sync = useCallback(() => setPath(readPath()), []);

  useEffect(() => {
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [sync]);

  return path;
}

export interface ParsedRoute {
  section: 'dashboard' | 'applications' | 'calendar' | 'settings' | 'application';
  id: string | null;
}

export function parseRoute(path: string): ParsedRoute {
  const segments = path.split('/').filter(Boolean);
  const [first, second] = segments;

  if (first === 'applications') {
    return second ? { section: 'application', id: second } : { section: 'applications', id: null };
  }
  if (first === 'calendar') return { section: 'calendar', id: null };
  if (first === 'settings') return { section: 'settings', id: null };
  return { section: 'dashboard', id: null };
}
