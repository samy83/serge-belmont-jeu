import { describe, expect, it } from 'vitest';
import { flightPolyline, flightPositionAt, simulateFlight, type FlightWorld } from '@core/physics/flight';
import { sweepCircleRect, sweepPointCircle } from '@core/physics/geometry';

const params = { speed: 2400, gravity: 0, maxBounces: 12, dt: 1 / 120, maxFlightTime: 6 };

function world(partial: Partial<FlightWorld> = {}): FlightWorld {
  return {
    width: 900,
    height: 1600,
    floorY: 1280,
    radius: 42,
    walls: { left: true, right: true, top: true },
    anchors: { top: true, left: false, right: false },
    balls: [],
    obstacles: [],
    ...partial,
  };
}

describe('geometrie de balayage', () => {
  it('trouve le premier contact point/cercle', () => {
    const t = sweepPointCircle(0, 0, 100, 0, 60, 0, 10);
    expect(t).toBeCloseTo(0.5, 6);
    expect(sweepPointCircle(0, 0, 100, 0, 60, 50, 10)).toBe(-1);
  });

  it('trouve le contact cercle/rectangle sur une face et sur un coin', () => {
    const face = sweepCircleRect(0, 50, 100, 0, 10, 60, 0, 40, 100)!;
    expect(face.t).toBeCloseTo(0.5, 6);
    expect(face.nx).toBe(-1);
    const corner = sweepCircleRect(0, -20, 100, 0, 10, 60, -15, 40, 100)!;
    expect(corner).not.toBeNull();
    expect(corner.t).toBeLessThan(0.6);
    expect(corner.ny).toBeLessThan(0);
  });
});

describe('simulateFlight', () => {
  it('une boule tiree droit vers le haut se colle au plafond', () => {
    const f = simulateFlight(world(), 450, 1470, 0, -1, params);
    expect(f.outcome).toBe('attached');
    expect(f.attachSurface).toBe('wall-top');
    expect(f.endY).toBeCloseTo(42, 6);
    expect(f.endX).toBeCloseTo(450, 6);
    expect(f.duration).toBeCloseTo((1470 - 42) / 2400, 3);
  });

  it('rebondit sur le bord gauche en conservant sa vitesse', () => {
    const f = simulateFlight(world(), 450, 1470, -1, -1, params);
    const bounce = f.events.find((e) => e.type === 'bounce')!;
    expect(bounce.surface).toBe('wall-left');
    expect(bounce.x).toBeCloseTo(42, 3);
    expect(f.outcome).toBe('attached');
    // Apres le rebond la boule repart vers la droite : elle finit a droite du point de rebond.
    expect(f.endX).toBeGreaterThan(bounce.x + 100);
    // Vitesse constante : distance parcourue = vitesse x duree.
    let dist = 0;
    for (let i = 1; i < f.xs.length; i++) dist += Math.hypot(f.xs[i]! - f.xs[i - 1]!, f.ys[i]! - f.ys[i - 1]!);
    // Le rebond tombe a l'interieur d'un pas : le segment coupe le coin, d'ou une tolerance de 1 %.
    expect(Math.abs(dist / f.duration - 2400)).toBeLessThan(2400 * 0.01);
  });

  it("s'arrete exactement au contact d'une boule posee", () => {
    const w = world({ balls: [{ id: 7, x: 450, y: 42 }] });
    const f = simulateFlight(w, 450, 1470, 0, -1, params);
    expect(f.outcome).toBe('attached');
    expect(f.attachSurface).toBe('ball');
    expect(f.attachTargetId).toBe(7);
    expect(Math.hypot(f.endX - 450, f.endY - 42)).toBeCloseTo(84, 6);
  });

  it('rebondit sur un obstacle gris', () => {
    const w = world({ obstacles: [{ id: 1, x: 400, y: 600, w: 100, h: 60 }] });
    const f = simulateFlight(w, 450, 1470, 0, -1, params);
    const bounce = f.events[0]!;
    expect(bounce.type).toBe('bounce');
    expect(bounce.surface).toBe('obstacle');
    expect(bounce.y).toBeCloseTo(660 + 42, 3);
    // Renvoyee vers le bas, elle repasse sous la ligne de chute et est perdue.
    expect(f.outcome).toBe('lost');
  });

  it('est deterministe : deux simulations identiques donnent le meme vol', () => {
    const w = world({ balls: [{ id: 1, x: 300, y: 42 }, { id: 2, x: 384, y: 42 }], obstacles: [{ id: 1, x: 100, y: 500, w: 80, h: 60 }] });
    const a = simulateFlight(w, 200, 1470, 0.7, -0.7, params);
    const b = simulateFlight(w, 200, 1470, 0.7, -0.7, params);
    expect(a).toEqual(b);
  });

  it('interpole la position et trace la polyligne des rebonds', () => {
    const f = simulateFlight(world(), 450, 1470, -1, -1, params);
    const p0 = flightPositionAt(f, 0);
    expect(p0).toEqual({ x: 450, y: 1470 });
    const mid = flightPositionAt(f, f.duration / 2);
    expect(mid.y).toBeLessThan(1470);
    const end = flightPositionAt(f, f.duration + 1);
    expect(end.x).toBeCloseTo(f.endX, 6);
    const line = flightPolyline(f);
    expect(line.length).toBe(f.events.length + 1);
    // Ligne tronquee au premier rebond : depart + point de rebond.
    expect(flightPolyline(f, 1)).toHaveLength(2);
  });

  it('abandonne apres trop de rebonds', () => {
    const f = simulateFlight(world(), 450, 1470, 1, -0.01, { ...params, maxBounces: 2 });
    expect(f.outcome).toBe('lost');
    expect(f.events.filter((e) => e.type === 'bounce').length).toBe(3);
  });
});
