const { withEntitlementsPlist, withInfoPlist, withAndroidManifest, withGradleProperties } = require('expo/config-plugins');

module.exports = function withHealthTools(config) {
  config = withEntitlementsPlist(config, value => { value.modResults['com.apple.developer.healthkit'] = true; return value; });
  config = withInfoPlist(config, value => {
    value.modResults.NSHealthShareUsageDescription = 'Special Calendar reads the workouts and daily steps you allow, to show your fitness history and dashboard. Sync imports these records into your selected company account.';
    // Apple's static HealthKit validation also requires the update purpose key.
    // Authorization remains read-only (toShare: [] in the native module).
    value.modResults.NSHealthUpdateUsageDescription = 'Special Calendar uses Apple Health to display the workouts and daily steps you choose to share in your fitness dashboard. This version does not write or change Apple Health records.';
    return value;
  });
  config = withGradleProperties(config, value => {
    const item = value.modResults.find(item => item.key === 'android.minSdkVersion');
    if (item) item.value = String(Math.max(26, Number(item.value) || 26));
    else value.modResults.push({type: 'property', key: 'android.minSdkVersion', value: '26'});
    return value;
  });
  return withAndroidManifest(config, value => {
    const application = value.modResults.manifest.application[0];
    application['meta-data'] = application['meta-data'] || [];
    application['meta-data'] = application['meta-data'].filter(item => item.$['android:name'] !== 'sc_health_privacy_url');
    application['meta-data'].push({$: {'android:name': 'sc_health_privacy_url', 'android:value': (value.extra?.siteUrl || 'https://specialcalendar.com').replace(/\/$/, '') + '/privacy-policy'}});
    return value;
  });
};
