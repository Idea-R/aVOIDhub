import * as THREE from "three";
import type { Arena, Obstacle } from "@avoid/boomerangavoid-sim";

export type EnvironmentDetail = "full" | "low";
type Palette = { stone: number; dark: number; body: number; trim: number; leaf: number; light: number };
type Point = [number, number, number];
const PALETTES: Record<string, Palette> = {
  "moss-court": { stone: 0x667a68, dark: 0x374d42, body: 0x8c765b, trim: 0xc8ba89, leaf: 0x799e66, light: 0xe3d493 },
  "kiln-courtyard": { stone: 0x997660, dark: 0x573b3a, body: 0xc78468, trim: 0xebbb8e, leaf: 0x858d61, light: 0xffd382 },
  "tideglass-steps": { stone: 0x72989c, dark: 0x365b6d, body: 0x8db7ac, trim: 0xc6d8b9, leaf: 0x639b91, light: 0xd6ecda },
  "windbell-garden": { stone: 0x829578, dark: 0x4a6a62, body: 0xb6b583, trim: 0xd7c799, leaf: 0x8fb986, light: 0xe9b8ad },
  moonwell: { stone: 0x9294af, dark: 0x4b4d72, body: 0xb8abc7, trim: 0xd2c7dd, leaf: 0x8d9f9c, light: 0xf1dfac },
  "lantern-foundry": { stone: 0x84726d, dark: 0x424e52, body: 0xb98a63, trim: 0xe1b681, leaf: 0x8eab9a, light: 0xf6d18e },
  "reedwater-crossing": { stone:0x628f85,dark:0x234c50,body:0x80b0a1,trim:0xc1d7a5,leaf:0x70b98d,light:0xd8edc1 },
  "copperleaf-locks": { stone:0x937460,dark:0x4f3e39,body:0xb67b4c,trim:0xe4b875,leaf:0xb49a63,light:0xffda91 },
};

/** Static, opaque, single-material parts. GardenRenderer.mergeStatic bakes their colors. */
class Kit {
  constructor(readonly parent: THREE.Group, readonly palette: Palette) {}
  mesh(geometry: THREE.BufferGeometry, color: number, position: Point = [0, 0, 0], scale: Point = [1, 1, 1], rotation: Point = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.02 }));
    mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.decorative = true;
    this.parent.add(mesh);
    return mesh;
  }
  box(size: Point, position: Point, color: number, rotation: Point = [0, 0, 0]) {
    return this.mesh(new THREE.BoxGeometry(...size), color, position, [1, 1, 1], rotation);
  }
  stone(position: Point, scale: Point, color = this.palette.stone, seed = 0) {
    return this.mesh(new THREE.DodecahedronGeometry(1, 0), color, position, scale, [seed * .07, seed * .83, seed * .06]);
  }
  orb(position: Point, scale: Point, color: number) {
    return this.mesh(new THREE.SphereGeometry(1, 10, 6), color, position, scale);
  }
  cylinder(top: number, bottom: number, height: number, position: Point, color: number, segments = 10) {
    return this.mesh(new THREE.CylinderGeometry(top, bottom, height, segments), color, position);
  }
  ring(radius: number, tube: number, position: Point, color: number, rotation: Point = [Math.PI / 2, 0, 0], arc = Math.PI * 2) {
    return this.mesh(new THREE.TorusGeometry(radius, tube, 5, 18, arc), color, position, [1, 1, 1], rotation);
  }
  stem(points: Point[], radius: number, color: number) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    return this.mesh(new THREE.TubeGeometry(curve, Math.max(4, points.length * 3), radius, 5, false), color);
  }
  leaf(start: Point, end: Point, width: number, color: number, bend = .08) {
    const from = new THREE.Vector3(...start), axis = new THREE.Vector3(...end).sub(from);
    const across = new THREE.Vector3(axis.y, -axis.x, 0).normalize();
    if (across.lengthSq() < .1) across.set(1, 0, 0);
    const vertices: number[] = [], indices: number[] = [];
    // Closed lens ribbon, with a raised midrib and a curved silhouette.
    for (let side = 0; side < 2; side++) for (let step = 0; step <= 5; step++) {
      const t = step / 5, swell = Math.sin(t * Math.PI), center = from.clone().addScaledVector(axis, t);
      center.z += swell * bend + side * .025;
      for (let col = -1; col <= 1; col++) {
        const vertex = center.clone().addScaledVector(across, col * width * swell);
        if (col === 0) vertex.z -= swell * .055;
        vertices.push(vertex.x, vertex.y, vertex.z);
      }
    }
    for (let side = 0; side < 2; side++) for (let row = 0; row < 5; row++) for (let col = 0; col < 2; col++) {
      const a = side * 18 + row * 3 + col, b = a + 1, c = a + 4, d = a + 3;
      indices.push(...(side ? [a, c, b, a, d, c] : [a, b, c, a, c, d]));
    }
    for (let row = 0; row < 5; row++) for (const col of [0, 2]) {
      const a = row * 3 + col, b = a + 3; indices.push(a, b, b + 18, a, b + 18, a + 18);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return this.mesh(geometry, color);
  }
}

