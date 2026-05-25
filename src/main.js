import world from '@svg-maps/world';
import './styles.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});
const shortWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'UTC',
});
const rankingDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});
const fullNumberFormatter = new Intl.NumberFormat('en-US');
const collator = new Intl.Collator('en');

const elements = {
  dateSelect: document.querySelector('#dateSelect'),
  dateSlider: document.querySelector('#dateSlider'),
  todayButton: document.querySelector('#todayButton'),
  selectedDate: document.querySelector('#selectedDate'),
  countryCount: document.querySelector('#countryCount'),
  holidayCount: document.querySelector('#holidayCount'),
  populationCount: document.querySelector('#populationCount'),
  populationQuality: document.querySelector('#populationQuality'),
  resultTitle: document.querySelector('#resultTitle'),
  holidayList: document.querySelector('#holidayList'),
  topDaysList: document.querySelector('#topDaysList'),
  rankingTabs: document.querySelectorAll('[data-ranking-mode]'),
  methodologyButton: document.querySelector('#methodologyButton'),
  methodologyPanel: document.querySelector('#methodologyPanel'),
  countryPanel: document.querySelector('#countryPanel'),
  countryPanelClose: document.querySelector('#countryPanelClose'),
  countryPanelTitle: document.querySelector('#countryPanelTitle'),
  countryPanelMeta: document.querySelector('#countryPanelMeta'),
  countryPanelList: document.querySelector('#countryPanelList'),
  emptyState: document.querySelector('#emptyState'),
  sourceLink: document.querySelector('#sourceLink'),
  tooltip: document.querySelector('#tooltip'),
  worldMap: document.querySelector('#worldMap'),
};

const state = {
  data: null,
  selectedDate: null,
  selectedCountryCode: null,
  rankingMode: 'countries',
  pathsByCode: new Map(),
  rowsByCode: new Map(),
  holidaysByCountry: new Map(),
};

init();

async function init() {
  try {
    const dataUrl = `${import.meta.env.BASE_URL}holidays-2026.json`;
    const response = await fetch(dataUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    state.data = await response.json();
    buildCountryHolidayIndex();
    renderMap();
    buildDateControls();
    wireControls();
    setSelectedDate(getInitialDate());
    renderSource();
    renderTopDayRanking();
  } catch (error) {
    document.body.innerHTML = `<main class="load-error"><h1>Could not load holiday data</h1><p>${escapeHtml(error.message)}</p></main>`;
  }
}

function renderMap() {
  elements.worldMap.setAttribute('viewBox', world.viewBox);
  elements.worldMap.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  for (const location of world.locations) {
    const code = location.id.toUpperCase();
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const country = state.data.countries[code];
    const label = country?.name || location.name;

    path.setAttribute('d', location.path);
    path.setAttribute('data-code', code);
    path.setAttribute('aria-label', label);
    path.setAttribute('tabindex', '0');
    path.classList.add('country');

    if (!country) {
      path.classList.add('country--no-data');
    }

    path.addEventListener('pointerenter', (event) => showTooltip(code, event));
    path.addEventListener('pointermove', (event) => moveTooltip(event));
    path.addEventListener('pointerleave', hideTooltip);
    path.addEventListener('focus', (event) => showTooltip(code, event));
    path.addEventListener('blur', hideTooltip);
    path.addEventListener('click', () => openCountryPanel(code));
    path.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openCountryPanel(code);
      }
    });

    elements.worldMap.append(path);
    state.pathsByCode.set(code, path);
  }
}

function buildCountryHolidayIndex() {
  state.holidaysByCountry = new Map();

  for (const [date, rows] of Object.entries(state.data.holidaysByDate)) {
    for (const row of rows) {
      if (!state.holidaysByCountry.has(row.countryCode)) {
        state.holidaysByCountry.set(row.countryCode, []);
      }

      const countryRows = state.holidaysByCountry.get(row.countryCode);
      const duplicate = countryRows.some((holiday) => {
        return holiday.date === date && holiday.name === row.name;
      });

      if (!duplicate) {
        countryRows.push({ ...row, date });
      }
    }
  }

  for (const rows of state.holidaysByCountry.values()) {
    rows.sort((a, b) => {
      return a.date.localeCompare(b.date) || collator.compare(a.name, b.name);
    });
  }
}

