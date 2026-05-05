import puppeteer from 'puppeteer';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tools', 'screens', 'en');
const HTML = pathToFileURL(path.join(ROOT, 'index.html')).href;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const STAGES = [
    ['easy',  2,  'stage-03-road'],
    ['easy',  4,  'stage-05-market'],
    ['easy',  6,  'stage-07-apartment'],
    ['crazy', 12, 'stage-13-subway'],
    ['crazy', 13, 'stage-14-home-night'],
];

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 700, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => {
        try { localStorage.setItem('simbangLang', 'en'); } catch (e) {}
    });
    await page.goto(HTML, { waitUntil: 'load' });
    await sleep(300);

    for (const [diff, idx, label] of STAGES) {
        await page.evaluate((d, i) => {
            window.eval(`
                difficulty = '${d}';
                selectedModeIdx = MODE_LIST.indexOf('${d}');
                currentStage = ${i};
                totalScore = 0;
                gameState = 'playing';
                stageTimer = 0;
                stopBgm();
                initStage();
            `);
        }, diff, idx);
        await sleep(500);
        await page.screenshot({ path: path.join(OUT_DIR, `01-${label}.png`) });
    }

    await browser.close();
    console.log('DONE');
})();