function mushroom(k: Kit, x: number, y: number, z: number, size: number) {
  k.cylinder(size * .12, size * .16, size * .7, [x, y + size * .35, z], k.palette.trim, 7);
  k.mesh(new THREE.SphereGeometry(size * .43, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    k.palette.light, [x, y + size * .66, z], [1, .63, 1]);
}

function mossStump(k: Kit, hero: boolean) {
  const p = k.palette, height = hero ? 1.35 : .65;
  k.cylinder(.40, .58, height, [0, height / 2, 0], p.body, 9);
  k.cylinder(.39, .41, .08, [0, height, 0], p.trim, 9);
  k.ring(.24, .017, [0, height + .047, 0], p.body);
  k.ring(.12, .014, [0, height + .049, 0], p.body);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    k.stem([[Math.cos(angle) * .34, .3, Math.sin(angle) * .34], [Math.cos(angle) * .55, .12, Math.sin(angle) * .55], [Math.cos(angle) * .76, .06, Math.sin(angle) * .76]], .075, p.body);
  }
  for (let i = 0; i < 3; i++) k.orb([-.26 + i * .21, height + .04, -.14], [.23, .09, .22], p.leaf);
  mushroom(k, .34, height + .03, .12, hero ? .55 : .36);
  mushroom(k, -.62, .05, .22, .34);
  if (hero) {
    k.stem([[-.32, height - .2, 0], [-.50, height + .30, -.03], [-.75, height + .43, -.04]], .07, p.body);
    k.leaf([-.48, height + .23, -.03], [-.12, height + .61, -.02], .12, p.leaf);
  }
}

function pottery(k: Kit, hero: boolean) {
  const p = k.palette, scale = hero ? 1 : .65;
  const profile = [[0, 0], [.62, 0], [.66, .25], [.64, .65], [.52, 1], [.3, 1.23], [0, 1.27]];
  k.mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x * scale, y * scale)), 12), p.body);
  k.ring(.62 * scale, .065 * scale, [0, .10 * scale, 0], p.trim);
  const doorway = new THREE.Shape();
  doorway.moveTo(-.25, 0); doorway.lineTo(.25, 0); doorway.lineTo(.25, .30);
  doorway.absarc(0, .30, .25, 0, Math.PI, false); doorway.closePath();
  k.mesh(new THREE.ShapeGeometry(doorway, 8), p.dark, [0, .12 * scale, .625 * scale], [scale, scale, scale]);
  k.ring(.28 * scale, .055 * scale, [0, .42 * scale, .65 * scale], p.trim, [0, 0, 0], Math.PI);
  k.box([.42 * scale, .06 * scale, .10 * scale], [0, .15 * scale, .65 * scale], p.light);
  k.cylinder(.12 * scale, .15 * scale, .45 * scale, [.23 * scale, 1.24 * scale, 0], p.body, 8);
  k.ring(.15 * scale, .035 * scale, [.23 * scale, 1.47 * scale, 0], p.trim);
  if (hero) {
    k.cylinder(.19, .13, .38, [.76, .20, .10], p.trim, 9);
    k.cylinder(.145, .145, .025, [.76, .40, .10], p.dark, 9);
    k.ring(.18, .035, [.76, .41, .10], p.body);
    k.box([.22, .06, .34], [-.72, .06, .16], p.trim, [0, .2, 0]);
    k.box([.22, .06, .34], [-.70, .12, .16], p.trim, [0, -.12, 0]);
  }
}

