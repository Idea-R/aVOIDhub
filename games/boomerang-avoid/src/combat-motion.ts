import * as THREE from "three";
import {
  RULES,
  type MatchState,
  type Player,
  type GameEvent,
} from "@avoid/boomerangavoid-sim";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
export type SlashStage = "none" | "windup" | "active" | "recovery";
/** Presentation reads the same half-open tick intervals as slashActive(). */
export function slashPresentation(player: Player, tick: number) {
  const start = player.slashStart - RULES.slashWindup,
    end = player.slashUntil;
  let stage: SlashStage = "none",
    progress = 0,
    clipProgress = 0;
  if (
    player.slashCooldown > 0 &&
    tick >= start &&
    tick < player.slashCooldown
  ) {
    if (tick < player.slashStart) {
      stage = "windup";
      progress = clamp((tick - start) / RULES.slashWindup);
      clipProgress = progress * 0.38;
    } else if (tick < end) {
      stage = "active";
      progress = clamp(
        (tick - player.slashStart) / Math.max(1, end - player.slashStart),
      );
      clipProgress = 0.38 + progress * 0.38;
    } else {
      stage = "recovery";
      progress = clamp((tick - end) / Math.max(1, player.slashCooldown - end));
      clipProgress = 0.76 + progress * 0.24;
    }
  }
  const t = ease(progress);
  const angle =
    stage === "windup"
      ? 0.45 - 1.6 * t
      : stage === "active"
        ? -1.15 + 2.3 * t
        : stage === "recovery"
          ? 1.15 - 0.7 * t
          : 0.45;
  const reach =
    stage === "windup"
      ? 0.57 + 0.33 * t
      : stage === "active"
        ? 0.9
        : stage === "recovery"
          ? 0.9 - 0.33 * t
          : 0.57;
  const height =
    stage === "windup"
      ? 0.68 + 0.1 * t
      : stage === "active"
        ? 0.78 + Math.sin(progress * Math.PI) * 0.12
        : stage === "recovery"
          ? 0.78 - 0.1 * t
          : 0.68;
  return {
    stage,
    progress,
    clipProgress,
    angle,
    reach,
    height,
    active: stage === "active",
  };
}

