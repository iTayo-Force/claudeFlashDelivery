import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors, spacing, fontSize } from '../utils/theme';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const slideAnim = useState(new Animated.Value(-50))[0];

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);

      if (offline && !isOffline) {
        setIsOffline(true);
        setWasOffline(true);
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      } else if (!offline && isOffline) {
        setIsOffline(false);
        // Show "back online" briefly then hide
        setTimeout(() => {
          Animated.timing(slideAnim, { toValue: -50, duration: 300, useNativeDriver: true }).start(() => {
            setWasOffline(false);
          });
        }, 2000);
      }
    });

    return () => unsubscribe();
  }, [isOffline]);

  if (!isOffline && !wasOffline) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        isOffline ? styles.offline : styles.online,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={styles.text}>
        {isOffline ? '📡 Pas de connexion internet' : '✅ Connexion rétablie'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: spacing.xl + spacing.md, // account for status bar
    paddingBottom: spacing.sm,
    alignItems: 'center',
    zIndex: 1000,
  },
  offline: {
    backgroundColor: colors.gray[800],
  },
  online: {
    backgroundColor: colors.success,
  },
  text: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
