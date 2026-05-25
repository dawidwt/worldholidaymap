# World Holiday Map

A static Vite app showing countries that have a public holiday on the selected day in 2026. The date can be changed from a dropdown or with the day-of-year slider.

## Run

```bash
npm install
npm run data
npm run dev
```

Local URL after starting Vite: `http://127.0.0.1:5173/`.

## Data

`public/holidays-2026.json` is generated with `npm run data` from the `date-holidays` library and filtered to the `public` holiday type. The same generated file also includes approximate country-level population totals from the World Bank `SP.POP.TOTL` indicator, with REST Countries population values used only as a fallback for map areas missing from the World Bank snapshot. Those totals power the selected-day population estimate, data quality indicators, and the top-10 holiday-day rankings by countries or population. Timeanddate - Holidays Worldwide is linked in the app as a reference source for manual verification.

Dates are shareable through the query string, for example `http://127.0.0.1:5173/?date=2026-12-25`.
