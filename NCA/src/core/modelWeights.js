/**
 * Pre-trained NCA model loader and decoder.
 * Loads Base64-encoded model weights from the models/ directory
 * and sets them in the modelWeights object.
 */

import { C, HIDDEN_C, PERCEPTION_C } from './config.js';

// Zero-initialized default weights; overwritten when loadRandomModel() completes
export const modelWeights = {
  w1: new Float32Array(PERCEPTION_C * HIDDEN_C),
  b1: new Float32Array(HIDDEN_C),
  w2: new Float32Array(HIDDEN_C * C),
  b2: new Float32Array(C)
};

function decodeLayer(layerData) {
  const rawStr = atob(layerData.data_b64);
  const in_ch = layerData.in_ch;
  const out_ch = layerData.out_ch;
  const w_scale = layerData.weight_scale;
  const b_scale = layerData.bias_scale;
  
  const weights = new Float32Array(in_ch * out_ch);
  const biases = new Float32Array(out_ch);
  
  let byteIdx = 0;
  // Read weights
  for (let i = 0; i < in_ch * out_ch; i++) {
    const v = rawStr.charCodeAt(byteIdx++) / 255.0;
    weights[i] = (v - 0.5) * w_scale;
  }
  // Read biases
  for (let i = 0; i < out_ch; i++) {
    const v = rawStr.charCodeAt(byteIdx++) / 255.0;
    biases[i] = (v - 0.5) * b_scale;
  }
  return { weights, biases };
}

const AVAILABLE_MODELS = [
  'tree', 'ladybug', 'fish', 'eye', 'explosion', 
  'spiderweb', 'smiley', 'pretzel', 'butterfly', 'lizard'
];

export let currentModelName = 'lizard'; // default

export async function loadRandomModel() {
  try {
    const randomIdx = Math.floor(Math.random() * AVAILABLE_MODELS.length);
    currentModelName = AVAILABLE_MODELS[randomIdx];
    
    const response = await fetch(`models/${currentModelName}.json`);
    if (!response.ok) throw new Error(`Failed to load ${currentModelName}.json`);
    const data = await response.json();
    
    const l1 = decodeLayer(data[0]);
    const l2 = decodeLayer(data[1]);
    
    // 덮어씌우기
    modelWeights.w1.set(l1.weights);
    modelWeights.b1.set(l1.biases);
    modelWeights.w2.set(l2.weights);
    modelWeights.b2.set(l2.biases);
    console.log(`Pre-trained NCA model loaded: ${currentModelName}`);
  } catch (err) {
    console.error("Error loading model:", err);
  }
}
