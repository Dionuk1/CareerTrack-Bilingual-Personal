import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, OfflineError, isOffline, type SessionUser } from './api';
import { readLocalApplications, writeLocalApplications } from './localStore';
import type { ImportedApplication } from './backup';
import {
  newId,
  type Application,
  type ApplicationInput,
  type Interview,
  type InterviewInput,
} from '../types';

export type StoreMode = 'cloud' | 'local';

export interface StoreValue {
  mode: StoreMode;
  cloudEnabled: boolean;
  booting: boolean;
  loading: boolean;
  loadError: string | null;
  user: SessionUser | null;
  applications: Application[];
  createApplication: (input: ApplicationInput) => Promise<Application>;
  patchApplication: (id: string, patch: Partial<ApplicationInput>) => Promise<void>;
  deleteApplication: (id: string) => Promise<void>;
  addInterview: (applicationId: string, input: InterviewInput) => Promise<Interview>;
  updateInterview: (applicationId: string, interviewId: string, input: InterviewInput) => Promise<void>;
  deleteInterview: (applicationId: string, interviewId: string) => Promise<void>;
  replaceAll: (items: ImportedApplication[]) => Promise<number>;
  signIn: (returnTo?: string) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}

export function isOfflineError(error: unknown): boolean {
  return error instanceof OfflineError || (error instanceof Error && error.name === 'OfflineError');
}

const nowIso = () => new Date().toISOString();

