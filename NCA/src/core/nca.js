import { C, HIDDEN_C, PERCEPTION_C, ALPHA_INDEX, ALIVE_THRESHOLD } from './config.js';
import { perceiveCell, denseLayer, applyReluInPlace, computeAliveMask } from './math.js';

// Shared buffers for zero-allocation inner loop
const sharedP = new Float32Array(PERCEPTION_C);
const sharedXraw = new Float32Array(HIDDEN_C);
const sharedDS = new Float32Array(C);

export function createGrid(W, H) {
  return new Float32Array(W * H * C);
}

// Seed center cell: alpha=1.0 AND hidden channels = 1.0, RGB = 0.0
// (Distill implementation convention requires hidden channels to be 1.0 as well)
export function seedCenter(grid, W, H) {
  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);
  const offset = (cy * W + cx) * C;
  // Clear RGB channels to 0.0 (matches official seed: RGB=0, alpha+hidden=1)
  for (let c = 0; c < ALPHA_INDEX; c++) {
    grid[offset + c] = 0.0;
  }
  for (let c = ALPHA_INDEX; c < C; c++) {
    grid[offset + c] = 1.0;
  }
}

// ── Shared per-cell NCA pipeline ──
// Both stepNCA() and getCellStepDebug() use this function.
function computeCellUpdate(grid, W, H, x, y, weights) {
  const P = perceiveCell(grid, W, H, C, x, y);
  const pIdentity = P.slice(0, C);
  const pSobelX = P.slice(C, C * 2);
  const pSobelY = P.slice(C * 2, C * 3);

  const Xraw = denseLayer(P, weights.w1, weights.b1, HIDDEN_C);
  const X = new Float32Array(Xraw); // copy before ReLU
  applyReluInPlace(X);

  const dS = denseLayer(X, weights.w2, weights.b2, C);

  return { P, pIdentity, pSobelX, pSobelY, Xraw, X, dS };
}

// Zero-allocation version for the main simulation loop
function computeCellUpdateFast(grid, W, H, x, y, weights, outDS) {
  perceiveCell(grid, W, H, C, x, y, sharedP);
  denseLayer(sharedP, weights.w1, weights.b1, HIDDEN_C, sharedXraw);
  
  applyReluInPlace(sharedXraw); // Modify in place
  denseLayer(sharedXraw, weights.w2, weights.b2, C, outDS);
}

// Pre-allocated buffers for stepNCA (avoids per-frame GC pressure)
let cachedW = 0, cachedH = 0;
let sharedCandidateGrid = null;
let sharedStochasticMask = null;
let sharedPreAlive = null;
let sharedPostAlive = null;

function ensureStepBuffers(W, H) {
  if (cachedW !== W || cachedH !== H) {
    cachedW = W;
    cachedH = H;
    sharedCandidateGrid = new Float32Array(W * H * C);
    sharedStochasticMask = new Uint8Array(W * H);
    sharedPreAlive = new Uint8Array(W * H);
    sharedPostAlive = new Uint8Array(W * H);
  }
}

// ── Full NCA step over the entire grid ──
// Returns a StepResult object with all data needed for inspector replay.
export function stepNCA(grid, W, H, weights, updateRate = 0.5) {
  ensureStepBuffers(W, H);

  // Save pre-step snapshot for inspector (must be a copy — inspector reads it later)
  const preGrid = new Float32Array(grid);

  // --- Step 0: Pre-alive mask on current state ---
  computeAliveMask(grid, W, H, C, ALIVE_THRESHOLD, sharedPreAlive);

  // --- Step 1: Generate stochastic update mask ---
  for (let i = 0; i < sharedStochasticMask.length; i++) {
    sharedStochasticMask[i] = Math.random() < updateRate ? 1 : 0;
  }

  // --- Step 2: Compute ΔS and apply stochastic mask ---
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const offset = (y * W + x) * C;
      const idx = y * W + x;

      if (sharedStochasticMask[idx] === 1) {
        computeCellUpdateFast(grid, W, H, x, y, weights, sharedDS);
        for (let c = 0; c < C; c++) {
          sharedCandidateGrid[offset + c] = grid[offset + c] + sharedDS[c];
        }
      } else {
        for (let c = 0; c < C; c++) {
          sharedCandidateGrid[offset + c] = grid[offset + c];
        }
      }
    }
  }

  // --- Step 3 & 4: Post-alive mask and apply both masks in one pass ---
  computeAliveMask(sharedCandidateGrid, W, H, C, ALIVE_THRESHOLD, sharedPostAlive);

  for (let idx = 0; idx < W * H; idx++) {
    const alive = sharedPreAlive[idx] & sharedPostAlive[idx]; // Both must be alive
    const offset = idx * C;

    for (let c = 0; c < C; c++) {
      grid[offset + c] = sharedCandidateGrid[offset + c] * alive;
    }
  }

  return {
    stochasticMask: new Uint8Array(sharedStochasticMask),
    preGrid,
    preAlive: new Uint8Array(sharedPreAlive),
    postAlive: new Uint8Array(sharedPostAlive)
  };
}

// ── Extract per-cell debug data from a completed step ──
// Uses the preGrid snapshot to show the "before → after" transition.
// Reuses computeCellUpdate() to avoid duplicating the pipeline.
export function getCellStepDebug(stepResult, W, H, cx, cy, weights) {
  const { preGrid, stochasticMask, preAlive, postAlive } = stepResult;
  const cellIdx = cy * W + cx;
  const cellOffset = cellIdx * C;

  // State before the step
  const currentState = preGrid.slice(cellOffset, cellOffset + C);

  // 3x3 neighborhood from preGrid
  const neighborhood = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
        const off = (ny * W + nx) * C;
        neighborhood.push(Array.from(preGrid.slice(off, off + C)));
      } else {
        neighborhood.push(new Array(C).fill(0)); // Zero-padding
      }
    }
  }

  // Recompute pipeline on preGrid using the shared function
  const { P, pIdentity, pSobelX, pSobelY, Xraw, X, dS } = computeCellUpdate(preGrid, W, H, cx, cy, weights);

  const wasUpdated = stochasticMask[cellIdx];

  // Candidate state
  const candidateState = new Float32Array(C);
  for (let c = 0; c < C; c++) {
    candidateState[c] = wasUpdated ? currentState[c] + dS[c] : currentState[c];
  }

  // Alive mask: pre AND post (matches stepNCA)
  const preAliveVal = preAlive[cellIdx];
  const postAliveVal = postAlive[cellIdx];
  const alive = preAliveVal & postAliveVal;

  const newState = new Float32Array(C);
  for (let c = 0; c < C; c++) {
    newState[c] = candidateState[c] * alive;
  }

  return {
    currentState,
    neighborhood,
    P,
    pIdentity,
    pSobelX,
    pSobelY,
    Xraw,
    X,
    dS,
    candidateState,
    newState,
    preAlive: preAliveVal,
    postAlive: postAliveVal,
    wasUpdated
  };
}
