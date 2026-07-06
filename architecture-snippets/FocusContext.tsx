// ============================================
// Focus Context — Pomodoro State Management
// ============================================

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as focusRepo from '@/src/database/focusRepository';
import { FocusSession, CreateFocusSessionInput } from '@/src/database/focusRepository';
import { Task } from '@/src/types';
import { today } from '@/src/utils/dateUtils';

export type FocusStatus = 'idle' | 'focusing' | 'paused' | 'finished';

interface FocusContextType {
  // Timer state
  status: FocusStatus;
  focusSeconds: number; // Elapsed focus time in seconds
  restSeconds: number; // Elapsed rest/pause time in seconds
  activeTask: Task | null;
  activeSession: FocusSession | null;

  // Actions
  startFocus: (task: Task) => Promise<void>;
  pauseFocus: () => void;
  resumeFocus: () => void;
  finishFocus: (quality?: string) => Promise<FocusSession | null>;
  cancelFocus: () => void;

  // History
  todaySessions: FocusSession[];
  refreshSessions: () => Promise<void>;
}

const FocusContext = createContext<FocusContextType>({
  status: 'idle',
  focusSeconds: 0,
  restSeconds: 0,
  activeTask: null,
  activeSession: null,
  startFocus: async () => {},
  pauseFocus: () => {},
  resumeFocus: () => {},
  finishFocus: async () => null,
  cancelFocus: () => {},
  todaySessions: [],
  refreshSessions: async () => {},
});

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<FocusStatus>('idle');
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [todaySessions, setTodaySessions] = useState<FocusSession[]>([]);

  // Use refs to track intervals and background time
  const focusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backgroundTimestampRef = useRef<number | null>(null);
  const statusRef = useRef<FocusStatus>('idle');

  // Keep statusRef in sync
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Handle app going to background/foreground (keep timer accurate)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // Save timestamp when going to background
        backgroundTimestampRef.current = Date.now();
      } else if (nextState === 'active' && backgroundTimestampRef.current) {
        // Calculate elapsed time in background
        const elapsedMs = Date.now() - backgroundTimestampRef.current;
        const elapsedSec = Math.floor(elapsedMs / 1000);
        backgroundTimestampRef.current = null;

        if (statusRef.current === 'focusing') {
          setFocusSeconds(prev => prev + elapsedSec);
        } else if (statusRef.current === 'paused') {
          setRestSeconds(prev => prev + elapsedSec);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Load today's sessions on mount
  const refreshSessions = useCallback(async () => {
    try {
      const sessions = await focusRepo.getSessionsForDate(today());
      setTodaySessions(sessions);
    } catch (error) {
      console.error('Error loading focus sessions:', error);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, []);

  const clearAllIntervals = useCallback(() => {
    if (focusIntervalRef.current) {
      clearInterval(focusIntervalRef.current);
      focusIntervalRef.current = null;
    }
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
  }, []);

  const startFocusInterval = useCallback(() => {
    clearAllIntervals();
    focusIntervalRef.current = setInterval(() => {
      setFocusSeconds(prev => prev + 1);
    }, 1000);
  }, [clearAllIntervals]);

  const startRestInterval = useCallback(() => {
    clearAllIntervals();
    restIntervalRef.current = setInterval(() => {
      setRestSeconds(prev => prev + 1);
    }, 1000);
  }, [clearAllIntervals]);

  // ---- Actions ----

  const startFocus = useCallback(async (task: Task) => {
    // Reset everything
    setFocusSeconds(0);
    setRestSeconds(0);
    setActiveTask(task);

    // Create DB record
    const input: CreateFocusSessionInput = {
      taskId: task.id,
      tagId: task.tagId,
      category: task.category,
      sessionDate: today(),
      startTime: new Date().toISOString(),
    };

    const session = await focusRepo.createFocusSession(input);
    setActiveSession(session);
    setStatus('focusing');
    startFocusInterval();
  }, [startFocusInterval]);

  const pauseFocus = useCallback(() => {
    setStatus('paused');
    startRestInterval();
  }, [startRestInterval]);

  const resumeFocus = useCallback(() => {
    setStatus('focusing');
    startFocusInterval();
  }, [startFocusInterval]);

  const finishFocus = useCallback(async (quality?: string): Promise<FocusSession | null> => {
    clearAllIntervals();

    if (!activeSession) {
      setStatus('idle');
      return null;
    }

    // Persist final durations to DB
    const completed = await focusRepo.completeFocusSession(
      activeSession.id,
      focusSeconds,
      restSeconds,
      quality
    );

    setStatus('finished');
    setActiveSession(completed);
    await refreshSessions();

    return completed;
  }, [activeSession, focusSeconds, restSeconds, clearAllIntervals, refreshSessions]);

  const cancelFocus = useCallback(() => {
    clearAllIntervals();
    setStatus('idle');
    setFocusSeconds(0);
    setRestSeconds(0);
    setActiveTask(null);
    setActiveSession(null);
  }, [clearAllIntervals]);

  return (
    <FocusContext.Provider value={{
      status,
      focusSeconds,
      restSeconds,
      activeTask,
      activeSession,
      startFocus,
      pauseFocus,
      resumeFocus,
      finishFocus,
      cancelFocus,
      todaySessions,
      refreshSessions,
    }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  return useContext(FocusContext);
}
