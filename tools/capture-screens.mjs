import puppeteer from 'puppeteer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'tools', 'screens');
const HTML = pathToFileURL(path.join(ROOT, 'index.html')).href;

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

const STAGES_TO_CAPTURE = [
    // [difficulty, stageIndex, label]
    ['easy',   0,  'stage-01-church-yard'],
    ['easy',   1,  'stage-02-parking'],
    ['easy',   2,  'stage-03-road'],
    ['easy',   3,  'stage-04-alley'],
    ['easy',   4,  'stage-05-market'],   // 시장 배너 (떡볶이 등) 한글 가능
    ['easy',   5,  'stage-06-park'],
    ['easy',   6,  'stage-07-apartment'],
    ['easy',   7,  'stage-08-mountain'],
    ['easy',   8,  'stage-09-highway'],
    ['easy',   9,  'stage-10-terminal'], // 터미널 간판 한글 가능
    ['easy',   10, 'stage-11-train'],
    ['easy',   11, 'stage-12-home'],
    ['crazy',  11, 'stage-12-rooftop'],
    ['crazy',  12, 'stage-13-subway'],   // 선릉 간판 한글 가능
    ['crazy',  13, 'stage-14-home-night'],
];

async function captureLang(browser, lang) {
    const langDir = path.join(OUT_DIR, lang);
    if (!fs.existsSync(langDir)) fs.mkdirSync(langDir, { recursive: true });

    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 700, deviceScaleFactor: 1 });

    // 사전에 localStorage 언어 설정
    await page.evaluateOnNewDocument((l) => {
        try { localStorage.setItem('simbangLang', l); } catch (e) {}
    }, lang);

    await page.goto(HTML, { waitUntil: 'load' });
    await sleep(400);

    // 1. 메뉴
    await page.screenshot({ path: path.join(langDir, '00-menu.png') });

    // 각 스테이지별 캡처
    for (const [diff, stageIdx, label] of STAGES_TO_CAPTURE) {
        // gameState 강제 설정 + initStage
        await page.evaluate((d, i) => {
            window.difficulty = d;
            window.selectedModeIdx = ['easy','normal','hard','crazy'].indexOf(d);
            // 위 변수들이 실제 모듈에 정의되어 있어야 함 (window 글로벌 확보)
            // 게임 모듈 변수들에 직접 접근
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
        }, diff, stageIdx);
        // 몇 프레임 진행 (장애물/아이템 랜덤 스폰)
        await sleep(500);
        await page.screenshot({ path: path.join(langDir, `01-${label}.png`) });

        // 스토리 인트로
        await page.evaluate(() => {
            window.eval(`gameState = 'storyIntro'; stageTimer = 0;`);
        });
        await sleep(150);
        await page.screenshot({ path: path.join(langDir, `02-storyIntro-${label}.png`) });
    }

    // 일시정지
    await page.evaluate(() => {
        window.eval(`
            difficulty = 'easy';
            currentStage = 0;
            gameState = 'playing';
            initStage();
        `);
    });
    await sleep(300);
    await page.evaluate(() => { window.eval('togglePause();'); });
    await sleep(150);
    await page.screenshot({ path: path.join(langDir, '90-pause.png') });

    // 스테이지 클리어
    await page.evaluate(() => {
        window.eval(`
            currentStage = 0;
            score = 1234;
            totalScore = 4321;
            gameState = 'stageClear';
        `);
    });
    await sleep(100);
    await page.screenshot({ path: path.join(langDir, '91-stageClear.png') });

    // 게임 오버
    await page.evaluate(() => {
        window.eval(`
            currentStage = 4;
            score = 567;
            gameState = 'gameOver';
        `);
    });
    await sleep(100);
    await page.screenshot({ path: path.join(langDir, '92-gameOver.png') });

    // 엔딩
    await page.evaluate(() => {
        window.eval(`
            currentStage = 11;
            totalScore = 32100;
            gameState = 'ending';
        `);
    });
    await sleep(100);
    await page.screenshot({ path: path.join(langDir, '93-ending.png') });

    await page.close();
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
        await captureLang(browser, 'en');
        await captureLang(browser, 'ko');
    } finally {
        await browser.close();
    }
    console.log('DONE:', OUT_DIR);
})();