function buildDateControls() {
  const days = getDaysInYear(state.data.year);
  const fragment = document.createDocumentFragment();

  elements.dateSlider.max = String(days - 1);

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const iso = isoFromDayIndex(dayIndex);
    const count = getStatsForDate(iso).countryCount;
    const option = document.createElement('option');

    option.value = iso;
    option.textContent = `${formatShortDateWithWeekday(iso)} - ${count} ${pluralize(count, 'country', 'countries')}`;
    fragment.append(option);
  }

  elements.dateSelect.append(fragment);
}

function wireControls() {
  elements.dateSelect.addEventListener('change', () => setSelectedDate(elements.dateSelect.value));
  elements.dateSlider.addEventListener('input', () => {
    setSelectedDate(isoFromDayIndex(Number(elements.dateSlider.value)));
  });
  elements.todayButton.addEventListener('click', () => setSelectedDate(getTodayForYear()));
  elements.countryPanelClose.addEventListener('click', closeCountryPanel);
  elements.methodologyButton.addEventListener('click', toggleMethodology);
  window.addEventListener('popstate', () => {
    setSelectedDate(getInitialDate(), { updateUrl: false });
  });

  for (const tab of elements.rankingTabs) {
    tab.addEventListener('click', () => {
      state.rankingMode = tab.dataset.rankingMode;
      renderTopDayRanking();
    });
  }
}

function setSelectedDate(iso, options = {}) {
  const { updateUrl = true } = options;
  const selectedIso = isIsoInSelectedYear(iso) ? iso : `${state.data.year}-01-01`;
  state.selectedDate = selectedIso;
  const dayIndex = dayIndexFromIso(selectedIso);

  elements.dateSelect.value = selectedIso;
  elements.dateSlider.value = String(dayIndex);
  elements.selectedDate.textContent = formatLongDate(selectedIso);

  if (updateUrl) {
    updateDateUrl(selectedIso);
  }

  updateRowsForDate(selectedIso);
  updateMap();
  renderHolidayList();

  if (state.selectedCountryCode) {
    renderCountryPanel(state.selectedCountryCode);
  }
}

function updateRowsForDate(iso) {
  state.rowsByCode = new Map();

  for (const row of getRowsForDate(iso)) {
    if (!state.rowsByCode.has(row.countryCode)) {
      const country = state.data.countries[row.countryCode];

      state.rowsByCode.set(row.countryCode, {
        countryCode: row.countryCode,
        countryName: row.countryName,
        population: country?.population ?? null,
        populationYear: country?.populationYear ?? null,
        holidays: [],
      });
    }

    state.rowsByCode.get(row.countryCode).holidays.push(row);
  }
}

function updateMap() {
  for (const [code, path] of state.pathsByCode.entries()) {
    const hasHoliday = state.rowsByCode.has(code);
    path.classList.toggle('country--active', hasHoliday);
    path.setAttribute('aria-current', hasHoliday ? 'date' : 'false');
  }
}

