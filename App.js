import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen';
import WebViewScreen from './src/screens/WebViewScreen';

export default function App() {
  const [isWebViewReady, setWebViewReady] = useState(false);
  const [isSplashVisible, setSplashVisible] = useState(true);
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <WebViewScreen
          onInitialLoadComplete={() => setWebViewReady(true)}
          onThemeChange={setIsDarkTheme}
        />
        <ExpoStatusBar style={isDarkTheme ? 'light' : 'dark'} />
        {isSplashVisible && (
          <AnimatedSplashScreen
            isReady={isWebViewReady}
            onFinish={() => setSplashVisible(false)}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#061217',
    alignItems: 'stretch',
  },
});
