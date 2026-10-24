import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen';
import WebViewScreen from './src/screens/WebViewScreen';

// Keep the native splash up until our JS splash (same look) is mounted.
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  const insets = useSafeAreaInsets();
  const [isWebViewReady, setWebViewReady] = useState(false);
  const [isSplashVisible, setSplashVisible] = useState(true);

  // Always pad top and bottom with safe area insets so both login/register headers
  // and authenticated dashboard topbar/footer clear Dynamic Island and Home Indicator cleanly.
  const topInset = insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 50 : 0);
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 24 : 0);

  const onJsSplashReady = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    // Fallback: never leave the native splash stuck if layout is delayed.
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.root}>
      <RNStatusBar barStyle="dark-content" backgroundColor="#ffffff" animated />
      <ExpoStatusBar style="dark" backgroundColor="#ffffff" animated />
      <View
        style={[
          styles.container,
          {
            backgroundColor: '#ffffff',
            paddingTop: topInset,
            paddingBottom: bottomInset,
          },
        ]}
      >
        <WebViewScreen onInitialLoadComplete={() => setWebViewReady(true)} />
      </View>
      {isSplashVisible && (
        <AnimatedSplashScreen
          isReady={isWebViewReady}
          onLayoutReady={onJsSplashReady}
          onFinish={() => setSplashVisible(false)}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    alignItems: 'stretch',
  },
});
