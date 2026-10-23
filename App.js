import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Platform, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen';
import WebViewScreen from './src/screens/WebViewScreen';

function AppContent() {
  const insets = useSafeAreaInsets();
  const [isWebViewReady, setWebViewReady] = useState(false);
  const [isSplashVisible, setSplashVisible] = useState(true);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isLoginPage, setIsLoginPage] = useState(true);

  // Always pad top and bottom with safe area insets so both login/register headers
  // and authenticated dashboard topbar/footer clear Dynamic Island and Home Indicator cleanly.
  const resolvedTopInset = insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 50 : 0);
  const topInset = resolvedTopInset;
  const resolvedBottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 24 : 0);
  const bottomInset = resolvedBottomInset;
  const isDark = isDarkTheme || isLoginPage;
  const containerBg = isDark ? '#061217' : '#ffffff';

  return (
    <View style={styles.root}>
      <RNStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} animated />
      <ExpoStatusBar style={isDark ? 'light' : 'dark'} animated />
      <View style={[styles.container, { backgroundColor: containerBg, paddingTop: topInset, paddingBottom: bottomInset }]}>
        <WebViewScreen
          onInitialLoadComplete={() => setWebViewReady(true)}
          onThemeChange={(dark, isLogin) => {
            setIsDarkTheme(dark);
            if (typeof isLogin === 'boolean') {
              setIsLoginPage(isLogin);
            }
          }}
        />
      </View>
      {isSplashVisible && (
        <AnimatedSplashScreen
          isReady={isWebViewReady}
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
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    alignItems: 'stretch',
  },
});