function reeds(k: Kit, hero: boolean) {
  const p = k.palette;
  k.stone([0, .04, 0], [.70, .15, .49], p.stone, 1);
  k.stone([.47, .08, .20], [.29, .22, .35], p.trim, 2);
  const count = hero ? 5 : 3;
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * .20, height = (hero ? 1.5 : .65) + .15 * Math.sin(i * 3.1);
    k.stem([[x, .1, -.08], [x * 1.1, height * .6, -.11], [x * 1.35 + .10, height, -.06]], .025, p.leaf);
    k.orb([x * 1.35 + .10, height, -.06], [.07, .18, .07], p.trim);
    k.leaf([x, .22, -.08], [x - .22, height * .7, -.03], .075, p.leaf);
  }
  k.ring(.28, .018, [-.12, .16, .09], p.light, [Math.PI / 2, 0, 0], Math.PI * 1.35);
  if (hero) k.mesh(new THREE.ConeGeometry(.16, .40, 5), p.light, [-.50, .29, .24], [1, 1, 1], [0, .2, -.2]);
}

function bell(k: Kit, x: number, y: number, z: number, size: number) {
  const p = k.palette;
  k.stem([[x, y + .25, z], [x, y, z]], .014, p.dark);
  const profile = [[.03, .1], [.13, .07], [.14, -.1], [.22, -.22], [.23, -.24]];
  k.mesh(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r * size, h * size)), 10), p.trim, [x, y, z]);
  k.orb([x, y - .22 * size, z], [.055 * size, .07 * size, .055 * size], p.dark);
  k.leaf([x, y - .28 * size, z], [x + .10, y - .58 * size, z], .07 * size, p.light);
}

function windStand(k: Kit, hero: boolean) {
  const p = k.palette;
  if (hero) {
    k.stone([-.57, .05, 0], [.27, .15, .24]); k.stone([.57, .05, 0], [.27, .15, .24]);
    k.stem([[-.58, .05, 0], [-.55, 1.25, 0], [-.35, 1.87, 0], [.35, 1.87, 0], [.55, 1.25, 0], [.58, .05, 0]], .065, p.body);
    for (const [x, y, size] of [[-.32, 1.48, .8], [0, 1.27, 1], [.32, 1.52, .72]]) bell(k, x, y, 0, size);
  } else {
    k.stem([[0, 0, 0], [-.10, .6, 0], [.15, .95, 0]], .04, p.body);
    bell(k, .15, .70, 0, .65);
  }
  for (const side of [-1, 1]) {
    k.leaf([side * .4, .05, .04], [side * .73, .56, .03], .13, p.leaf);
    k.leaf([side * .4, .05, .04], [side * .23, .41, .10], .12, p.leaf);
  }
}

