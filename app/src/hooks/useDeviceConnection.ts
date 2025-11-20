import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { OmiConnection, BleAudioCodec, OmiDevice } from 'friend-lite-react-native';
import { useBluetoothLogger } from './useBluetoothLogger';

interface UseDeviceConnection {
  connectedDevice: OmiDevice | null;
  isConnecting: boolean;
  currentCodec: BleAudioCodec | null;
  batteryLevel: number;
  connectToDevice: (deviceId: string) => Promise<void>;
  disconnectFromDevice: () => Promise<void>;
  getAudioCodec: () => Promise<void>;
  getBatteryLevel: () => Promise<void>;
  connectedDeviceId: string | null;
}

export const useDeviceConnection = (
  omiConnection: OmiConnection,
  onDisconnect?: () => void, // Callback for when disconnection happens, e.g., to stop audio listener
  onConnect?: () => void // Callback for when connection happens
): UseDeviceConnection => {
  const [connectedDevice, setConnectedDevice] = useState<OmiDevice | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [currentCodec, setCurrentCodec] = useState<BleAudioCodec | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(-1);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);

  // Bluetooth logger
  const bluetoothLogger = useBluetoothLogger();
  const currentSessionIdRef = useRef<string | null>(null);

  const handleConnectionStateChange = useCallback((id: string, state: string) => {
    console.log(`Device ${id} connection state: ${state}`);
    const isNowConnected = state === 'connected';
    setIsConnecting(false);

    // Log state change
    bluetoothLogger.logStateChange(id, state);

    if (isNowConnected) {
        setConnectedDeviceId(id);

        // Log successful connection
        bluetoothLogger.logConnectionSuccess(id, undefined, currentSessionIdRef.current || undefined);

        // Potentially fetch the device details from omiConnection if needed to set connectedDevice
        // For now, we'll assume the app manages the full OmiDevice object elsewhere or doesn't need it here.
        if (onConnect) onConnect();
    } else {
        // Log disconnect
        bluetoothLogger.logDisconnect(id);
        currentSessionIdRef.current = null;

        setConnectedDeviceId(null);
        setConnectedDevice(null);
        setCurrentCodec(null);
        setBatteryLevel(-1);
        if (onDisconnect) onDisconnect();
    }
  }, [onDisconnect, onConnect, bluetoothLogger]);

  const connectToDevice = useCallback(async (deviceId: string) => {
    if (connectedDeviceId && connectedDeviceId !== deviceId) {
      console.log('Disconnecting from previous device before connecting to new one.');
      await disconnectFromDevice();
    }
    if (connectedDeviceId === deviceId) {
        console.log('Already connected or connecting to this device');
        return;
    }

    setIsConnecting(true);
    setConnectedDevice(null); // Clear previous device details
    setCurrentCodec(null);
    setBatteryLevel(-1);

    // Log connection attempt and get session ID
    const sessionId = await bluetoothLogger.logConnectionAttempt(deviceId);
    currentSessionIdRef.current = sessionId;

    try {
      const success = await omiConnection.connect(deviceId, handleConnectionStateChange);
      if (success) {
        console.log('Successfully initiated connection to device:', deviceId);
        // Note: actual connected state is set by handleConnectionStateChange callback
      } else {
        setIsConnecting(false);
        // Log connection failure
        await bluetoothLogger.logConnectionFailure(deviceId, 'Connection returned false', sessionId);
        currentSessionIdRef.current = null;
        Alert.alert('Connection Failed', 'Could not connect to the device. Please try again.');
      }
    } catch (error) {
      console.error('Connection error:', error);
      setIsConnecting(false);
      setConnectedDevice(null);
      setConnectedDeviceId(null);

      // Log connection error
      await bluetoothLogger.logConnectionFailure(deviceId, String(error), sessionId);
      currentSessionIdRef.current = null;

      Alert.alert('Connection Error', String(error));
    }
  }, [omiConnection, handleConnectionStateChange, connectedDeviceId, bluetoothLogger]);

  const disconnectFromDevice = useCallback(async () => {
    console.log('Attempting to disconnect...');
    setIsConnecting(false); // No longer attempting to connect if we are disconnecting
    try {
      if (onDisconnect) {
        await onDisconnect(); // Call pre-disconnect cleanup (e.g., stop audio)
      }
      await omiConnection.disconnect();
      console.log('Successfully disconnected.');
      setConnectedDevice(null);
      setConnectedDeviceId(null);
      setCurrentCodec(null);
      setBatteryLevel(-1);
      // The handleConnectionStateChange should also be triggered by the SDK upon disconnection
      // Logging will happen in handleConnectionStateChange
    } catch (error) {
      console.error('Disconnect error:', error);

      // Log disconnect error
      if (connectedDeviceId) {
        await bluetoothLogger.logError(connectedDeviceId, `Disconnect error: ${String(error)}`);
      }

      Alert.alert('Disconnect Error', String(error));
      // Even if disconnect fails, reset state as we intend to be disconnected
      setConnectedDevice(null);
      setConnectedDeviceId(null);
      setCurrentCodec(null);
      setBatteryLevel(-1);
    }
  }, [omiConnection, onDisconnect, connectedDeviceId, bluetoothLogger]);

  const getAudioCodec = useCallback(async () => {
    if (!omiConnection.isConnected() || !connectedDeviceId) {
      Alert.alert('Not Connected', 'Please connect to a device first.');
      return;
    }
    try {
      const codecValue = await omiConnection.getAudioCodec();
      setCurrentCodec(codecValue);
      console.log('Audio codec:', codecValue);
    } catch (error) {
      console.error('Get codec error:', error);
      if (String(error).includes('not connected')) {
        setConnectedDevice(null);
        setConnectedDeviceId(null);
        Alert.alert('Connection Lost', 'The device appears to be disconnected. Please reconnect.');
      } else {
        Alert.alert('Error', `Failed to get audio codec: ${error}`);
      }
    }
  }, [omiConnection, connectedDeviceId]);

  const getBatteryLevel = useCallback(async () => {
    if (!omiConnection.isConnected() || !connectedDeviceId) {
      Alert.alert('Not Connected', 'Please connect to a device first.');
      return;
    }
    try {
      const level = await omiConnection.getBatteryLevel();
      setBatteryLevel(level);
      console.log('Battery level:', level);
    } catch (error) {
      console.error('Get battery level error:', error);
      if (String(error).includes('not connected')) {
        setConnectedDevice(null);
        setConnectedDeviceId(null);
        Alert.alert('Connection Lost', 'The device appears to be disconnected. Please reconnect.');
      } else {
        Alert.alert('Error', `Failed to get battery level: ${error}`);
      }
    }
  }, [omiConnection, connectedDeviceId]);

  return {
    connectedDevice,
    isConnecting,
    currentCodec,
    batteryLevel,
    connectToDevice,
    disconnectFromDevice,
    getAudioCodec,
    getBatteryLevel,
    connectedDeviceId
  };
}; 