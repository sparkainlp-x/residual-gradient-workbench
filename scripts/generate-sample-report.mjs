import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  calculateResidual,
  replayResidualStep,
  calculateTEG,
  UPSTREAM_REPOSITORY,
  UPSTREAM_CONTRACT_COMMIT,
  VECTOR_LENGTH,
} from "../src/model.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reference = Array(VECTOR_LENGTH).fill(0);
const observed = Array(VECTOR_LENGTH).fill(0);
observed[6] = 0.55;
observed[18] = 0.12;
const initialResidual = calculateResidual(reference, observed);
const replay = replayResidualStep(reference, observed, { cap: 0.25, tolerance: 0.25 });
const tegInputs = {
  hotC: 80,
  coldC: 25,
  seebeckVPerK: 0.025,
  internalResistanceOhm: 4,
  loadResistanceOhm: 4,
  durationSeconds: 60,
  heatInputJ: null,
};
const teg = calculateTEG(tegInputs);

const report = {
  report_id: "sample-residual-gradient-run-v1",
  report_type: "synthetic software-model output",
  physical_experiment_performed: false,
  lanes_are_coupled: false,
  residual_contract: {
    repository: UPSTREAM_REPOSITORY,
    commit: UPSTREAM_CONTRACT_COMMIT,
    formula: "r_i = abs(y_i - x_i); R = max_i(r_i)",
    implementation_note: "JavaScript reimplementation of the pinned upstream Python contract; not byte-identical upstream behavior.",
    initial_aggregate_R: initialResidual.aggregateResidual,
    initial_component_residuals: initialResidual.componentResiduals,
    replay: {
      cap: replay.cap,
      tolerance: replay.tolerance,
      offending_component_index_1_based: replay.worstIndex + 1,
      offending_component_residual_before: replay.observerEvent.residualBefore,
      applied_delta_to_observed_component: replay.appliedDelta,
      aggregate_R_before: replay.residualBefore,
      aggregate_R_after: replay.residualAfter,
      component_residuals_after: replay.residualVectorAfter,
      classification: replay.classification,
      observer_latch: replay.latchHeld ? "HELD" : "WITHIN TOLERANCE",
      work_from_residual: 0,
      note: "The 0.55 spike exceeds the 0.25 bounded step; after one step R=0.30 remains above tau=0.25. No energy is attributed to a residual change.",
    },
  },
  thermoelectric_lane: {
    model: "classical linear Thevenin TEG model",
    inputs: teg.inputs,
    synthetic_parameters_not_hardware_measurements: true,
    deltaT_K: teg.deltaT_K,
    open_circuit_voltage_V: teg.openCircuitVoltageV,
    current_A: teg.currentA,
    loaded_voltage_V: teg.loadVoltageV,
    electrical_power_W: teg.electricalPowerW,
    electrical_energy_J: teg.electricalEnergyJ,
    matched_load_condition: "R_load = R_int",
    load_matched: teg.loadMatched,
    matched_load_max_power_W: teg.matchedLoadMaxPowerW,
    carnot_fraction_ceiling_only: teg.carnotFraction,
    measured_heat_input_J: null,
    available_work_J: null,
    heat_input_statement: "Heat input is unmeasured; available work in joules is unknown.",
    note: "Predicted electrical output is attributed only to explicit external hot/cold reservoirs. The Carnot fraction is a maximum heat-to-work fraction, not actual device efficiency.",
  },
  thermodynamic_boundary: "No free energy from nothing: the TEG lane requires an external temperature gradient. Residual replay contributes no work.",
};

await writeFile(resolve(root, "reports/sample-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log("Wrote reports/sample-report.json");
