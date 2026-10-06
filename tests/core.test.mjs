import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, modules = {}, extra = {}) {
  const testModule = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module: testModule, exports: testModule.exports, require: name => { if (!(name in modules)) throw new Error(name); return modules[name]; }, Date, Set, Map, Number, Math, Error, URL, Uint8Array, Promise, ...extra });
  return testModule.exports;
}
const { validateImportRows } = load('lib/place-import.ts');
const cells = (...values) => [...values, ...Array(13).fill('')].slice(0, 13);

test('Excel duplicates within the file report the second row and preserve no accidental overwrite semantics', () => {
  const { records, issues } = validateImportRows([{ row: 2, cells: cells(' 碧潭 ', ' 新店碧潭 ') }, { row: 7, cells: cells('碧潭', '新店碧潭') }]);
  assert.equal(records.length, 2); assert.equal(issues.length, 1); assert.equal(issues[0].row, 7); assert.match(issues[0].reason, /第 2 列重複/);
});
test('Excel reports all invalid rows together', () => {
  const { issues } = validateImportRows([{ row: 2, cells: cells('', '地址', '6') }, { row: 3, cells: cells('地點', '', '', '', '', 'javascript:alert(1)') }]);
  assert.equal(issues.length, 4); assert.deepEqual([...new Set(issues.map(issue => issue.row))], [2, 3]);
});
test('Coordinate pairs and range validation reject invalid coordinates', () => {
  const result = validateImportRows([{ row: 2, cells: cells('地點', '地址', '', '', '', '', '', '25') }, { row: 3, cells: cells('地點二', '地址', '', '', '', '', '', '91', '181') }]);
  assert.equal(result.issues.length, 3);
});
test('Invalid calendar dates and reversed ranges are rejected', () => {
  const { issues } = validateImportRows([{ row: 2, cells: cells('地點', '地址', '', '', '', '', '', '', '', '13', '2026-02-30', '2026-02-01') }]);
  assert.equal(issues.length, 3);
});
test('Valid import supports tags, both timing types, blank navigation, zero coordinates, and no photos', () => {
  const { records, issues } = validateImportRows([{ row: 2, cells: cells('地點', '地址', '4', '親子,散步', '筆記', 'https://example.com', '', '0', '0', '5,5,10', '2026-10-01', '2026-10-31', '傍晚') }]);
  assert.equal(issues.length, 0); const place = records[0].place;
  assert.equal(place.lat, 0); assert.equal(place.lng, 0); assert.equal(place.navigationTarget, ''); assert.equal(place.photos.length, 0); assert.equal(place.bestTimings.length, 2); assert.equal(place.bestTimings[0].months.length, 2);
});
const dates = load('lib/dates.ts');
test('Today uses local calendar fields instead of UTC', () => {
  assert.equal(dates.localDateText({ getFullYear: () => 2026, getMonth: () => 9, getDate: () => 5 }), '2026-10-05');
});
const { isSuitableNow } = load('lib/timing.ts', { '@/lib/dates': dates });
test('Suitable-now includes both ends of a date range and excludes dates outside it', () => {
  const place = { bestTimings: [{ kind: 'dateRange', startDate: '2026-10-01', endDate: '2026-10-05' }] };
  assert.equal(isSuitableNow(place, '2026-10-01'), true); assert.equal(isSuitableNow(place, '2026-10-05'), true); assert.equal(isSuitableNow(place, '2026-10-06'), false);
});
test('Suitable-now supports old monthly data without selecting places without timing', () => {
  assert.equal(isSuitableNow({ bestTiming: { months: [10] } }, '2026-10-05'), true); assert.equal(isSuitableNow({}, '2026-10-05'), false);
});
const { buildNavigationDestination } = load('lib/navigation.ts');
test('Navigation follows target coordinates, target name, place coordinates, address', () => {
  const place = { navigationTargetLat: 0, navigationTargetLng: 0, navigationTarget: '碧潭', lat: 25, lng: 121, address: '新店' };
  assert.equal(buildNavigationDestination(place), '0,0'); delete place.navigationTargetLat; delete place.navigationTargetLng;
  assert.equal(buildNavigationDestination(place), '碧潭'); place.navigationTarget = '.'; assert.equal(buildNavigationDestination(place), '25,121'); delete place.lat; delete place.lng; assert.equal(buildNavigationDestination(place), '新店');
});
function identityHarness(seed) {
  const database = new Map(Object.entries(seed)); const writes = [];
  let writing = false;
  const fake = {
    doc: (_db, ...segments) => segments.join("/"),
    setDoc: async (ref, value) => database.set(ref, value),
    runTransaction: async (_db, callback) => callback({
      get: async ref => { assert.equal(writing, false, 'all reads must happen before writes'); return { exists: () => database.has(ref), data: () => database.get(ref) }; },
      set: (ref, value) => { writing = true; writes.push({ ref, value }); },
      update: (ref, value) => { writing = true; writes.push({ ref, value }); },
    }),
  };
  return { ...load('lib/identity.ts', { 'firebase/firestore': fake, '@/lib/firebase': { db: {} } }), writes };
}
test('Identity merge combines every existing alias and both group lists without rewriting memories', async () => {
  const harness = identityHarness({
    'groups/map-memory-identity-transfers/info/CODE': { deviceId: 'old', groupIds: ['old-group'], expiresAt: Date.now() + 10000, nickname: '舊', used: false },
    'groups/map-memory-identity-profiles/info/old': { deviceIds: ['old', 'older'], groupIds: ['old-group'] },
    'groups/map-memory-identity-profiles/info/older': { deviceIds: ['old', 'older'], groupIds: ['old-group'] },
    'groups/map-memory-identity-profiles/info/new': { deviceIds: ['new'], groupIds: ['new-group'] },
  });
  const profile = await harness.mergeIdentity('code', 'new', ['new-group'], '新暱稱');
  assert.deepEqual([...profile.deviceIds].sort(), ['new', 'old', 'older']); assert.deepEqual([...profile.groupIds].sort(), ['new-group', 'old-group']); assert.equal(profile.nickname, '新暱稱');
  assert.equal(harness.writes.length, 4); assert.ok(harness.writes.every(write => /^groups\/map-memory-identity-(profiles|transfers)\/info\//.test(write.ref))); assert.equal(harness.writes.at(-1).value.used, true);
});
test('Expired or used transfer code causes no writes', async () => {
  for (const source of [{ used: true, expiresAt: Date.now() + 10000 }, { used: false, expiresAt: Date.now() - 1 }]) {
    const harness = identityHarness({ 'groups/map-memory-identity-transfers/info/CODE': { deviceId: 'old', ...source } });
    await assert.rejects(harness.mergeIdentity('code', 'new', [], '新'), /已使用或超過/); assert.equal(harness.writes.length, 0);
  }
});
test('Merging a transfer code into its source device is blocked with no writes', async () => {
  const harness = identityHarness({ 'groups/map-memory-identity-transfers/info/CODE': { deviceId: 'old', used: false, expiresAt: Date.now() + 10000 } });
  await assert.rejects(harness.mergeIdentity('code', 'old', [], ''), /另一支手機/); assert.equal(harness.writes.length, 0);
});


test('Current location requests fresh high-accuracy coordinates', async () => {
  const position = { coords: { latitude: 25.033, longitude: 121.5654 } };
  const api = load('lib/current-location.ts', {}, { navigator: { geolocation: { getCurrentPosition(success, failure, options) {
    assert.equal(options.enableHighAccuracy, true); assert.equal(options.maximumAge, 0); assert.equal(options.timeout, 15000); success(position);
  } } } });
  assert.equal(await api.currentPosition(), position);
  assert.equal(api.coordinateAddress(25.033, 121.5654), '25.033000,121.565400');
  assert.equal(api.coordinateAddress(0, 0), '0.000000,0.000000');
  for (const [lat, lng] of [[NaN, 0], [0, Infinity], [91, 0], [0, -181]]) assert.throws(() => api.coordinateAddress(lat, lng), /座標無效/);
});
test('Current location explains unsupported, denied, unavailable and timed-out location', async () => {
  await assert.rejects(load('lib/current-location.ts').currentPosition(), /不支援定位/);
  for (const [code, message] of [[1, /權限未開放/], [2, /無法取得/], [3, /定位逾時/]]) {
    const api = load('lib/current-location.ts', {}, { navigator: { geolocation: { getCurrentPosition(success, failure) { failure({ code }); } } } });
    await assert.rejects(api.currentPosition(), message);
  }
});
