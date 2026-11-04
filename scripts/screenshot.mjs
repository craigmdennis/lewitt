// Capture screenshots of the app from a dev server or a prototype file, with a
// saved session.
//
// It loads Playwright from PLAYWRIGHT_DIR, or from the current directory when
// PLAYWRIGHT_DIR is not set.
//
// Chromium launches with --ignore-certificate-errors, because a dev server
// certificate is often not trusted. Without the flag, a mock service worker
// fails to register.
//
// One page:
//   node screenshot.mjs <session file> <url> <file.png> [width,height] [--selector <css>]
//
// Every state in a list, plus a contact sheet of all of them in <dir>/sheet.png.
// Each state opens <url> with ?state=<id> added:
//   node screenshot.mjs <session file> --states <url> <S1,S2,...> <dir> [width,height] [--selector <css>]
//
// A static copy of a page, for a standalone HTML prototype, in <dir>:
//   node screenshot.mjs <session file> --snapshot <url> <dir> --selector <css> [width,height] [--wait <ms>]
// <dir>/page.html is the page with its scripts removed. The element that
// --selector matches is replaced by a line that reads <!-- PROTOTYPE -->.
// <dir>/part.html holds that element's HTML. <dir>/page.css holds every CSS
// rule on the page, with fonts and images inlined, so the copy opens from any
// local server without the dev server.
//
// A layout check of one page, for offsets too small to see in a screenshot:
//   node screenshot.mjs <session file> --layout <url> <file.png> [width,height] [--selector <css>] [--wait <ms>]
// It lists each pair of neighbouring elements that almost align, by 1 to 4 px,
// and each heading with less space above it than below it. <file.png> shows each
// finding outlined and numbered.
//
// --selector crops each screenshot to the first element that matches.
// --wait <ms> sets the wait after the page loads. The default is 15000.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const USAGE = `Usage:
  node screenshot.mjs <session file> <url> <file.png> [width,height] [--selector <css>] [--wait <ms>]
  node screenshot.mjs <session file> --states <url> <S1,S2,...> <dir> [width,height] [--selector <css>] [--wait <ms>]
  node screenshot.mjs <session file> --snapshot <url> <dir> --selector <css> [width,height] [--wait <ms>]
  node screenshot.mjs <session file> --layout <url> <file.png> [width,height] [--selector <css>] [--wait <ms>]`;

const positional = [];
const flags = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--states') flags.states = true;
  else if (argv[i] === '--snapshot') flags.snapshot = true;
  else if (argv[i] === '--layout') flags.layout = true;
  else if (argv[i] === '--selector' || argv[i] === '--wait') flags[argv[i].slice(2)] = argv[++i];
  else positional.push(argv[i]);
}

const session = positional.shift();
let jobs;
let sheet;
let snapshotDir;
let layoutJob;
if (flags.layout) {
  const [url, file] = positional;
  if (!file) fail();
  layoutJob = { url, file };
  jobs = [];
  positional.splice(0, 2);
} else if (flags.snapshot) {
  const [url, dir] = positional;
  if (!dir || !flags.selector) fail();
  fs.mkdirSync(dir, { recursive: true });
  snapshotDir = dir;
  jobs = [{ label: 'snapshot', url, file: path.join(dir, 'page.png') }];
  positional.splice(0, 2);
} else if (flags.states) {
  const [url, ids, dir] = positional;
  if (!dir) fail();
  fs.mkdirSync(dir, { recursive: true });
  jobs = ids.split(',').map((id) => {
    const target = new URL(url);
    target.searchParams.set('state', id);
    return { label: id, url: target.href, file: path.join(dir, `${id}.png`) };
  });
  sheet = path.join(dir, 'sheet.png');
  positional.splice(0, 3);
} else {
  const [url, file] = positional;
  if (!file) fail();
  jobs = [{ label: path.basename(file), url, file }];
  positional.splice(0, 2);
}
const [width, height] = (positional[0] ?? '1440,1600').split(',').map(Number);
const wait = Number(flags.wait ?? 15000);

const require = createRequire(path.join(process.env.PLAYWRIGHT_DIR ?? process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  storageState: session,
  viewport: { width, height },
});

// Four pages at a time, so a list of states takes a few waits in total.
const queue = [...jobs];
await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
  for (let job = queue.shift(); job; job = queue.shift()) await capture(job);
}));

if (layoutJob) {
  await layout(layoutJob.url, layoutJob.file);
} else if (snapshotDir) {
  await snapshot(jobs[0].url, snapshotDir);
} else if (sheet) {
  await contactSheet(jobs, sheet);
  console.log(`Saved ${sheet}`);
}
await browser.close();

async function capture(job) {
  const page = await context.newPage();
  let mocked = 0;
  page.on('console', (message) => {
    if (message.text().startsWith('[MSW]')) mocked++;
  });
  await page.goto(job.url);
  await page.waitForTimeout(wait);
  // Parallel cold loads can fail to fetch a module from the dev server. One reload fixes it.
  if (await page.getByText('Application Error').count()) {
    await page.reload();
    await page.waitForTimeout(wait);
    if (await page.getByText('Application Error').count()) console.log(`${job.label}: the page shows Application Error`);
  }
  if (page.url().includes('/login')) console.log(`${job.label}: the session has expired`);
  const element = flags.selector ? page.locator(flags.selector).first() : null;
  if (element && (await element.count())) {
    await element.screenshot({ path: job.file });
  } else {
    if (element) console.log(`${job.label}: no element matches ${flags.selector}, so the whole page is saved`);
    await page.screenshot({ path: job.file });
  }
  await page.close();
  console.log(`Saved ${job.file}${mocked ? `, mocked ${mocked} requests` : ''}`);
}

async function snapshot(url, dir) {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForTimeout(wait);
  if (page.url().includes('/login')) console.log('The session has expired');
  const result = await page.evaluate(async (selector) => {
    const part = document.querySelector(selector);
    if (!part) return { error: `No element matches ${selector}` };

    // Each CSS rule, with url() made absolute against its stylesheet.
    const css = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        if (sheet.href) css.push(`@import url("${sheet.href}");`);
        continue;
      }
      const base = sheet.href ?? location.href;
      for (const rule of rules) {
        css.push(rule.cssText.replace(/url\(["']?([^"')]+)["']?\)/g, (match, ref) =>
          ref.startsWith('data:') ? match : `url("${new URL(ref, base).href}")`));
      }
    }
    let text = css.join('\n');

    // Fonts and images inline, so the copy needs no dev server.
    const toData = async (ref) => {
      try {
        const response = await fetch(ref);
        if (!response.ok) return null;
        const blob = await response.blob();
        if (blob.size > 2_000_000) return null;
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    };
    const refs = [...new Set([...text.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]))]
      .filter((ref) => !ref.startsWith('data:'));
    for (const ref of refs) {
      const data = await toData(ref);
      if (data) text = text.split(`url("${ref}")`).join(`url("${data}")`);
    }

    // Current form values become attributes, so the copy shows them.
    for (const input of document.querySelectorAll('input, textarea, select')) {
      if (input.type === 'checkbox' || input.type === 'radio') input.toggleAttribute('checked', input.checked);
      else if (input.tagName === 'TEXTAREA') input.textContent = input.value;
      else input.setAttribute('value', input.value);
    }

    const partHtml = part.outerHTML;
    const marker = document.createComment(' PROTOTYPE ');
    part.replaceWith(marker);
    const clone = document.documentElement.cloneNode(true);
    marker.replaceWith(part);
    clone.querySelectorAll('script, noscript, style, link[rel="stylesheet"], link[rel="modulepreload"], link[rel="preload"]')
      .forEach((element) => element.remove());
    for (const element of clone.querySelectorAll('img[src]')) {
      const data = await toData(element.src);
      if (data) element.setAttribute('src', data);
      element.removeAttribute('srcset');
    }
    const head = clone.querySelector('head');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'page.css';
    head.append(link);
    const html = '<!doctype html>\n' + clone.outerHTML.replace('<!-- PROTOTYPE -->', '\n<!-- PROTOTYPE -->\n');
    return { html, partHtml, css: text, rules: css.length, inlined: refs.length };
  }, flags.selector);
  await page.close();
  if (result.error) {
    console.log(result.error);
    return;
  }
  fs.writeFileSync(path.join(dir, 'page.html'), result.html);
  fs.writeFileSync(path.join(dir, 'part.html'), result.partHtml + '\n');
  fs.writeFileSync(path.join(dir, 'page.css'), result.css);
  console.log(`Saved ${dir}/page.html, part.html and page.css: ${result.rules} CSS rules, ${result.inlined} fonts and images checked`);
}

async function layout(url, file) {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForTimeout(wait);
  if (page.url().includes('/login')) console.log('The session has expired');
  const result = await page.evaluate((selector) => {
    const root = selector ? document.querySelector(selector) : document.body;
    if (!root) return { error: `No element matches ${selector}` };

    const shown = (element) => {
      const rect = element.getBoundingClientRect();
      // A screen reader only element is 1 px square.
      if (rect.width <= 1 || rect.height <= 1) return false;
      const style = getComputedStyle(element);
      return style.visibility !== 'hidden' && Number(style.opacity) > 0;
    };
    const children = (element) => [...element.children].filter(shown);
    const ownText = (element) =>
      [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());

    // The element a reader sees in a wrapper: the wrapper's only child, down to the content.
    const content = (element) => {
      let current = element;
      while (!(current instanceof SVGElement) && !ownText(current) && children(current).length === 1) current = children(current)[0];
      return current;
    };
    // The visible box: the first line of text for text, or the element's box.
    const box = (element) => {
      if (ownText(element) && !children(element).length) {
        const range = document.createRange();
        range.selectNodeContents(element);
        const line = range.getClientRects()[0];
        if (line) return line;
      }
      return element.getBoundingClientRect();
    };
    const name = (element) => {
      const text = element.innerText?.trim().replace(/\s+/g, ' ').slice(0, 40);
      const label = element.getAttribute('aria-label');
      const className = typeof element.className === 'string' ? element.className.split(' ')[0] : '';
      return `${element.tagName.toLowerCase()}${className ? `.${className}` : ''}${text ? ` "${text}"` : label ? ` [${label}]` : ''}`;
    };
    const isHeading = (element) => /^H[1-6]$/.test(element.tagName) || element.getAttribute('role') === 'heading';
    const near = (offset) => offset >= 1 && offset <= 4;
    const round = (value) => Math.round(value * 10) / 10;

    const findings = [];
    for (const parent of [root, ...root.querySelectorAll('*')]) {
      if (!shown(parent)) continue;
      const items = children(parent).map((element) => {
        const target = content(element);
        return { element, target, outer: element.getBoundingClientRect(), inner: box(target) };
      });
      if (items.length < 2) continue;
      const byX = [...items].sort((a, b) => a.outer.left - b.outer.left);
      const byY = [...items].sort((a, b) => a.outer.top - b.outer.top);

      // Neighbours in a row: their tops, centres, and bottoms all miss by a few pixels.
      for (let i = 1; i < byX.length; i++) {
        const [a, b] = [byX[i - 1], byX[i]];
        const sideBySide = b.outer.left >= a.outer.right - 1;
        const overlap = Math.min(a.outer.bottom, b.outer.bottom) - Math.max(a.outer.top, b.outer.top);
        if (!sideBySide || overlap <= 0) continue;
        const centre = (rect) => rect.top + rect.height / 2;
        const offsets = {
          tops: Math.abs(a.inner.top - b.inner.top),
          centres: Math.abs(centre(a.inner) - centre(b.inner)),
          bottoms: Math.abs(a.inner.bottom - b.inner.bottom),
        };
        if (near(Math.min(...Object.values(offsets)))) {
          findings.push({
            kind: 'Row',
            text: `${name(a.target)} and ${name(b.target)} sit side by side, and none of their edges align: the tops differ by ${round(offsets.tops)} px, the centres by ${round(offsets.centres)} px, and the bottoms by ${round(offsets.bottoms)} px.`,
            rects: [a.inner, b.inner],
          });
        }
      }

      // Neighbours in a column: their left edges miss by a few pixels.
      for (let i = 1; i < byY.length; i++) {
        const [a, b] = [byY[i - 1], byY[i]];
        const stacked = b.outer.top >= a.outer.bottom - 1;
        if (!stacked) continue;
        const offset = Math.abs(a.inner.left - b.inner.left);
        if (near(offset)) {
          findings.push({
            kind: 'Column',
            text: `${name(a.target)} sits above ${name(b.target)}, and their left edges differ by ${round(offset)} px.`,
            rects: [a.inner, b.inner],
          });
        }
      }

      // A heading closer to the content above it than to its own content.
      for (let i = 1; i < byY.length - 1; i++) {
        const [above, heading, below] = [byY[i - 1], byY[i], byY[i + 1]];
        if (!isHeading(heading.target)) continue;
        const spaceAbove = heading.outer.top - above.outer.bottom;
        const spaceBelow = below.outer.top - heading.outer.bottom;
        if (spaceAbove >= 0 && spaceAbove <= spaceBelow) {
          findings.push({
            kind: 'Heading',
            text: `${name(heading.target)} has ${round(spaceAbove)} px above it and ${round(spaceBelow)} px below it, so it reads as part of the content above.`,
            rects: [heading.outer],
          });
        }
      }
    }

    // Outline and number each finding on the page.
    findings.forEach((finding, index) => {
      for (const rect of finding.rects) {
        const mark = document.createElement('div');
        Object.assign(mark.style, {
          position: 'absolute', left: `${rect.left + scrollX}px`, top: `${rect.top + scrollY}px`,
          width: `${rect.width}px`, height: `${rect.height}px`, outline: '1px solid #e5007a',
          zIndex: 2147483647, pointerEvents: 'none',
        });
        const label = document.createElement('span');
        label.textContent = String(index + 1);
        Object.assign(label.style, {
          position: 'absolute', left: '0', top: '0', padding: '0 3px', background: '#e5007a',
          color: '#fff', font: '600 10px/14px system-ui',
        });
        mark.append(label);
        document.body.append(mark);
      }
    });
    return { findings: findings.map(({ kind, text }) => ({ kind, text })) };
  }, flags.selector);
  if (result.error) {
    console.log(result.error);
  } else {
    const element = flags.selector ? page.locator(flags.selector).first() : null;
    if (element) await element.screenshot({ path: file });
    else await page.screenshot({ path: file, fullPage: true });
    if (!result.findings.length) console.log('No layout findings');
    result.findings.forEach((finding, index) => console.log(`${index + 1}. ${finding.kind}: ${finding.text}`));
    console.log(`Saved ${file}`);
  }
  await page.close();
}

// Two columns in a page 1600 pixels wide, each screenshot under its state ID. The page
// renders at twice its size, so each frame keeps its own resolution and stays readable
// when the design lead zooms in.
async function contactSheet(items, file) {
  const cells = items
    .map((item) => {
      const data = fs.readFileSync(item.file).toString('base64');
      return `<figure><figcaption>${item.label}</figcaption><img src="data:image/png;base64,${data}"></figure>`;
    })
    .join('');
  const page = await browser.newPage({ viewport: { width: 1600, height: 800 }, deviceScaleFactor: 2 });
  await page.setContent(`<style>
    body { margin: 0; padding: 16px; background: #fff; font: 600 20px system-ui; }
    main { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    figure { margin: 0; border: 1px solid #ccc; }
    figcaption { padding: 6px 10px; background: #eee; }
    img { display: block; width: 100%; }
  </style><main>${cells}</main>`);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}

function fail() {
  console.error(USAGE);
  process.exit(2);
}
