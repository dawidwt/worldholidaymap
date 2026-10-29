import { test, expect } from '@playwright/test';

for (const year of [2026, 2027]) {
  test(`${year}: direct links, controls, map, ranking and share URL`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`/?date=${year}-12-25&source=test#map`);
    await expect(page.locator('#yearSelect')).toHaveValue(String(year));
    await expect(page.locator('#dateSelect')).toHaveValue(`${year}-12-25`);
    await expect(page.locator('#dateSelect option')).toHaveCount(365);
    await expect(page.locator('#dateSlider')).toHaveAttribute('max', '364');
    await expect(page.locator('[data-code="PL"]')).toHaveClass(/country--active/);
    await page.locator('#shareDateButton').click();
    const shared = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    expect(shared.searchParams.get('date')).toBe(`${year}-12-25`);
    expect(shared.searchParams.get('source')).toBe('test');
    expect(shared.hash).toBe('#map');
    await page.locator('#dateSlider').press('Home');
    await expect(page.locator('#dateSelect')).toHaveValue(`${year}-01-01`);
    await page.locator('#dateSlider').press('End');
    await expect(page.locator('#dateSelect')).toHaveValue(`${year}-12-31`);
    const top = page.locator('#topDaysList li').first();
    const date = await top.getAttribute('data-date');
    expect(date.startsWith(`${year}-`)).toBeTruthy();
    await top.click();
    await expect(page.locator('#dateSelect')).toHaveValue(date);
  });
}

test('year changes refresh open country panel, map, counts and rankings without duplicating days', async ({ page }) => {
  await page.goto('/?date=2026-04-05');
  await expect(page.locator('#dateSelect')).toHaveValue('2026-04-05');
  await page.locator('[data-code="PL"]').dispatchEvent('click');
  await expect(page.locator('#countryPanelMeta')).toContainText('in 2026');
  await page.locator('#yearSelect').selectOption('2027');
  await expect(page.locator('#dateSelect')).toHaveValue('2027-04-05');
  await expect(page.locator('#countryPanelMeta')).toContainText('in 2027');
  await expect(page.locator('#countryPanelList')).toContainText('Mar 28');
  await expect(page.locator('[data-code="PL"]')).not.toHaveClass(/country--active/);
  await expect(page.locator('#rankingTitle')).toContainText('2027');
  const data = await (await page.request.get('/holidays-2027.json')).json();
  await expect(page.locator('#countryCount')).toHaveText(String(data.dateStats['2027-04-05'].countryCount));
  expect(await page.locator('#topDaysList li').evaluateAll(items => items.every(x => x.dataset.date.startsWith('2027-')))).toBeTruthy();
  await page.locator('[data-ranking-mode="population"]').click();
  await page.locator('#yearSelect').selectOption('2026');
  await expect(page.locator('#dateSelect')).toHaveValue('2026-04-05');
  await expect(page.locator('#dateSelect option')).toHaveCount(365);
  await expect(page.locator('[data-code="PL"]')).toHaveClass(/country--active/);
  await expect(page.locator('[data-ranking-mode="population"]')).toHaveAttribute('aria-selected', 'true');
});

test('Today and browser history can change the active year', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00Z'));
  await page.goto('/?date=2027-12-25');
  await expect(page.locator('#dateSelect')).toHaveValue('2027-12-25');
  await page.locator('#todayButton').click();
  await expect(page.locator('#dateSelect')).toHaveValue('2026-10-29');
  await page.evaluate(() => {
    history.pushState({}, '', '?date=2027-01-01');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('#dateSelect')).toHaveValue('2027-01-01');
  await page.goBack();
  await expect(page.locator('#dateSelect')).toHaveValue('2026-10-29');
  await page.goForward();
  await expect(page.locator('#dateSelect')).toHaveValue('2027-01-01');
});

test('failed year load leaves the previous view usable and permits retry', async ({ page }) => {
  await page.goto('/?date=2026-12-25');
  await expect(page.locator('#dateSelect')).toHaveValue('2026-12-25');
  await page.route('**/holidays-2027.json', route => route.fulfill({ status: 503, body: '' }));
  await page.locator('#yearSelect').selectOption('2027');
  await expect(page.locator('#dataStatus')).toContainText('Could not load 2027');
  await expect(page.locator('#yearSelect')).toHaveValue('2026');
  await expect(page).toHaveURL(/date=2026-12-25/);
  await page.unroute('**/holidays-2027.json');
  await page.locator('#yearSelect').selectOption('2027');
  await expect(page.locator('#dateSelect')).toHaveValue('2027-12-25');
});

test('a slow year response cannot overwrite a newer selection', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/holidays-2027.json', async route => {
    await gate;
    await route.continue();
  });
  await page.goto('/?date=2026-12-25');
  await expect(page.locator('#dateSelect')).toHaveValue('2026-12-25');
  const requested = page.waitForRequest('**/holidays-2027.json');
  await page.locator('#yearSelect').selectOption('2027');
  await requested;
  await page.locator('#yearSelect').selectOption('2026');
  const response = page.waitForResponse('**/holidays-2027.json');
  release();
  await (await response).finished();
  await expect(page.locator('#yearSelect')).toHaveValue('2026');
  await expect(page.locator('#dateSelect')).toHaveValue('2026-12-25');
  await expect(page).toHaveURL(/date=2026-12-25/);
});


test('year selector remains usable on mobile without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?date=2026-12-25');
  await expect(page.locator('#dateSelect')).toHaveValue('2026-12-25');
  await page.locator('#yearSelect').selectOption('2027');
  await expect(page.locator('#dateSelect')).toHaveValue('2027-12-25');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
