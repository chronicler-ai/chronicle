import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const BLUETOOTH_LOGS_KEY = 'BLUETOOTH_LOGS';
const BLUETOOTH_STATS_KEY = 'BLUETOOTH_STATS';
const CURRENT_SESSION_KEY = 'BLUETOOTH_CURRENT_SESSION';
const MAX_LOG_ENTRIES = 500;
const LOG_RETENTION_DAYS = 7;

// Enums
export enum BluetoothEvent {
  SCAN_START = 'scan_start',
  SCAN_STOP = 'scan_stop',
  DEVICE_FOUND = 'device_found',
  CONNECT_ATTEMPT = 'connect_attempt',
  CONNECT_SUCCESS = 'connect_success',
  CONNECT_FAILURE = 'connect_failure',
  DISCONNECT = 'disconnect',
  AUTO_RECONNECT_ATTEMPT = 'auto_reconnect_attempt',
  AUTO_RECONNECT_SUCCESS = 'auto_reconnect_success',
  AUTO_RECONNECT_FAILURE = 'auto_reconnect_failure',
  STATE_CHANGE = 'state_change',
  ERROR = 'error',
}

// Interfaces
export interface BluetoothLogEntry {
  id: string;
  timestamp: number;
  event: BluetoothEvent;
  details: {
    deviceId?: string;
    deviceName?: string;
    state?: string;
    errorMessage?: string;
    duration?: number;
    success?: boolean;
    isAutoReconnect?: boolean;
  };
  sessionId?: string;
}

export interface BluetoothSession {
  sessionId: string;
  deviceId: string;
  deviceName?: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'failed';
  totalConnectAttempts: number;
  totalDisconnects: number;
  totalErrors: number;
  connectionDuration?: number;
}

export interface BluetoothStats {
  totalSessions: number;
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  totalDisconnects: number;
  averageSessionDuration: number;
  lastConnectionTime?: number;
  currentSession?: BluetoothSession;
}

// Helper functions
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const truncateDeviceId = (deviceId: string): string => {
  // Keep only last 8 characters for privacy
  if (deviceId.length > 8) {
    return `...${deviceId.slice(-8)}`;
  }
  return deviceId;
};

export const isLogExpired = (timestamp: number): boolean => {
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  return now - timestamp > LOG_RETENTION_DAYS * dayInMs;
};

// Storage functions
export const saveBluetoothLog = async (entry: BluetoothLogEntry): Promise<void> => {
  try {
    const existingLogs = await getBluetoothLogs();

    // Filter out expired logs
    const validLogs = existingLogs.filter(log => !isLogExpired(log.timestamp));

    // Add new log and limit to MAX_LOG_ENTRIES
    const newLogs = [entry, ...validLogs].slice(0, MAX_LOG_ENTRIES);

    await AsyncStorage.setItem(BLUETOOTH_LOGS_KEY, JSON.stringify(newLogs));
    console.log('[BluetoothLogger] Log saved:', entry.event);

    // Update stats
    await updateBluetoothStats(entry);
  } catch (error) {
    console.error('[BluetoothLogger] Error saving log:', error);
  }
};

export const getBluetoothLogs = async (): Promise<BluetoothLogEntry[]> => {
  try {
    const logs = await AsyncStorage.getItem(BLUETOOTH_LOGS_KEY);
    if (!logs) return [];

    const parsedLogs = JSON.parse(logs);

    // Filter out expired logs
    return parsedLogs.filter((log: BluetoothLogEntry) => !isLogExpired(log.timestamp));
  } catch (error) {
    console.error('[BluetoothLogger] Error reading logs:', error);
    return [];
  }
};

export const clearBluetoothLogs = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(BLUETOOTH_LOGS_KEY);
    await AsyncStorage.removeItem(BLUETOOTH_STATS_KEY);
    await AsyncStorage.removeItem(CURRENT_SESSION_KEY);
    console.log('[BluetoothLogger] All logs and stats cleared');
  } catch (error) {
    console.error('[BluetoothLogger] Error clearing logs:', error);
  }
};

export const getBluetoothStats = async (): Promise<BluetoothStats> => {
  try {
    const statsJson = await AsyncStorage.getItem(BLUETOOTH_STATS_KEY);
    if (!statsJson) {
      return {
        totalSessions: 0,
        totalConnections: 0,
        successfulConnections: 0,
        failedConnections: 0,
        totalDisconnects: 0,
        averageSessionDuration: 0,
      };
    }
    return JSON.parse(statsJson);
  } catch (error) {
    console.error('[BluetoothLogger] Error reading stats:', error);
    return {
      totalSessions: 0,
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      totalDisconnects: 0,
      averageSessionDuration: 0,
    };
  }
};

