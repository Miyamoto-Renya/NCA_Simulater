/**
 * Core Math and Tensor Operations for NCA
 * Uses Float32Array for performance.
 */

import { ALPHA_INDEX } from './config.js';

// 1D Array dot product with weight matrix (shape: inputSize x outputSize)
// vec: Float32Array(inputSize)
// weights: Float32Array(inputSize * outputSize) (flattened, row-major)
// Here we use row-major: weights[in_idx * outputSize + out_idx]
// bias: Float32Array(outputSize)
export function denseLayer(vec, weights, bias, outputSize, outBuffer = null) {
  const inputSize = vec.length;
  const out = outBuffer || new Float32Array(outputSize);
  for (let o = 0; o < outputSize; o++) {
    let sum = bias[o];
    for (let i = 0; i < inputSize; i++) {
      sum += vec[i] * weights[i * outputSize + o];
    }
    out[o] = sum;
  }
  return out;
}

// Apply ReLU to vector in-place
export function applyReluInPlace(vec) {
  for (let i = 0; i < vec.length; i++) {
    vec[i] = Math.max(0, vec[i]);
  }
}

// Sobel and Identity Filters for Perception
// Paper uses 1/8 normalization on Sobel filters to keep gradient magnitudes stable
export const FILTERS = {
  identity: [
    0, 0, 0,
    0, 1, 0,
    0, 0, 0
  ],
  sobelX: [
    -1/8, 0, 1/8,
    -2/8, 0, 2/8,
    -1/8, 0, 1/8
  ],
  sobelY: [
    -1/8, -2/8, -1/8,
       0,    0,    0,
     1/8,  2/8,  1/8
  ]
};

// Perceive function for a single cell (x, y)
// grid: Float32Array(H * W * C)
// W, H: dimensions
// C: channels
export function perceiveCell(grid, W, H, C, cx, cy, outBuffer = null) {
  const out = outBuffer || new Float32Array(C * 3); // Identity, SobelX, SobelY
  if (outBuffer) {
    out.fill(0); // clear existing values
  }
  
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      // Zero-padding boundary conditions
      let nx = cx + dx;
      let ny = cy + dy;
      
      const filterIdx = (dy + 1) * 3 + (dx + 1);
      const idVal = FILTERS.identity[filterIdx];
      const sxVal = FILTERS.sobelX[filterIdx];
      const syVal = FILTERS.sobelY[filterIdx];
      
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
        const cellOffset = (ny * W + nx) * C;
        
        for (let c = 0; c < C; c++) {
          const val = grid[cellOffset + c];
          if (idVal !== 0) out[c] += val * idVal;         // first C elements
          if (sxVal !== 0) out[C + c] += val * sxVal;     // next C elements
          if (syVal !== 0) out[C * 2 + c] += val * syVal; // last C elements
        }
      }
    }
  }
  
  return out;
}

// Check if cell is alive (alpha channel > threshold)
// A cell is alive if max alpha in 3x3 neighborhood is > threshold
export function computeAliveMask(grid, W, H, C, threshold, outMask = null) {
  const mask = outMask || new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let maxAlpha = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          let nx = x + dx;
          let ny = y + dy;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
            const cellOffset = (ny * W + nx) * C;
            const alpha = grid[cellOffset + ALPHA_INDEX];
            if (alpha > maxAlpha) maxAlpha = alpha;
          }
        }
      }
      mask[y * W + x] = maxAlpha > threshold ? 1 : 0;
    }
  }
  return mask;
}
