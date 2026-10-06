export const VECTOR_LENGTH = 32;
export const UPSTREAM_REPOSITORY = "sparkainlp-x/oes32-residual";
export const UPSTREAM_CONTRACT_COMMIT = "b77b61254f15778c6ae221843dceac7a8571158e";

function finiteNumber(value, label, { min = -Infinity, exclusiveMin = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  if (exclusiveMin ? value <= min : value < min) {
    const relation = exclusiveMin ? "greater than" : "at least";
    throw new RangeError(`${label} must be ${relation} ${min}`);
  }
  return value;
}

function checkedVector(values, label) {
  if (!Array.isArray(values) || values.length !== VECTOR_LENGTH) {
    throw new RangeError(`${label} must contain exactly ${VECTOR_LENGTH} finite real values`);
  }
  return values.map((value, index) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(`${label}[${index}] must be a finite real number`);
    }
    return value;
  });
}

/**
 * Normative OES-32 residual contract: r_i = abs(y_i - x_i), R = max(r_i).
 * This browser implementation is a JavaScript reimplementation of the pinned
 * contract, not the upstream Python reference implementation byte-for-byte.
 */
export function calculateResidual(reference, observed) {
  const x = checkedVector(reference, "reference");
  const y = checkedVector(observed, "observed");
  const componentResiduals = x.map((value, index) => Math.abs(y[index] - value));
  const aggregateResidual = Math.max(...componentResiduals);
  return {
    componentResiduals,
    aggregateResidual,
    worstIndex: componentResiduals.indexOf(aggregateResidual),
  };
}

/**
 * Apply one deterministic, capped correction to the first worst component.
 * Every other observed component is copied unchanged. No energy is attributed.
 */
export function replayResidualStep(reference, observed, { cap = 0.25, tolerance = 0.25 } = {}) {
  const x = checkedVector(reference, "reference");
  const y = checkedVector(observed, "observed");
  const stepCap = finiteNumber(cap, "cap", { min: 0 });
  const tau = finiteNumber(tolerance, "tolerance", { min: 0 });
  const before = calculateResidual(x, y);
  const nextObserved = [...y];
  const offendingIndex = before.aggregateResidual > 0 ? before.worstIndex : null;
  let appliedDelta = 0;

  if (offendingIndex !== null) {
    const distance = before.componentResiduals[offendingIndex];
    const amount = Math.min(stepCap, distance);
    const direction = Math.sign(x[offendingIndex] - y[offendingIndex]);
    appliedDelta = direction * amount;
    nextObserved[offendingIndex] = y[offendingIndex] + appliedDelta;
  }

  const after = calculateResidual(x, nextObserved);
  const fell = after.aggregateResidual < before.aggregateResidual;
  const latchHeld = after.aggregateResidual > tau;
  const observerEvent = offendingIndex === null
    ? {
        componentIndex: null,
        residualBefore: 0,
        appliedDelta: 0,
        message: "No offending component; residual is already zero.",
      }
    : {
        componentIndex: offendingIndex,
        residualBefore: before.componentResiduals[offendingIndex],
        appliedDelta,
        message: `Component ${offendingIndex + 1}: residual ${before.componentResiduals[offendingIndex]} observed; bounded Δy ${appliedDelta} applied.`,
      };

  return {
    reference: x,
    observedBefore: y,
    observedAfter: nextObserved,
    residualVectorBefore: before.componentResiduals,
    residualVectorAfter: after.componentResiduals,
    residualBefore: before.aggregateResidual,
    residualAfter: after.aggregateResidual,
    worstIndex: offendingIndex,
    appliedDelta,
    cap: stepCap,
    tolerance: tau,
    fell,
    classification: fell ? "simulation" : "no-fall replay",
    latchHeld,
    observerEvent,
    workFromResidual: 0,
  };
}

export function celsiusToKelvin(celsius) {
  finiteNumber(celsius, "temperature");
  return celsius + 273.15;
}

/**
 * Idealized linear Thevenin model for a thermoelectric generator (TEG).
 * Electrical output is predicted only for an explicitly supplied positive
 * hot-to-cold reservoir gradient. It is not a hardware measurement.
 */
export function calculateTEG({
  hotC,
  coldC,
  seebeckVPerK,
  internalResistanceOhm,
  loadResistanceOhm,
  durationSeconds,
  heatInputJ = null,
}) {
  finiteNumber(hotC, "T_hot (°C)");
  finiteNumber(coldC, "T_cold (°C)");
  const hotK = celsiusToKelvin(hotC);
  const coldK = celsiusToKelvin(coldC);
  finiteNumber(hotK, "T_hot (K)", { min: 0, exclusiveMin: true });
  finiteNumber(coldK, "T_cold (K)", { min: 0, exclusiveMin: true });
  finiteNumber(seebeckVPerK, "Seebeck coefficient S", { min: 0 });
  finiteNumber(internalResistanceOhm, "internal resistance", { min: 0, exclusiveMin: true });
  finiteNumber(loadResistanceOhm, "load resistance", { min: 0, exclusiveMin: true });
  finiteNumber(durationSeconds, "run duration", { min: 0 });
  if (heatInputJ !== null) finiteNumber(heatInputJ, "measured Q_hot", { min: 0 });

  const deltaT_K = hotK - coldK;
  const hasPositiveGradient = deltaT_K > 0;
  const openCircuitVoltageV = hasPositiveGradient ? seebeckVPerK * deltaT_K : 0;
  const currentA = hasPositiveGradient
    ? openCircuitVoltageV / (internalResistanceOhm + loadResistanceOhm)
    : 0;
  const loadVoltageV = currentA * loadResistanceOhm;
  const electricalPowerW = currentA * currentA * loadResistanceOhm;
  const electricalEnergyJ = electricalPowerW * durationSeconds;
  const carnotFraction = deltaT_K >= 0 ? 1 - coldK / hotK : null;
  const matchedLoadMaxPowerW = hasPositiveGradient
    ? (openCircuitVoltageV * openCircuitVoltageV) / (4 * internalResistanceOhm)
    : 0;
  const loadMatched = Math.abs(loadResistanceOhm - internalResistanceOhm)
    <= 1e-9 * Math.max(1, internalResistanceOhm, loadResistanceOhm);
  const availableWorkJ = heatInputJ !== null && carnotFraction !== null
    ? heatInputJ * carnotFraction
    : null;

  return {
    inputs: {
      hotC,
      coldC,
      hotK,
      coldK,
      seebeckVPerK,
      internalResistanceOhm,
      loadResistanceOhm,
      durationSeconds,
      heatInputJ,
    },
    deltaT_K,
    hasPositiveGradient,
    openCircuitVoltageV,
    currentA,
    loadVoltageV,
    electricalPowerW,
    electricalEnergyJ,
    carnotFraction,
    matchedLoadMaxPowerW,
    loadMatched,
    availableWorkJ,
    heatInputMeasured: heatInputJ !== null,
    hardwareMeasurement: false,
  };
}
