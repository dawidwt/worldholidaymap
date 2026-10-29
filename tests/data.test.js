import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SUPPORTED_YEARS, isIsoDate } from '../src/calendar.js';

for (const year of SUPPORTED_YEARS) {
  const data = JSON.parse(await readFile(new URL(`../public/holidays-${year}.json`, import.meta.url)));
  test(`${year}: dataset dates, coverage, totals and ranking are consistent`, () => {
    assert.equal(data.year, year);
    assert.ok(Object.keys(data.countries).length > 190);
    assert.equal(data.coverage.countriesWithHolidayData, Object.keys(data.countries).length);
    const dates = Object.keys(data.holidaysByDate).sort();
    assert.ok(dates.length > 300);
    assert.equal(data.coverage.datesWithPublicHolidays, dates.length);
    assert.deepEqual(Object.keys(data.dateStats).sort(), dates);
    for (const date of dates) {
      assert.ok(isIsoDate(date) && date.startsWith(`${year}-`), date);
      const rows = data.holidaysByDate[date];
      const codes = [...new Set(rows.map(row => row.countryCode))];
      assert.equal(new Set(rows.map(row => `${row.countryCode}:${row.name}`)).size, rows.length);
      for (const row of rows) {
        assert.ok(data.countries[row.countryCode]);
        assert.equal(row.type, 'public');
        assert.ok(row.name.trim());
      }
      const populated = codes.map(code => data.countries[code]).filter(c => typeof c.population === 'number');
      assert.deepEqual(data.dateStats[date], {
        date, countryCount: codes.length, holidayCount: rows.length,
        population: populated.reduce((sum, c) => sum + c.population, 0),
        populationCountryCount: populated.length,
      });
    }
    const ranked = Object.values(data.dateStats).sort((a, b) =>
      b.countryCount - a.countryCount || b.population - a.population || a.date.localeCompare(b.date));
    assert.deepEqual(data.topHolidayDates, ranked.slice(0, 10));
  });
  test(`${year}: fixed and movable Polish holidays are generated for the correct year`, () => {
    const easter = year === 2026 ? '2026-04-05' : '2027-03-28';
    for (const date of [`${year}-01-01`, `${year}-12-25`, easter]) {
      assert.ok(data.holidaysByDate[date].some(row => row.countryCode === 'PL'), date);
    }
    const wrongEaster = year === 2026 ? '2026-03-28' : '2027-04-05';
    assert.ok(!(data.holidaysByDate[wrongEaster] || []).some(row => row.countryCode === 'PL'));
  });
}
