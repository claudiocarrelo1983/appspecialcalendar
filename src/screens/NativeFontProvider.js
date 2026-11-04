import React from 'react';
import {useFonts} from 'expo-font';
import {NativeFontContext} from './NativeGymTypography';

// Covers admin, client, authentication and offline modals, including cold starts.
export default function NativeFontProvider({children}) {
  const [loaded]=useFonts({
    GymBoxicons:require('../assets/fonts/boxicons.ttf'),
    GymBody:require('../assets/fonts/Poppins-Regular.ttf'),
    GymBodySemiBold:require('../assets/fonts/Poppins-SemiBold.ttf'),
    GymHeading:require('../assets/fonts/BricolageGrotesque-Bold.ttf'),
  });
  return <NativeFontContext.Provider value={loaded}>{children}</NativeFontContext.Provider>;
}
