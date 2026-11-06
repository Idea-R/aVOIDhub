import { CHARACTERS, createMatch, getBotInputs, restartMatch, stateHash, step } from "@avoid/boomerangavoid-sim";
import { newDraft, parseDraft, type StudioDraft } from "../src/studio-contract";

export function powerDraft(kind: "on" | "off" | "empty" | "legacy", count = 4, wins = 5): StudioDraft {
  const d = newDraft("moss-court");
  d.label = `Power-up ${kind} proving yard`;
  d.arena.name = d.label;
  d.match.seed = 41827;
  d.match.wins = wins;
  d.match.upgrades = kind !== "off";
  d.match.enabledUpgrades = kind === "empty" ? [] : ["tailwind"];
  if (kind === "legacy") delete d.match.enabledUpgrades;
  d.seats = CHARACTERS.slice(0,count).map((c,i) => ({
    id:`studio-${i}`, name:i?`Bot ${i}`:"Local player", character:c.id, color:c.color,
    team:i%2, bot:i===0?null:i===1?"easy":i===2?"hard":"normal", control:i===0?"keyboard1":"bot",
  }));
  return parseDraft(d);
}

/** Real bot decisions and simulation only; human seats receive neutral input. */
export function replayPowerDraft(draft: StudioDraft) {
  const d = parseDraft(draft);
  const state = createMatch({...d.match,arenaDraft:d.arena},d.seats.map(({control,...seat})=>seat));
  const run = (s: typeof state) => {
    const drops: {tick:number;upgrade:string}[] = [];
    const firstDecision: Record<string,number> = {};
    while (s.phase !== "matchResults" && s.tick < 36000) {
      const commands = getBotInputs(s);
      for (const [id,c] of Object.entries(commands))
        if (!(id in firstDecision) && (Math.hypot(c.mx,c.my)>0 || c.dash || c.slash || c.throw)) firstDecision[id]=s.tick;
      step(s,commands);
      for(const e of s.events)if(e.type==="pickupSpawn")drops.push({tick:s.tick,upgrade:e.detail!});
    }
    if (s.phase !== "matchResults") throw Error("Power-up fixture exceeded natural-match tick bound");
    return {
      tick:s.tick,round:s.round,hash:stateHash(s),scores:s.players.map(p=>p.score),winners:[...s.matchWinnerIds],drops,firstDecision,
      config:structuredClone(s.config),seats:s.players.map(({id,name,character,color,team,bot})=>({id,name,character,color,team,bot})),
    };
  };
  const first = run(state), restarted = restartMatch(state);
  const cleanRestart = {tick:restarted.tick,round:restarted.round,scores:restarted.players.map(p=>p.score),pickups:restarted.pickups.length,upgrades:restarted.players.map(p=>p.upgrades.length),shields:restarted.players.map(p=>p.shield)};
  return {first,cleanRestart,rematch:run(restarted)};
}
