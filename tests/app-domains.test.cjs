const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const selectDomain = require('../config/select-domain.cjs');
const domains = require('../config/app-domains.json');
const configure = require('../app.config.js');
const base = require('../app.json').expo;
const profiles = require('../eas.json').build;

test('the EAS pre-install check rejects structural differences between preview builds', () => {
  const { validatePreviewProfiles } = require('../scripts/validate-company-build.cjs');
  assert.doesNotThrow(() => validatePreviewProfiles(profiles));
  for (const change of [
    profile => { profile.developmentClient = true; },
    profile => { profile.android = { buildType: 'app-bundle' }; },
    profile => { profile.env.ENABLE_DIFFERENT_UI = 'true'; },
  ]) {
    const different = structuredClone(profiles);
    change(different['preview-ftx']);
    assert.throws(() => validatePreviewProfiles(different));
  }
});

test('the folder default and default EAS profiles select the same company', () => {
  const expected = require('../config/default-domain.json').domain;
  assert.equal(selectDomain({}).domain, expected);
  for (const name of ['development', 'preview', 'production']) {
    const app = selectDomain({ ...profiles[name].env, EAS_BUILD_PROFILE: name });
    assert.equal(app.domain, expected);
    assert.equal(app.appId, base.android.package);
    assert.equal(app.appId, base.ios.bundleIdentifier);
  }
});

test('domain selection rejects mismatched websites and unknown company domains', () => {
  assert.throws(() => selectDomain({ APP_DOMAIN: 'evil.example' }));
  assert.throws(() => selectDomain({ APP_DOMAIN: 'c20260531125358085.specialcalendar.com', EXPO_PUBLIC_SITE_URL: 'https://c20261027151705426.specialcalendar.com' }));
  assert.throws(() => selectDomain({ EXPO_PUBLIC_SITE_URL: 'http://c20261027151705426.specialcalendar.com' }));
  assert.throws(() => selectDomain({ EXPO_PUBLIC_SITE_URL: 'https://c20261027151705426.specialcalendar.com/login' }));
});

test('changing only the URL selects the company code and app identity for either company', () => {
  for (const [domain, expected] of Object.entries(domains)) {
    const app = selectDomain({ EXPO_PUBLIC_SITE_URL: `https://${domain}`, EAS_BUILD_PROFILE: 'preview' });
    assert.equal(app.pagecode, domain.split('.')[0]);
    assert.equal(app.appId, expected.appId);
    assert.equal(app.siteUrl, `https://${domain}`);
  }
});

test('both companies build with matching identifiers, URLs, links, assets and isolated runtimes', () => {
  const previousDomain = process.env.APP_DOMAIN;
  const previousUrl = process.env.EXPO_PUBLIC_SITE_URL;
  const runtimes = new Set();
  try {
    for (const [domain, settings] of Object.entries(domains)) {
      process.env.APP_DOMAIN = domain;
      process.env.EXPO_PUBLIC_SITE_URL = `https://${domain}`;
      const app = configure({ config: base });
      assert.equal(app.name, settings.title);
      assert.equal(app.android.package, settings.appId);
      assert.equal(app.ios.bundleIdentifier, settings.appId);
      assert.ok(app.ios.infoPlist.NSCameraUsageDescription.includes(settings.title));
      assert.equal(app.extra.siteUrl, `https://${domain}`);
      assert.equal(app.extra.companyPagecode, settings.pagecode);
      assert.equal(app.extra.eas.projectId, settings.projectId);
      assert.deepEqual(app.ios.associatedDomains, [`applinks:${domain}`]);
      assert.equal(app.android.intentFilters[0].data[0].host, domain);
      assert.equal(app.plugins.find(p => Array.isArray(p) && p[0] === 'expo-splash-screen')[1].image, settings.splash);
      assert.ok(fs.existsSync(path.join(__dirname, '..', settings.icon)));
      assert.ok(fs.existsSync(path.join(__dirname, '..', settings.splash)));
      runtimes.add(app.runtimeVersion);
      const firebasePath = path.join(__dirname, '..', settings.androidGoogleServicesFile);
      // Local Firebase client files are excluded from Git and supplied at build time.
      if (fs.existsSync(firebasePath)) {
        const firebase = JSON.parse(fs.readFileSync(firebasePath, 'utf8'));
        assert.ok(firebase.client.some(c => c.client_info.android_client_info.package_name === settings.appId));
      }
    }
    assert.equal(runtimes.size, 2);
  } finally {
    if (previousDomain === undefined) delete process.env.APP_DOMAIN; else process.env.APP_DOMAIN = previousDomain;
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SITE_URL; else process.env.EXPO_PUBLIC_SITE_URL = previousUrl;
  }
});

test('explicit EAS profiles select the corresponding domain without inherited URL conflicts', () => {
  for (const profile of ['preview-demo', 'preview-ftx', 'production-demo', 'production-ftx']) {
    const { env, extends: parent } = profiles[profile];
    const app = selectDomain({ ...profiles[parent].env, ...env });
    assert.equal(app.domain, env.APP_DOMAIN);
    assert.equal(app.appId, profile.endsWith('-demo') ? 'com.demoteam.app' : 'com.ftxteam.app');
    assert.equal(profiles[profile].channel, `${profile.endsWith('-ftx') ? 'ftx' : 'demo'}-${parent}`);
  }
});

test('deployment registry matches the mobile domain configuration', () => {
  const deployed = require('../deployment/domain-push/common/config/mobile-push-domains.json');
  assert.deepEqual(deployed, domains);
});

test('animated splash image follows the same selected company as the native splash', () => {
  const vm = require('node:vm');
  const babel = require('@babel/core');
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/companyBranding.js'), 'utf8');
  const { code } = babel.transformSync(source, { babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'] });
  for (const [domain, config] of Object.entries(domains)) {
    const exports = {};
    vm.runInNewContext(code, { exports, require(name) {
      if (name === './companyAppConfig') return { __esModule: true, default: () => ({ domain }) };
      return name === 'expo-constants' ? { expoConfig: { extra: { companyDomain: domain } } } : name;
    } });
    assert.equal(exports.companySplashImage(), `../../${config.splash.slice(2)}`);
  }
});
