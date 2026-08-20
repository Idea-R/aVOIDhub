import { describe, expect, it } from "vitest";
import {
  armorFaceNormal,
  classifyArmorFace,
  resolveArmorImpact,
} from "./combatMath";

const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const direction = (degrees: number) => ({
  x: Math.cos(radians(degrees)),
  y: Math.sin(radians(degrees)),
});

describe("directional armor math", () => {
  it("uses the frozen inclusive face boundaries", () => {
    expect(classifyArmorFace(direction(45), 0)).toBe("front");
    expect(classifyArmorFace(direction(45.001), 0)).toBe("right");
    expect(classifyArmorFace(direction(-45.001), 0)).toBe("left");
    expect(classifyArmorFace(direction(134.999), 0)).toBe("right");
    expect(classifyArmorFace(direction(135), 0)).toBe("rear");
    expect(classifyArmorFace(direction(-135), 0)).toBe("rear");
  });

  it("rotates face classification and normals with the defender hull", () => {
    expect(classifyArmorFace(direction(30), radians(30))).toBe("front");
    expect(classifyArmorFace(direction(120), radians(30))).toBe("right");
    expect(armorFaceNormal("front", radians(90))).toEqual(
      expect.objectContaining({ x: expect.closeTo(0, 10), y: 1 }),
    );
  });

  it("keeps left and right armor exactly symmetric", () => {
    const left = resolveArmorImpact({
      travelDirection: direction(90),
      impactDirection: direction(-90),
      hullAngle: 0,
      baseDamage: 100,
      penetration: 1,
      currentHealth: 200,
    });
    const right = resolveArmorImpact({
      travelDirection: direction(-90),
      impactDirection: direction(90),
      hullAngle: 0,
      baseDamage: 100,
      penetration: 1,
      currentHealth: 200,
    });
    expect(left.face).toBe("left");
    expect(right.face).toBe("right");
    expect(left.damage).toBe(right.damage);
    expect(left.incidenceDegrees).toBeCloseTo(right.incidenceDegrees, 10);
  });

  it("uses penetrating, glancing, and ricochet incidence boundaries", () => {
    const resolveFrontAt = (degrees: number) =>
      resolveArmorImpact({
        travelDirection: direction(180 + degrees),
        impactDirection: direction(0),
        hullAngle: 0,
        baseDamage: 100,
        penetration: 1,
        currentHealth: 200,
      });

    expect(resolveFrontAt(49.999).outcome).toBe("penetration");
    expect(resolveFrontAt(50).outcome).toBe("glancing");
    expect(resolveFrontAt(68).outcome).toBe("glancing");
    expect(resolveFrontAt(68.001).outcome).toBe("ricochet");
    expect(resolveFrontAt(68.001).damage).toBe(0);
  });

  it("applies face, penetration, outcome, and health clamps without rolls", () => {
    const rear = resolveArmorImpact({
      travelDirection: direction(0),
      impactDirection: direction(180),
      hullAngle: 0,
      baseDamage: 100,
      penetration: 1,
      currentHealth: 200,
    });
    expect(rear.face).toBe("rear");
    expect(rear.damage).toBeCloseTo(135, 10);

    const clamped = resolveArmorImpact({
      travelDirection: direction(0),
      impactDirection: direction(180),
      hullAngle: 0,
      baseDamage: 10_000,
      penetration: 8,
      currentHealth: 17,
    });
    expect(clamped.damage).toBe(17);
    expect(clamped.remainingHealth).toBe(0);

    const input = {
      travelDirection: direction(230),
      impactDirection: direction(0),
      hullAngle: 0,
      baseDamage: 40,
      penetration: 0.75,
      currentHealth: 140,
    };
    expect(resolveArmorImpact(input)).toEqual(resolveArmorImpact(input));
  });

  it("rejects zero-length travel and impact vectors", () => {
    expect(() =>
      resolveArmorImpact({
        travelDirection: { x: 0, y: 0 },
        impactDirection: { x: 1, y: 0 },
        hullAngle: 0,
        baseDamage: 10,
        penetration: 1,
        currentHealth: 100,
      }),
    ).toThrow(RangeError);
    expect(() =>
      resolveArmorImpact({
        travelDirection: { x: -1, y: 0 },
        impactDirection: { x: 0, y: 0 },
        hullAngle: 0,
        baseDamage: 10,
        penetration: 1,
        currentHealth: 100,
      }),
    ).toThrow(RangeError);
  });
});
