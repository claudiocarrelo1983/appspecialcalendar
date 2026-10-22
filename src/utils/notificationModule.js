let notifications;

export function getNotifications() {
  if (notifications !== undefined) return notifications;

  try {
    const module = require('expo-notifications');
    module.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    notifications = module;
  } catch (error) {
    // An older installed binary may not contain the notification native modules.
    // Keep the calendar app usable when this optional feature cannot initialize.
    console.warn('Push notifications unavailable:', error);
    notifications = null;
  }

  return notifications;
}
