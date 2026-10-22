if (global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler && global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.warn('[GlobalErrorHandler] Caught error:', error);
    if (!__DEV__ && defaultHandler) {
      try {
        defaultHandler(error, false);
      } catch (err) {
        console.warn('[GlobalErrorHandler] Fallback handler error:', err);
      }
      return;
    }
    if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
