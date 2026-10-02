import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AnimatedSplashScreen from './src/screens/AnimatedSplashScreen'
import WebViewScreen from './src/screens/WebViewScreen';

export default function App() {
  const [isSplashAnimationComplete, setSplashAnimationComplete] = useState(false);

  if (!isSplashAnimationComplete){
    return <AnimatedSplashScreen onFinish={() => {
    setTimeout(() => setSplashAnimationComplete(true), 50);
  }}/>
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.container}
      >
        <WebViewScreen />
        <ExpoStatusBar style='dark'/>
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
