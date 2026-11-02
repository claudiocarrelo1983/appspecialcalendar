import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import Constants from 'expo-constants';
import { companySplashImage } from '../utils/companyBranding';

export function SplashArtwork({ scale = 1 }) {
  return <>
    <Animated.View style={styles.logoFrame}>
      <Animated.Image source={companySplashImage()}
        style={[styles.logo, { transform: [{ scale }] }]}
        resizeMode="contain"
        accessibilityLabel={`${Constants.expoConfig?.name || 'Club'} logo`} />
    </Animated.View>
    <Text style={styles.credit}>by Special Calendar</Text>
  </>;
}

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
  const readyRef = useRef(isReady), finishRef = useRef(onFinish);
  readyRef.current = isReady; finishRef.current = onFinish;

  const triggerFadeOut = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.05,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (finishRef.current) finishRef.current();
    });
  }, [containerOpacity, scale]);

  useEffect(() => {
    const minTimer = setTimeout(() => {
      minTimePassedRef.current = true;
      if (readyRef.current) {
        triggerFadeOut();
      }
    }, 150);

    // Keep splash up longer so a stuck site loading-overlay never flashes white.
    const fallbackTimer = setTimeout(() => {
      triggerFadeOut();
    }, 6000);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(fallbackTimer);
    };
  }, [triggerFadeOut]);

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
      <SplashArtwork scale={scale} />
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
    borderRadius: 52,
    backgroundColor: '#fff',
  },
  logo: {
    width: 200,
    height: 200,
  },
  credit: {
    position: 'absolute',
    top: '50%',
    marginTop: 138,
    left: 24,
    right: 24,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    color: '#667085',
  },
});
