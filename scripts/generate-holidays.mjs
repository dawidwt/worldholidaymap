import { mkdir, readFile, writeFile } from 'node:fs/promises';
import Holidays from 'date-holidays';
import world from '@svg-maps/world';

const YEAR = 2026;
const OUTPUT_PATH = new URL('../public/holidays-2026.json', import.meta.url);
const POPULATION_PATH = new URL('./data/world-bank-population.json', import.meta.url);
const SUPPLEMENTAL_POPULATION_PATH = new URL('./data/supplemental-population.json', import.meta.url);
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

const populationSnapshot = JSON.parse(await readFile(POPULATION_PATH, 'utf8'));
const supplementalPopulationSnapshot = JSON.parse(await readFile(SUPPLEMENTAL_POPULATION_PATH, 'utf8'));
const populationByCode = buildPopulationIndex();
const base = new Holidays();
const supportedCountries = base.getCountries();
const mapCodes = new Set(world.locations.map((location) => location.id.toUpperCase()));

const holidaysByDate = {};
const countryCoverage = {};
const skippedCountries = [];

function getCountryName(code, fallback) {
  try {
    return displayNames.of(code) || fallback || code;
  } catch {
    return fallback || code;
  }
}

function normalizeHolidayName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function addHoliday(date, holiday) {
  if (!holidaysByDate[date]) {
    holidaysByDate[date] = [];
  }

  const duplicate = holidaysByDate[date].some((item) => {
    return item.countryCode === holiday.countryCode && item.name === holiday.name;
  });

  if (!duplicate) {
    holidaysByDate[date].push(holiday);
  }
}

for (const [code, fallbackName] of Object.entries(supportedCountries)) {
  if (!mapCodes.has(code)) {
    skippedCountries.push({ code, name: fallbackName });
    continue;
  }

  const hd = new Holidays(code, null, null, {
    languages: ['en'],
    types: ['public'],
  });
  hd.setLanguages(['en']);

  const countryName = getCountryName(code, fallbackName);
  const populationRecord = populationByCode.get(code);

  countryCoverage[code] = {
    code,
    name: countryName,
    sourceName: fallbackName,
    population: populationRecord?.population ?? null,
    populationYear: populationRecord?.year ?? null,
    populationSource: populationRecord?.source ?? null,
  };

  for (const item of hd.getHolidays(YEAR)) {
    if (item.type !== 'public') {
      continue;
    }

    const date = item.date.slice(0, 10);
    const name = normalizeHolidayName(item.name);

    if (!date || !name) {
      continue;
    }

    addHoliday(date, {
      countryCode: code,
      countryName,
      name,
      type: item.type,
      substitute: Boolean(item.substitute),
    });
  }
}

for (const date of Object.keys(holidaysByDate)) {
  holidaysByDate[date].sort((a, b) => {
    return a.countryName.localeCompare(b.countryName, 'en') || a.name.localeCompare(b.name, 'en');
  });
}

const dates = Object.keys(holidaysByDate).sort();
const countriesWithPopulation = Object.values(countryCoverage).filter((country) => {
  return typeof country.population === 'number';
});
const populationYears = countriesWithPopulation
  .map((country) => country.populationYear)
  .filter((year) => typeof year === 'number');
const dateStats = Object.fromEntries(
  dates.map((date) => {
    return [date, getDateStats(date, holidaysByDate[date])];
  }),
);
const topHolidayDates = Object.values(dateStats)
  .sort((a, b) => {
    return (
      b.countryCount - a.countryCount ||
      b.population - a.population ||
      a.date.localeCompare(b.date)
    );
  })
  .slice(0, 10);
const payload = {
  year: YEAR,
  generatedAt: new Date().toISOString(),
  dataPolicy:
    'The dataset includes public holidays of type "public" from the date-holidays library, matched to countries present in the world SVG map. Population totals are approximate sums of country-level World Bank population estimates for highlighted countries, with supplemental REST Countries values only for map areas missing from the World Bank snapshot.',
  referenceSource: {
    label: 'Timeanddate - Holidays Worldwide',
    url: 'https://www.timeanddate.com/holidays/',
    note:
      'Timeanddate is linked in the app as a reference source for manual verification; direct automated page reads are blocked by anti-bot protection.',
  },
  populationSource: populationSnapshot.source,
  populationSources: [populationSnapshot.source, supplementalPopulationSnapshot.source],
  coverage: {
    mapLocations: world.locations.length,
    countriesWithHolidayData: Object.keys(countryCoverage).length,
    countriesWithPopulationData: countriesWithPopulation.length,
    populationYearRange: {
      min: populationYears.length ? Math.min(...populationYears) : null,
      max: populationYears.length ? Math.max(...populationYears) : null,
    },
    datesWithPublicHolidays: dates.length,
    skippedCountries,
  },
  countries: countryCoverage,
  holidaysByDate,
  dateStats,
  topHolidayDates,
};

await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(
  `Generated ${dates.length} active dates for ${Object.keys(countryCoverage).length} countries in ${OUTPUT_PATH.pathname}`,
);

function buildPopulationIndex() {
  const records = new Map();

  for (const [code, country] of Object.entries(populationSnapshot.countries)) {
    records.set(code, {
      ...country,
      source: 'worldBank',
    });
  }

  for (const [code, country] of Object.entries(supplementalPopulationSnapshot.countries)) {
    if (records.has(code) || typeof country.population !== 'number') {
      continue;
    }

    records.set(code, {
      code,
      year: country.year ?? null,
      population: country.population,
      source: 'restCountries',
    });
  }

  return records;
}

function getDateStats(date, rows) {
  const countryCodes = [...new Set(rows.map((row) => row.countryCode))];
  const populationCountries = countryCodes
    .map((code) => countryCoverage[code])
    .filter((country) => typeof country?.population === 'number');
  const population = populationCountries.reduce((sum, country) => sum + country.population, 0);

  return {
    date,
    countryCount: countryCodes.length,
    holidayCount: rows.length,
    population,
    populationCountryCount: populationCountries.length,
  };
}
