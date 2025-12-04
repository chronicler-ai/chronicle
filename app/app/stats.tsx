import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, router as navigationRouter } from 'expo-router';
import {
  getBluetoothLogs,
  getBluetoothStats,
  getCurrentSession,
  clearBluetoothLogs,
  BluetoothLogEntry,
  BluetoothStats,
  BluetoothSession,
  BluetoothEvent,
} from '../src/utils/bluetoothLogger';

export default function StatsScreen() {
  const routerHook = useRouter();

  const goBack = () => {
    try {
      console.log('[StatsScreen] Attempting to go back');
      if (routerHook && typeof routerHook.back === 'function') {
        routerHook.back();
      } else if (navigationRouter && typeof navigationRouter.back === 'function') {
        navigationRouter.back();
      } else {
        console.error('[StatsScreen] No valid router for back navigation');
      }
    } catch (error) {
      console.error('[StatsScreen] Navigation back error:', error);
    }
  };
  const [logs, setLogs] = useState<BluetoothLogEntry[]>([]);
  const [stats, setStats] = useState<BluetoothStats | null>(null);
  const [currentSession, setCurrentSession] = useState<BluetoothSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [logsData, statsData, sessionData] = await Promise.all([
        getBluetoothLogs(),
        getBluetoothStats(),
        getCurrentSession(),
      ]);

      setLogs(logsData.slice(0, 20)); // Show last 20 events
      setStats(statsData);
      setCurrentSession(sessionData);
    } catch (error) {
      console.error('[StatsScreen] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClearLogs = () => {
    Alert.alert(
      'Clear All Logs',
      'Are you sure you want to clear all Bluetooth connection logs and statistics? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearBluetoothLogs();
            await loadData();
          },
        },
      ]
    );
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getEventIcon = (event: BluetoothEvent): string => {
    switch (event) {
      case BluetoothEvent.CONNECT_SUCCESS:
      case BluetoothEvent.AUTO_RECONNECT_SUCCESS:
        return '✅';
      case BluetoothEvent.CONNECT_FAILURE:
      case BluetoothEvent.AUTO_RECONNECT_FAILURE:
        return '❌';
      case BluetoothEvent.DISCONNECT:
        return '🔌';
      case BluetoothEvent.CONNECT_ATTEMPT:
      case BluetoothEvent.AUTO_RECONNECT_ATTEMPT:
        return '🔄';
      case BluetoothEvent.ERROR:
        return '⚠️';
      case BluetoothEvent.STATE_CHANGE:
        return '🔀';
      case BluetoothEvent.SCAN_START:
        return '🔍';
      case BluetoothEvent.SCAN_STOP:
        return '⏸️';
      default:
        return '📝';
    }
  };

  const getEventLabel = (event: BluetoothEvent): string => {
    switch (event) {
      case BluetoothEvent.CONNECT_ATTEMPT:
        return 'Connect Attempt';
      case BluetoothEvent.CONNECT_SUCCESS:
        return 'Connected';
      case BluetoothEvent.CONNECT_FAILURE:
        return 'Connection Failed';
      case BluetoothEvent.DISCONNECT:
        return 'Disconnected';
      case BluetoothEvent.AUTO_RECONNECT_ATTEMPT:
        return 'Auto Reconnect Attempt';
      case BluetoothEvent.AUTO_RECONNECT_SUCCESS:
        return 'Auto Reconnected';
      case BluetoothEvent.AUTO_RECONNECT_FAILURE:
        return 'Auto Reconnect Failed';
      case BluetoothEvent.STATE_CHANGE:
        return 'State Change';
      case BluetoothEvent.ERROR:
        return 'Error';
      case BluetoothEvent.SCAN_START:
        return 'Scan Started';
      case BluetoothEvent.SCAN_STOP:
        return 'Scan Stopped';
      default:
        return event;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connection Stats</Text>
        <TouchableOpacity onPress={handleClearLogs} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Bluetooth Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Bluetooth Summary</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.totalSessions || 0}</Text>
              <Text style={styles.statLabel}>Total Sessions</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats && stats.totalConnections > 0
                  ? `${((stats.successfulConnections / stats.totalConnections) * 100).toFixed(1)}%`
                  : '0%'}
              </Text>
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats?.averageSessionDuration ? formatDuration(stats.averageSessionDuration) : '0s'}
              </Text>
              <Text style={styles.statLabel}>Avg Duration</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.totalDisconnects || 0}</Text>
              <Text style={styles.statLabel}>Disconnects</Text>
            </View>
          </View>
        </View>

        {/* Current Connection Section */}
        {currentSession && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔷 Current Connection</Text>
            <View style={styles.currentConnection}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Status:</Text>
                <Text style={[styles.statusValue, styles.statusActive]}>Connected ✅</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Device:</Text>
                <Text style={styles.statusValue}>{currentSession.deviceId}</Text>
              </View>
              {currentSession.deviceName && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Name:</Text>
                  <Text style={styles.statusValue}>{currentSession.deviceName}</Text>
                </View>
              )}
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Duration:</Text>
                <Text style={styles.statusValue}>
                  {formatDuration(Date.now() - currentSession.startTime)}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Started:</Text>
                <Text style={styles.statusValue}>{formatTimestamp(currentSession.startTime)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Events Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Recent Events (Last 24h)</Text>
          {logs.length > 0 ? (
            <View style={styles.eventsList}>
              {logs.map((log) => (
                <View key={log.id} style={styles.eventItem}>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventTime}>{formatTimestamp(log.timestamp)}</Text>
                    <Text style={styles.eventIcon}>{getEventIcon(log.event)}</Text>
                  </View>
                  <Text style={styles.eventType}>{getEventLabel(log.event)}</Text>
                  {log.details.deviceId && (
                    <Text style={styles.eventDetail}>Device: {log.details.deviceId}</Text>
                  )}
                  {log.details.deviceName && (
                    <Text style={styles.eventDetail}>Name: {log.details.deviceName}</Text>
                  )}
                  {log.details.state && (
                    <Text style={styles.eventDetail}>State: {log.details.state}</Text>
                  )}
                  {log.details.duration && (
                    <Text style={styles.eventDetail}>Duration: {formatDuration(log.details.duration)}</Text>
                  )}
                  {log.details.errorMessage && (
                    <Text style={[styles.eventDetail, styles.errorText]}>
                      Error: {log.details.errorMessage}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No events recorded yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Connect to a Bluetooth device to start logging
              </Text>
            </View>
          )}
        </View>

        {/* WebSocket Stub Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌐 WebSocket Connection</Text>
          <View style={styles.stubCard}>
            <Text style={styles.stubIcon}>🚧</Text>
            <Text style={styles.stubTitle}>Logging Not Implemented</Text>
            <Text style={styles.stubDescription}>
              WebSocket connection logging will be added in Phase 2. It will track connection
              state, reconnection attempts, and streaming metrics.
            </Text>
          </View>
        </View>

        {/* Phone Audio Stub Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎤 Phone Audio</Text>
          <View style={styles.stubCard}>
            <Text style={styles.stubIcon}>🚧</Text>
            <Text style={styles.stubTitle}>Logging Not Implemented</Text>
            <Text style={styles.stubDescription}>
              Phone audio recording logging will be added in Phase 2. It will track recording
              sessions, duration, and audio streaming metrics.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    padding: 5,
  },
  clearButtonText: {
    fontSize: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  currentConnection: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  statusActive: {
    color: '#4CD964',
  },
  eventsList: {
    marginTop: 5,
  },
  eventItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  eventTime: {
    fontSize: 12,
    color: '#666',
  },
  eventIcon: {
    fontSize: 16,
  },
  eventType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  eventDetail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  errorText: {
    color: '#FF3B30',
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginBottom: 5,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  stubCard: {
    backgroundColor: '#FFF9E6',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE066',
  },
  stubIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  stubTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  stubDescription: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});
