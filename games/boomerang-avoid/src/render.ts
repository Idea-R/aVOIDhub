import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  ARENAS,
  type Arena,
  type MatchState,
  type Player,
  type CharacterId,
} from "@avoid/boomerangavoid-sim";
import type { Preferences } from "./input";
type Particle = {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
};
const material = (color: number, roughness = 0.8) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
const colors = {
  cream: 0xffedc5,
  dark: 0x18363a,
  coral: 0xf58c72,
  mint: 0xa6d7a5,
  gold: 0xf9cf79,
};
export class GardenRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera();
  private island = new THREE.Group();
  private actors = new Map<string, THREE.Group>();
  private weapons = new Map<string, THREE.Group>();
  private collectibles = new THREE.Group();
  private collectibleKey = "";
  private particles: Particle[] = [];
  private stars = new THREE.Group();
  private arena: Arena | null = null;
  private seenEvents = new Set<string>();
  private lastPhase = "";
  private time = 0;
  private menu = true;
  private relay = new THREE.Group();
  private hazards: THREE.Group[] = [];
  private targets = new THREE.Group();
  private closing = new THREE.Group();
  readonly metrics = {
    frames: 0,
    drawCalls: 0,
    triangles: 0,
    dpr: 1,
    frameMs: 0,
  };
  constructor(
    canvas: HTMLCanvasElement,
    private preferences: Preferences,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.17;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(0x15383c);
    this.scene.fog = new THREE.FogExp2(0x15383c, 0.012);
    this.scene.add(new THREE.HemisphereLight(0xffecd4, 0x678883, 2.6));
    const sun = new THREE.DirectionalLight(0xffe4b3, 4);
    sun.position.set(-8, 18, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -18,
      right: 18,
      top: 18,
      bottom: -18,
      near: 0.5,
      far: 60,
    });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9cdbd4, 1.4);
    fill.position.set(10, 7, -12);
    this.scene.add(fill);
    this.scene.add(
      this.island,
      this.collectibles,
      this.relay,
      this.stars,
      this.targets,
      this.closing,
    );
    const stars = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.04, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0xb2d5bb }),
      72,
    );
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 72; i++) {
      matrix.makeTranslation(
        Math.sin(i * 47.2) * 32,
        Math.sin(i * 1.3) * 9 + 3,
        Math.cos(i * 39.9) * 26,
      );
      stars.setMatrixAt(i, matrix);
    }
    this.stars.add(stars);
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.35, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffd169,
        emissive: 0xe89b31,
        emissiveIntensity: 0.8,
      }),
    );
    this.relay.add(orb);
    const orbit = this.ring(0.57, 0.04, 0xffe2a0);
    orbit.rotation.x = 0.5;
    this.relay.add(orbit);
    addEventListener("resize", () => this.resize());
    this.resize();
  }
  private mesh(
    geometry: THREE.BufferGeometry,
    color: number,
    x = 0,
    y = 0,
    z = 0,
    parent: THREE.Object3D = this.island,
  ) {
    const m = new THREE.Mesh(geometry, material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  private sphere(
    radius: number,
    color: number,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D,
    detail = 12,
  ) {
    return this.mesh(
      new THREE.SphereGeometry(radius, detail, 8),
      color,
      x,
      y,
      z,
      parent,
    );
  }
  private ring(radius: number, tube: number, color: number) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 5, 40),
      material(color),
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  private box(
    w: number,
    h: number,
    d: number,
    color: number,
    x: number,
    y: number,
    z: number,
    parent = this.island,
  ) {
    return this.mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent);
  }
  private flower(x: number, z: number, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    this.island.add(g);
    const stem = this.mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 0.38, 5),
      0x4d7d61,
      0,
      0.18,
      0,
      g,
    );
    stem.rotation.z = 0.15;
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      const petal = this.sphere(
        0.1,
        colors.cream,
        Math.sin(a) * 0.11,
        0.42,
        Math.cos(a) * 0.11,
        g,
        6,
      );
      petal.scale.y = 0.5;
    }
    this.sphere(0.07, colors.gold, 0, 0.43, 0, g, 6);
  }
  private plant(x: number, z: number, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0.02, z);
    g.scale.setScalar(scale);
    this.island.add(g);
    for (let i = 0; i < 5; i++) {
      const leaf = this.mesh(
        new THREE.SphereGeometry(0.2, 6, 5),
        i % 2 ? 0x7fa77a : 0x9fbd8a,
        Math.sin(i * 2.4) * 0.15,
        0.17,
        Math.cos(i * 2.4) * 0.15,
        g,
      );
      leaf.scale.set(0.6, 1.6, 0.5);
      leaf.rotation.z = Math.sin(i * 2.4) * 0.5;
      leaf.rotation.x = Math.cos(i * 2.4) * 0.5;
    }
  }
  setArena(id: string) {
    const arena = ARENAS.find((a) => a.id === id) || ARENAS[0];
    if (!arena || this.arena?.id === arena.id) return;
    this.arena = arena;
    this.disposeGroup(this.island);
    this.disposeGroup(this.targets);
    this.disposeGroup(this.closing);
    this.island.position.y = 0;
    this.hazards = [];
    this.scene.background = new THREE.Color(arena.sky);
    this.scene.fog = new THREE.FogExp2(arena.sky, 0.009);
    const w = arena.width,
      h = arena.height;
    const foundation = this.box(w + 0.6, 1.3, h + 0.6, 0x52675a, 0, -0.78, 0);
    foundation.geometry = new THREE.BoxGeometry(w + 0.6, 1.3, h + 0.6, 1, 1, 1);
    this.box(w + 0.1, 0.25, h + 0.1, arena.ground, 0, -0.08, 0);
    this.box(w + 0.7, 0.18, h + 0.7, 0x91a47e, 0, -0.28, 0);
    // Warm stone corner caps and a thin readable perimeter keep the playable plane clear.
    for (const x of [-w / 2, w / 2])
      for (const z of [-h / 2, h / 2])
        this.mesh(
          new THREE.CylinderGeometry(0.48, 0.6, 0.35, 6),
          0xcebba0,
          x,
          0.03,
          z,
        );
    for (let i = 0; i < Math.floor(w); i++) {
      this.box(0.7, 0.08, 0.15, 0xe3d3a7, -w / 2 + 0.5 + i, 0.04, -h / 2);
      this.box(0.7, 0.08, 0.15, 0xe3d3a7, -w / 2 + 0.5 + i, 0.04, h / 2);
    }
    for (let i = 0; i < Math.floor(h); i++) {
      this.box(0.15, 0.08, 0.7, 0xe3d3a7, -w / 2, 0.04, -h / 2 + 0.5 + i);
      this.box(0.15, 0.08, 0.7, 0xe3d3a7, w / 2, 0.04, -h / 2 + 0.5 + i);
    }
    for (let i = 0; i < 85; i++) {
      const x = Math.sin(i * 15.37) * w * 0.47,
        z = Math.cos(i * 46.81) * h * 0.47;
      const pebble = this.mesh(
        new THREE.CircleGeometry(0.04 + (i % 3) * 0.025, 5),
        i % 2 ? 0xb0b58c : 0xc2bd98,
        x,
        0.056,
        z,
      );
      pebble.rotation.x = -Math.PI / 2;
    }
    for (const obstacle of arena.obstacles) {
      const g = new THREE.Group();
      g.position.set(obstacle.x, 0, obstacle.y);
      this.island.add(g);
      const height = obstacle.height || 1;
      if (obstacle.kind === "hedge") {
        this.box(
          obstacle.w,
          height * 0.5,
          obstacle.h,
          0x527c65,
          0,
          height * 0.25,
          0,
          g,
        );
        for (let i = 0; i < 6; i++) {
          const leaf = this.sphere(
            Math.min(obstacle.w, obstacle.h) * 0.48,
            i % 2 ? 0x91b17b : 0x71976e,
            Math.sin(i * 8) * obstacle.w * 0.3,
            height * 0.7,
            Math.cos(i * 8) * obstacle.h * 0.3,
            g,
          );
          leaf.scale.y = 0.8;
        }
      } else if (obstacle.kind === "kiln") {
        this.mesh(
          new THREE.CylinderGeometry(
            obstacle.w * 0.43,
            obstacle.w * 0.51,
            height,
            8,
          ),
          0xc28568,
          0,
          height / 2,
          0,
          g,
        );
        this.mesh(
          new THREE.CylinderGeometry(
            obstacle.w * 0.48,
            obstacle.w * 0.43,
            0.15,
            8,
          ),
          0xe0b38e,
          0,
          height,
          0,
          g,
        );
        this.box(
          obstacle.w * 0.35,
          height * 0.4,
          0.06,
          0x4b4540,
          0,
          height * 0.35,
          obstacle.h * 0.46,
          g,
        );
        this.box(
          obstacle.w * 0.25,
          0.13,
          0.07,
          0xf8c16e,
          0,
          height * 0.3,
          obstacle.h * 0.49,
          g,
        );
      } else if (obstacle.kind === "pillar") {
        this.mesh(
          new THREE.CylinderGeometry(
            obstacle.w * 0.38,
            obstacle.w * 0.47,
            height,
            7,
          ),
          0xb7b7a0,
          0,
          height / 2,
          0,
          g,
        );
        this.mesh(
          new THREE.CylinderGeometry(
            obstacle.w * 0.52,
            obstacle.w * 0.52,
            0.15,
            7,
          ),
          0xe2d2af,
          0,
          height,
          0,
          g,
        );
        this.sphere(0.19, 0xf3d58d, 0, height + 0.17, 0, g);
      } else {
        const stone = this.box(
          obstacle.w,
          height,
          obstacle.h,
          obstacle.kind === "shutter" ? 0x89a89b : 0xa9a790,
          0,
          height / 2,
          0,
          g,
        );
        stone.rotation.y = 0.025;
        this.box(
          obstacle.w * 0.93,
          0.12,
          obstacle.h * 0.9,
          0xc7c4a3,
          0,
          height + 0.02,
          0,
          g,
        );
        this.plant(obstacle.x, obstacle.y, height * 0.35);
      }
    }
    for (const hazard of arena.hazards) {
      const g = new THREE.Group();
      g.position.set(hazard.x, 0.06, hazard.y);
      g.userData.hazard = hazard;
      this.island.add(g);
      this.hazards.push(g);
      const floor = this.box(
        hazard.w,
        0.045,
        hazard.h,
        hazard.kind === "gap" ? 0x193d40 : 0x789588,
        0,
        0,
        0,
        g,
      );
      if (hazard.kind === "gap") {
        floor.material = material(0x1b3c40);
        for (let k = 0; k < 4; k++)
          this.sphere(
            0.04,
            0xb7e0d0,
            ((k % 2) - 0.5) * hazard.w * 0.5,
            0.02,
            (Math.floor(k / 2) - 0.5) * hazard.h * 0.5,
            g,
          );
      } else {
        const hoop = this.ring(
          Math.min(hazard.w, hazard.h) * 0.37,
          0.04,
          hazard.kind === "vent" ? 0xf5ac75 : 0xc3e1bb,
        );
        hoop.position.y = 0.05;
        g.add(hoop);
        for (let k = 0; k < 3; k++)
          this.box(
            hazard.w * 0.7,
            0.03,
            0.05,
            0xc5d6b0,
            0,
            0.06,
            (k - 1) * hazard.h * 0.22,
            g,
          );
      }
      if (hazard.kind === "shutter") {
        const wall = this.box(
          hazard.w,
          1.15,
          hazard.h,
          0xb7bfa0,
          0,
          0.58,
          0,
          g,
        );
        g.userData.wall = wall;
      }
      if (hazard.kind === "gate") {
        const portal = this.ring(0.62, 0.075, 0xc5b4ed);
        portal.rotation.x = 0;
        portal.position.y = 0.66;
        g.add(portal);
      }
      if (hazard.kind === "wind" || hazard.kind === "conveyor") {
        const direction = new THREE.Group();
        direction.rotation.y = -hazard.angle;
        for (let k = 0; k < 3; k++) {
          const arrow = this.mesh(
            new THREE.ConeGeometry(0.14, 0.4, 3),
            0xe6dba8,
            (k - 1) * 0.65,
            0.11,
            0,
            direction,
          );
          arrow.rotation.z = -Math.PI / 2;
        }
        g.add(direction);
      }
    }
    // Exterior foliage never obscures authoritative obstacles or the arena floor.
    for (let i = 0; i < 22; i++) {
      const x = i % 2 ? -w / 2 - 0.28 : w / 2 + 0.28,
        z = (i / 22 - 0.5) * h * 1.7;
      if (Math.abs(z) < h / 2 - 0.4) {
        this.plant(x, z, 0.7 + (i % 3) * 0.16);
        if (i % 3 === 0) this.flower(x, z, 0.8);
      }
    }
    for (let i = 0; i < 12; i++) {
      const x = Math.sin(i * 4.3) * (w / 2 + 1.7),
        z = Math.cos(i * 4.3) * (h / 2 + 1.7);
      const rock = this.mesh(
        new THREE.IcosahedronGeometry(0.3 + (i % 3) * 0.15, 0),
        0x637b6a,
        x,
        -1.6 - (i % 4) * 0.6,
        z,
      );
      rock.rotation.set(i * 0.2, i * 0.7, i * 0.1);
    }
    for (const [index, target] of arena.targets.entries()) {
      const g = new THREE.Group();
      g.position.set(target.x, 0.08, target.y);
      const ring = this.ring(1.15, 0.065, colors.gold);
      g.add(ring);
      const inner = this.ring(0.91, 0.025, colors.cream);
      g.add(inner);
      g.userData.index = index;
      this.targets.add(g);
    }
    for (let i = 0; i < 4; i++) {
      const strip = this.box(1, 0.025, 1, 0xea8f72, 0, 0.09, 0, this.closing);
      strip.material = new THREE.MeshStandardMaterial({
        color: 0xe99370,
        emissive: 0xa94727,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      });
    }
    this.mergeStatic();
    this.targets.visible = false;
    this.closing.visible = false;
    this.resize();
  }
  private mergeStatic() {
    this.mergeModel(
      this.island,
      this.island.children.filter((child) => !child.userData.hazard),
    );
  }
  private mergeModel(group: THREE.Group, fixed = [...group.children]) {
    const geometries: THREE.BufferGeometry[] = [];
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    for (const child of fixed)
      child.traverse((object) => {
        if (
          !(object instanceof THREE.Mesh) ||
          !(object.material instanceof THREE.MeshStandardMaterial)
        )
          return;
        const geometry = object.geometry.index
          ? object.geometry.toNonIndexed()
          : object.geometry.clone();
        geometry.applyMatrix4(
          new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld),
        );
        geometry.deleteAttribute("uv");
        const count = geometry.getAttribute("position").count;
        const rgb = object.material.color,
          colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          colors[i * 3] = rgb.r;
          colors[i * 3 + 1] = rgb.g;
          colors[i * 3 + 2] = rgb.b;
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometries.push(geometry);
      });
    const merged = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    if (!merged) return;
    for (const child of fixed) {
      group.remove(child);
      child.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
    }
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        metalness: 0.02,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  private disposeGroup(group: THREE.Group) {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((m) => m.dispose());
      }
    });
    group.clear();
  }
  private makeActor(player: Player) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    g.userData.body = body;
    const color = player.color;
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 24),
      new THREE.MeshBasicMaterial({
        color: 0x193a34,
        transparent: true,
        opacity: 0.23,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.035;
    g.add(shadow);
    const footRing = this.ring(0.43, 0.055, color);
    footRing.position.y = 0.07;
    g.add(footRing);
    this.character(body, player.character, color);
    this.mergeModel(body);
    g.userData.signature = player.character + ":" + player.color;
    const shield = this.sphere(0.75, 0xb0e6db, 0, 0.55, 0, g, 18);
    shield.material = new THREE.MeshStandardMaterial({
      color: 0xbcf8de,
      transparent: true,
      opacity: 0.18,
      roughness: 0.05,
      metalness: 0.1,
      depthWrite: false,
    });
    shield.visible = false;
    g.userData.shield = shield;
    const slash = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 1.5, 24, 1, -Math.PI / 2 - 0.95, 1.9),
      new THREE.MeshBasicMaterial({
        color: 0xffedb3,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    slash.rotation.x = -Math.PI / 2;
    slash.position.set(0, 0.3, 0);
    slash.visible = false;
    body.add(slash);
    g.userData.slash = slash;
    this.scene.add(g);
    return g;
  }
  private character(body: THREE.Group, id: CharacterId, color: number) {
    const feet = [-0.22, 0.22].map((x) =>
      this.sphere(0.17, 0x314e43, x, 0.16, 0.02, body, 8),
    );
    feet.forEach((m) => m.scale.set(1, 0.55, 1.3));
    if (id === "pip") {
      const core = this.sphere(0.46, color, 0, 0.63, 0, body);
      core.scale.y = 1.15;
      for (let i = 0; i < 3; i++) {
        const leaf = this.sphere(
          0.19,
          i === 1 ? 0xc2d992 : 0x80a85c,
          (i - 1) * 0.15,
          1.11,
          0,
          body,
          7,
        );
        leaf.scale.set(0.5, 1.4, 0.65);
        leaf.rotation.z = (i - 1) * -0.6;
      }
    }
    if (id === "kiln") {
      this.mesh(
        new THREE.CylinderGeometry(0.35, 0.45, 0.78, 9),
        color,
        0,
        0.65,
        0,
        body,
      );
      const rim = this.ring(0.35, 0.09, 0xffd6b0);
      rim.position.y = 1.04;
      body.add(rim);
      this.mesh(
        new THREE.CylinderGeometry(0.27, 0.27, 0.04, 10),
        0x664b3d,
        0,
        1.03,
        0,
        body,
      );
      const handle = this.ring(0.2, 0.065, color);
      handle.rotation.y = Math.PI / 2;
      handle.position.set(0.44, 0.73, 0);
      body.add(handle);
    }
    if (id === "volt") {
      const core = this.box(0.65, 0.65, 0.55, color, 0, 0.65, 0, body);
      core.rotation.z = 0.12;
      this.mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.32, 5),
        0x385957,
        0.08,
        1.08,
        0,
        body,
      );
      this.sphere(0.1, colors.gold, 0.08, 1.26, 0, body, 7);
      for (const x of [-0.42, 0.42]) {
        const bolt = this.box(0.14, 0.3, 0.3, 0xf7df8a, x, 0.67, 0, body);
        bolt.rotation.z = x > 0 ? 0.2 : -0.2;
      }
    }
    if (id === "nori") {
      const core = this.sphere(0.46, color, 0, 0.62, 0, body, 10);
      core.scale.set(1.05, 0.9, 0.95);
      for (let i = 0; i < 5; i++) {
        const frond = this.mesh(
          new THREE.ConeGeometry(0.13, 0.55, 5),
          i % 2 ? 0x66a69e : 0x96c3a4,
          (i - 2) * 0.11,
          1.08,
          0,
          body,
        );
        frond.rotation.z = (i - 2) * 0.28;
      }
    }
    if (id === "cairn") {
      this.mesh(
        new THREE.IcosahedronGeometry(0.46, 1),
        color,
        0,
        0.55,
        0,
        body,
      );
      const head = this.mesh(
        new THREE.IcosahedronGeometry(0.3, 0),
        0xced2bd,
        0,
        0.98,
        0,
        body,
      );
      head.rotation.y = 0.4;
      this.sphere(0.12, 0xa3c086, 0.12, 1.23, 0, body, 6);
    }
    if (id === "comet") {
      const core = this.sphere(0.42, color, 0, 0.65, 0, body);
      core.scale.set(0.9, 1.1, 1);
      const tail = this.mesh(
        new THREE.ConeGeometry(0.25, 0.78, 7),
        0xdac8f3,
        0,
        0.83,
        -0.5,
        body,
      );
      tail.rotation.x = -1.2;
      this.sphere(0.12, 0xf4edcf, -0.1, 1.03, 0.12, body, 6);
    }
    const eyeY = id === "cairn" ? 0.97 : 0.75;
    for (const x of [-0.14, 0.14]) {
      this.sphere(0.074, colors.dark, x, eyeY, 0.398, body, 8);
      this.sphere(0.021, 0xfffaf0, x - 0.012, eyeY + 0.025, 0.458, body, 6);
    }
    for (const x of [-0.26, 0.26]) {
      const cheek = this.sphere(
        0.065,
        0xf4b097,
        x,
        eyeY - 0.13,
        0.365,
        body,
        6,
      );
      cheek.scale.z = 0.2;
    }
    for (const x of [-0.44, 0.44])
      this.sphere(0.115, color, x, 0.55, 0.05, body, 8);
  }
  private makeWeapon(color: number) {
    const g = new THREE.Group(),
      shape = new THREE.Shape();
    shape.moveTo(-0.48, -0.13);
    shape.lineTo(-0.4, 0.08);
    shape.lineTo(-0.04, 0.15);
    shape.lineTo(0.17, 0.48);
    shape.lineTo(0.37, 0.38);
    shape.lineTo(0.12, -0.09);
    shape.lineTo(-0.48, -0.13);
    const mesh = this.mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.085,
        bevelEnabled: true,
        bevelSize: 0.035,
        bevelThickness: 0.025,
        bevelSegments: 1,
        steps: 1,
      }),
      color,
      0,
      0,
      0,
      g,
    );
    mesh.rotation.x = -Math.PI / 2;
    this.sphere(0.07, 0xffefb5, 0, 0.05, 0, g, 6);
    this.scene.add(g);
    return g;
  }
  setMenu(menu: boolean) {
    if (this.menu === menu) return;
    this.menu = menu;
    this.resize();
  }
  resize() {
    const width = innerWidth,
      height = innerHeight;
    const dpr = Math.min(
      devicePixelRatio || 1,
      this.preferences.quality === "low"
        ? 1
        : this.preferences.quality === "high"
          ? 2
          : 1.65,
    );
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.metrics.dpr = dpr;
    const arena = this.arena;
    const aw = (arena?.width || 20) + 5,
      ah = (arena?.height || 14) * 0.83 + 6;
    let viewHeight = Math.max(ah, aw / (width / height));
    if (this.menu && width > 850)
      viewHeight = Math.max(viewHeight, aw / ((width - 410) / height));
    if (width < 700) viewHeight *= 1.05;
    const aspect = width / height;
    this.camera.left = (-viewHeight * aspect) / 2;
    this.camera.right = (viewHeight * aspect) / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.near = 0.1;
    this.camera.far = 140;
    const offset = this.menu && width > 850 ? -viewHeight * aspect * 0.16 : 0;
    const lift =
      this.menu && width < 850 && height > width ? viewHeight * 0.085 : 0;
    this.camera.position.set(offset, 26 - lift, 26 + lift);
    this.camera.lookAt(offset, -lift, lift);
    this.camera.updateProjectionMatrix();
    this.renderer.shadowMap.enabled = this.preferences.quality !== "low";
  }
  draw(
    state: MatchState,
    dt: number,
    onEvent: (type: string) => void,
    recentEvents = state.events,
  ) {
    this.time += dt;
    this.setArena(state.config.mapId);
    for (const player of state.players) {
      let g = this.actors.get(player.id);
      if (
        !g ||
        g.userData.signature !== player.character + ":" + player.color
      ) {
        if (g) {
          this.scene.remove(g);
          this.disposeGroup(g);
        }
        g = this.makeActor(player);
        this.actors.set(player.id, g);
      }
      const body = g.userData.body as THREE.Group;
      g.position.set(player.x, 0, player.y);
      const walking = Math.hypot(player.vx, player.vy) > 0.3;
      const bob = this.preferences.reducedMotion
        ? 0
        : Math.sin(this.time * 18 + player.x) * 0.055 * (walking ? 1 : 0.2);
      body.position.y = player.alive
        ? bob
        : Math.max(-0.3, body.position.y - dt * 2);
      body.rotation.y = Math.atan2(player.fx, player.fy);
      body.rotation.z = player.alive
        ? Math.sin(this.time * 18) * 0.055 * (walking ? 1 : 0)
        : 1.4;
      body.scale.setScalar(player.alive ? 1 : 0.6);
      g.visible = player.alive || state.phase !== "playing";
      (g.userData.shield as THREE.Mesh).visible = player.alive && player.shield;
      (g.userData.slash as THREE.Mesh).visible =
        player.alive && player.slashUntil > state.tick;
    }
    for (const [id, g] of this.actors)
      if (!state.players.some((p) => p.id === id)) {
        this.scene.remove(g);
        this.disposeGroup(g);
        this.actors.delete(id);
      }
    for (const weapon of state.weapons) {
      let g = this.weapons.get(weapon.id);
      const owner = state.players.find((p) => p.id === weapon.ownerId);
      if (!g || g.userData.color !== owner?.color) {
        if (g) {
          this.scene.remove(g);
          this.disposeGroup(g);
        }
        g = this.makeWeapon(owner?.color || 0xffd48e);
        g.userData.color = owner?.color;
        this.weapons.set(weapon.id, g);
      }
      const held = weapon.phase === "held" || weapon.phase === "windup";
      g.visible =
        weapon.phase !== "inert" &&
        weapon.phase !== "rematerializing" &&
        !!owner?.alive;
      g.position.set(
        held ? owner!.x + owner!.fx * 0.56 : weapon.x,
        held ? 0.66 : 0.35,
        held ? owner!.y + owner!.fy * 0.56 : weapon.y,
      );
      g.rotation.y = held ? Math.atan2(owner!.fx, owner!.fy) : this.time * 24;
      g.scale.setScalar(held ? 0.75 : 1);
      if (
        !held &&
        g.visible &&
        !this.preferences.reducedMotion &&
        this.metrics.frames % 3 === 0
      )
        this.particle(
          weapon.x,
          0.25,
          weapon.y,
          owner?.color || colors.gold,
          0.12,
          0.15,
        );
    }
    for (const [id, g] of this.weapons)
      if (!state.weapons.some((w) => w.id === id)) {
        this.scene.remove(g);
        this.disposeGroup(g);
        this.weapons.delete(id);
      }
    const collectibleKey =
      state.pickups.map((p) => p.id).join(",") +
      "/" +
      state.effects.map((e) => e.id).join(",");
    if (collectibleKey !== this.collectibleKey) {
      this.collectibleKey = collectibleKey;
      this.disposeGroup(this.collectibles);
      for (const pickup of state.pickups) {
        const gem = this.mesh(
          new THREE.OctahedronGeometry(0.25, 0),
          0xffdf85,
          pickup.x,
          0.45 + Math.sin(this.time * 3) * 0.08,
          pickup.y,
          this.collectibles,
        );
        gem.userData.pickup = true;
        const ring = this.ring(0.42, 0.025, colors.cream);
        ring.position.set(pickup.x, 0.09, pickup.y);
        this.collectibles.add(ring);
      }
    }
    for (const child of this.collectibles.children)
      if (child.userData.pickup) {
        child.rotation.y = this.time;
        child.position.y =
          0.45 +
          (this.preferences.reducedMotion ? 0 : Math.sin(this.time * 3) * 0.08);
      }
    for (const effect of state.effects) {
      const ring = this.ring(
        effect.radius,
        0.055,
        effect.kind === "ember"
          ? 0xff9361
          : effect.kind === "frost"
            ? 0xb4eceb
            : 0xd7b1f4,
      );
      ring.position.set(effect.x, 0.1, effect.y);
      this.collectibles.add(ring);
    }
    this.relay.visible = state.config.mode === "relay";
    this.relay.position.set(
      state.relay.x,
      0.8 + Math.sin(this.time * 3) * 0.1,
      state.relay.y,
    );
    this.relay.rotation.y = this.time;
    this.targets.visible = state.config.mode === "relay";
    for (const target of this.targets.children) {
      const active = target.userData.index === state.relay.target;
      target.scale.setScalar(
        active
          ? 1 +
              (this.preferences.reducedMotion
                ? 0
                : Math.sin(this.time * 4) * 0.035)
          : 0.8,
      );
      for (const ring of target.children)
        if (ring instanceof THREE.Mesh) {
          const mat = ring.material as THREE.MeshStandardMaterial;
          mat.color.setHex(active ? colors.gold : 0x829c91);
          mat.emissive.setHex(active ? 0x886020 : 0);
          mat.emissiveIntensity = active ? 0.35 : 0;
        }
    }
    const elapsed = state.tick - state.roundStart;
    const margin = Math.min(7, Math.max(0, (elapsed - 3600) / 240));
    this.closing.visible = state.config.mode !== "relay" && margin > 0;
    if (this.arena && margin > 0)
      for (const [i, strip] of this.closing.children.entries()) {
        const { width: w, height: h } = this.arena;
        strip.scale.set(i < 2 ? margin : w, 1, i < 2 ? h : margin);
        strip.position.set(
          i < 2 ? (i === 0 ? -1 : 1) * (w / 2 - margin / 2) : 0,
          0.09,
          i < 2 ? 0 : (i === 2 ? -1 : 1) * (h / 2 - margin / 2),
        );
      }
    for (const g of this.hazards) {
      const h = g.userData.hazard;
      const cycle = (((elapsed + h.offset) % h.period) + h.period) % h.period;
      const active = cycle < h.active;
      const warned = !active && cycle >= h.period - 45;
      g.scale.y = active ? 1.15 : 1;
      if (g.userData.wall) (g.userData.wall as THREE.Mesh).visible = active;
      const hoop = g.children[1] as THREE.Mesh | undefined;
      if (hoop && hoop.material instanceof THREE.MeshStandardMaterial)
        hoop.material.emissive.setHex(
          active
            ? 0xd4864e
            : warned
              ? Math.floor(state.tick / 7) % 2
                ? 0xe8a44b
                : 0x79562b
              : 0,
        );
    }
    for (const event of recentEvents) {
      if (this.seenEvents.has(event.id)) continue;
      this.seenEvents.add(event.id);
      if (event.tick < state.tick - 8) continue;
      onEvent(event.type);
      const color =
        state.players.find(
          (p) => p.id === (event.type === "death" ? event.target : event.actor),
        )?.color || colors.gold;
      if (
        event.type === "death" ||
        event.type === "deflect" ||
        event.type === "upgrade" ||
        event.type === "catch"
      ) {
        const count = this.preferences.reducedMotion
          ? 3
          : event.type === "death"
            ? 24
            : 10;
        for (let i = 0; i < count; i++)
          this.particle(
            event.x,
            0.4,
            event.y,
            color,
            event.type === "death" ? 0.15 : 0.08,
            0.6 + (i % 4) * 0.08,
          );
      }
    }
    if (this.seenEvents.size > 2000)
      this.seenEvents = new Set(state.events.map((e) => e.id));
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= dt * 3;
      p.mesh.rotation.x += dt * 3;
      p.mesh.rotation.z += dt * 5;
      p.mesh.scale.setScalar(Math.max(0, p.life / p.max));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
    if (!this.preferences.reducedMotion) {
      this.stars.rotation.y = this.time * 0.006;
      this.island.position.y = Math.sin(this.time * 0.6) * 0.025;
    }
    if (this.lastPhase !== state.phase) {
      this.lastPhase = state.phase;
      if (state.phase === "countdown") this.seenEvents.clear();
    }
    this.renderer.render(this.scene, this.camera);
    this.metrics.frames++;
    this.metrics.drawCalls = this.renderer.info.render.calls;
    this.metrics.triangles = this.renderer.info.render.triangles;
    this.metrics.frameMs = dt * 1000;
  }
  private particle(
    x: number,
    y: number,
    z: number,
    color: number,
    size: number,
    life: number,
    family?: CharacterId,
  ) {
    const cap=this.preferences.reducedMotion?16:this.preferences.quality==='low'?24:48;
    if (this.particles.length >= cap) return;
    const mesh = this.mesh(
      family==='kiln'?new THREE.BoxGeometry(size*1.7,size*.8,size*1.2):
      family==='volt'?new THREE.TorusGeometry(size*.8,size*.23,3,6):
      family==='nori'?new THREE.ConeGeometry(size,size*.3,3):
      family==='cairn'?new THREE.DodecahedronGeometry(size,0):
      family==='comet'?new THREE.OctahedronGeometry(size):new THREE.IcosahedronGeometry(size, 0),
      color,
      x,
      y,
      z,
      this.scene,
    );
    mesh.castShadow=false;mesh.receiveShadow=false;
    const i = this.particles.length;
    this.particles.push({
      mesh,
      vx: Math.sin(i * 23.7) * 2,
      vy: 1 + (i % 4) * 0.5,
      vz: Math.cos(i * 8.3) * 2,
      life,
      max: life,
    });
  }
}
