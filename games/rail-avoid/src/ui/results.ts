/** Victory / defeat results screen: slam or rise headline, sequential stat count-ups, score last. */
import { el, btn, fmtTime } from './dom';
import type { UiShared } from './shared';
import { REGION_NAMES } from '../core/config';
import { gsap, D, isReduced, shake, countText, Particles, rowsIn } from './motion';

export interface ResultsActions { again(seed: number): void; newRun(): void; title(): void }

export function createResults(ui: UiShared, actions: ResultsActions): { el: HTMLElement; show(kind: 'victory' | 'defeat'): void } {
  const box = el('div', { class: 'rv-panel rv-modal rv-results' });
  const overlay = el('div', { class: 'rv-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Run results' }, box);
  const fx = el('canvas', { class: 'rv-results-fx', 'aria-hidden': 'true' });
  const particles = new Particles(fx, 45, ['232,193,112', '255,240,200']);
  let lastSeed = 0;
  let seq: gsap.core.Timeline | null = null;

  function show(kind: 'victory' | 'defeat'): void {
    const s = ui.state();
    const stats = s?.stats;
    lastSeed = s?.seed ?? 0;
    const kills = stats ? Object.values(stats.kills).reduce((a, b) => a + (b || 0), 0) : 0;
    const rows: Array<[string, string]> = [
      ['Time survived', s ? fmtTime(s.time) : '—'],
      ['Region reached', s ? (REGION_NAMES[Math.max(0, Math.min(3, s.region))] ?? '—') : '—'],
      ['Distance travelled', s ? `${Math.round(s.train.distanceTravelled)} hexes` : '—'],
      ['Settlements rescued', stats ? String(stats.settlementsRescued) : '—'],
      ['Settlements lost to the void', stats ? String(stats.settlementsLost) : '—'],
      ['Passengers delivered', s ? String(s.train.passengersDelivered) : '—'],
      ['Passengers still aboard', s ? String(s.train.passengers) : '—'],
      ['Cars intact', s ? String(s.train.cars.filter(c => c.hp > 0).length) : '—'],
      ['Cars lost', stats ? String(stats.carsLost) : '—'],
      ['Enemies destroyed', String(kills)],
      ['Bosses defeated', stats ? String(stats.bossesDefeated) : '—'],
      ['Rails laid', stats ? String(stats.railsLaid) : '—'],
      ['Damage dealt / taken', stats ? `${Math.round(stats.damageDealt)} / ${Math.round(stats.damageTaken)}` : '—'],
      ['Events resolved', stats ? String(stats.eventsResolved) : '—'],
    ];
    const victory = kind === 'victory';
    box.className = 'rv-panel rv-modal rv-results ' + (victory ? 'rv-victory' : 'rv-defeat');
    const label = el('div', { class: 'rv-label', text: victory ? 'Run complete' : 'Run over' });
    const h1 = el('h1', { text: victory ? 'The Gate Is Open' : 'Derailed' });
    const reason = el('div', { class: 'rv-reason', text: victory ? 'The last train crossed the Last Gate. The continent is behind you.' : (s?.defeatReason || 'The convoy was lost.') });
    const scoreNum = el('b', { text: '0' });
    const score = el('div', { class: 'rv-score' }, 'SCORE ', scoreNum);
    const trs = rows.map(([k, v]) => el('tr', null, el('td', { text: k }), el('td', { class: 'rv-rv', 'data-final': v, text: v })));
    const table = el('table', { 'aria-label': 'Run statistics' }, el('tbody', null, ...trs));
    const seed = el('div', { class: 'rv-seed', text: `seed ${lastSeed}` });
    const acts = el('div', { class: 'rv-actions' },
      btn('Run again (same seed)', () => { ui.audio().ui('confirm'); ui.close('results'); actions.again(lastSeed); }, { class: 'rv-primary', aria: 'Run again with the same seed' }),
      btn('New run', () => { ui.audio().ui('confirm'); ui.close('results'); actions.newRun(); }),
      btn('Title', () => { ui.audio().ui('close'); ui.close('results'); actions.title(); }, { aria: 'Return to title' }),
    );
    box.replaceChildren(...(victory ? [el('div', { class: 'rv-rays', 'aria-hidden': 'true' }), fx] : []), label, h1, reason, score, table, seed, acts);
    ui.open('results');
    if (victory) particles.start();
    play(victory, { label, h1, reason, score, scoreNum, trs, seed, acts }, stats?.score ?? 0);
  }

  function play(victory: boolean, e: { label: HTMLElement; h1: HTMLElement; reason: HTMLElement; score: HTMLElement; scoreNum: HTMLElement; trs: HTMLElement[]; seed: HTMLElement; acts: HTMLElement }, finalScore: number): void {
    seq?.kill();
    const vals = e.trs.map(tr => tr.lastElementChild as HTMLElement);
    gsap.set([e.label, e.reason, e.score, e.seed, ...e.trs], { opacity: 0 });
    const actBtns = Array.from(e.acts.children);
    gsap.set(actBtns, { autoAlpha: 0 });
    for (const v of vals) v.textContent = '';
    const tl = gsap.timeline();
    seq = tl;
    tl.fromTo(e.label, { opacity: 0, letterSpacing: '0.5em' }, { opacity: 1, letterSpacing: '0.18em', duration: D(0.8) }, 0);
    if (victory) {
      tl.fromTo(e.h1, { y: 46, opacity: 0, filter: 'blur(12px)', letterSpacing: '0.55em' },
        { y: 0, opacity: 1, filter: 'blur(0px)', letterSpacing: '0.18em', duration: D(1.3), ease: 'power3.out' }, D(0.25));
      const rays = box.querySelector('.rv-rays');
      if (rays) tl.fromTo(rays, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: D(1.6), ease: 'power2.out' }, D(0.3));
    } else {
      tl.fromTo(e.h1, { scale: 2.6, opacity: 0, filter: 'blur(8px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: D(0.3), ease: 'power4.in' }, D(0.3))
        .add(() => {
          shake(box, 10, 0.45);
          if (isReduced()) return;
          const f = gsap.timeline();
          for (const o of [0.2, 1, 0.4, 1, 0.6, 1]) f.to(e.h1, { opacity: o, duration: 0.05, ease: 'none' });
          f.to(e.h1, { textShadow: '0 0 60px rgba(232,111,111,0.9)', duration: 0.25 }).to(e.h1, { textShadow: '0 0 30px rgba(232,111,111,0.4)', duration: 0.8 });
        }, D(0.6));
    }
    tl.to(e.reason, { opacity: 1, duration: D(0.5) }, D(1.0));
    const rowAt = D(1.15), step = D(0.085);
    e.trs.forEach((tr, i) => {
      tl.fromTo(tr, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: D(0.3), ease: 'power2.out', clearProps: 'transform' }, rowAt + i * step);
      tl.add(() => countText(vals[i], vals[i].dataset.final ?? '', { dur: 0.55 }), rowAt + i * step);
    });
    const scoreAt = rowAt + e.trs.length * step + D(0.25);
    tl.fromTo(e.score, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: D(0.5), ease: 'back.out(1.8)', clearProps: 'transform' }, scoreAt)
      .add(() => countText(e.scoreNum, String(finalScore), { dur: 1.3, onDone: () => { if (!isReduced()) gsap.fromTo(e.score, { scale: 1.18 }, { scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.4)', clearProps: 'transform' }); } }), scoreAt)
      .to(e.seed, { opacity: 1, duration: D(0.4) }, scoreAt + D(0.9))
      .set(actBtns, { visibility: 'inherit' }, scoreAt + D(1.0))
      .add(() => rowsIn(actBtns, { y: 16 }), scoreAt + D(1.0));
  }

  ui.registerPanel('results', { el: overlay, modal: true, escClosable: false, anim: 'fade', onClose: () => { particles.stop(); seq?.kill(); seq = null; } });
  return { el: overlay, show };
}
