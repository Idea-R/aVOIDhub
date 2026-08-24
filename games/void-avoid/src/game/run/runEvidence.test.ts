import { describe, expect, it } from 'vitest';
import { ScoreSystem } from '../systems/ScoreSystem';
import { RunRandomStreams } from './seededRandom';
import {
  RunEvidenceRecorder,
  verifyRunEvidence,
  type RunEvidence,
} from './runEvidence';

function createEvidence(seed = 0x12345678): RunEvidence {
  const random = new RunRandomStreams(seed);
  const recorder = new RunEvidenceRecorder();
  recorder.begin(seed, { width: 1280, height: 720, pixelRatio: 1 });
  const score = new ScoreSystem(
    random.getStream('score').next,
    (event) => recorder.record(event),
  );

  for (let tick = 1; tick <= 180; tick += 1) {
    recorder.advanceTick();
    if (tick === 30) score.addMeteorScore(100, 100, false, 'defense');
    if (tick === 60) score.addMeteorScore(200, 100, true, 'knockback');
    if (tick === 90) score.addChainFragmentScore(300, 100);
    if (tick === 120) score.processChainDetonationScore(6, 640, 360);
  }

  score.updateSurvivalScore(3);
  return recorder.finish(score.getScoreBreakdown(), random.getDrawCounts());
}

describe('VOIDaVOID run evidence', () => {
  it('recomputes the final score from seed, ticks, and ordered score events', () => {
    const evidence = createEvidence();
    const verification = verifyRunEvidence(evidence);

    expect(verification).toMatchObject({ valid: true, errors: [] });
    expect(verification.recomputed).toEqual(evidence.final);
    expect(evidence.events.map((event) => event.tick)).toEqual([30, 60, 90, 120]);
  });

  it('produces the same evidence and integrity code for the same run', () => {
    expect(createEvidence()).toEqual(createEvidence());
  });

  it('rejects score, ordering, draw-count, and integrity tampering', () => {
    const scoreTamper = structuredClone(createEvidence());
    scoreTamper.final.total += 1;
    expect(verifyRunEvidence(scoreTamper).valid).toBe(false);

    const orderTamper = structuredClone(createEvidence());
    orderTamper.events[1].tick = 1;
    expect(verifyRunEvidence(orderTamper).errors).toContain('Evidence events are not in deterministic tick order.');

    const drawTamper = structuredClone(createEvidence());
    drawTamper.randomDraws.score += 1;
    expect(verifyRunEvidence(drawTamper).errors).toContain('Score random draw count does not match the recorded score events.');

    const shapeTamper = structuredClone(createEvidence());
    const meteorEvent = shapeTamper.events.find((event) => event.type === 'meteor');
    if (meteorEvent?.type === 'meteor') Object.assign(meteorEvent, { source: 'browser' });
    expect(verifyRunEvidence(shapeTamper).errors).toContain('Meteor evidence has an invalid shape.');

    const integrityTamper = structuredClone(createEvidence());
    integrityTamper.integrity = 'fnv1a32:00000000';
    expect(verifyRunEvidence(integrityTamper).errors).toContain('Evidence integrity code does not match.');
  });
});
