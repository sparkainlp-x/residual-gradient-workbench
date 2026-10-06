import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateResidual,
  replayResidualStep,
  celsiusToKelvin,
  calculateTEG,
  VECTOR_LENGTH,
} from "../src/model.mjs";

const zeros = () => Array(VECTOR_LENGTH).fill(0);
const baseTEG = (overrides = {}) => ({
  hotC: 80,
  coldC: 25,
  seebeckVPerK: 0.025,
  internalResistanceOhm: 4,
  loadResistanceOhm: 4,
  durationSeconds: 60,
  heatInputJ: null,
  ...overrides,
});

test("residual uses abs(y_i - x_i) and R=max(r_i) over 32 values", () => {
  const x = zeros();
  const y = zeros();
  x[2] = 1.5;
  y[2] = 1.0;
  y[17] = -0.55;
  const result = calculateResidual(x, y);
  assert.equal(result.componentResiduals[2], 0.5);
  assert.equal(result.componentResiduals[17], 0.55);
  assert.equal(result.aggregateResidual, 0.55);
  assert.equal(result.worstIndex, 17);
});

test("residual rejects malformed or non-finite vectors", () => {
  assert.throws(() => calculateResidual([0], [0]), /exactly 32/);
  const invalid = zeros();
  invalid[0] = Number.NaN;
  assert.throws(() => calculateResidual(zeros(), invalid), /finite real number/);
});

test("one residual replay changes only the first worst component and never assigns work", () => {
  const x = zeros();
  const y = zeros();
  y[4] = 0.2;
  y[9] = -0.55;
  y[20] = 0.1;
  const result = replayResidualStep(x, y, { cap: 0.25, tolerance: 0.25 });
  assert.equal(result.worstIndex, 9);
  assert.ok(Math.abs(result.observedAfter[9] - (-0.3)) < 1e-12);
  for (let i = 0; i < VECTOR_LENGTH; i += 1) {
    if (i !== 9) assert.equal(result.observedAfter[i], y[i], `component ${i} changed`);
  }
  assert.equal(result.workFromResidual, 0);
  assert.equal(result.fell, true);
  assert.equal(result.classification, "simulation");
});

test("the 0.55 spike cannot be closed by a 0.25 step; observer latch remains held", () => {
  const x = zeros();
  const y = zeros();
  y[6] = 0.55;
  y[18] = 0.12;
  const result = replayResidualStep(x, y, { cap: 0.25, tolerance: 0.25 });
  assert.equal(result.residualBefore, 0.55);
  assert.equal(result.appliedDelta, -0.25);
  assert.ok(Math.abs(result.observedAfter[6] - 0.3) < 1e-12);
  assert.ok(Math.abs(result.residualAfter - 0.3) < 1e-12);
  assert.equal(result.latchHeld, true);
  assert.equal(result.residualVectorAfter[18], 0.12);
  assert.equal(result.workFromResidual, 0);
});

test("ties are deterministic and choose the first worst index", () => {
  const x = zeros();
  const y = zeros();
  y[3] = 0.4;
  y[8] = -0.4;
  const result = replayResidualStep(x, y, { cap: 0.1, tolerance: 0.25 });
  assert.equal(result.worstIndex, 3);
  assert.equal(result.residualAfter, 0.4);
  assert.equal(result.fell, false);
  assert.equal(result.latchHeld, true);
});

test("Celsius converts to Kelvin with the 273.15 offset", () => {
  assert.equal(celsiusToKelvin(0), 273.15);
  assert.equal(celsiusToKelvin(25), 298.15);
});

test("zero and reversed thermal gradients produce no positive electrical output", () => {
  for (const [hotC, coldC] of [[25, 25], [20, 30]]) {
    const result = calculateTEG(baseTEG({ hotC, coldC, loadResistanceOhm: 7 }));
    assert.equal(result.hasPositiveGradient, false);
    assert.equal(result.openCircuitVoltageV, 0);
    assert.equal(result.currentA, 0);
    assert.equal(result.loadVoltageV, 0);
    assert.equal(result.electricalPowerW, 0);
    assert.equal(result.electricalEnergyJ, 0);
    assert.equal(result.matchedLoadMaxPowerW, 0);
  }
});

test("TEG equations produce nonnegative loaded power and energy", () => {
  const result = calculateTEG(baseTEG());
  const expectedVoc = 0.025 * (80 - 25);
  const expectedCurrent = expectedVoc / (4 + 4);
  assert.equal(result.openCircuitVoltageV, expectedVoc);
  assert.equal(result.currentA, expectedCurrent);
  assert.equal(result.loadVoltageV, expectedCurrent * 4);
  assert.equal(result.electricalPowerW, expectedCurrent ** 2 * 4);
  assert.equal(result.electricalEnergyJ, result.electricalPowerW * 60);
  assert.ok(result.electricalPowerW >= 0);
  assert.ok(result.electricalEnergyJ >= 0);
  assert.equal(result.hardwareMeasurement, false);
});

test("matched load R_load=R_int attains the model's maximum load power", () => {
  const matched = calculateTEG(baseTEG({ loadResistanceOhm: 4 }));
  const mismatched = calculateTEG(baseTEG({ loadResistanceOhm: 12 }));
  assert.equal(matched.loadMatched, true);
  assert.equal(matched.electricalPowerW, matched.matchedLoadMaxPowerW);
  assert.equal(mismatched.loadMatched, false);
  assert.ok(mismatched.electricalPowerW < matched.matchedLoadMaxPowerW);
});

test("Carnot fraction is between zero and one for a positive Kelvin gradient", () => {
  const result = calculateTEG(baseTEG());
  assert.ok(result.inputs.hotK > result.inputs.coldK);
  assert.ok(result.carnotFraction > 0 && result.carnotFraction < 1);
});

test("available-work energy is unknown without measured heat, and only computed when Q_hot is supplied", () => {
  const unmeasured = calculateTEG(baseTEG());
  assert.equal(unmeasured.availableWorkJ, null);
  assert.equal(unmeasured.heatInputMeasured, false);
  const measured = calculateTEG(baseTEG({ heatInputJ: 1000 }));
  assert.equal(measured.availableWorkJ, 1000 * measured.carnotFraction);
  assert.equal(measured.heatInputMeasured, true);
});

test("temperatures at or below absolute zero are rejected", () => {
  assert.throws(() => calculateTEG(baseTEG({ hotC: -273.15 })), /greater than 0/);
  assert.throws(() => calculateTEG(baseTEG({ coldC: -273.15 })), /greater than 0/);
});
