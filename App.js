import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { Component, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen';
import WebViewScreen from './src/screens/WebViewScreen';

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

export default function App() {
  const [isSplashAnimationComplete, setSplashAnimationComplete] = useState(false);

  if (!isSplashAnimationComplete) {
    return (
      <AnimatedSplashScreen
        onFinish={() => {
          setTimeout(() => setSplashAnimationComplete(true), 50);
        }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <WebViewScreen />
          <ExpoStatusBar style="dark" />
        </SafeAreaView>
      </SafeAreaProvider>
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
