import type { Application } from '../types';

const STORAGE_KEY = 'careertrack.applications.v1';

export function readLocalApplications(): Application[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Application[];
  } catch {
    return [];
  }
}

export function writeLocalApplications(applications: Application[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
  } catch {
    // Storage can be full or blocked; the UI still works for this session.
  }
}
