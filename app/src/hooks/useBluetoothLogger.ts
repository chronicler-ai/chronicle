import { useCallback, useRef } from 'react';
import {
  saveBluetoothLog,
  startSession,
  endCurrentSession,
  updateSession,
  generateId,
  truncateDeviceId,
  BluetoothEvent,
  BluetoothLogEntry,
} from '../utils/bluetoothLogger';

interface UseBluetoothLogger {
  logScanStart: () => Promise<void>;
  logScanStop: () => Promise<void>;
  logDeviceFound: (deviceId: string, deviceName?: string) => Promise<void>;
  logConnectionAttempt: (deviceId: string, deviceName?: string, isAutoReconnect?: boolean) => Promise<string>;
  logConnectionSuccess: (deviceId: string, deviceName?: string, sessionId?: string) => Promise<void>;
  logConnectionFailure: (deviceId: string, errorMessage: string, sessionId?: string) => Promise<void>;
  logDisconnect: (deviceId: string, deviceName?: string) => Promise<void>;
  logStateChange: (deviceId: string, state: string) => Promise<void>;
  logError: (deviceId: string, errorMessage: string) => Promise<void>;
}

export const useBluetoothLogger = (): UseBluetoothLogger => {
  const currentSessionIdRef = useRef<string | null>(null);

  const logScanStart = useCallback(async (): Promise<void> => {
    const entry: BluetoothLogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      event: BluetoothEvent.SCAN_START,
      details: {},
    };
    await saveBluetoothLog(entry);
  }, []);

  const logScanStop = useCallback(async (): Promise<void> => {
    const entry: BluetoothLogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      event: BluetoothEvent.SCAN_STOP,
      details: {},
    };
    await saveBluetoothLog(entry);
  }, []);

  const logDeviceFound = useCallback(async (deviceId: string, deviceName?: string): Promise<void> => {
    const entry: BluetoothLogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      event: BluetoothEvent.DEVICE_FOUND,
      details: {
        deviceId: truncateDeviceId(deviceId),
        deviceName,
      },
    };
    await saveBluetoothLog(entry);
  }, []);

  const logConnectionAttempt = useCallback(
    async (deviceId: string, deviceName?: string, isAutoReconnect: boolean = false): Promise<string> => {
      // Start a new session
      const sessionId = await startSession(deviceId, deviceName);
      currentSessionIdRef.current = sessionId;

      const entry: BluetoothLogEntry = {
        id: generateId(),
        timestamp: Date.now(),
        event: isAutoReconnect ? BluetoothEvent.AUTO_RECONNECT_ATTEMPT : BluetoothEvent.CONNECT_ATTEMPT,
        details: {
          deviceId: truncateDeviceId(deviceId),
          deviceName,
          isAutoReconnect,
        },
        sessionId,
      };
      await saveBluetoothLog(entry);

      return sessionId;
    },
    []
  );

  const logConnectionSuccess = useCallback(
    async (deviceId: string, deviceName?: string, sessionId?: string): Promise<void> => {
      const activeSessionId = sessionId || currentSessionIdRef.current;

      const entry: BluetoothLogEntry = {
        id: generateId(),
        timestamp: Date.now(),
        event: BluetoothEvent.CONNECT_SUCCESS,
        details: {
          deviceId: truncateDeviceId(deviceId),
          deviceName,
          success: true,
        },
        sessionId: activeSessionId || undefined,
      };
      await saveBluetoothLog(entry);

      // Update session status
      if (activeSessionId) {
        await updateSession({ status: 'active' });
      }
    },
    []
  );

  const logConnectionFailure = useCallback(
    async (deviceId: string, errorMessage: string, sessionId?: string): Promise<void> => {
      const activeSessionId = sessionId || currentSessionIdRef.current;

      const entry: BluetoothLogEntry = {
        id: generateId(),
        timestamp: Date.now(),
        event: BluetoothEvent.CONNECT_FAILURE,
        details: {
          deviceId: truncateDeviceId(deviceId),
          errorMessage,
          success: false,
        },
        sessionId: activeSessionId || undefined,
      };
      await saveBluetoothLog(entry);

      // Update session status
      if (activeSessionId) {
        await updateSession({ status: 'failed' });
      }

      // Clear session reference
      currentSessionIdRef.current = null;
    },
    []
  );

  const logDisconnect = useCallback(async (deviceId: string, deviceName?: string): Promise<void> => {
    // End the current session (which will log the disconnect event with duration)
    await endCurrentSession();

    // Clear session reference
    currentSessionIdRef.current = null;
  }, []);

  const logStateChange = useCallback(async (deviceId: string, state: string): Promise<void> => {
    const entry: BluetoothLogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      event: BluetoothEvent.STATE_CHANGE,
      details: {
        deviceId: truncateDeviceId(deviceId),
        state,
      },
      sessionId: currentSessionIdRef.current || undefined,
    };
    await saveBluetoothLog(entry);
  }, []);

  const logError = useCallback(async (deviceId: string, errorMessage: string): Promise<void> => {
    const entry: BluetoothLogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      event: BluetoothEvent.ERROR,
      details: {
        deviceId: truncateDeviceId(deviceId),
        errorMessage,
      },
      sessionId: currentSessionIdRef.current || undefined,
    };
    await saveBluetoothLog(entry);

    // Update session error count
    if (currentSessionIdRef.current) {
      const currentSession = await import('../utils/bluetoothLogger').then(m => m.getCurrentSession());
      const session = await currentSession;
      if (session) {
        await updateSession({ totalErrors: session.totalErrors + 1 });
      }
    }
  }, []);

  return {
    logScanStart,
    logScanStop,
    logDeviceFound,
    logConnectionAttempt,
    logConnectionSuccess,
    logConnectionFailure,
    logDisconnect,
    logStateChange,
    logError,
  };
};
