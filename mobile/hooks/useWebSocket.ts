import { useEffect, useRef, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

interface DeliveryUpdate {
  type: 'delivery_update';
  deliveryId: string;
  status: string;
  driverId?: string;
  timestamp: string;
}

interface DriverLocation {
  type: 'driver_location';
  driverId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

type WSMessage = DeliveryUpdate | DriverLocation | { type: string; [key: string]: unknown };

interface UseWebSocketOptions {
  onDeliveryUpdate?: (update: DeliveryUpdate) => void;
  onDriverLocation?: (location: DriverLocation) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Authenticate immediately
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);

        switch (msg.type) {
          case 'auth_ok':
            setAuthenticated(true);
            break;
          case 'auth_error':
            setAuthenticated(false);
            break;
          case 'delivery_update':
            optionsRef.current.onDeliveryUpdate?.(msg as DeliveryUpdate);
            break;
          case 'driver_location':
            optionsRef.current.onDriverLocation?.(msg as DriverLocation);
            break;
        }
      } catch {
        // Invalid JSON
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setAuthenticated(false);
      // Reconnect after 3 seconds
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setAuthenticated(false);
  }, []);

  const subscribeDelivery = useCallback((deliveryId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe_delivery', deliveryId }));
    }
  }, []);

  const unsubscribeDelivery = useCallback((deliveryId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe_delivery', deliveryId }));
    }
  }, []);

  const subscribeDriver = useCallback((driverId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe_driver', driverId }));
    }
  }, []);

  const unsubscribeDriver = useCallback((driverId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe_driver', driverId }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    connected,
    authenticated,
    connect,
    disconnect,
    subscribeDelivery,
    unsubscribeDelivery,
    subscribeDriver,
    unsubscribeDriver,
  };
}
