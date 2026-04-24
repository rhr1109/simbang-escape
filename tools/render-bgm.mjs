// Render CRAZY-extra stage BGMs to MP3
// 게임 내 Web Audio API 로직을 Node.js에서 오프라인 렌더링하여 MP3로 저장

import fs from 'fs';
import path from 'path';
import * as lamejs from '@breezystack/lamejs';

const BGM = {
    'bgm-stage12-rooftop': {
        tempo: 130,
        wave: 'sawtooth',
        notes: [0, 7, 12, 15, 19, 15, 12, 7, -2, 5, 10, 13, 17, 13, 10, 5],
        bass: [0, 0, -5, -5, 3, 3, -7, -7],
        vol: 0.038,
        title: '12단계: 옥상 추격전'
    },
    'bgm-stage13-subway': {
        tempo: 120,
        wave: 'square',
        notes: [0, 3, 5, 8, 5, 3, 0, -4, -2, 1, 3, 6, 3, 1, -2, -5],
        bass: [0, 0, 0, 0, -5, -5, -7, -7],
        vol: 0.035,
        title: '13단계: 심야 지하철'
    }
};

const SR = 44100;
const DURATION = 32; // seconds (약 2~3 루프)
const BASE_FREQ = 220; // A3

function waveSample(type, phase) {
    switch (type) {
        case 'sine':     return Math.sin(phase);
        case 'square':   return Math.sin(phase) >= 0 ? 1 : -1;
        case 'triangle': return (2 / Math.PI) * Math.asin(Math.sin(phase));
        case 'sawtooth': {
            let x = phase / (2 * Math.PI);
            return 2 * (x - Math.floor(0.5 + x));
        }
    }
    return 0;
}

function renderBgm(m) {
    const beatLen = m.tempo / 1000; // ms → seconds
    const samples = SR * DURATION;
    const buf = new Float32Array(samples);

    function addVoice(notes, freqMult, wavetype, volume) {
        const loopLen = notes.length * beatLen;
        const loops = Math.ceil(DURATION / loopLen);
        for (let rep = 0; rep < loops; rep++) {
            for (let i = 0; i < notes.length; i++) {
                const note = notes[i];
                const t0 = rep * loopLen + i * beatLen;
                const t1 = t0 + beatLen;
                const freq = BASE_FREQ * freqMult * Math.pow(2, note / 12);
                const s0 = Math.floor(t0 * SR);
                const s1 = Math.min(samples, Math.floor(t1 * SR));
                if (s0 >= samples) break;
                // 노트 내 phase 연속성을 위해 노트 내부 phase 사용
                for (let s = s0; s < s1; s++) {
                    const localT = (s - s0) / SR;
                    // 엔벨로프: 5ms 어택 → 80% 구간 sustain → 20% 구간 fade to 70%
                    let env;
                    if (localT < 0.005) env = (localT / 0.005) * volume;
                    else if (localT < beatLen * 0.8) env = volume;
                    else {
                        const fadeRatio = (localT - beatLen * 0.8) / (beatLen * 0.2);
                        env = volume * (1 - fadeRatio * 0.3);
                    }
                    // 노트 꼬리 방지: 마지막 2ms 빠른 릴리즈
                    if (localT > beatLen - 0.002) {
                        env *= Math.max(0, (beatLen - localT) / 0.002);
                    }
                    const phase = 2 * Math.PI * freq * localT;
                    buf[s] += env * waveSample(wavetype, phase);
                }
            }
        }
    }

    // 메인 멜로디
    addVoice(m.notes, 1, m.wave, m.vol);
    // 베이스 (옥타브 아래 sine)
    addVoice(m.bass, 0.5, 'sine', m.vol * 0.8);

    // Normalize slight
    let peak = 0;
    for (let i = 0; i < samples; i++) if (Math.abs(buf[i]) > peak) peak = Math.abs(buf[i]);
    if (peak > 0.99) {
        const scale = 0.95 / peak;
        for (let i = 0; i < samples; i++) buf[i] *= scale;
    }
    return buf;
}

function floatToInt16(f32) {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
        let s = Math.max(-1, Math.min(1, f32[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
}

function encodeMp3(pcm, sampleRate, bitrateKbps = 128) {
    const encoder = new lamejs.Mp3Encoder(1 /* mono */, sampleRate, bitrateKbps);
    const blockSize = 1152;
    const chunks = [];
    for (let i = 0; i < pcm.length; i += blockSize) {
        const chunk = pcm.subarray(i, Math.min(i + blockSize, pcm.length));
        const enc = encoder.encodeBuffer(chunk);
        if (enc.length > 0) chunks.push(Buffer.from(enc));
    }
    const flush = encoder.flush();
    if (flush.length > 0) chunks.push(Buffer.from(flush));
    return Buffer.concat(chunks);
}

const outDir = path.join(path.dirname(new URL(import.meta.url).pathname).slice(1), '..', 'assets', 'bgm');
fs.mkdirSync(outDir, { recursive: true });

for (const [name, m] of Object.entries(BGM)) {
    console.log(`Rendering ${name} (${m.title})...`);
    const f32 = renderBgm(m);
    const pcm = floatToInt16(f32);
    const mp3 = encodeMp3(pcm, SR, 128);
    const outPath = path.join(outDir, `${name}.mp3`);
    fs.writeFileSync(outPath, mp3);
    console.log(`  → ${outPath} (${(mp3.length / 1024).toFixed(1)} KB, ${DURATION}s, 128kbps)`);
}
console.log('Done.');
