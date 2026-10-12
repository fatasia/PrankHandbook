// Run against a local static server: node tests/sidebar.cjs (requires playwright).
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:8080';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    for (const width of [320, 390, 600, 768, 769, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width <= 768, hasTouch: width <= 768 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/#/xuyan.md');
      const toggle = page.locator('.sidebar-toggle');
      await page.waitForSelector('.sidebar-toggle[aria-expanded]');
      const mobile = width <= 768;
      const state = async expected => {
        await page.waitForFunction(value => document.querySelector('.sidebar-toggle')?.getAttribute('aria-expanded') === String(value), expected);
        assert.equal(await toggle.getAttribute('aria-expanded'), String(expected));
        assert.equal(await page.locator('.sidebar').evaluate(el => el.inert), !expected);
      };
      await state(!mobile);
      await toggle.click();
      await state(mobile);
      await toggle.click();
      await state(!mobile);
      if (mobile) {
        // A normal article click must not open the directory.
        await page.locator('.markdown-section h1').click();
        await state(false);
        await toggle.click();
        await page.locator('.sidebar-backdrop').click({ position: { x: width - 8, y: 300 } });
        await state(false);
        await toggle.click();
        await page.keyboard.press('Escape');
        await state(false);
        await toggle.click();
        await page.locator('.sidebar a[href*="41-sleep"]').click();
        await page.waitForFunction(() => location.hash.includes('41-sleep') && document.querySelector('.markdown-section h1')?.textContent.includes('睡觉'));
        await state(false);
        await toggle.click();
        const anchor = page.locator('.sidebar a[href*="id="]').last();
        assert.ok(await anchor.count(), 'Chapter heading links are available');
        const href = await anchor.getAttribute('href');
        await anchor.click();
        await page.waitForFunction(href => location.hash === href, href);
        await page.waitForFunction(() => {
          const id = new URLSearchParams(location.hash.split('?')[1]).get('id');
          const heading = document.getElementById(id);
          return heading && scrollY > 0 && heading.getBoundingClientRect().top >= -1
            && heading.getBoundingClientRect().bottom <= innerHeight;
        });
        await state(false);
        // The current chapter can be selected again and still closes the drawer.
        await toggle.click();
        await page.locator('.sidebar a[href*="41-sleep"]:not([href*="id="])').click();
        await state(false);
        await page.setViewportSize({ width: 1024, height: 844 });
        await state(true);
        await page.setViewportSize({ width, height: 844 });
        await state(false);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
        if (width === 390) {
          await toggle.click();
          await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().left === 0);
          await page.screenshot({ path: process.env.TEMP + '/prank-sidebar-mobile.png' });
          await page.keyboard.press('Escape');
          await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 0);
          await page.screenshot({ path: process.env.TEMP + '/prank-reading-mobile.png' });
        }
        await page.goto(base + '/#/');
        await page.waitForSelector('section.cover.show');
        assert.equal(await toggle.isVisible(), false);
        assert.equal(await page.locator('.sidebar-backdrop').isVisible(), false);
        await page.locator('.cover-title').click();
        await page.waitForSelector('.sidebar-toggle[aria-expanded="false"]', { state: 'visible' });
      } else {
        await toggle.click();
        await page.reload();
        await page.waitForSelector('.sidebar-toggle[aria-expanded="false"]');
        await state(false);
        await toggle.click();
        await state(true);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: toggle, navigation, responsive state`);
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    });
    const page = await context.newPage();
    await page.goto(base + '/#/xuyan.md');
    await page.waitForSelector('.sidebar-toggle[aria-expanded="false"]');
    await page.locator('.sidebar-toggle').click();
    assert.equal(await page.locator('.sidebar-toggle').getAttribute('aria-expanded'), 'true');
    console.log('PASS storage unavailable: directory still works');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