function moonStone(k: Kit, hero: boolean) {
  const p = k.palette;
  if (hero) {
    for (const x of [-.58, .58]) {
      k.cylinder(.12, .18, .75, [x, .38, 0], p.stone, 7);
      k.cylinder(.23, .24, .10, [x, .06, 0], p.trim, 7);
    }
    k.ring(.58, .12, [0, .75, 0], p.body, [0, 0, 0], Math.PI);
    k.ring(.58, .025, [0, .75, .12], p.trim, [0, 0, 0], Math.PI);
    k.mesh(new THREE.OctahedronGeometry(.17, 0), p.light, [0, 1.34, 0], [1, 1.45, .55]);
    k.stone([0, .03, 0], [.82, .11, .4], p.dark, 2);
  } else {
    k.stone([0, .21, 0], [.50, .37, .32], p.stone, 3);
    k.ring(.16, .025, [0, .28, .30], p.light, [0, 0, .45], Math.PI * 1.45);
    k.stone([.45, .08, .08], [.23, .17, .28], p.body, 2);
  }
  for (let i = 0; i < 3; i++) k.box([.035, .10, .025], [-.16 + i * .16, .24, .29], p.trim, [0, 0, (i - 1) * .45]);
}

function machine(k: Kit, hero: boolean) {
  const p = k.palette;
  k.box([1.05, .12, .65], [0, .08, 0], p.dark);
  k.cylinder(.29, .35, hero ? .88 : .48, [-.16, hero ? .55 : .35, 0], p.body, 10);
  k.ring(.32, .045, [-.16, hero ? .96 : .58, 0], p.trim);
  k.box([.47, .32, .42], [.38, .30, .05], p.stone);
  const center: Point = [.38, .37, .285];
  k.ring(.19, .06, center, p.trim, [0, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    k.box([.12, .09, .07], [center[0] + Math.cos(a) * .235, center[1] + Math.sin(a) * .235, center[2]], p.trim, [0, 0, a]);
  }
  k.orb([.38, .37, .30], [.07, .07, .04], p.dark);
  if (hero) {
    k.stem([[-.35, .85, -.08], [-.35, 1.53, -.08], [.10, 1.67, -.08], [.43, 1.49, -.08]], .055, p.dark);
    k.cylinder(.18, .22, .25, [.43, 1.27, -.08], p.light, 8);
    k.cylinder(.24, .27, .07, [.43, 1.44, -.08], p.body, 8);
    k.cylinder(.24, .20, .07, [.43, 1.10, -.08], p.dark, 8);
    for (const side of [-1, 1]) k.box([.025, .32, .025], [.43 + side * .17, 1.27, -.08], p.dark);
  }
}

const BUILDERS: Record<string, (kit: Kit, hero: boolean) => void> = {
  "moss-court": mossStump, "kiln-courtyard": pottery, "tideglass-steps": reeds,
  "windbell-garden": windStand, moonwell: moonStone, "lantern-foundry": machine,
  "reedwater-crossing":reeds,"copperleaf-locks":machine,
};

function stableSeed(text: string) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return (value >>> 0) / 4294967296;
}

