import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTED_YEARS, isIsoDate, isSupportedDate, getInitialDate, getTodayDate,
  dateInYear, getDaysInYear, isoFromDayIndex, dayIndexFromIso } from '../src/calendar.js';

for (const year of SUPPORTED_YEARS) {
  test(`${year}: all 365 dates round-trip through the slider and URL`, () => {
    assert.equal(getDaysInYear(year), 365);
    for (let day = 0; day < 365; day++) {
      const iso = isoFromDayIndex(year, day);
      assert.ok(isSupportedDate(iso));
      assert.equal(dayIndexFromIso(iso), day);
      assert.equal(getInitialDate(`?date=${iso}`), iso);
    }
    assert.equal(isoFromDayIndex(year, 0), `${year}-01-01`);
    assert.equal(isoFromDayIndex(year, 364), `${year}-12-31`);
    assert.equal(getTodayDate(new Date(year, 9, 29, 12)), `${year}-10-29`);
  });
}

test('invalid, unsupported and missing URL dates fall back to local today', () => {
  const now = new Date(2027, 4, 20, 12);
  for (const value of ['', '2026-02-29', '2027-02-30', '2027-04-31', '2027-13-01',
    '2027-00-01', '2027-01-00', '2027-1-1', '2028-01-01', 'junk']) {
    assert.equal(getInitialDate(`?date=${value}`, now), '2027-05-20');
  }
  assert.equal(getInitialDate('', now), '2027-05-20');
  assert.equal(getTodayDate(new Date(2028, 0, 1)), '2026-01-01');
  assert.equal(isSupportedDate(null), false);
});

test('changing year preserves month/day and clamps leap day', () => {
  assert.equal(dateInYear('2026-12-31', 2027), '2027-12-31');
  assert.equal(dateInYear('2027-01-01', 2026), '2026-01-01');
  assert.equal(dateInYear('2028-02-29', 2027), '2027-02-28');
  assert.ok(isIsoDate('2028-02-29'));
  assert.equal(getDaysInYear(2028), 366);
});
