/**
 * Central Configuration for NCA Project.
 * All model/grid constants are defined here to avoid scattered dependencies.
 */

export const C = 16;                    // Total channels (4 RGBA + 12 Hidden)
export const HIDDEN_C = 128;            // Hidden layer size in 1×1 Conv MLP
export const PERCEPTION_C = C * 3;      // 48 channels (Identity + SobelX + SobelY)
export const ALPHA_INDEX = 3;           // Index of alpha channel in state vector
export const ALIVE_THRESHOLD = 0.1;     // Alpha threshold for alive mask
export const DEFAULT_UPDATE_RATE = 0.5; // Stochastic update probability
