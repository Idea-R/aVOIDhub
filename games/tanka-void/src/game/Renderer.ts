import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type RunSnapshot,
  type ViewportLayout,
} from "./types";

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
}

function drawBeacon(
  context: CanvasRenderingContext2D,
  snapshot: RunSnapshot,
): void {
  const radius = 26 + Math.sin(snapshot.tick / 24) * 4;
  context.save();
  context.translate(snapshot.beacon.x, snapshot.beacon.y);
  context.strokeStyle = "#ff6c4a";
  context.fillStyle = "rgba(255, 108, 74, 0.12)";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(-40, 0);
  context.lineTo(40, 0);
  context.moveTo(0, -40);
  context.lineTo(0, 40);
  context.stroke();
  context.restore();
}

function drawTank(
  context: CanvasRenderingContext2D,
  snapshot: RunSnapshot,
): void {
  const tank = snapshot.tank;
  context.save();
  context.translate(tank.x, tank.y);
  context.rotate(tank.hullAngle);
  context.fillStyle = "#090b09";
  context.fillRect(-38, -31, 76, 12);
  context.fillRect(-38, 19, 76, 12);
  context.fillStyle = "#8c9d3d";
  context.strokeStyle = "#e7ff4f";
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(-34, -24, 68, 48, 10);
  context.fill();
  context.stroke();
  context.fillStyle = "#4e5b23";
  context.fillRect(20, -19, 16, 38);
  context.restore();

  context.save();
  context.translate(tank.x, tank.y);
  context.rotate(tank.turretAngle);
  context.fillStyle = "#dce87f";
  context.fillRect(0, -5, 58, 10);
  context.fillStyle = "#10130c";
  context.strokeStyle = "#f5ffd4";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(0, 0, 20, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

export class TankRenderer {
  constructor(private readonly context: CanvasRenderingContext2D) {}

  render(snapshot: RunSnapshot, layout: ViewportLayout): void {
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
    drawBeacon(context, snapshot);
    drawTank(context, snapshot);
  }
}
