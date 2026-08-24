import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type CombatantId,
  type CoverSnapshot,
  type CoverStrikeSnapshot,
  type EnemySnapshot,
  type ImpactSnapshot,
  type ProjectileSnapshot,
  type RunSnapshot,
  type TankSnapshot,
  type ViewportLayout,
} from "./types";
import type { TankCosmeticId } from "../api/playerContext";

type TankPalette = { body: string; edge: string; dark: string };

export const PLAYER_COSMETICS: Record<TankCosmeticId, TankPalette> = {
  standard: { body: "#8c9d3d", edge: "#e7ff4f", dark: "#4e5b23" },
  "founder-meteor": {
    body: "#148f88",
    edge: "#ff7957",
    dark: "#075b59",
  },
};

const TEAM_COLORS: Record<CombatantId, TankPalette> = {
  player: PLAYER_COSMETICS.standard,
  enemy: { body: "#a6412d", edge: "#ff8b6f", dark: "#60251d" },
};

const ENEMY_COLORS: Record<
  EnemySnapshot["archetype"],
  { body: string; edge: string; dark: string }
> = {
  scout: { body: "#a84d2d", edge: "#ff9b54", dark: "#632918" },
  bruiser: TEAM_COLORS.enemy,
  hunter: { body: "#843f68", edge: "#f48bc7", dark: "#4e203c" },
  commander: { body: "#663f87", edge: "#cf96ff", dark: "#38214c" },
};

function drawArena(context: CanvasRenderingContext2D): void {
  context.fillStyle = "#151711";
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  context.fillStyle = "rgba(231, 255, 79, 0.025)";
  context.fillRect(0, WORLD_HEIGHT * 0.375, WORLD_WIDTH, WORLD_HEIGHT * 0.25);
  context.fillStyle = "rgba(255, 108, 74, 0.025)";
  context.fillRect(WORLD_WIDTH * 0.42, 0, WORLD_WIDTH * 0.16, WORLD_HEIGHT);

  context.strokeStyle = "rgba(229, 234, 194, 0.075)";
  context.lineWidth = 1;
  for (let x = 0; x <= WORLD_WIDTH; x += 60) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, WORLD_HEIGHT);
    context.stroke();
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += 60) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WORLD_WIDTH, y);
    context.stroke();
  }

  context.save();
  context.translate(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 35);
  context.rotate(-Math.PI / 36);
  context.textAlign = "center";
  context.fillStyle = "rgba(244, 241, 223, 0.035)";
  context.font = "900 126px Impact, sans-serif";
  context.fillText("TANKaVOID", 0, 0);
  context.fillStyle = "rgba(231, 255, 79, 0.055)";
  context.font = "700 14px ui-monospace, monospace";
  context.letterSpacing = "9px";
  context.fillText("ONE LINE / FIVE WAVES", 0, 38);
  context.restore();

  context.strokeStyle = "rgba(255, 108, 74, 0.22)";
  context.lineWidth = 2;
  context.setLineDash([14, 22]);
  context.beginPath();
  context.moveTo(0, WORLD_HEIGHT / 2);
  context.lineTo(WORLD_WIDTH, WORLD_HEIGHT / 2);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = "rgba(244, 241, 223, 0.22)";
  context.font = "700 10px ui-monospace, monospace";
  context.letterSpacing = "2px";
  context.fillText("SECTOR 01", 42, 74);
  context.fillText("SECTOR 02", WORLD_WIDTH - 114, 74);

  context.strokeStyle = "#e7ff4f";
  context.lineWidth = 5;
  context.setLineDash([24, 16]);
  context.strokeRect(16, 16, WORLD_WIDTH - 32, WORLD_HEIGHT - 32);
  context.setLineDash([]);

  context.fillStyle = "rgba(244, 241, 223, 0.34)";
  context.font = "600 12px ui-monospace, monospace";
  context.letterSpacing = "2px";
  context.fillText("FACE THE HIT / BREAK THE LINE", 42, WORLD_HEIGHT - 42);
}

function drawCover(
  context: CanvasRenderingContext2D,
  cover: CoverSnapshot,
): void {
  context.save();
  context.translate(cover.x, cover.y);
  context.fillStyle = "#26291f";
  context.strokeStyle = "#8c9d3d";
  context.lineWidth = 5;
  context.fillRect(0, 0, cover.width, cover.height);
  context.strokeRect(0, 0, cover.width, cover.height);
  context.fillStyle = "rgba(231, 255, 79, 0.08)";
  for (let x = 14; x < cover.width; x += 28)
    context.fillRect(x, 0, 8, cover.height);
  context.fillStyle = "rgba(244, 241, 223, 0.55)";
  context.font = "700 10px ui-monospace, monospace";
  context.fillText(cover.id.toUpperCase(), 12, cover.height - 12);
  context.restore();
}

