/** Persistent conversation transitions. Preparing a party is not resolving an event. */
import type { SimContext } from './api';
import type { ConversationOption } from '../core/conversations';
import { KEEPER_HELPED } from '../core/conversations';
import { addResource, log } from './helpers';
import { addMarks } from './loot';

export function prepareExpedition(ctx: SimContext): boolean {
  const e = ctx.state.activeEvent;
  if (!e || e.preparingExpedition || !ctx.state.train.crew.some(c => c.hp > 20)) return false;
  e.preparingExpedition = true;
  ctx.bus.defer('expedition:prepare', {});
  return true;
}

export function cancelExpeditionPreparation(ctx: SimContext): boolean {
  const e = ctx.state.activeEvent;
  if (ctx.state.phase !== 'event' || !e?.preparingExpedition) return false;
  e.preparingExpedition = false;
  ctx.bus.defer('event:show', { defId: e.defId });
  return true;
}

export function rememberKeeperHelp(ctx: SimContext): void {
  const flags = ctx.state.storyFlags ??= [];
  if (!flags.includes(KEEPER_HELPED)) flags.push(KEEPER_HELPED);
}

export function chooseKeeperOption(ctx: SimContext, option: ConversationOption): boolean {
  const { state } = ctx;
  const e = state.activeEvent!;
  switch (option.action) {
    case 'help': case 'mechanic': case 'kit':
      e.dialogue = { step: 'briefing', approach: option.action };
      break;
    case 'prepare': return prepareExpedition(ctx);
    case 'repair': {
      // Availability was checked by the shared predicate immediately before this commit.
      const cost = option.requires!.amount!;
      addResource(ctx, 'scrap', -cost);
      addMarks(ctx, 3, 'keeper rescue');
      rememberKeeperHelp(ctx);
      e.dialogue = { ...e.dialogue, step: 'receipt', receipt: `The hoist is turning. Everyone is out. You spent ${cost} scrap and earned 3 marks. The keepers will remember this.` };
      state.stats.eventsResolved++;
      log(state, `The keeper's signal: repaired the hoist for ${cost} scrap; +3 marks.`, 'good');
      break;
    }
    case 'leave':
      e.dialogue = { ...e.dialogue, step: 'receipt', receipt: 'I understand. I’ll keep signalling for another crew. Safe travels, Conductor. No supplies spent; no reward.' };
      state.stats.eventsResolved++;
      break;
    case 'return':
      state.activeEvent = null;
      state.phase = 'running';
      ctx.bus.defer('phase:change', { phase: 'running' });
      return true;
  }
  ctx.bus.defer('event:show', { defId: e.defId });
  return true;
}
