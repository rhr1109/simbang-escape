import puppeteer from 'puppeteer';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tools', 'screens');
const HTML = pathToFileURL(path.join(ROOT, 'index.html')).href;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function captureSubwaySign(browser, lang) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 700, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument((l) => {
        try { localStorage.setItem('simbangLang', l); } catch (e) {}
    }, lang);
    await page.goto(HTML, { waitUntil: 'load' });
    await sleep(300);

    // Stage 13 (지하철) 진입 + bgScroll을 진행시켜 선릉 간판이 화면에 들어오도록
    await page.evaluate(() => {
        window.eval(`
            difficulty = 'crazy';
            currentStage = 12; // 지하철
            gameState = 'playing';
            stageTimer = 0;
            stopBgm();
            initStage();
            // 선릉 간판은 x=400. scroll = bgScroll * 0.3.
            // 화면 안 (0~1000)에 보이게 하기 위해 scrollX ≈ 100~300 정도가 좋음
            // 즉 bgScroll ≈ 600~1000
            bgScroll = 800;
        `);
    });
    await sleep(120);
    await page.screenshot({ path: path.join(OUT_DIR, lang, 'subway-sign-visible.png') });
    await page.close();
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
        await captureSubwaySign(browser, 'en');
        await captureSubwaySign(browser, 'ko');
    } finally {
        await browser.close();
    }
    console.log('DONE');
})();
