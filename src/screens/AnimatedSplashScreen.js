import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  StatusBar,
  View,
  Image,
  Text,
} from 'react-native';

export default function AnimatedSplashScreen({ onFinish }) {

  const opacity = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {

    const animation = Animated.sequence([

      // 🔹 Fade IN
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),

      // 🔹 Delay
      Animated.delay(1500),

      // 🔹 Fade OUT + zoom leve
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.05,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start(({ finished }) => {
      if (finished && onFinish) onFinish();
    });

    return () => animation.stop();

  }, [onFinish]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeIn }]}>

      {/*Status Bar */}
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      {/*BACKGROUND */}
      <View style={styles.background} />

      {/*LOGO */}
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <Image
          source={require('../../assets/logo/ftx-icon.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="FTX Team logo"
        />
        <Text style={styles.attribution}>by Special Calendar</Text>
      </Animated.View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  background: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#fff',
  },

  logoWrapper: {
    width: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },

  logo: {
    width: 220,
    height: 220,
  },

  attribution: {
    marginTop: 20,
    color: '#60666b',
    fontSize: 14,
    textAlign: 'center',
  },
});
