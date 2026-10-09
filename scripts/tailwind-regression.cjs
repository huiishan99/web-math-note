/*
 * Usage: PLAYWRIGHT_MODULE=/path/to/playwright node scripts/tailwind-regression.cjs
 * TEST_BASE_URL defaults to http://127.0.0.1:8916.
 * BASELINE_URL optionally points to a separately built pre-migration app.
 * DEV_URL optionally enables the Vite CSS HMR test against front-end/src.
 * VISUAL_ARTIFACT_DIR receives before/after screenshots and computed styles.
 * All solver-status responses are mocked; calculation POSTs are prohibited.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8916';
const output = process.env.VISUAL_ARTIFACT_DIR || path.join(os.tmpdir(), 'mathnote-tailwind-regression');
const viewports = [
  { name: 'desktop', width: 1365, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const properties = [
  'display', 'position', 'boxSizing', 'padding', 'margin', 'gap',
  'alignItems', 'justifyContent', 'overflowX', 'overflowY', 'fontFamily',
  'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color',
  'backgroundColor', 'borderColor', 'borderWidth', 'borderRadius',
  'backdropFilter', 'opacity', 'cursor', 'pointerEvents', 'touchAction',
];

async function openPage(browser, url, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const errors = [];
  const forbiddenCalls = [];
  const browserEvents = [];
  const recordEvent = event => { if (browserEvents.length < 100) browserEvents.push(event); };
  page.on('console', message => recordEvent({ type: 'console', level: message.type(), text: message.text() }));
  page.on('websocket', socket => {
    recordEvent({ type: 'websocket', url: socket.url() });
    socket.on('framereceived', frame => recordEvent({ type: 'websocket-frame', payload: String(frame.payload).slice(0, 2000) }));
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const target = new URL(request.url());
    if (/\/calculate\/status\/?$/.test(target.pathname)) {
      await route.fulfill({ json: {
        configured: false, human_verification_required: false,
        human_verification_configured: false,
      }, headers: { 'access-control-allow-origin': '*' } });
    } else if (request.method() === 'POST') {
      forbiddenCalls.push(request.url());
      await route.abort();
    } else if (target.origin === new URL(url).origin) {
      await route.continue();
    } else {
      // Keep MathJax/CDN/network variability out of the CSS comparison.
      await route.abort();
    }
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'New page', exact: true }).waitFor();
  await page.getByRole('status').filter({ hasText: "AI solving isn't connected yet" }).waitFor();
  await page.waitForFunction(() => document.querySelector('canvas')?.width > 0);
  await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.id = 'tailwind-theme-probe';
    // Exercise existing semantic utilities without changing application sources.
    probe.className = 'bg-primary text-primary-foreground border border-input rounded-md';
    probe.style.cssText = 'position:fixed;left:-1000px;top:0;width:20px;height:20px';
    document.body.append(probe);
    return document.fonts.ready;
  });
  await page.mouse.move(viewport.width - 1, Math.floor(viewport.height / 2));
  // Allow the initial canvas restoration and autosave effects to settle.
  await page.waitForTimeout(250);
  return { page, context, errors, forbiddenCalls, browserEvents };
}

async function snapshot(page) {
  return page.evaluate(properties => {
    const visible = element => element && element.getBoundingClientRect().width > 0
      && element.getBoundingClientRect().height > 0 && getComputedStyle(element).display !== 'none';
    const pick = selector => [...document.querySelectorAll(selector)].find(visible);
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = 1;
    const ctx = colorCanvas.getContext('2d', { willReadFrequently: true });
    const normalizeColor = color => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const record = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        box: Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, rect[key]])),
        style: Object.fromEntries(properties.map(key => [key,
          key.endsWith('Color') || key === 'color' ? normalizeColor(style[key]) : style[key],
        ])),
      };
    };
    const selectors = {
      body: 'body', main: 'main', canvas: 'canvas', navigation: 'nav',
      activePage: 'nav [aria-current="page"]', newPage: 'button[aria-label="New page"]',
      pen: 'button[aria-label="Pen"]', eraser: 'button[aria-label="Eraser"]',
      undo: 'button[aria-label="Undo"]', redo: 'button[aria-label="Redo"]',
      solve: 'button[aria-label="Solve"]', strokeWidth: 'input[aria-label="Stroke width"]',
      whiteInk: 'button[aria-label="Ink #ffffff"]', status: '[role="status"]',
      ghostSample: '.ghost-sample', themeProbe: '#tailwind-theme-probe',
    };
    const result = {};
    for (const [key, selector] of Object.entries(selectors)) {
      const element = pick(selector);
      if (element) result[key] = record(element);
    }
    const pen = pick(selectors.pen);
    const ink = pick(selectors.whiteInk);
    result.toolPanel = record(pen.parentElement);
    result.toolbar = record(pen.parentElement.parentElement);
    result.penIcon = record(pen.querySelector('svg'));
    result.inkPanel = record(ink.parentElement);
    result.inkSwatch = record(ink.firstElementChild);
    return result;
  }, properties);
}

function near(actual, expected, message, tolerance = 0.1) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

function verifyLayout(state, viewport, dark) {
  const failures = [];
  const capture = check => {
    try { check(); } catch (error) { failures.push(error.message); }
  };
  const checkAssert = {
    equal: (...args) => capture(() => assert.equal(...args)),
    deepEqual: (...args) => capture(() => assert.deepEqual(...args)),
    ok: (...args) => capture(() => assert.ok(...args)),
  };
  const checkNear = (...args) => capture(() => near(...args));
  const mobile = viewport.width < 1280;
  checkNear(state.canvas.box.width, viewport.width, 'Canvas fills viewport width');
  checkNear(state.canvas.box.height, viewport.height, 'Canvas fills viewport height');
  checkNear(state.canvas.box.x, 0, 'Canvas left edge');
  checkNear(state.canvas.box.y, 0, 'Canvas top edge');
  checkNear(state.navigation.box.x, mobile ? 12 : 16, 'Navigation inset');
  checkNear(state.navigation.box.y, mobile ? 12 : 16, 'Navigation top inset');
  checkNear(state.newPage.box.width, 32, 'Page button important width');
  checkNear(state.newPage.box.height, 32, 'Page button important height');
  checkNear(state.pen.box.width, mobile ? 32 : 36, 'Responsive tool-button width');
  checkNear(state.pen.box.height, mobile ? 32 : 36, 'Responsive tool-button height');
  checkNear(state.penIcon.box.width, 16, 'Nested SVG width');
  checkNear(state.penIcon.box.height, 16, 'Nested SVG height');
  checkNear(state.whiteInk.box.width, mobile ? 36 : 32, 'Responsive ink button width');
  checkNear(state.whiteInk.box.height, mobile ? 36 : 32, 'Responsive ink button height');
  checkNear(state.inkSwatch.box.width, 20, 'Mantine ColorSwatch width');
  checkAssert.equal(state.pen.style.borderRadius, '6px', 'Legacy configured radius is preserved');
  checkAssert.equal(state.toolPanel.style.borderWidth, '1px');
  checkAssert.equal(state.toolPanel.style.backdropFilter, 'blur(40px)', 'Legacy backdrop-blur-2xl');
  checkAssert.equal(state.canvas.style.touchAction, 'none');
  checkAssert.equal(state.canvas.style.cursor, 'crosshair');
  checkAssert.deepEqual(state.canvas.style.backgroundColor, [8, 9, 11, 255]);
  checkAssert.deepEqual(state.toolPanel.style.borderColor, [255, 255, 255, 26]);
  checkAssert.equal(state.undo.style.opacity, '0.5', 'Disabled button opacity');
  checkAssert.equal(state.pen.style.pointerEvents, 'auto', 'Tool panel accepts input');
  checkAssert.deepEqual(state.themeProbe.style.backgroundColor, dark ? [250, 250, 250, 255] : [23, 23, 23, 255], 'Semantic primary background follows class-based dark theme');
  checkAssert.deepEqual(state.themeProbe.style.color, dark ? [23, 23, 23, 255] : [250, 250, 250, 255], 'Semantic primary foreground follows class-based dark theme');
  if (mobile) {
    checkAssert.ok(state.pen.box.y > viewport.height / 2, 'Mobile tools dock at the bottom');
    checkAssert.ok(state.navigation.box.width <= viewport.width - 24, 'Navigation fits mobile');
  } else {
    checkAssert.ok(state.pen.box.y < 80, 'Desktop tools dock at the top');
    checkNear(state.toolbar.box.x, 368, 'Desktop toolbar offset');
  }
  return failures;
}

function compareStyles(before, after, label) {
  const differences = [];
  for (const [element, expected] of Object.entries(before)) {
    const actual = after[element];
    if (!actual) { differences.push(`${element}: missing`); continue; }
    for (const [key, value] of Object.entries(expected.box)) {
      if (Math.abs(actual.box[key] - value) > 0.1) differences.push(`${element}.${key}: ${value} → ${actual.box[key]}`);
    }
    for (const [key, value] of Object.entries(expected.style)) {
      const next = actual.style[key];
      const matches = Array.isArray(value)
        ? value.every((channel, index) => Math.abs(channel - next[index]) <= 1)
        : value === next;
      if (!matches) differences.push(`${element}.${key}: ${JSON.stringify(value)} → ${JSON.stringify(next)}`);
    }
  }
  if (differences.length) console.error(`${label} CSS differences:\n${differences.join('\n')}`);
  return differences;
}

async function comparePixels(page, before, after, label) {
  const result = await page.evaluate(async ({ before, after }) => {
    const load = async source => createImageBitmap(await (await fetch(`data:image/png;base64,${source}`)).blob());
    const a = await load(before);
    const b = await load(after);
    if (a.width !== b.width || a.height !== b.height) return { ratio: 1, dimensionsDiffer: true };
    const canvas = document.createElement('canvas');
    canvas.width = a.width; canvas.height = a.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(a, 0, 0);
    const oldPixels = ctx.getImageData(0, 0, a.width, a.height).data;
    ctx.clearRect(0, 0, a.width, a.height);
    ctx.drawImage(b, 0, 0);
    const difference = ctx.getImageData(0, 0, a.width, a.height);
    let changed = 0;
    for (let index = 0; index < oldPixels.length; index += 4) {
      const differs = [0, 1, 2, 3].some(channel => Math.abs(oldPixels[index + channel] - difference.data[index + channel]) > 2);
      changed += Number(differs);
      difference.data.set(differs ? [255, 0, 120, 255] : [0, 0, 0, 255], index);
    }
    ctx.putImageData(difference, 0, 0);
    return { ratio: changed / (a.width * a.height), changed, diff: canvas.toDataURL('image/png').split(',')[1] };
  }, { before: before.toString('base64'), after: after.toString('base64') });
  if (result.diff) await fs.writeFile(path.join(output, `${label}-diff.png`), Buffer.from(result.diff, 'base64'));
  console.log(`${label}: ${((result.ratio || 0) * 100).toFixed(4)}% pixels differ by more than 2/255`);
  return result.ratio || 0;
}

async function verifyInteractions(page, viewport) {
  const canvas = page.locator('canvas');
  const pixels = () => canvas.evaluate(element => element.toDataURL());
  const empty = await pixels();
  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  await page.mouse.move(viewport.width * 0.25, viewport.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(viewport.width * 0.55, viewport.height * 0.42, { steps: 16 });
  await page.mouse.up();
  await page.waitForFunction(() => [...document.querySelectorAll('button[aria-label="Undo"]')].some(button => !button.disabled));
  const drawn = await pixels();
  assert.notEqual(drawn, empty, 'Drawing changes canvas pixels');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.waitForFunction(expected => document.querySelector('canvas').toDataURL() === expected, empty);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.waitForFunction(expected => document.querySelector('canvas').toDataURL() === expected, drawn);
  await page.getByRole('button', { name: 'Eraser', exact: true }).click();
  assert.equal(await canvas.evaluate(element => getComputedStyle(element).cursor), 'cell');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  assert.equal(await canvas.evaluate(element => getComputedStyle(element).cursor), 'default');
  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  await page.getByRole('button', { name: 'New page', exact: true }).click();
  await page.waitForFunction(expected => document.querySelector('canvas').toDataURL() === expected, empty);
  await page.getByRole('button', { name: 'Page 1', exact: true }).click();
  await page.waitForFunction(expected => document.querySelector('canvas').toDataURL() === expected, drawn);
  await page.getByRole('button', { name: 'New page', exact: true }).click();
  assert.equal(await page.locator('nav [aria-current="page"]').innerText(), '3');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete page', exact: true }).click();
  assert.equal(await page.locator('nav [aria-current="page"]').innerText(), '3');
}

async function verifyHmr(browser, url) {
  const source = process.env.HMR_SOURCE_DIR || path.resolve(__dirname, '../front-end/src');
  const file = path.join(source, `tailwind-hmr-probe-${process.pid}.tsx`);
  const moduleUrl = `/src/${path.basename(file)}`;
  const moduleSource = classes => `
export const tailwindHmrProbe = ${JSON.stringify(classes)};
const probe = document.getElementById('tailwind-hmr-probe');
if (probe) probe.className = tailwindHmrProbe;
if (import.meta.hot) {
  import.meta.hot.accept(module => {
    const current = document.getElementById('tailwind-hmr-probe');
    if (current && module) current.className = module.tailwindHmrProbe;
  });
}
`;
  let session;
  let created = false;
  let stage = 'initialize-module';
  const diagnostics = { stages: [], sourceFile: file, moduleUrl };
  try {
    // Register an ordinary source dependency before initial CSS compilation.
    // An orphan file added after startup has no Vite module importer and is not
    // a realistic test of CSS HMR for an imported application module.
    await fs.writeFile(file, moduleSource(''), { flag: 'wx' });
    created = true;
    session = await openPage(browser, url, viewports[0]);
    await session.page.evaluate(async sourceUrl => {
      window.__tailwindHmrDocument = 'preserved';
      const probe = document.createElement('div');
      probe.id = 'tailwind-hmr-probe';
      probe.style.position = 'fixed';
      probe.style.top = '100px';
      document.body.append(probe);
      await import(sourceUrl);
    }, moduleUrl);
    for (const [index, width] of [137, 173].entries()) {
      stage = `${index ? 'update' : 'add'}-${width}px`;
      const classes = `w-[${width}px] h-[19px] bg-[#123456]`;
      await fs.writeFile(file, moduleSource(classes));
      // The imported module's HMR callback must apply the updated class itself.
      await session.page.waitForFunction(expected => {
        const probe = document.getElementById('tailwind-hmr-probe');
        return probe && getComputedStyle(probe).width === `${expected}px`;
      }, width, { timeout: 20000 });
      assert.equal(await session.page.evaluate(() => window.__tailwindHmrDocument), 'preserved', 'CSS HMR does not reload the document');
      assert.equal(await session.page.locator('#tailwind-hmr-probe').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(18, 52, 86)');
      diagnostics.stages.push({ stage, passed: true });
    }
    assert.deepEqual(session.errors, []);
    assert.deepEqual(session.forbiddenCalls, []);
    diagnostics.passed = true;
    console.log('Vite CSS HMR passed: imported module adds and updates arbitrary utilities, no document reload');
  } catch (error) {
    diagnostics.passed = false;
    diagnostics.failedStage = stage;
    diagnostics.error = error.message;
    if (session) {
      diagnostics.document = await session.page.evaluate(() => {
        const probe = document.getElementById('tailwind-hmr-probe');
        return {
          sentinel: window.__tailwindHmrDocument,
          probe: probe ? {
            classes: probe.className,
            width: getComputedStyle(probe).width,
            background: getComputedStyle(probe).backgroundColor,
          } : null,
        };
      }).catch(failure => ({ error: failure.message }));
      // These diagnostic requests run only after failure; they cannot make a
      // stalled watcher accidentally pass by forcing another CSS transform.
      for (const [name, pathname] of [['css', '/src/index.css'], ['module', moduleUrl]]) {
        try {
          const response = await session.page.request.get(new URL(pathname, url).href);
          await fs.writeFile(path.join(output, `hmr-${name}-response.txt`), await response.text());
        } catch (failure) { diagnostics[`${name}ReadError`] = failure.message; }
      }
      await session.page.screenshot({ path: path.join(output, 'hmr-failure.png') }).catch(() => {});
    }
    throw new Error(`${stage}: ${error.message}`);
  } finally {
    if (session) diagnostics.browserEvents = session.browserEvents;
    await fs.writeFile(path.join(output, 'hmr-diagnostics.json'), JSON.stringify(diagnostics, null, 2));
    if (session) await session.context.close();
    if (created) await fs.unlink(file);
  }
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  const failures = [];
  try {
    for (const viewport of viewports) {
      const current = await openPage(browser, base, viewport);
      const baseline = process.env.BASELINE_URL ? await openPage(browser, process.env.BASELINE_URL, viewport) : null;
      try {
        for (const dark of [false, true]) {
          const label = `${viewport.name}${dark ? '-dark' : ''}`;
          for (const session of [current, baseline].filter(Boolean)) {
            await session.page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
            await session.page.waitForTimeout(200);
          }
          const after = await snapshot(current.page);
          await fs.writeFile(path.join(output, `${label}-current.json`), JSON.stringify(after, null, 2));
          const afterImage = await current.page.screenshot({ path: path.join(output, `${label}-current.png`), animations: 'disabled' });
          if (baseline) {
            const before = await snapshot(baseline.page);
            await fs.writeFile(path.join(output, `${label}-baseline.json`), JSON.stringify(before, null, 2));
            const beforeImage = await baseline.page.screenshot({ path: path.join(output, `${label}-baseline.png`), animations: 'disabled' });
            failures.push(...compareStyles(before, after, label).map(difference => `${label}: ${difference}`));
            const ratio = await comparePixels(current.page, beforeImage, afterImage, label);
            if (ratio > 0.001) failures.push(`${label}: more than 0.1% of screenshot pixels changed (${ratio})`);
          }
          const layoutFailures = verifyLayout(after, viewport, dark);
          failures.push(...layoutFailures.map(failure => `${label}: ${failure}`));
          console.log(`${label}: ${layoutFailures.length ? `${layoutFailures.length} layout assertion(s) failed` : 'geometry, responsive tools, disabled styles, canvas and Mantine swatches passed'}`);
        }
        try {
          await verifyInteractions(current.page, viewport);
          console.log(`${viewport.name}: drawing, undo/redo, tool switching, page restore, repeated creation and cancel passed`);
        } catch (error) {
          failures.push(`${viewport.name} interaction: ${error.message}`);
        }
        for (const [name, session] of [['current', current], ['baseline', baseline]]) {
          if (!session) continue;
          failures.push(...session.errors.map(error => `${viewport.name} ${name} page error: ${error}`));
          failures.push(...session.forbiddenCalls.map(url => `${viewport.name} ${name} forbidden POST: ${url}`));
        }
      } finally {
        await current.context.close();
        if (baseline) await baseline.context.close();
      }
    }
    if (process.env.DEV_URL) {
      try { await verifyHmr(browser, process.env.DEV_URL); }
      catch (error) { failures.push(`Vite HMR: ${error.message}`); }
    }
    assert.deepEqual(failures, [], 'Tailwind migration must preserve baseline computed styles and screenshots');
    console.log(`Tailwind regression passed; artifacts: ${output}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
