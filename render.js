// Frame-exact renderer: Puppeteer seeks each shot's GSAP timeline frame by frame and pipes PNGs into ffmpeg.
// usage: node render.js [--fmt h|v|both] [--shots s1_hook,s3_dentro_1] [--jobs 3] [--no-concat]
const puppeteer = require('puppeteer-core');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const ROOT = __dirname;
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'shots.json'), 'utf8'));
const FMTS = { h: [1920, 1080, '16x9'], v: [1080, 1920, '9x16'] };
const fmts = opt('fmt', 'both') === 'both' ? ['h', 'v'] : [opt('fmt')];
const only = opt('shots', '') ? opt('shots').split(',') : null;
const JOBS = +opt('jobs', 3);
const OUT = path.join(ROOT, 'out');

function ffmpegSink(file, fps) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', file],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  return { write: buf => new Promise(r => p.stdin.write(buf) ? r() : p.stdin.once('drain', r)), end: () => { p.stdin.end(); return done; } };
}

async function renderShot(browser, shot, fmt) {
  const [W, H] = FMTS[fmt];
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const dur = shot.out - shot.in;
  const url = `file://${ROOT}/shots/${shot.id}.html?fmt=${fmt}&offset=${shot.in}&dur=${dur}`;
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 30000, polling: 100 });
  if (errs.length) throw new Error(`${shot.id}: ${errs.join(' | ')}`);
  const cdp = await page.createCDPSession();
  const DRY = args.includes('--dry');                 // layout check on every 2nd frame, no capture, no encode
  const sink = DRY ? { write: async () => {}, end: async () => {} } : ffmpegSink(path.join(OUT, 'seg', fmt, shot.id + '.mp4'), plan.fps);
  const issues = [];
  for (let fr = 0; fr < dur; fr++) {
    await page.evaluate(n => window.renderFrame(n), fr);
    if (!DRY) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
      await sink.write(Buffer.from(data, 'base64'));
    }
    if (fr % (DRY ? 2 : 6) === 0) {
      const c = await page.evaluate(() => window.layoutCheck());
      c.issues.forEach(i => issues.push(`${shot.id} f${shot.in + fr}: ${i}`));
    }
  }
  await sink.end();
  await page.close();
  return issues;
}

(async () => {
  const t0 = Date.now();
  const launch = () => puppeteer.launch({ executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--allow-file-access-from-files', '--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] });
  const browsers = await Promise.all(Array.from({ length: JOBS }, launch));   // one browser per worker: no background-tab throttling
  const report = {};
  for (const fmt of fmts) {
    const todo = plan.shots.filter(s => !only || only.includes(s.id));
    const issues = [];
    let i = 0;
    await Promise.all(browsers.map(async browser => {
      while (i < todo.length) { const s = todo[i++]; const st = Date.now();
        issues.push(...await renderShot(browser, s, fmt));
        console.log(`[${fmt}] ${s.id} ${s.out - s.in}f in ${((Date.now() - st) / 1000).toFixed(1)}s`); }
    }));
    report[fmt] = [...new Set(issues)];
    if (!args.includes('--no-concat') && !args.includes('--dry')) {
      const list = path.join(OUT, 'seg', fmt, 'list.txt');
      fs.writeFileSync(list, plan.shots.map(s => `file '${s.id}.mp4'`).join('\n'));
      const silent = path.join(OUT, 'seg', `video_${FMTS[fmt][2]}.mp4`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
      const n = execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', silent]).toString().trim();
      console.log(`[${fmt}] concat -> ${silent} (${n} frames, expected ${plan.total_frames})`);
    }
  }
  fs.mkdirSync(path.join(OUT, 'check'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'check', 'layout_report.json'), JSON.stringify(report, null, 2));
  for (const k in report) console.log(`[${k}] layout issues: ${report[k].length}`, report[k].slice(0, 15));
  await Promise.all(browsers.map(b => b.close()));
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})().catch(e => { console.error(e); process.exit(1); });
