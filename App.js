import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen';
import WebViewScreen from './src/screens/WebViewScreen';

function AppContent() {
  const insets = useSafeAreaInsets();
  const [isWebViewReady, setWebViewReady] = useState(false);
  const [isSplashVisible, setSplashVisible] = useState(true);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isLoginPage, setIsLoginPage] = useState(false);

  // When on login/auth page, fill full screen edge-to-edge with dark background.
  // When logged in, pad top so the web content (.topbar) begins cleanly below Dynamic Island / status bar.
  const resolvedTopInset = insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 50 : 0);
  const topInset = isLoginPage ? 0 : resolvedTopInset;
  const resolvedBottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 24 : 0);
  const bottomInset = isLoginPage ? 0 : resolvedBottomInset;
  const containerBg = isLoginPage ? '#061217' : (isDarkTheme ? '#061217' : '#ffffff');

  return (
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
      <ExpoStatusBar style={isDarkTheme || isLoginPage ? 'light' : 'dark'} />
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
  container: {
    flex: 1,
    alignItems: 'stretch',
  },
});

