// Render selected global frames to PNG for quick review: node preview.js h 80,330,680
const puppeteer = require('puppeteer-core'); const fs = require('fs'); const path = require('path');
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'shots.json')));
const [fmt, list] = process.argv.slice(2); const [W, H] = fmt === 'v' ? [1080, 1920] : [1920, 1080];
(async () => {
  const b = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p = await b.newPage(); await p.setViewport({ width: W, height: H });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  fs.mkdirSync('out/check', { recursive: true }); const outs = [];
  for (const g of list.split(',').map(Number)) {
    const s = plan.shots.find(s => g >= s.in && g < s.out);
    await p.goto(`file://${__dirname}/shots/${s.id}.html?fmt=${fmt}&offset=${s.in}&dur=${s.out - s.in}`);
    await p.waitForFunction('window.__ready===true', { timeout: 20000 });
    for (let fr = 0; fr <= g - s.in; fr++) await p.evaluate(n => renderFrame(n), fr); // seek forward like the renderer
    const c = await p.evaluate(() => layoutCheck());
    const o = `out/check/${fmt}_${String(g).padStart(4, '0')}.png`; await p.screenshot({ path: o }); outs.push(o);
    console.log(g, s.id, JSON.stringify(c));
  }
  if (errs.length) console.log('ERRORS', errs);
  await b.close();
})();
