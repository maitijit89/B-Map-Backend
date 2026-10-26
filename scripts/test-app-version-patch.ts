import { env } from '../src/core/config/env.config';
import { AppVersionController, appVersionController } from '../src/modules/app-version/app-version.controller';
import { AppVersionService } from '../src/modules/app-version/app-version.service';
import { VersionUtils } from '../src/modules/app-version/version.utils';

async function runVersionControlAndPatchTests() {
  console.log('===============================================================');
  console.log('🚀 APP VERSION CONTROL & FRONTEND PATCHING VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Authoritative Backend Base Version is 1.0.0
  // -------------------------------------------------------------
  console.log('--- TEST 1: Backend Sovereign Release Version is 1.0.0 ---');
  assert(env.APP_VERSION === '1.0.0', `Authoritative APP_VERSION must equal 1.0.0 (found: ${env.APP_VERSION})`);

  // -------------------------------------------------------------
  // TEST 2: Semantic Version Parsing & Comparison Engine
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Semantic Version Parsing & Comparison Logic ---');
  const [maj1, min1, pat1] = VersionUtils.parseSemver('1.0.0');
  assert(maj1 === 1 && min1 === 0 && pat1 === 0, '1.0.0 parses correctly into [1, 0, 0]');

  const [majBeta, minBeta, patBeta] = VersionUtils.parseSemver('1.2.3-rc.2');
  assert(majBeta === 1 && minBeta === 2 && patBeta === 3, 'Pre-release semver parses base numeric triplet correctly');

  // Comparison assertions
  assert(VersionUtils.compareSemver('1.0.0', '1.0.0') === 0, '1.0.0 equals 1.0.0');
  assert(VersionUtils.compareSemver('0.9.9', '1.0.0') < 0, '0.9.9 is older than 1.0.0');
  assert(VersionUtils.compareSemver('1.0.1', '1.0.0') > 0, '1.0.1 is newer than 1.0.0');
  assert(VersionUtils.compareSemver('2.0.0', '1.9.9') > 0, 'Major version bump takes precedence');
  assert(VersionUtils.isOutdated('0.9.8', '1.0.0') === true, 'isOutdated("0.9.8", "1.0.0") must return true');
  assert(VersionUtils.isOutdated('1.0.0', '1.0.0') === false, 'isOutdated("1.0.0", "1.0.0") must return false');
  assert(VersionUtils.isForceUpdateRequired('0.8.5', '1.0.0') === true, 'Force update required if installed is below minimum');
  assert(VersionUtils.isForceUpdateRequired('1.0.0', '1.0.0') === false, 'Force update NOT required if version satisfies minimum');

  // -------------------------------------------------------------
  // TEST 3: AppVersionService Default Platform Initialization
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Default Platform Versions Initialized to 1.0.0 ---');
  const testService = new AppVersionService();
  const allPlatforms = testService.getAllPlatformsLatest();

  assert(allPlatforms.length === 4, `Must initialize 4 client platforms (web, android, ios, desktop)`);
  const webInit = allPlatforms.find((p) => p.platform === 'web');
  const androidInit = allPlatforms.find((p) => p.platform === 'android');
  const iosInit = allPlatforms.find((p) => p.platform === 'ios');

  assert(webInit?.currentVersion === '1.0.0', `Web platform starts at version 1.0.0`);
  assert(androidInit?.currentVersion === '1.0.0', `Android platform starts at version 1.0.0`);
  assert(iosInit?.currentVersion === '1.0.0', `iOS platform starts at version 1.0.0`);
  assert(webInit?.latestBuildNumber === 100, `Initial build number is 100`);

  // -------------------------------------------------------------
  // TEST 4: Client Version Check (Before Patch)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Client Version Check (Pre-Patch State) ---');
  // Client already on 1.0.0
  const checkCurrent = testService.checkClientVersion({
    platform: 'web',
    version: '1.0.0',
    buildNumber: 100,
  });
  assert(checkCurrent.updateAvailable === false, 'Client on 1.0.0 has updateAvailable = false');
  assert(checkCurrent.forceUpdate === false, 'Client on 1.0.0 has forceUpdate = false');
  assert(checkCurrent.currentVersion === '1.0.0', 'Active currentVersion reported as 1.0.0');

  // Legacy client on 0.9.0
  const checkLegacy = testService.checkClientVersion({
    platform: 'web',
    version: '0.9.0',
    buildNumber: 90,
  });
  assert(checkLegacy.updateAvailable === true, 'Legacy 0.9.0 client has updateAvailable = true');
  assert(checkLegacy.forceUpdate === true, 'Legacy 0.9.0 client has forceUpdate = true (below minimum 1.0.0)');
  assert(checkLegacy.patchAvailable === true, 'Patch bundle is available for legacy upgrade');

  // -------------------------------------------------------------
  // TEST 5: Dynamic Frontend Version Patch via API (PATCH /patch)
  // User Prompt: "then version update in frontend i want to patch using api"
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Frontend Dynamic Version Patching via API ---');
  const patchPayload = {
    platform: 'web' as const,
    currentVersion: '1.0.1',
    latestBuildNumber: 101,
    title: 'B-Map Web v1.0.1 Live Hotfix Release',
    releaseNotes: [
      'Hotfix: Ultra-low latency WebSocket reconnect optimization',
      'Enhanced Extended Kalman Filter sensor smoothing',
      'DigiPIN 4x4m grid snapping precision upgrade',
    ],
    patchBundleUrl: 'https://cdn.bmap.io/bundles/web/v1.0.1/app.delta.bundle.js',
    patchHash: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    patchSize: 492000,
    forceUpdate: false,
    broadcastSocket: false, // mute actual socket emission in test runner
  };

  const patchedRecord = await testService.patchAppVersion(patchPayload);

  assert(patchedRecord.platform === 'web', 'Patched platform is web');
  assert(patchedRecord.currentVersion === '1.0.1', 'Patched currentVersion updated to 1.0.1');
  assert(patchedRecord.latestBuildNumber === 101, 'Build number incremented to 101');
  assert(patchedRecord.patchBundleUrl === patchPayload.patchBundleUrl, 'OTA patchBundleUrl correctly assigned');
  assert(patchedRecord.releaseNotes.length === 3, 'Patch release notes attached successfully');

  // -------------------------------------------------------------
  // TEST 6: Post-Patch Client Verification & Live Hot-Reload Delta
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Post-Patch Verification for 1.0.0 Client ---');
  // Client on 1.0.0 now checks against newly patched server (which is at 1.0.1)
  const checkPostPatch = testService.checkClientVersion({
    platform: 'web',
    version: '1.0.0',
    buildNumber: 100,
  });

  assert(checkPostPatch.updateAvailable === true, 'Client at 1.0.0 now flagged with updateAvailable = true');
  assert(checkPostPatch.patchAvailable === true, 'patchAvailable = true for hot-reload bundle delivery');
  assert(checkPostPatch.patch?.fromVersion === '1.0.0', 'Patch fromVersion is 1.0.0');
  assert(checkPostPatch.patch?.toVersion === '1.0.1', 'Patch toVersion is 1.0.1');
  assert(checkPostPatch.patch?.patchBundleUrl === patchPayload.patchBundleUrl, 'Patch bundle URL points to v1.0.1 delta');
  assert(checkPostPatch.patch?.patchHash === patchPayload.patchHash, 'Patch SHA-256 hash included for integrity check');

  // Client that applied the patch and now reports 1.0.1
  const checkUpdated = testService.checkClientVersion({
    platform: 'web',
    version: '1.0.1',
    buildNumber: 101,
  });
  assert(checkUpdated.updateAvailable === false, 'Updated client at 1.0.1 is fully satisfied (no update needed)');

  // -------------------------------------------------------------
  // TEST 7: Platform Isolation
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Platform Isolation Check ---');
  const androidCheck = testService.checkClientVersion({
    platform: 'android',
    version: '1.0.0',
    buildNumber: 100,
  });
  assert(androidCheck.currentVersion === '1.0.0', 'Android platform remains isolated at 1.0.0 when only web is patched');
  assert(androidCheck.updateAvailable === false, 'Android client 1.0.0 is not affected by web patch');

  // -------------------------------------------------------------
  // TEST 8: Controller HTTP REST Endpoint Contract Testing
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Controller REST Endpoint Contract Validation ---');

  // Helper mock express response
  function createMockRes() {
    const res: any = {};
    res.statusCode = 200;
    res.body = null;
    res.status = function (code: number) {
      res.statusCode = code;
      return res;
    };
    res.json = function (payload: any) {
      res.body = payload;
      return res;
    };
    return res;
  }

  // 8.1 GET /current
  const mockResCurrent = createMockRes();
  await appVersionController.getCurrent({} as any, mockResCurrent);
  assert(mockResCurrent.statusCode === 200, 'GET /current returns 200 OK');
  assert(mockResCurrent.body.success === true, 'GET /current returns standardized success envelope');
  assert(mockResCurrent.body.data.appVersion === '1.0.0', 'Authoritative version in response is 1.0.0');

  // 8.2 GET /latest
  const mockResLatest = createMockRes();
  await appVersionController.getLatestPlatforms({} as any, mockResLatest);
  assert(mockResLatest.statusCode === 200, 'GET /latest returns 200 OK');
  assert(mockResLatest.body.data.platforms.length === 4, 'GET /latest returns all 4 client platforms');

  // 8.3 GET /check with query params
  const mockReqCheck: any = {
    query: { platform: 'web', version: '1.0.0', buildNumber: '100' },
    body: {},
  };
  const mockResCheck = createMockRes();
  await appVersionController.checkVersion(mockReqCheck, mockResCheck);
  assert(mockResCheck.statusCode === 200, 'GET /check returns 200 OK');
  assert(typeof mockResCheck.body.data.updateAvailable === 'boolean', 'Check response includes updateAvailable flag');

  // 8.4 PATCH /patch dynamic frontend version update
  const mockReqPatch: any = {
    body: {
      platform: 'web',
      currentVersion: '1.0.2',
      latestBuildNumber: 102,
      title: 'B-Map Web v1.0.2 OTA Hotpatch',
      patchBundleUrl: 'https://cdn.bmap.io/bundles/web/v1.0.2/main.bundle.js',
      broadcastSocket: false,
    },
  };
  const mockResPatch = createMockRes();
  await appVersionController.patchVersion(mockReqPatch, mockResPatch);
  assert(mockResPatch.statusCode === 200, 'PATCH /patch returns 200 OK');
  assert(mockResPatch.body.data.currentVersion === '1.0.2', 'PATCH /patch updated version to 1.0.2 via API');
  assert(mockResPatch.body.data.patchBundleUrl.includes('v1.0.2'), 'PATCH /patch updated OTA bundle URL');

  // 8.5 Invalid platform rejection
  const mockReqBadPatch: any = {
    body: {
      platform: 'smartwatch_invalid',
      currentVersion: '2.0.0',
    },
  };
  const mockResBadPatch = createMockRes();
  await appVersionController.patchVersion(mockReqBadPatch, mockResBadPatch);
  assert(mockResBadPatch.statusCode === 400, 'PATCH /patch rejects invalid platform with 400 Bad Request');

  // -------------------------------------------------------------
  // TEST SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`📊 VERSION CONTROL & PATCH RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVersionControlAndPatchTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
