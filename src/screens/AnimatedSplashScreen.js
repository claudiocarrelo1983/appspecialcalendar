import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  StatusBar,
  View,
  Image,
  Text,
} from 'react-native';

export default function AnimatedSplashScreen({ onFinish, isReady = false }) {
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const finishedRef = useRef(false);
  const minTimePassedRef = useRef(false);

  const triggerFadeOut = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.05,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onFinish) onFinish();
    });
  }, [containerOpacity, scale, onFinish]);

  // Initial logo fade-in and minimum display timer
  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    const minTimer = setTimeout(() => {
      minTimePassedRef.current = true;
      if (isReady) {
        triggerFadeOut();
      }
    }, 1000);

    // Fallback timer: dismiss after 4.5s max even if network is slow/offline
    const fallbackTimer = setTimeout(() => {
      triggerFadeOut();
    }, 4500);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(fallbackTimer);
    };
  }, [logoOpacity, scale, isReady, triggerFadeOut]);

  // When WebView fires ready after min display timer has elapsed
  useEffect(() => {
    if (isReady && minTimePassedRef.current) {
      triggerFadeOut();
    }
  }, [isReady, triggerFadeOut]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]} pointerEvents="none">
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <View style={styles.background} />
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity: logoOpacity,
            transform: [{ scale }],
          },
        ]}
      >
        <Image
          source={require('../../assets/logo/ftx-logo-circle.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="FTX Team logo"
        />
        <Text style={styles.attribution}>by Special Calendar</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },

  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
  },

  logoWrapper: {
    width: 220,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },

  logo: {
    width: 220,
    height: 220,
  },

  attribution: {
    marginTop: 20,
    color: '#60666b',
    fontSize: 14,
    textAlign: 'center',
  },
});