/** Adds an original biome diorama outside the playable floor. Call before mergeStatic. */
export function addEnvironmentKit(arena: Arena, parent: THREE.Group, detail: EnvironmentDetail = "full"): void {
  const root = new THREE.Group(); root.name = "environment-kit";
  root.userData.decorative = true; root.userData.environmentKit = { arenaId: arena.id, detail };
  parent.add(root);
  const palette = PALETTES[arena.id] ?? PALETTES["moss-court"], build = BUILDERS[arena.id] ?? mossStump;
  const seed = stableSeed(arena.id), halfW = arena.width / 2, halfH = arena.height / 2;
  const anchors: Array<{ x: number; z: number; hero: boolean; edge: "back" | "left" | "right" }> = [
    { x: -halfW * .62, z: -halfH - 1.05, hero: true, edge: "back" },
    { x: halfW * .62, z: -halfH - 1.05, hero: true, edge: "back" },
    { x: -halfW - 1.05, z: -halfH * .35, hero: false, edge: "left" },
    { x: halfW + 1.05, z: -halfH * .35, hero: false, edge: "right" },
  ];
  if (detail === "full") anchors.push(
    { x: -halfW - 1.02, z: halfH * .40, hero: false, edge: "left" },
    { x: halfW + 1.02, z: halfH * .40, hero: false, edge: "right" },
    { x: 0, z: -halfH - 1.05, hero: false, edge: "back" },
  );
  anchors.forEach((anchor, index) => {
    const group = new THREE.Group(); group.name = `perimeter-${anchor.edge}-${index}`;
    group.position.set(anchor.x, 0, anchor.z);
    group.rotation.y = (seed - .5) * .26 + (index % 2 ? -.11 : .11);
    group.userData.decorative = true; group.userData.environmentAnchor = anchor.edge;
    root.add(group); const kit = new Kit(group, palette);
    kit.stone([0, -.24, 0], [.95, .28, .73], palette.stone, index);
    build(kit, anchor.hero);
    group.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(group);
    // Keep complete prop bounds at least 0.28 m outside the actual floor, even for edited studio arenas.
    // Parent is the renderer's untransformed island group.
    if (anchor.edge === "left") group.position.x -= Math.max(0, bounds.max.x + halfW + .28);
    if (anchor.edge === "right") group.position.x += Math.max(0, halfW + .28 - bounds.min.x);
    if (anchor.edge === "back") group.position.z -= Math.max(0, bounds.max.z + halfH + .28);
  });
  // Low silhouettes below the deck give the island a sculpted edge without foreground occlusion.
  const edgeKit = new Kit(root, palette), count = detail === "full" ? 12 : 6;
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count, x = (t - .5) * arena.width * .93;
    edgeKit.stone([x, -.74 - .12 * Math.sin(i * 2.3), halfH + .15], [.62, .37, .36], i % 3 ? palette.stone : palette.dark, i);
  }
}

/** Adds surface detail within an existing collision rectangle. Parent is obstacle-local. */
export function decorateObstacle(obstacle: Obstacle, parent: THREE.Group, arenaId = ""): void {
  if (obstacle.kind === "shutter") return; // Dynamic shutters retain their authoritative visibility.
  const group = new THREE.Group(); group.name = `obstacle-dressing-${obstacle.id}`;
  group.userData.decorative = true; group.userData.obstacleDressing = obstacle.id;
  parent.add(group);
  const p = PALETTES[arenaId] ?? PALETTES["moss-court"], k = new Kit(group, p);
  const top = obstacle.height || 1;
  if (obstacle.kind === "kiln") {
    k.ring(.34, .05, [0, top + .11, 0], p.trim);
    k.cylinder(.19, .21, .30, [.24, top + .18, -.30], p.body, 8);
    k.cylinder(.14, .14, .025, [.24, top + .34, -.30], p.dark, 8);
    for (const x of [-.29, .29]) k.box([.06, .30, .06], [x, top * .4, .42], p.trim);
  } else if (obstacle.kind === "pillar" || arenaId === "moonwell") {
    k.ring(.48, .075, [0, top + .11, 0], p.body);
    k.ring(.31, .025, [0, top + .14, 0], p.light);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      k.box([.06, .025, .13], [Math.cos(a) * .44, top + .18, Math.sin(a) * .44], p.light, [0, -a, 0]);
    }
  } else {
    for (let i = 0; i < 3; i++) k.orb([-.24 + i * .23, top + .055, -.12], [.25, .095, .20], i % 2 ? p.body : p.leaf);
    mushroom(k, .26, top, .20, .27);
    k.leaf([-.28, top, .16], [-.40, top + .25, .13], .07, p.leaf);
  }
  group.updateMatrixWorld(true);
  const inverse = parent.matrixWorld.clone().invert(), bounds = new THREE.Box3();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) bounds.union(object.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld)));
  });
  const spanX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)) * 2;
  const spanZ = Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)) * 2;
  group.scale.x *= Math.min(1, obstacle.w * .90 / Math.max(spanX, .001));
  group.scale.z *= Math.min(1, obstacle.h * .90 / Math.max(spanZ, .001));
}