function sortApplications(list: Application[]): Application[] {
  return [...list].sort((a, b) => (a.appliedOn < b.appliedOn ? 1 : a.appliedOn > b.appliedOn ? -1 : 0));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);

  const appsRef = useRef<Application[]>([]);
  const modeRef = useRef<StoreMode>('local');
  const signedInRef = useRef(false);

  appsRef.current = applications;
  modeRef.current = cloudEnabled && user ? 'cloud' : 'local';
  signedInRef.current = Boolean(user);

  const commitLocal = useCallback((mutator: (list: Application[]) => Application[]) => {
    const next = mutator(appsRef.current);
    writeLocalApplications(next);
    setApplications(next);
  }, []);

  const loadCloud = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.data();
      setApplications(sortApplications(list));
      setLoadError(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setApplications([]);
      }
      setLoadError(error instanceof Error ? error.message : 'load-failed');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const assertWritable = useCallback(() => {
    if (modeRef.current === 'cloud' && isOffline()) throw new OfflineError();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const health = await api.health();
        if (cancelled) return;
        if (!health.cloud) {
          setApplications(sortApplications(readLocalApplications()));
          return;
        }
        setCloudEnabled(true);
        const session = await api.me();
        if (cancelled) return;
        setUser(session);
      } catch {
        if (!cancelled) setApplications(sortApplications(readLocalApplications()));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadCloud().catch(() => undefined);
  }, [user, loadCloud]);

  useEffect(() => {
    if (!cloudEnabled) return;
    const onOnline = () => {
      if (signedInRef.current) void loadCloud().catch(() => undefined);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [cloudEnabled, loadCloud]);

  const createApplication = useCallback<StoreValue['createApplication']>(async (input) => {
    assertWritable();
    if (modeRef.current === 'cloud') {
      const created = await api.createApplication(input);
      const withInterviews: Application = { ...created, interviews: created.interviews ?? [] };
      setApplications((prev) => sortApplications([withInterviews, ...prev]));
      return withInterviews;
    }
    const timestamp = nowIso();
    const created: Application = {
      ...input,
      id: newId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      interviews: [],
    };
    commitLocal((list) => sortApplications([created, ...list]));
    return created;
  }, [assertWritable, commitLocal]);

  const patchApplication = useCallback<StoreValue['patchApplication']>(async (id, patch) => {
    assertWritable();
    if (modeRef.current === 'cloud') {
      const updated = await api.updateApplication(id, patch);
      setApplications((prev) =>
        prev.map((application) =>
          application.id === id
            ? { ...application, ...updated, interviews: application.interviews }
            : application
        )
      );
      return;
    }
    const timestamp = nowIso();
    commitLocal((list) =>
      list.map((application) =>
        application.id === id ? { ...application, ...patch, updatedAt: timestamp } : application
      )
    );
  }, [assertWritable, commitLocal]);

  const deleteApplication = useCallback<StoreValue['deleteApplication']>(async (id) => {
    assertWritable();
    if (modeRef.current === 'cloud') {
      await api.deleteApplication(id);
      setApplications((prev) => prev.filter((application) => application.id !== id));
      return;
    }
    commitLocal((list) => list.filter((application) => application.id !== id));
  }, [assertWritable, commitLocal]);

  const addInterview = useCallback<StoreValue['addInterview']>(async (applicationId, input) => {
    assertWritable();
    if (modeRef.current === 'cloud') {
      const interview = await api.addInterview(applicationId, input);
      setApplications((prev) =>
        prev.map((application) =>
          application.id === applicationId
            ? { ...application, interviews: [...application.interviews, interview] }
            : application
        )
      );
      return interview;
    }
    const interview: Interview = {
      id: newId(),
      applicationId,
      scheduledAt: input.scheduledAt,
      round: input.round ?? null,
      location: input.location ?? null,
      feedback: input.feedback ?? null,
    };
    const timestamp = nowIso();
    commitLocal((list) =>
      list.map((application) =>
        application.id === applicationId
          ? { ...application, interviews: [...application.interviews, interview], updatedAt: timestamp }
          : application
      )
    );
    return interview;
  }, [assertWritable, commitLocal]);

  const updateInterview = useCallback<StoreValue['updateInterview']>(async (applicationId, interviewId, input) => {
    assertWritable();
    if (modeRef.current === 'cloud') {
      const updated = await api.updateInterview(interviewId, input);
      setApplications((prev) =>
        prev.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                interviews: application.interviews.map((interview) =>
                  interview.id === interviewId ? updated : interview
                ),
              }
            : application
        )
      );
      return;
    }
    const apply = (list: Application[]) =>
      list.map((application) =>
        application.id === applicationId
          ? {
              ...application,
              updatedAt: nowIso(),
              interviews: application.interviews.map((interview) =>
                interview.id === interviewId
                  ? {
                      ...interview,
                      scheduledAt: input.scheduledAt ?? interview.scheduledAt,
                      round: input.round !== undefined ? input.round ?? null : interview.round,
                      location: input.location !== undefined ? input.location ?? null : interview.location,
                      feedback: input.feedback !== undefined ? input.feedback ?? null : interview.feedback,
                    }
                  : interview
              ),
            }
          : application
      );
    commitLocal(apply);
  }, [assertWritable, commitLocal]);

  const deleteInterview = useCallback<StoreValue['deleteInterview']>(async (applicationId, interviewId) => {
    assertWritable();
    if (modeRef.current === 'cloud') {
      await api.deleteInterview(interviewId);
      setApplications((prev) =>
        prev.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                interviews: application.interviews.filter((interview) => interview.id !== interviewId),
              }
            : application
        )
      );
      return;
    }
    const timestamp = nowIso();
    commitLocal((list) =>
      list.map((application) =>
        application.id === applicationId
          ? {
              ...application,
              updatedAt: timestamp,
              interviews: application.interviews.filter((interview) => interview.id !== interviewId),
            }
          : application
      )
    );
  }, [assertWritable, commitLocal]);

  const replaceAll = useCallback<StoreValue['replaceAll']>(async (items) => {
    assertWritable();
    if (modeRef.current === 'cloud') {
      const created = await api.replaceAll(
        items.map((item) => ({ ...item.application, interviews: item.interviews }))
      );
      setApplications(sortApplications(created));
      return created.length;
    }

    const timestamp = nowIso();
    const created: Application[] = items.map((item) => {
      const applicationId = newId();
      return {
        ...item.application,
        id: applicationId,
        createdAt: timestamp,
        updatedAt: timestamp,
        interviews: item.interviews.map((interview) => ({
          id: newId(),
          applicationId,
          scheduledAt: interview.scheduledAt,
          round: interview.round,
          location: interview.location,
          feedback: interview.feedback,
        })),
      };
    });

    const next = sortApplications(created);
    writeLocalApplications(next);
    setApplications(next);
    return next.length;
  }, [assertWritable]);

  const signIn = useCallback<StoreValue['signIn']>((returnTo = '/') => {
    api.signIn(returnTo);
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    setApplications([]);
    await api.signOut();
  }, []);

  const refresh = useCallback(async () => {
    if (modeRef.current === 'cloud') {
      await loadCloud();
    } else {
      setApplications(sortApplications(readLocalApplications()));
    }
  }, [loadCloud]);

  const value = useMemo<StoreValue>(
    () => ({
      mode: cloudEnabled && user ? 'cloud' : 'local',
      cloudEnabled,
      booting,
      loading,
      loadError,
      user,
      applications,
      createApplication,
      patchApplication,
      deleteApplication,
      addInterview,
      updateInterview,
      deleteInterview,
      replaceAll,
      signIn,
      signOut,
      refresh,
    }),
    [
      cloudEnabled,
      booting,
      loading,
      loadError,
      user,
      applications,
      createApplication,
      patchApplication,
      deleteApplication,
      addInterview,
      updateInterview,
      deleteInterview,
      replaceAll,
      signIn,
      signOut,
      refresh,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
