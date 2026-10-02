import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const START_URL = 'https://specialcalendar.com/login-mobile';

const INJECTED_PREVENT_ZOOM_JS = `
  (function() {
    // 1. Prevent touch pinch-to-zoom via CSS
    if (!document.getElementById('native-feel-style')) {
      const style = document.createElement('style');
      style.id = 'native-feel-style';
      style.innerHTML = 'html, body { touch-action: pan-x pan-y !important; -webkit-text-size-adjust: 90%; }';
      document.documentElement.appendChild(style);
    }

    // 2. Enforce viewport meta tag to disable zooming
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.documentElement.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no';

    // 3. Disable WebKit/iOS pinch gestures
    document.addEventListener('gesturestart', function(e) {
      e.preventDefault();
    }, { passive: false });
  })();
  true;
`;

export default function WebViewScreen() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);

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
      injectedJavaScriptBeforeContentLoaded={INJECTED_PREVENT_ZOOM_JS}
      injectedJavaScript={INJECTED_PREVENT_ZOOM_JS}
      textZoom={90}
      setBuiltInZoomControls={false}
      setDisplayZoomControls={false}
      scalesPageToFit={false}
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
