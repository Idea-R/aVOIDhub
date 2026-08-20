import { describe, expect, it } from "vitest";
import { ParticleSystem } from "./ParticleSystem";

describe("ParticleSystem", () => {
  it("caps dense standard-motion effects", () => {
    const particles = new ParticleSystem();
    for (let index = 0; index < 100; index += 1) {
      particles.createExplosion({ x: index, y: index }, "#ffffff");
    }

    expect(particles.getParticles()).toHaveLength(480);
  });

  it("reduces and caps decorative motion when requested", () => {
    const particles = new ParticleSystem();
    particles.setReducedMotion(true);

    particles.createExplosion({ x: 10, y: 10 }, "#ffffff");
    expect(particles.getParticles()).toHaveLength(4);

    particles.createElectricSparks({ x: 10, y: 10 });
    expect(particles.getParticles()).toHaveLength(4);

    for (let index = 0; index < 100; index += 1) {
      particles.createExplosion({ x: index, y: index }, "#ffffff");
    }
    expect(particles.getParticles()).toHaveLength(96);
  });
});
