import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  StatusBar,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';

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

      // 🔹 Delay (deixa a animação rodar)
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

  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeIn }]}>

      {/* 🔹 Status Bar */}
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* 🔹 BACKGROUND (opcional - mantém cor sólida) */}
      <View style={styles.background} />

      {/* 🔥 LOTTIE ANIMATION */}
      <Animated.View
        style={[
          styles.lottieWrapper,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <LottieView
          source={require('../../assets/animations/Insider-loading.json')}
          autoPlay
          loop
          style={styles.lottie}
        />
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

  lottieWrapper: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },

  lottie: {
    width: '100%',
    height: '100%',
  },
});