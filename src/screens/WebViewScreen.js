import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import LoadingOverlay from '../components/LoadingOverlay';

const START_URL = 'https://specialcalendar.com/login-mobile';

export default function WebViewScreen() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const onAndroidBackPress = useCallback(() => {
    if (canGoBack) {
      webViewRef.current?.goBack();
      return true;
    }
    return false;
  }, [canGoBack]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onAndroidBackPress
    );

    return () => subscription.remove();
  }, [onAndroidBackPress]);

  return (
  <View style={styles.container}>
    <WebView
      ref={webViewRef}
      source={{ uri: START_URL }}
      onNavigationStateChange={(navState) => {
        setCanGoBack(navState.canGoBack);
      }}
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      cacheEnabled
      incognito={false}
      javaScriptEnabled
      domStorageEnabled
      allowsBackForwardNavigationGestures
    />
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