function drawArmorGuide(
  context: CanvasRenderingContext2D,
  tank: TankSnapshot,
  colors: TankPalette,
): void {
  context.save();
  context.translate(tank.x, tank.y);
  context.rotate(tank.hullAngle);
  context.lineCap = "square";
  context.lineWidth = 7;

  context.strokeStyle = colors.edge;
  context.beginPath();
  context.moveTo(46, -21);
  context.lineTo(46, 21);
  context.stroke();

  context.strokeStyle = "#f4f1df";
  context.globalAlpha = 0.52;
  context.beginPath();
  context.moveTo(-24, -38);
  context.lineTo(24, -38);
  context.moveTo(-24, 38);
  context.lineTo(24, 38);
  context.stroke();

  context.strokeStyle = "#ff6c4a";
  context.globalAlpha = 0.9;
  context.beginPath();
  context.moveTo(-46, -21);
  context.lineTo(-46, 21);
  context.stroke();
  context.restore();
}

function drawTank(
  context: CanvasRenderingContext2D,
  tank: TankSnapshot,
  team: CombatantId,
  label = "YOU",
  enemyArchetype?: EnemySnapshot["archetype"],
  playerColors: TankPalette = PLAYER_COSMETICS.standard,
): void {
  const colors =
    team === "enemy" && enemyArchetype
      ? ENEMY_COLORS[enemyArchetype]
      : team === "player"
        ? playerColors
        : TEAM_COLORS[team];
  drawArmorGuide(context, tank, colors);

  context.save();
  context.translate(tank.x + 11, tank.y + 13);
  context.rotate(tank.hullAngle);
  context.globalAlpha = tank.disabled ? 0.18 : 0.36;
  context.fillStyle = "#000";
  context.beginPath();
  context.ellipse(0, 0, 48, 34, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.translate(tank.x, tank.y);
  context.rotate(tank.hullAngle);
  context.globalAlpha = tank.disabled ? 0.48 : 1;
  context.fillStyle = "#090b09";
  context.fillRect(-38, -31, 76, 12);
  context.fillRect(-38, 19, 76, 12);
  context.fillStyle = colors.body;
  context.strokeStyle = colors.edge;
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(-34, -24, 68, 48, 10);
  context.fill();
  context.stroke();
  context.fillStyle = colors.dark;
  context.fillRect(20, -19, 16, 38);
  context.fillStyle = "rgba(6, 8, 6, 0.68)";
  context.fillRect(-34, -24, 12, 48);
  context.restore();

  context.save();
  context.translate(tank.x, tank.y);
  context.rotate(tank.turretAngle);
  context.globalAlpha = tank.disabled ? 0.48 : 1;
  context.fillStyle = colors.edge;
  context.fillRect(0, -5, 58, 10);
  context.fillStyle = "#10130c";
  context.strokeStyle = colors.edge;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(0, 0, 20, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();

  const width = 92;
  const ratio = tank.maxHealth > 0 ? tank.health / tank.maxHealth : 0;
  context.fillStyle = "rgba(5, 6, 5, 0.8)";
  context.fillRect(tank.x - width / 2, tank.y - 58, width, 10);
  context.fillStyle = ratio > 0.35 ? colors.edge : "#ff6c4a";
  context.fillRect(tank.x - width / 2 + 2, tank.y - 56, (width - 4) * ratio, 6);
  context.fillStyle = "rgba(244, 241, 223, 0.72)";
  context.font = "700 10px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText(label, tank.x, tank.y - 65);
  context.textAlign = "start";
}

function drawProjectile(
  context: CanvasRenderingContext2D,
  projectile: ProjectileSnapshot,
  playerColors: TankPalette,
): void {
  const color =
    projectile.owner === "player"
      ? playerColors.edge
      : TEAM_COLORS[projectile.owner].edge;
  context.strokeStyle = color;
  context.fillStyle = "#f4f1df";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(
    projectile.position.x - projectile.direction.x * 18,
    projectile.position.y - projectile.direction.y * 18,
  );
  context.lineTo(projectile.position.x, projectile.position.y);
  context.stroke();
  context.beginPath();
  context.arc(projectile.position.x, projectile.position.y, 4, 0, Math.PI * 2);
  context.fill();
}

function drawImpact(
  context: CanvasRenderingContext2D,
  impact: ImpactSnapshot,
  age: number,
): void {
  if (age > 66) return;
  const progress = age / 66;
  const radius = 14 + progress * 38;
  const color =
    impact.outcome === "ricochet"
      ? "#e7ff4f"
      : impact.outcome === "glancing"
        ? "#ffbd5b"
        : "#ff6c4a";
  context.save();
  context.globalAlpha = Math.max(0.12, 1 - progress);
  context.translate(impact.point.x, impact.point.y);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = impact.outcome === "penetration" ? 7 : 4;

  if (impact.outcome === "ricochet") {
    context.rotate(-Math.PI / 5);
    context.beginPath();
    context.moveTo(-radius, 0);
    context.lineTo(radius, 0);
    context.moveTo(0, -radius);
    context.lineTo(0, radius);
    context.stroke();
  } else if (impact.outcome === "glancing") {
    context.beginPath();
    context.moveTo(-radius, radius * 0.6);
    context.lineTo(radius, -radius * 0.6);
    context.stroke();
  } else {
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, 5, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = Math.max(0.35, 1 - progress);
  context.font = "900 14px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText(
    impact.outcome === "ricochet"
      ? "RICOCHET"
      : impact.outcome === "glancing"
        ? `GLANCING / ${Math.round(impact.damage)}`
        : `PENETRATION / ${Math.round(impact.damage)}`,
    0,
    -radius - 12,
  );
  context.font = "700 10px ui-monospace, monospace";
  context.fillText(
    `${impact.face.toUpperCase()} · ${Math.round(impact.incidenceDegrees)}°`,
    0,
    radius + 20,
  );
  context.restore();
}

function drawCoverStrike(
  context: CanvasRenderingContext2D,
  strike: CoverStrikeSnapshot,
  age: number,
): void {
  if (age > 48) return;
  const progress = age / 48;
  const radius = 8 + progress * 26;
  context.save();
  context.translate(strike.point.x, strike.point.y);
  context.rotate(Math.PI / 4);
  context.globalAlpha = Math.max(0.1, 1 - progress);
  context.strokeStyle = TEAM_COLORS[strike.owner].edge;
  context.lineWidth = 5;
  context.strokeRect(-radius / 2, -radius / 2, radius, radius);
  context.restore();
}

function drawStage(
  context: CanvasRenderingContext2D,
  snapshot: RunSnapshot,
): void {
  if (snapshot.stage === "combat" || snapshot.phase === "briefing") return;
  context.save();
  context.fillStyle = "rgba(8, 10, 8, 0.5)";
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  context.textAlign = "center";
  context.fillStyle = snapshot.stage === "deploying" ? "#e7ff4f" : "#ff6c4a";
  context.font = "900 104px Impact, sans-serif";
  const title =
    snapshot.stage === "deploying"
      ? String(Math.max(1, Math.ceil(snapshot.stageTicksRemaining / 60)))
      : snapshot.stage === "wave-clear"
        ? `WAVE ${snapshot.wave} CLEAR`
        : snapshot.completionReason === "run-cleared"
          ? "FIVE WAVES CLEAR"
          : "HULL LOST";
  context.fillText(title, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
  context.fillStyle = "#f4f1df";
  context.font = "700 16px ui-monospace, monospace";
  context.fillText(
    snapshot.stage === "deploying"
      ? `WAVE ${snapshot.wave}/${snapshot.waveCount} · ${snapshot.waveTitle.toUpperCase()}`
      : snapshot.stage === "wave-clear"
        ? "FIELD REPAIR / NEXT LINE FORMING"
        : "IMPACT CONFIRMED / RESULT LOCKING",
    WORLD_WIDTH / 2,
    WORLD_HEIGHT / 2 + 46,
  );
  context.textAlign = "start";
  context.restore();
}

export class TankRenderer {
  private playerCosmetic: TankCosmeticId = "standard";

  constructor(private readonly context: CanvasRenderingContext2D) {}

  setPlayerCosmetic(cosmetic: TankCosmeticId): void {
    this.playerCosmetic = cosmetic;
  }

  render(snapshot: RunSnapshot, layout: ViewportLayout): number {
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = "#080a08";
    context.fillRect(0, 0, layout.bitmapWidth, layout.bitmapHeight);
    context.setTransform(
      layout.scale * layout.dpr,
      0,
      0,
      layout.scale * layout.dpr,
      layout.offsetX * layout.dpr,
      layout.offsetY * layout.dpr,
    );
    drawArena(context);
    for (const cover of snapshot.cover) drawCover(context, cover);
    const playerColors = PLAYER_COSMETICS[this.playerCosmetic];
    for (const projectile of snapshot.projectiles)
      drawProjectile(context, projectile, playerColors);
    drawTank(context, snapshot.tank, "player", "YOU", undefined, playerColors);
    for (const enemy of snapshot.enemies)
      drawTank(
        context,
        enemy,
        "enemy",
        `${enemy.label} / W${snapshot.wave}`,
        enemy.archetype,
      );
    for (const impact of snapshot.impacts)
      drawImpact(context, impact, snapshot.tick - impact.tick);
    for (const strike of snapshot.coverStrikes)
      drawCoverStrike(context, strike, snapshot.tick - strike.tick);
    drawStage(context, snapshot);
    return (
      1 +
      snapshot.cover.length +
      snapshot.projectiles.length +
      1 +
      snapshot.enemies.length +
      snapshot.impacts.length +
      snapshot.coverStrikes.length +
      (snapshot.stage === "combat" || snapshot.phase === "briefing" ? 0 : 1)
    );
  }
}
