import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { Component, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>A carregar FTX Team...</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [WebViewScreen, setWebViewScreen] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Defer WebView + notifications modules until after splash has painted
    // and the RN bridge is ready. Eager imports were aborting via RCTFatal.
    const timer = setTimeout(() => {
      try {
        // eslint-disable-next-line global-require
        const screen = require('./src/screens/WebViewScreen').default;
        if (!cancelled) setWebViewScreen(() => screen);
      } catch (error) {
        console.warn('[App] Failed to load WebViewScreen:', error);
        if (!cancelled) setLoadError(true);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Não foi possível iniciar a aplicação.</Text>
      </View>
    );
  }

  if (!WebViewScreen) {
    return <View style={styles.container} />;
  }

  const Screen = WebViewScreen;
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Screen />
        <ExpoStatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function App() {
  const [isSplashAnimationComplete, setSplashAnimationComplete] = useState(false);

  if (!isSplashAnimationComplete) {
    return (
      <ErrorBoundary>
        <AnimatedSplashScreen
          onFinish={() => {
            setTimeout(() => setSplashAnimationComplete(true), 50);
          }}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'stretch',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#333',
  },
});
