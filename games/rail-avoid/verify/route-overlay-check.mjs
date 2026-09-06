import { chromium } from 'playwright';
import fs from 'node:fs';
const out = 'verify/screenshots/route-overlay'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage(); const errors = [], failures = [];
page.on('pageerror', e => errors.push(e.message));
const check = (ok, msg) => { if (!ok) failures.push(msg); };
try {
  await page.addInitScript(() => window.__RAIL_SKIP_OPENING = true);
  await page.goto('http://localhost:5178/RAILaVOID/');
  await page.waitForFunction(() => window.__RAIL?.ready && window.__RAIL.view);
  for (const [width, height] of [[1280,720],[800,600],[390,844],[1920,1080]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => { const R = window.__RAIL; R.ctx.settings.setMeta({introSeen:true}); R.ctx.settings.set({reducedMotion:true,showTutorial:false,uiScale:.75}); R.newRun(12345); R.pause(); });
    await page.locator('.rv-jm-endpoint').first().waitFor(); await page.waitForTimeout(450);
    const proof = await page.evaluate(() => {
      const groups = [...document.querySelectorAll('.rv-junction-rails g')];
      const s = window.__RAIL.state;
      const links = new Set([...s.route.railLinks, ...s.route.builtLinks]);
      const allEdgesExist = groups.every(g => {
        const t = JSON.parse(g.dataset.trace);
        return t.slice(1).every((b,i) => { const a = t[i], x = a.join(','), y = b.join(','); return links.has(x < y ? `${x}|${y}` : `${y}|${x}`); });
      });
      return { allEdgesExist, groups:groups.length, paths:groups.map(g=>g.querySelector('path').getAttribute('d')), nodes:[...document.querySelectorAll('.rv-jm-endpoint')].map(n=>{
        const r = n.getBoundingClientRect(), l=n.querySelector('.rv-jm-label').getBoundingClientRect();
        return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,label:{x:l.x,y:l.y,right:l.right,bottom:l.bottom}};
      })};
    });
    console.log(JSON.stringify({width,height,...proof}));
    check(proof.groups >= 2, `${width}: missing choices`);
    check(proof.allEdgesExist, `${width}: preview contains invented rail`);
    for (const n of proof.nodes) {
      check(n.x >= 0 && n.right <= width && n.y >= 0 && n.bottom <= height, `${width}: node offscreen`);
      check(n.label.x >= 0 && n.label.right <= width && n.label.y >= 0 && n.label.bottom <= height, `${width}: label offscreen`);
    }
    for (let i=0;i<proof.nodes.length;i++) for(let j=i+1;j<proof.nodes.length;j++) {
      const a=proof.nodes[i].label,b=proof.nodes[j].label;
      check(Math.min(a.right,b.right)<=Math.max(a.x,b.x)||Math.min(a.bottom,b.bottom)<=Math.max(a.y,b.y),`${width}: destination labels overlap`);
    }
    await page.screenshot({path:`${out}/junction-${width}x${height}.png`});
    const choice = await page.locator('.rv-jm-endpoint').last().evaluate(n=>({col:+n.dataset.col,row:+n.dataset.row}));
    await page.locator('.rv-jm-endpoint').last().click();
    await page.waitForFunction(({col,row})=>{const R=window.__RAIL,p=R.state.route.path.at(-1);return p[0]===col&&p[1]===row&&R.state.phase==='running';},choice);
  }
  check(!errors.length, `Browser errors: ${errors.join('; ')}`);
  if(failures.length) throw new Error(failures.join('\n'));
  console.log('PASS actual-rail overlays and direct node activation at four viewport sizes');
} finally { await browser.close(); }
