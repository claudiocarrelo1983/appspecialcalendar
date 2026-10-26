import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

export default function AnimatedSplashScreen({
  onFinish,
  onLayoutReady,
  isReady = false,
}) {
  // Start fully visible so the handoff from the native splash is seamless
  // (same white bg + centered 200px logo, no "FTX Team" text).
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const finishedRef = useRef(false);
  const minTimePassedRef = useRef(false);
  const layoutReadyFiredRef = useRef(false);

  const triggerFadeOut = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.05,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onFinish) onFinish();
    });
  }, [containerOpacity, scale, onFinish]);

  useEffect(() => {
    const minTimer = setTimeout(() => {
      minTimePassedRef.current = true;
      if (isReady) {
        triggerFadeOut();
      }
    }, 700);

    // Keep splash up longer so a stuck site loading-overlay never flashes white.
    const fallbackTimer = setTimeout(() => {
      triggerFadeOut();
    }, 12000);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(fallbackTimer);
    };
  }, [isReady, triggerFadeOut]);

  useEffect(() => {
    if (isReady && minTimePassedRef.current) {
      triggerFadeOut();
    }
  }, [isReady, triggerFadeOut]);

  return (
    <Animated.View
      style={[styles.container, { opacity: containerOpacity }]}
      pointerEvents="none"
      onLayout={() => {
        if (layoutReadyFiredRef.current) return;
        layoutReadyFiredRef.current = true;
        if (onLayoutReady) onLayoutReady();
      }}
    >
      <Animated.View style={styles.logoFrame}>
      <Animated.Image
        source={require('../../assets/logo/ftx-icon.png')}
        style={[styles.logo, { transform: [{ scale }] }]}
        resizeMode="contain"
        accessibilityLabel="FTX Team logo"
      />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#ffffff',
    zIndex: 99999,
    elevation: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoFrame: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#dce3df',
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  logo: {
    width: 200,
    height: 200,
  },
});
