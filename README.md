# World Holiday Map

A static Vite app showing countries that have a public holiday on the selected day in **2026 or 2027**. Choose a year, then change the date with the dropdown or day-of-year slider. The map, country details, population totals and top-10 rankings all use the selected year.

## Run

```bash
npm ci
npm run data
npm run dev
```

Local URL after starting Vite: `http://127.0.0.1:5173/`.

## Data model

`src/calendar.js` defines `SUPPORTED_YEARS` (2026 and 2027) for both the generator and the UI. `npm run data` generates one file per supported year: `public/holidays-2026.json` and `public/holidays-2027.json`. Each retains the existing format: `year`, `countries`, `holidaysByDate`, `dateStats`, `topHolidayDates`, coverage and source metadata. Dates use full `YYYY-MM-DD` keys and each file contains only dates within its year. No backend or database is needed.

The app loads only the selected year's file and caches it in memory. Changing year preserves the month and day (February 29 would clamp to February 28 in a non-leap year). A failed load displays a retry message and keeps the previous date and data usable. To add a future year, extend `SUPPORTED_YEARS`, regenerate the files, update the descriptive copy and extend validation fixtures.

Holidays are generated from the `date-holidays` library and filtered to the `public` holiday type. Each file also includes approximate country-level population totals from the World Bank `SP.POP.TOTL` indicator, with REST Countries population values used only as a fallback for map areas missing from the World Bank snapshot. Both holiday years use the same population snapshots; these are **not population forecasts for 2026 or 2027**. Those totals power the selected-day population estimate, data quality indicators, and top-10 holiday-day rankings by countries or population. Timeanddate - Holidays Worldwide is linked in the app as a reference source for manual verification. Future holiday dates reflect the installed library's rules and may need regeneration after official changes.

## Shareable dates

Existing links keep working, and the full date also selects the year:

- `http://127.0.0.1:5173/?date=2026-12-25`
- `http://127.0.0.1:5173/?date=2027-12-25`

There is no separate `year` query parameter. Missing, invalid or unsupported dates fall back to the local current date if its year is supported, otherwise January 1 of 2026. **Today** follows the same rule and can switch the year. Date changes and Share date preserve other URL parameters and the hash. Browser history restores the year as well as the date; ordinary control changes retain the existing `replaceState` behavior.

## Validation

```bash
npm run build                 # generate both years, validate, then build
npm test                      # calendar logic and generated data validation
npx playwright install chromium
npm run test:e2e              # browser tests against the built app
```

Node tests cover every date in both years, invalid links, year boundaries, leap-day clamping, fixed and movable Polish holidays, dataset isolation, deduplication, coverage, population totals and rankings. Browser tests cover deep links, year changes, map and country details, slider boundaries, rankings, shared URLs, Today, history navigation, failed loads and stale responses. CI runs the build and browser checks on pull requests and pushes to `main`.
