import {
  VECTOR_LENGTH,
  calculateResidual,
  replayResidualStep,
  calculateTEG,
  UPSTREAM_REPOSITORY,
  UPSTREAM_CONTRACT_COMMIT,
} from "./model.mjs";

const $ = (id) => document.getElementById(id);
const fields = {
  reference: $("reference-vector"),
  observed: $("observed-vector"),
  cap: $("step-cap"),
  tolerance: $("residual-tolerance"),
  residualError: $("residual-error"),
  rBefore: $("r-before"),
  rAfter: $("r-after"),
  statusPill: $("residual-status-pill"),
  latch: $("observer-latch"),
  summary: $("step-summary"),
  grid: $("component-grid"),
  log: $("observer-log"),
  tegError: $("teg-error"),
  tegForm: $("teg-form"),
};

let lastReplay = null;
let lastTEG = null;
let logEntries = [];

function displayNumber(value, digits = 4) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0.0000";
  const abs = Math.abs(value);
  if (abs >= 10000 || abs < 0.0001) return value.toExponential(3);
  return value.toFixed(digits);
}

function compactNumber(value) {
  return Number.isFinite(value) ? String(value) : "";
}

function parseVector(text, label) {
  const trimmed = text.trim();
  const values = trimmed ? trimmed.split(/[\s,]+/).map(Number) : [];
  if (values.length !== VECTOR_LENGTH) {
    throw new Error(`${label} must contain exactly 32 numbers; received ${values.length}.`);
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`${label} contains a blank, non-number, or non-finite value.`);
  }
  return values;
}

