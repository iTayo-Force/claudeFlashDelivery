import { useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from '../services/api';

const QUEUE_KEY = '@flash_delivery_request_queue';

interface QueuedRequest {
  id: string;
  method: 'post' | 'put' | 'patch' | 'delete';
  url: string;
  data?: unknown;
  timestamp: number;
  retries: number;
}

/**
 * Hook that queues failed POST/PATCH requests when offline
 * and replays them when connectivity is restored.
 */
export function useRequestQueue() {
  const processingRef = useRef(false);

  const addToQueue = useCallback(async (method: QueuedRequest['method'], url: string, data?: unknown) => {
    try {
      const existing = await AsyncStorage.getItem(QUEUE_KEY);
      const queue: QueuedRequest[] = existing ? JSON.parse(existing) : [];

      queue.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        method,
        url,
        data,
        timestamp: Date.now(),
        retries: 0,
      });

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // Silent fail — queue storage is best-effort
    }
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const existing = await AsyncStorage.getItem(QUEUE_KEY);
      if (!existing) {
        processingRef.current = false;
        return;
      }

      const queue: QueuedRequest[] = JSON.parse(existing);
      if (queue.length === 0) {
        processingRef.current = false;
        return;
      }

      const remaining: QueuedRequest[] = [];

      for (const req of queue) {
        // Drop requests older than 24 hours
        if (Date.now() - req.timestamp > 24 * 60 * 60 * 1000) continue;
        // Drop requests that failed more than 3 times
        if (req.retries >= 3) continue;

        try {
          await api[req.method](req.url, req.data);
        } catch {
          remaining.push({ ...req, retries: req.retries + 1 });
        }
      }

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    } catch {
      // Silent fail
    } finally {
      processingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        processQueue();
      }
    });

    // Also process on mount
    processQueue();

    return () => unsubscribe();
  }, [processQueue]);

  return { addToQueue, processQueue };
}