function renderHolidayList() {
  const countries = [...state.rowsByCode.values()].sort((a, b) => {
    return collator.compare(a.countryName, b.countryName);
  });
  const holidayTotal = countries.reduce((sum, country) => sum + country.holidays.length, 0);
  const stats = getStatsForDate(state.selectedDate);

  elements.countryCount.textContent = String(countries.length);
  elements.holidayCount.textContent = String(holidayTotal);
  elements.populationCount.textContent = formatCompactNumber(stats.population);
  elements.populationQuality.textContent = formatPopulationCoverage(stats);
  elements.resultTitle.textContent = countries.length
    ? `${countries.length} ${pluralize(countries.length, 'country', 'countries')}`
    : 'Countries';
  elements.emptyState.hidden = countries.length > 0;
  elements.holidayList.replaceChildren();

  const fragment = document.createDocumentFragment();

  for (const country of countries) {
    const item = document.createElement('li');
    const names = country.holidays.map((holiday) => holiday.name).join(', ');
    const population = formatCountryPopulation(country);

    item.className = 'holiday-item';
    item.dataset.countryCode = country.countryCode;
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Show all holidays for ${country.countryName}`);
    item.innerHTML = `
      <span class="country-mark" aria-hidden="true"></span>
      <div>
        <div class="country-line">
          <span class="country-name">${escapeHtml(country.countryName)}</span>
          <span class="country-meta">
            <span class="country-population">${escapeHtml(population)}</span>
            <span class="country-code">${escapeHtml(country.countryCode)}</span>
          </span>
        </div>
        <p class="holiday-name">${escapeHtml(names)}</p>
      </div>
    `;

    item.addEventListener('mouseenter', () => setListHover(country.countryCode, true));
    item.addEventListener('mouseleave', () => setListHover(country.countryCode, false));
    item.addEventListener('click', () => openCountryPanel(country.countryCode));
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openCountryPanel(country.countryCode);
      }
    });
    fragment.append(item);
  }

  elements.holidayList.append(fragment);
}

function renderSource() {
  const { referenceSource } = state.data;
  elements.sourceLink.href = referenceSource.url;
  elements.sourceLink.textContent = referenceSource.label;
}

function toggleMethodology() {
  const isOpening = elements.methodologyPanel.hidden;

  elements.methodologyPanel.hidden = !isOpening;
  elements.methodologyButton.setAttribute('aria-expanded', isOpening ? 'true' : 'false');
  elements.methodologyButton.textContent = isOpening ? 'Hide methodology' : 'Show methodology';
}

function renderTopDayRanking() {
  const fragment = document.createDocumentFragment();
  const rankedDays = getRankedDays(state.rankingMode);

  for (const tab of elements.rankingTabs) {
    const active = tab.dataset.rankingMode === state.rankingMode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  }

  for (const [index, day] of rankedDays.entries()) {
    const item = document.createElement('li');

    item.className = 'top-day-item';
    item.dataset.date = day.date;
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Show ${formatLongDate(day.date)}`);
    item.innerHTML = `
      <span class="rank-number">${index + 1}</span>
      <span class="rank-date">${escapeHtml(formatRankingDate(day.date))}</span>
      <span class="rank-countries">${day.countryCount} ${escapeHtml(pluralize(day.countryCount, 'country', 'countries'))}</span>
      <span class="rank-population">${escapeHtml(formatCompactNumber(day.population))} people · ${escapeHtml(formatPopulationCoverage(day))}</span>
    `;
    item.addEventListener('click', () => setSelectedDate(day.date));
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setSelectedDate(day.date);
      }
    });
    fragment.append(item);
  }

  elements.topDaysList.replaceChildren(fragment);
}

function getRankedDays(mode) {
  const days = Object.values(state.data.dateStats);

  return days
    .sort((a, b) => {
      if (mode === 'population') {
        return (
          b.population - a.population ||
          b.countryCount - a.countryCount ||
          a.date.localeCompare(b.date)
        );
      }

      return (
        b.countryCount - a.countryCount ||
        b.population - a.population ||
        a.date.localeCompare(b.date)
      );
    })
    .slice(0, 10);
}

function openCountryPanel(code) {
  state.selectedCountryCode = code;
  renderCountryPanel(code);
  updateMap();
}

function closeCountryPanel() {
  state.selectedCountryCode = null;
  elements.countryPanel.hidden = true;
  updateMap();
}

function renderCountryPanel(code) {
  const country = state.data.countries[code];
  const path = state.pathsByCode.get(code);
  const countryName = country?.name || path?.getAttribute('aria-label') || code;
  const holidays = state.holidaysByCountry.get(code) || [];
  const selectedRows = holidays.filter((holiday) => holiday.date === state.selectedDate);
  const selectedText = selectedRows.length
    ? `${selectedRows.length} on selected date`
    : 'none on selected date';
  const holidayText = `${holidays.length} ${pluralize(holidays.length, 'public holiday', 'public holidays')} in ${state.data.year}`;

  elements.countryPanelTitle.textContent = countryName;
  elements.countryPanelMeta.textContent = `${holidayText} · ${selectedText} · ${formatCountryPopulation(country || {})}`;
  elements.countryPanelList.replaceChildren();

  if (!holidays.length) {
    const item = document.createElement('li');
    item.className = 'country-panel-empty';
    item.textContent = 'No public holiday data for this map area.';
    elements.countryPanelList.append(item);
  } else {
    const fragment = document.createDocumentFragment();

    for (const holiday of holidays) {
      const item = document.createElement('li');
      item.className = 'country-panel-item';
      item.classList.toggle('is-current', holiday.date === state.selectedDate);
      item.innerHTML = `
        <span class="country-panel-date">${escapeHtml(formatRankingDate(holiday.date))}</span>
        <span class="country-panel-name">${escapeHtml(holiday.name)}</span>
      `;
      fragment.append(item);
    }

    elements.countryPanelList.append(fragment);
  }

  elements.countryPanel.hidden = false;
}

