import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen';
import WebViewScreen from './src/screens/WebViewScreen';

export default function App() {
  const [isWebViewReady, setWebViewReady] = useState(false);
  const [isSplashVisible, setSplashVisible] = useState(true);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <WebViewScreen onInitialLoadComplete={() => setWebViewReady(true)} />
        <ExpoStatusBar style="dark" />
        {isSplashVisible && (
          <AnimatedSplashScreen
            isReady={isWebViewReady}
            onFinish={() => setSplashVisible(false)}
          />
        )}
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
