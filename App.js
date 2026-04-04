import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen';
import WebViewScreen from './src/screens/WebViewScreen';

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [isSplashAnimationComplete, setSplashAnimationComplete] = useState(false);
  const isSplashVisible = !isSplashAnimationComplete;

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        await SplashScreen.preventAutoHideAsync();
      } catch {
        // no-op
      } finally {
        if (isMounted) setAppIsReady(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const onLayoutRootView = useCallback(() => {
    if (!appIsReady) return;

    (async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // no-op
      }
    })();
  }, [appIsReady]);

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.container}
        edges={['top', 'left', 'right']}
        onLayout={onLayoutRootView}
      >
        {!isSplashAnimationComplete ? (
          <AnimatedSplashScreen onFinish={() => setSplashAnimationComplete(true)} />
        ) : (
          <WebViewScreen />
        )}
        <ExpoStatusBar
          style={isSplashVisible ? 'light' : 'dark'}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'stretch',
  },
});
