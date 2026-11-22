import type { Application, Interview, InterviewInput, ApplicationInput } from '../types';

export interface SessionUser {
  sub: string;
  name: string | null;
  email: string | null;
  picture: string | null;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class OfflineError extends Error {
  constructor() {
    super('offline');
    this.name = 'OfflineError';
  }
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (isOffline()) throw new OfflineError();

  const headers: Record<string, string> = { accept: 'application/json' };
  if (init?.body) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new OfflineError();
  }

  if (!response.ok) {
    let message = response.statusText || 'request failed';
    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // Non-JSON error body.
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

export const api = {
  async health(): Promise<{ cloud: boolean; db: boolean }> {
    try {
      const data = await request<{ cloud?: boolean; db?: boolean }>('/api/health');
      return { cloud: Boolean(data.cloud), db: Boolean(data.db) };
    } catch {
      return { cloud: false, db: false };
    }
  },

  async me(): Promise<SessionUser | null> {
    try {
      const data = await request<{ user: SessionUser }>('/api/me');
      return data.user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },

  async data(): Promise<Application[]> {
    const data = await request<{ applications: Application[] }>('/api/data');
    return data.applications ?? [];
  },

  async createApplication(input: ApplicationInput): Promise<Application> {
    const data = await request<{ application: Application }>('/api/applications', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { ...data.application, interviews: data.application.interviews ?? [] };
  },

  async updateApplication(id: string, patch: Partial<ApplicationInput>): Promise<Application> {
    const data = await request<{ application: Application }>(`/api/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return data.application;
  },

  async deleteApplication(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/applications/${id}`, { method: 'DELETE' });
  },

  async addInterview(applicationId: string, input: InterviewInput): Promise<Interview> {
    const data = await request<{ interview: Interview }>(`/api/applications/${applicationId}/interviews`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.interview;
  },

  async updateInterview(interviewId: string, input: InterviewInput): Promise<Interview> {
    const data = await request<{ interview: Interview }>(`/api/interviews/${interviewId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.interview;
  },

  async deleteInterview(interviewId: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/interviews/${interviewId}`, { method: 'DELETE' });
  },

  async replaceAll(applications: unknown[]): Promise<Application[]> {
    const data = await request<{ applications: Application[] }>('/api/data/replace', {
      method: 'POST',
      body: JSON.stringify({ applications }),
    });
    return data.applications ?? [];
  },

  signIn(returnTo = '/'): void {
    window.location.assign(`/auth/freebuff/signin?returnTo=${encodeURIComponent(returnTo)}`);
  },

  async signOut(): Promise<void> {
    try {
      await fetch('/auth/freebuff/signout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      window.location.assign('/');
    }
  },
};