export interface MotionFrame {
  motion: string;
  clip: string;
  key: string;
  loop: boolean;
  progress?: number;
  rate?: number;
  result: "winner" | "loser" | null;
  deathProgress: number;
  spawnProgress: number;
}
/** Actor-local presentation memory. No simulation object or RNG is changed. */
export class CombatMotion {
  private epoch = "";
  private lastTick = -1;
  private alive: boolean | undefined;
  private moving = false;
  private deathAt = 0;
  private spawnAt = -Infinity;
  private stopAt = -Infinity;
  private resultAt = 0;
  private resultKey = "";
  sample(
    state: MatchState,
    player: Player,
    events: readonly GameEvent[],
    now: number,
  ): MotionFrame {
    const epoch = `${state.config.seed}:${state.round}`;
    if (epoch !== this.epoch || state.tick < this.lastTick) {
      this.epoch = epoch;
      this.alive = undefined;
      this.moving = false;
      this.spawnAt = -Infinity;
      this.stopAt = -Infinity;
      this.resultKey = "";
    }
    this.lastTick = state.tick;
    if (!player.alive && this.alive !== false) this.deathAt = now;
    if (
      player.alive &&
      (this.alive === false ||
        (this.alive === undefined && state.phase === "countdown"))
    )
      this.spawnAt = now;
    this.alive = player.alive;
    const deathProgress = clamp((now - this.deathAt) / 0.8),
      spawnProgress = clamp((now - this.spawnAt) / 0.36);
    const frame = (
      motion: string,
      clip = motion,
      key = motion,
      progress?: number,
      loop = false,
      rate = 1,
    ): MotionFrame => ({
      motion,
      clip,
      key: `${epoch}:${key}`,
      loop,
      progress,
      rate,
      result: null,
      deathProgress,
      spawnProgress,
    });
    if (!player.alive)
      return frame(
        "elimination",
        "elimination",
        `death:${this.deathAt}`,
        deathProgress,
      );
    if (state.phase === "matchResults" || state.phase === "roundResults") {
      const resultKey = `${state.phase}:${state.phaseUntil}`;
      if (this.resultKey !== resultKey) {
        this.resultKey = resultKey;
        this.resultAt = now;
      }
      const winners =
        state.phase === "matchResults" ? state.matchWinnerIds : state.winnerIds;
      const winner = winners.includes(player.id);
      const result = winner
        ? frame(
            "victory",
            "victory",
            resultKey,
            clamp((now - this.resultAt) / 2),
          )
        : frame("defeat", "hit", resultKey, 0.62);
      result.result = winner ? "winner" : "loser";
      return result;
    }
    this.resultKey = "";
    const speed = Math.hypot(player.vx, player.vy),
      moving = speed > 0.3;
    if (this.moving && !moving) this.stopAt = now;
    this.moving = moving;
    if (player.dashUntil > state.tick)
      return frame(
        "dash",
        "dash",
        `dash:${player.dashUntil}`,
        clamp(
          (state.tick - player.dashUntil + RULES.dashTicks) / RULES.dashTicks,
        ),
      );
    const slash = slashPresentation(player, state.tick);
    if (slash.stage !== "none")
      return frame(
        "slash",
        "slash",
        `slash:${player.slashStart}`,
        slash.clipProgress,
      );
    const moment = [...events]
      .reverse()
      .find(
        (event) =>
          event.tick <= state.tick &&
          state.tick - event.tick < 14 &&
          (((event.type === "shield" || event.type === "shoveHit") &&
            event.target === player.id) ||
            (event.type === "catch" && event.actor === player.id)),
      );
    if (moment) {
      const motion = moment.type === "catch" ? "catch" : "hit";
      return frame(
        motion,
        motion,
        `${motion}:${moment.id}`,
        clamp((state.tick - moment.tick) / 14),
      );
    }
    const throwStart = player.throwAt - RULES.throwWindup;
    if (
      player.throwAt > 0 &&
      state.tick >= throwStart &&
      state.tick < player.throwAt + 12
    ) {
      const progress =
        state.tick < player.throwAt
          ? 0.38 * clamp((state.tick - throwStart) / RULES.throwWindup)
          : 0.38 + 0.62 * clamp((state.tick - player.throwAt) / 12);
      return frame("throw", "throw", `throw:${player.throwAt}`, progress);
    }
    if (spawnProgress < 1)
      return frame("spawn", "spawn", `spawn:${this.spawnAt}`, spawnProgress);
    if (
      state.weapons.some(
        (w) => w.ownerId === player.id && w.phase === "returning",
      )
    )
      return frame("recall_strain", "recall_strain", "recall", undefined, true);
    if (!moving && now - this.stopAt < 0.2)
      return frame(
        "stop_turn",
        "stop_turn",
        `stop:${this.stopAt}`,
        clamp((now - this.stopAt) / 0.2),
      );
    return moving
      ? frame(
          "run",
          "run",
          "run",
          undefined,
          true,
          0.65 + clamp(speed / RULES.runSpeed) * 0.8,
        )
      : frame("idle", "idle", "idle", undefined, true);
  }
}

/** One AnimationMixer per original rig; one-shot identity includes authoritative
 * action ticks/event IDs so adjacent identical actions still retrigger once. */
export class CharacterAnimation {
  readonly mixer: THREE.AnimationMixer;
  readonly actions: Record<string, THREE.AnimationAction>;
  private current: THREE.AnimationAction | undefined;
  private key = "";
  transitions = 0;
  constructor(
    readonly model: THREE.Object3D,
    clips: THREE.AnimationClip[],
  ) {
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = Object.fromEntries(
      clips.map((clip) => [clip.name, this.mixer.clipAction(clip)]),
    );
  }
  update(frame: MotionFrame, dt: number, reducedMotion: boolean) {
    const next = this.actions[frame.clip] || this.actions.idle;
    if (!next) return;
    if (this.key !== frame.key || next !== this.current) {
      const previous = this.current;
      next
        .reset()
        .stopFading()
        .setEffectiveWeight(1)
        .setLoop(
          frame.loop ? THREE.LoopRepeat : THREE.LoopOnce,
          frame.loop ? Infinity : 1,
        );
      next.clampWhenFinished = !frame.loop;
      next.play();
      if (previous && previous !== next)
        next.crossFadeFrom(previous, reducedMotion ? 0.035 : 0.065, false);
      this.current = next;
      this.key = frame.key;
      this.transitions++;
    }
    let progress = frame.progress;
    if (reducedMotion && frame.motion === "victory") progress = 0.35;
    if (reducedMotion && frame.motion === "spawn") progress = 1;
    next.setEffectiveTimeScale(
      frame.loop ? (frame.rate || 1) * (reducedMotion ? 0.6 : 1) : 0,
    );
    if (progress !== undefined)
      next.time = clamp(progress) * next.getClip().duration;
    this.mixer.update(Math.max(0, Math.min(dt, 0.1)));
    for (const action of Object.values(this.actions))
      if (
        action !== next &&
        action.isScheduled() &&
        action.getEffectiveWeight() <= 0.0001
      )
        action.stop();
  }
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
  }
}