export const updateBluetoothStats = async (entry: BluetoothLogEntry): Promise<void> => {
  try {
    const stats = await getBluetoothStats();

    switch (entry.event) {
      case BluetoothEvent.CONNECT_ATTEMPT:
        stats.totalConnections++;
        break;

      case BluetoothEvent.CONNECT_SUCCESS:
      case BluetoothEvent.AUTO_RECONNECT_SUCCESS:
        stats.successfulConnections++;
        stats.lastConnectionTime = entry.timestamp;
        break;

      case BluetoothEvent.CONNECT_FAILURE:
      case BluetoothEvent.AUTO_RECONNECT_FAILURE:
        stats.failedConnections++;
        break;

      case BluetoothEvent.DISCONNECT:
        stats.totalDisconnects++;

        // Update average session duration if duration is provided
        if (entry.details.duration) {
          const totalSessions = stats.totalSessions || 1;
          const currentAvg = stats.averageSessionDuration || 0;
          stats.averageSessionDuration =
            (currentAvg * (totalSessions - 1) + entry.details.duration) / totalSessions;
        }
        break;
    }

    await AsyncStorage.setItem(BLUETOOTH_STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('[BluetoothLogger] Error updating stats:', error);
  }
};

export const getCurrentSession = async (): Promise<BluetoothSession | null> => {
  try {
    const sessionJson = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
    if (!sessionJson) return null;
    return JSON.parse(sessionJson);
  } catch (error) {
    console.error('[BluetoothLogger] Error reading current session:', error);
    return null;
  }
};

export const startSession = async (deviceId: string, deviceName?: string): Promise<string> => {
  try {
    const sessionId = generateId();
    const session: BluetoothSession = {
      sessionId,
      deviceId,
      deviceName,
      startTime: Date.now(),
      status: 'active',
      totalConnectAttempts: 1,
      totalDisconnects: 0,
      totalErrors: 0,
    };

    await AsyncStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));

    // Update stats
    const stats = await getBluetoothStats();
    stats.totalSessions++;
    await AsyncStorage.setItem(BLUETOOTH_STATS_KEY, JSON.stringify(stats));

    console.log('[BluetoothLogger] Session started:', sessionId);
    return sessionId;
  } catch (error) {
    console.error('[BluetoothLogger] Error starting session:', error);
    return generateId();
  }
};

export const updateSession = async (updates: Partial<BluetoothSession>): Promise<void> => {
  try {
    const session = await getCurrentSession();
    if (!session) return;

    const updatedSession = { ...session, ...updates };
    await AsyncStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(updatedSession));
  } catch (error) {
    console.error('[BluetoothLogger] Error updating session:', error);
  }
};

export const endCurrentSession = async (): Promise<void> => {
  try {
    const session = await getCurrentSession();
    if (!session) return;

    const endTime = Date.now();
    const duration = endTime - session.startTime;

    const completedSession: BluetoothSession = {
      ...session,
      endTime,
      connectionDuration: duration,
      status: 'completed',
    };

    // Save completed session as a log entry for history
    const logEntry: BluetoothLogEntry = {
      id: generateId(),
      timestamp: endTime,
      event: BluetoothEvent.DISCONNECT,
      details: {
        deviceId: truncateDeviceId(session.deviceId),
        deviceName: session.deviceName,
        duration,
      },
      sessionId: session.sessionId,
    };

    await saveBluetoothLog(logEntry);

    // Clear current session
    await AsyncStorage.removeItem(CURRENT_SESSION_KEY);

    console.log('[BluetoothLogger] Session ended:', session.sessionId, 'Duration:', duration);
  } catch (error) {
    console.error('[BluetoothLogger] Error ending session:', error);
  }
};

export const getRecentLogs = async (limit: number = 20): Promise<BluetoothLogEntry[]> => {
  const logs = await getBluetoothLogs();
  return logs.slice(0, limit);
};

export const getLogsInLastHours = async (hours: number): Promise<BluetoothLogEntry[]> => {
  const logs = await getBluetoothLogs();
  const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
  return logs.filter(log => log.timestamp >= cutoffTime);
};
