import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CRYSTAL_BALL_SVG } from "../src/crystalBall.mjs";

test("crystal ball icon is a currentColor svg with a ball", () => {
  assert.match(CRYSTAL_BALL_SVG, /^<svg\b/);
  assert.match(CRYSTAL_BALL_SVG, /<\/svg>$/);
  assert.match(CRYSTAL_BALL_SVG, /currentColor/);
  assert.match(CRYSTAL_BALL_SVG, /<circle\b/);
  assert.doesNotMatch(CRYSTAL_BALL_SVG, /<script\b/i);
});

test("crystal-ball.svg matches the icon used by the top bar button", () => {
  const file = readFileSync(new URL("../crystal-ball.svg", import.meta.url), "utf8").trim();
  assert.equal(file, CRYSTAL_BALL_SVG);
});