function parseNonnegativeInput(input, label) {
  const value = Number(input.value);
  if (input.value.trim() === "" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite number greater than or equal to zero.`);
  }
  return value;
}

function writeVector(textarea, values) {
  const lines = [];
  for (let i = 0; i < values.length; i += 8) {
    lines.push(values.slice(i, i + 8).map(compactNumber).join(", "));
  }
  textarea.value = lines.join("\n");
}

function loadExample() {
  const reference = Array(VECTOR_LENGTH).fill(0);
  const observed = Array(VECTOR_LENGTH).fill(0);
  observed[6] = 0.55;
  observed[18] = 0.12;
  observed[26] = 0.03;
  writeVector(fields.reference, reference);
  writeVector(fields.observed, observed);
  lastReplay = null;
  appendLogNote("Loaded the default 0.55-spike fixture; earlier session events were retained.");
  renderResidual();
}

function showResidualError(message = "") {
  fields.residualError.textContent = message;
  fields.residualError.hidden = !message;
}

function renderGrid(componentResiduals, worstIndex) {
  const fragment = document.createDocumentFragment();
  componentResiduals.forEach((residual, index) => {
    const cell = document.createElement("div");
    cell.className = `component-cell${index === worstIndex ? " is-worst" : ""}`;
    cell.setAttribute("role", "listitem");
    const label = document.createElement("span");
    label.textContent = `i ${index + 1}`;
    const value = document.createElement("strong");
    value.textContent = displayNumber(residual, 3);
    cell.title = `Component ${index + 1}: residual ${residual}${index === worstIndex ? " (selected worst)" : ""}`;
    cell.append(label, value);
    fragment.append(cell);
  });
  fields.grid.replaceChildren(fragment);
}

function setLatch(value, tolerance) {
  const held = value > tolerance;
  fields.latch.textContent = held ? "HELD · R > τ" : "WITHIN τ";
  fields.latch.style.color = held ? "#a65b1b" : "#17734b";
  fields.statusPill.textContent = held ? "OVER TOLERANCE" : "WITHIN TOLERANCE";
  fields.statusPill.className = `status-pill ${held ? "status-held" : "status-clear"}`;
}

function renderResidual() {
  try {
    const reference = parseVector(fields.reference.value, "Reference vector x");
    const observed = parseVector(fields.observed.value, "Observed vector y");
    const current = calculateResidual(reference, observed);
    const tolerance = parseNonnegativeInput(fields.tolerance, "Tolerance τ");
    showResidualError("");
    const result = lastReplay;
    const aggregateNow = current.aggregateResidual;
    fields.rBefore.textContent = displayNumber(result?.residualBefore ?? aggregateNow);
    fields.rAfter.textContent = result ? displayNumber(result.residualAfter) : "—";
    renderGrid(current.componentResiduals, current.worstIndex);
    setLatch(aggregateNow, tolerance);
    if (result) {
      const selected = result.worstIndex === null ? "no component selected" : `component ${result.worstIndex + 1}`;
      fields.summary.textContent = result.fell
        ? `SIMULATION — R fell from ${displayNumber(result.residualBefore)} to ${displayNumber(result.residualAfter)} after updating ${selected}. This is not energy output.`
        : `No residual fall — ${selected} was re-scored; the observer status remains ${result.latchHeld ? "held" : "within tolerance"}. Work from residual remains 0.`;
    } else {
      fields.summary.textContent = aggregateNow > tolerance
        ? `R = ${displayNumber(aggregateNow)} exceeds τ = ${displayNumber(tolerance)}. The observer latch is held; no step has been applied.`
        : `R = ${displayNumber(aggregateNow)} is within τ = ${displayNumber(tolerance)}. No step has been applied.`;
    }
    return { reference, observed, current, tolerance };
  } catch (error) {
    fields.rBefore.textContent = "—";
    fields.rAfter.textContent = "—";
    fields.latch.textContent = "—";
    fields.statusPill.textContent = "INPUT NEEDED";
    fields.statusPill.className = "status-pill";
    fields.summary.textContent = "Correct the input values before calculating.";
    fields.grid.replaceChildren();
    showResidualError(error.message);
    return null;
  }
}

function appendLog(result) {
  const event = result.observerEvent;
  const detail = event.componentIndex === null
    ? event.message
    : `Component ${event.componentIndex + 1} · r=${displayNumber(event.residualBefore)} · Δy=${displayNumber(result.appliedDelta)} · R ${displayNumber(result.residualBefore)} → ${displayNumber(result.residualAfter)} · ${result.latchHeld ? "latch held" : "within tolerance"}`;
  appendLogNote(detail);
}

function appendLogNote(detail) {
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  logEntries.push({ timestamp, detail });
  renderLog();
}

function renderLog() {
  if (logEntries.length === 0) {
    const empty = document.createElement("li");
    empty.className = "log-empty";
    empty.textContent = "Waiting for replay events.";
    fields.log.replaceChildren(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const entry of logEntries) {
    const item = document.createElement("li");
    item.textContent = `${entry.timestamp} · ${entry.detail}`;
    fragment.append(item);
  }
  fields.log.replaceChildren(fragment);
  fields.log.scrollTop = fields.log.scrollHeight;
}

function applyStep() {
  try {
    const reference = parseVector(fields.reference.value, "Reference vector x");
    const observed = parseVector(fields.observed.value, "Observed vector y");
    const cap = parseNonnegativeInput(fields.cap, "Max correction cap");
    const tolerance = parseNonnegativeInput(fields.tolerance, "Tolerance τ");
    const result = replayResidualStep(reference, observed, { cap, tolerance });
    lastReplay = result;
    writeVector(fields.observed, result.observedAfter);
    appendLog(result);
    renderResidual();
  } catch (error) {
    showResidualError(error.message);
  }
}

function collectTEGInputs() {
  const heatText = $("heat-input").value.trim();
  return {
    hotC: readRequiredNumber("hot-c", "T_hot"),
    coldC: readRequiredNumber("cold-c", "T_cold"),
    seebeckVPerK: readRequiredNumber("seebeck", "Seebeck coefficient S"),
    internalResistanceOhm: readRequiredNumber("internal-r", "Internal resistance"),
    loadResistanceOhm: readRequiredNumber("load-r", "Load resistance"),
    durationSeconds: readRequiredNumber("duration-s", "Run duration"),
    heatInputJ: heatText === "" ? null : Number(heatText),
  };
}

function readRequiredNumber(id, label) {
  const text = $(id).value.trim();
  const value = Number(text);
  if (text === "" || !Number.isFinite(value)) {
    throw new Error(`${label} must be entered as a finite number.`);
  }
  return value;
}

function renderTEG(result) {
  $("voc-out").textContent = `${displayNumber(result.openCircuitVoltageV, 5)} V`;
  $("current-out").textContent = `${displayNumber(result.currentA, 5)} A`;
  $("vload-out").textContent = `${displayNumber(result.loadVoltageV, 5)} V`;
  $("power-out").textContent = `${displayNumber(result.electricalPowerW, 6)} W`;
  $("energy-out").textContent = `${displayNumber(result.electricalEnergyJ, 6)} J`;
  $("pmax-out").textContent = `${displayNumber(result.matchedLoadMaxPowerW, 6)} W`;
  $("carnot-out").textContent = result.carnotFraction === null
    ? "not defined for a reversed gradient"
    : `${(result.carnotFraction * 100).toFixed(2)}%`;

  const available = $("available-work-out");
  const heatNote = $("heat-note");
  if (!result.heatInputMeasured) {
    available.textContent = "Heat input unmeasured.";
    heatNote.textContent = "Available work in joules is unknown until Q_hot is measured.";
  } else if (result.availableWorkJ === null) {
    available.textContent = "No positive available-work result.";
    heatNote.textContent = "The hot reservoir is not above the cold reservoir; no positive-gradient work ceiling is computed.";
  } else {
    available.textContent = `Available-work ceiling: ${displayNumber(result.availableWorkJ, 5)} J`;
    heatNote.textContent = `Measured Q_hot × Carnot fraction (${displayNumber(result.inputs.heatInputJ, 3)} J × ${(result.carnotFraction * 100).toFixed(2)}%). This is not electrical output.`;
  }

  const status = $("teg-status-pill");
  status.textContent = result.hasPositiveGradient ? "POSITIVE ΔT · PREDICTED" : "NO POSITIVE OUTPUT";
  status.className = `status-pill ${result.hasPositiveGradient ? "status-model" : "status-reverse"}`;
  const match = $("load-match-note");
  match.textContent = result.loadMatched
    ? "Load matched: R_load = R_int. This reaches the model's maximum power for this source resistance."
    : `Not matched: maximum load power occurs at R_load = R_int = ${displayNumber(result.inputs.internalResistanceOhm, 3)} Ω.`;
  match.className = `load-match-note${result.loadMatched ? " is-matched" : ""}`;
}

function updateTEG() {
  try {
    const inputs = collectTEGInputs();
    if (Object.values(inputs).some((value) => value !== null && !Number.isFinite(value))) {
      throw new Error("Enter finite numeric values for all TEG inputs, or leave measured heat input blank.");
    }
    const result = calculateTEG(inputs);
    lastTEG = result;
    fields.tegError.textContent = "";
    fields.tegError.hidden = true;
    renderTEG(result);
    return result;
  } catch (error) {
    fields.tegError.textContent = error.message;
    fields.tegError.hidden = false;
    return null;
  }
}

function buildCurrentReport() {
  const residualState = renderResidual();
  const tegResult = updateTEG();
  if (!residualState || !tegResult) throw new Error("Fix invalid inputs before exporting the report.");
  const replay = lastReplay;
  return {
    report_id: `local-run-${new Date().toISOString()}`,
    report_type: "local software-model output",
    generated_at: new Date().toISOString(),
    physical_experiment_performed: false,
    lanes_are_coupled: false,
    residual_contract: {
      repository: UPSTREAM_REPOSITORY,
      commit: UPSTREAM_CONTRACT_COMMIT,
      formula: "r_i = abs(y_i - x_i); R = max_i(r_i)",
      implementation_note: "JavaScript reimplementation of the pinned upstream Python contract; not byte-identical upstream behavior.",
      reference_vector: residualState.reference,
      observed_vector: residualState.observed,
      residual_vector: residualState.current.componentResiduals,
      current_R: residualState.current.aggregateResidual,
      tolerance: residualState.tolerance,
      replay_step: replay ? {
        R_before: replay.residualBefore,
        R_after: replay.residualAfter,
        offending_component_index_1_based: replay.worstIndex === null ? null : replay.worstIndex + 1,
        offending_component_residual_before: replay.observerEvent.residualBefore,
        cap: replay.cap,
        applied_delta_to_observed_component: replay.appliedDelta,
        classification: replay.classification,
        latch_held: replay.latchHeld,
        work_from_residual: 0,
      } : null,
      observer_log: logEntries,
      notes: "A residual decrease is only a simulation. Residual values do not produce or represent energy.",
    },
    thermoelectric_lane: {
      model: "classical linear Thevenin TEG model",
      inputs: tegResult.inputs,
      synthetic_parameters_not_hardware_measurements: true,
      deltaT_K: tegResult.deltaT_K,
      open_circuit_voltage_V: tegResult.openCircuitVoltageV,
      current_A: tegResult.currentA,
      loaded_voltage_V: tegResult.loadVoltageV,
      electrical_power_W: tegResult.electricalPowerW,
      electrical_energy_J: tegResult.electricalEnergyJ,
      matched_load_condition: "R_load = R_int",
      load_matched: tegResult.loadMatched,
      matched_load_max_power_W: tegResult.matchedLoadMaxPowerW,
      carnot_fraction_ceiling_only: tegResult.carnotFraction,
      measured_heat_input_J: tegResult.inputs.heatInputJ,
      available_work_J: tegResult.availableWorkJ,
      heat_input_statement: tegResult.heatInputMeasured
        ? "Q_hot entered as measured input; available-work result is a Carnot ceiling, not electrical energy."
        : "Heat input is unmeasured; available work in joules is unknown.",
      note: "Predicted output is attributed only to explicit external reservoir temperatures. No physical experiment was run.",
    },
    thermodynamic_boundary: "The TEG lane requires an external temperature gradient. The residual lane contributes zero work. No free energy from nothing is claimed.",
  };
}

function downloadReport() {
  try {
    const report = buildCurrentReport();
    const blob = new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "residual-gradient-run-report.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    showResidualError(error.message);
  }
}

$("apply-step").addEventListener("click", applyStep);
$("load-example").addEventListener("click", loadExample);
for (const input of [fields.reference, fields.observed]) {
  input.addEventListener("input", () => {
    lastReplay = null;
    renderResidual();
  });
}
for (const input of [fields.cap, fields.tolerance]) {
  input.addEventListener("input", () => {
    lastReplay = null;
    renderResidual();
  });
}
fields.tegForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateTEG();
});
$("download-report").addEventListener("click", downloadReport);

loadExample();
updateTEG();