function showTooltip(code, event) {
  const country = state.data.countries[code];
  const fallbackPath = state.pathsByCode.get(code);
  const title = country?.name || fallbackPath?.getAttribute('aria-label') || code;
  const countryRows = state.rowsByCode.get(code);
  const population = country ? `Population estimate: ${formatCountryPopulation(country)}.` : '';
  const body = countryRows
    ? `${countryRows.holidays.map((holiday) => holiday.name).join(', ')} ${population}`.trim()
    : country
      ? 'No public holiday on this date.'
      : 'No public holiday data.';

  elements.tooltip.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(body)}</span>
  `;
  elements.tooltip.hidden = false;

  if ('clientX' in event) {
    moveTooltip(event);
  } else {
    elements.tooltip.style.left = '24px';
    elements.tooltip.style.top = '96px';
  }
}

function moveTooltip(event) {
  if (elements.tooltip.hidden) {
    return;
  }

  const offset = 16;
  const width = elements.tooltip.offsetWidth || 240;
  const height = elements.tooltip.offsetHeight || 80;
  const left = Math.min(event.clientX + offset, window.innerWidth - width - offset);
  const top = Math.min(event.clientY + offset, window.innerHeight - height - offset);

  elements.tooltip.style.left = `${Math.max(offset, left)}px`;
  elements.tooltip.style.top = `${Math.max(offset, top)}px`;
}

function hideTooltip() {
  elements.tooltip.hidden = true;
}

function setListHover(code, isHovered) {
  const path = state.pathsByCode.get(code);

  if (path) {
    path.classList.toggle('country--hovered', isHovered);
  }
}

function getRowsForDate(iso) {
  return state.data.holidaysByDate[iso] || [];
}

function getStatsForDate(iso) {
  return (
    state.data.dateStats[iso] || {
      countryCount: 0,
      holidayCount: 0,
      population: 0,
      populationCountryCount: 0,
    }
  );
}

function getInitialDate() {
  const urlDate = new URLSearchParams(window.location.search).get('date');

  if (isIsoInSelectedYear(urlDate)) {
    return urlDate;
  }

  return getTodayForYear();
}

function getTodayForYear() {
  const now = new Date();

  if (now.getFullYear() === state.data.year) {
    return toLocalIso(now);
  }

  return `${state.data.year}-01-01`;
}

function getDaysInYear(year) {
  return Math.round((Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS);
}

function isoFromDayIndex(dayIndex) {
  const date = new Date(Date.UTC(state.data.year, 0, 1 + dayIndex));
  return date.toISOString().slice(0, 10);
}

function dayIndexFromIso(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(state.data.year, 0, 1)) / DAY_MS);
}

function isIsoInSelectedYear(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) {
    return false;
  }

  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    year === state.data.year &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function updateDateUrl(iso) {
  const url = new URL(window.location.href);
  url.searchParams.set('date', iso);
  window.history.replaceState({ date: iso }, '', url);
}

function formatLongDate(iso) {
  return dateFormatter.format(dateFromIso(iso));
}

function formatShortDate(iso) {
  return shortDateFormatter.format(dateFromIso(iso));
}

function formatShortDateWithWeekday(iso) {
  const date = dateFromIso(iso);
  return `${shortDateFormatter.format(date)}, ${shortWeekdayFormatter.format(date)}`;
}

function formatRankingDate(iso) {
  const date = dateFromIso(iso);
  return `${rankingDateFormatter.format(date)}, ${shortWeekdayFormatter.format(date)}`;
}

function formatCompactNumber(value) {
  if (!value) {
    return '0';
  }

  return compactNumberFormatter.format(value);
}

function formatCountryPopulation(country) {
  if (typeof country.population !== 'number') {
    return 'population n/a';
  }

  return `${fullNumberFormatter.format(country.population)} people`;
}

function formatPopulationCoverage(stats) {
  if (!stats.countryCount) {
    return 'no country coverage';
  }

  if (stats.populationCountryCount === stats.countryCount) {
    return `based on all ${stats.countryCount} ${pluralize(stats.countryCount, 'country', 'countries')}`;
  }

  return `based on ${stats.populationCountryCount}/${stats.countryCount} countries`;
}

function dateFromIso(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toLocalIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
