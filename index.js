// Keep this file CommonJS so ErrorUtils is installed before App is required.
// ESM `import` statements are hoisted and would load App (and its deps) first.
if (global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler && global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.warn('[GlobalErrorHandler] Caught error:', error, 'fatal=', isFatal);
    if (!__DEV__ && defaultHandler) {
      try {
        // Downgrade fatals in release so a recoverable JS error does not SIGABRT.
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

const { registerRootComponent } = require('expo');
const App = require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
