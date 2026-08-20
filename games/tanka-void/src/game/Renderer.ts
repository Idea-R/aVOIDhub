import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type CombatantId,
  type CoverSnapshot,
  type CoverStrikeSnapshot,
  type ImpactSnapshot,
  type ProjectileSnapshot,
  type RunSnapshot,
  type TankSnapshot,
  type ViewportLayout,
} from "./types";

const TEAM_COLORS: Record<
  CombatantId,
  { body: string; edge: string; dark: string }
> = {
  player: { body: "#8c9d3d", edge: "#e7ff4f", dark: "#4e5b23" },
  enemy: { body: "#a6412d", edge: "#ff8b6f", dark: "#60251d" },
};

function drawArena(context: CanvasRenderingContext2D): void {
  context.fillStyle = "#151711";
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

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
): void {
  context.save();
  context.translate(tank.x, tank.y);
  context.rotate(tank.hullAngle);
  context.lineCap = "square";
  context.lineWidth = 7;

  context.strokeStyle = "#e7ff4f";
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
): void {
  const colors = TEAM_COLORS[team];
  drawArmorGuide(context, tank);

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
  context.fillText(
    team === "player" ? "YOU" : "BRUISER / T3",
    tank.x,
    tank.y - 65,
  );
  context.textAlign = "start";
}

function drawProjectile(
  context: CanvasRenderingContext2D,
  projectile: ProjectileSnapshot,
): void {
  const color = TEAM_COLORS[projectile.owner].edge;
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
      : snapshot.completionReason === "enemy-disabled"
        ? "LINE BROKEN"
        : "HULL LOST";
  context.fillText(title, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
  context.fillStyle = "#f4f1df";
  context.font = "700 16px ui-monospace, monospace";
  context.fillText(
    snapshot.stage === "deploying"
      ? "HOLD / SYSTEMS ARMING"
      : "IMPACT CONFIRMED / RESULT LOCKING",
    WORLD_WIDTH / 2,
    WORLD_HEIGHT / 2 + 46,
  );
  context.textAlign = "start";
  context.restore();
}

export class TankRenderer {
  constructor(private readonly context: CanvasRenderingContext2D) {}

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
    for (const projectile of snapshot.projectiles)
      drawProjectile(context, projectile);
    drawTank(context, snapshot.tank, "player");
    drawTank(context, snapshot.enemy, "enemy");
    for (const impact of snapshot.impacts)
      drawImpact(context, impact, snapshot.tick - impact.tick);
    for (const strike of snapshot.coverStrikes)
      drawCoverStrike(context, strike, snapshot.tick - strike.tick);
    drawStage(context, snapshot);
    return (
      1 +
      snapshot.cover.length +
      snapshot.projectiles.length +
      2 +
      snapshot.impacts.length +
      snapshot.coverStrikes.length +
      (snapshot.stage === "combat" || snapshot.phase === "briefing" ? 0 : 1)
    );
  }
}
