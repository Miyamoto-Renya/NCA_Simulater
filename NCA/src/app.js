import { createGrid, seedCenter, stepNCA, getCellStepDebug } from './core/nca.js';
import { modelWeights, loadRandomModel, currentModelName } from './core/modelWeights.js';
import { DEFAULT_UPDATE_RATE } from './core/config.js';
import { GridRenderer } from './ui/grid.js';
import { Inspector } from './ui/inspector.js';

const W = 32;
const H = 32;

// ── Unified application state ──
let grid = createGrid(W, H);
seedCenter(grid, W, H);

let isPlaying = false;
let animationId = null;
let stepCount = 0;              // Moved to module scope (was trapped in closure)
let lastStepResult = null;      // Full step result (preGrid, masks, etc.)
let selectedCell = null;
let stepsPerFrame = 1;

const gridRenderer = new GridRenderer('nca-canvas', W, H, handleCellClick);
const inspector = new Inspector('inspector');

// ── Inspector update — uses step result for timing ──
function updateInspector() {
  if (!selectedCell) return;
  const { x, y } = selectedCell;
  
  if (lastStepResult) {
    const debugData = getCellStepDebug(lastStepResult, W, H, x, y, modelWeights);
    inspector.render(debugData, x, y);
  } else {
    inspector.renderPlaceholder(x, y);
  }
}

function handleCellClick(x, y) {
  selectedCell = {x, y};
  gridRenderer.setSelectedCell(x, y);
  gridRenderer.render(grid);
  updateInspector();
}

function updateStepCounter() {
  document.getElementById('step-counter').textContent = `[${currentModelName || 'NCA'}] Step: ${stepCount}`;
}

function doStep() {
  lastStepResult = stepNCA(grid, W, H, modelWeights, DEFAULT_UPDATE_RATE);
  stepCount++;
  updateStepCounter();
  gridRenderer.render(grid);
  updateInspector();
}

function loop() {
  if (isPlaying) {
    for (let i = 0; i < stepsPerFrame; i++) {
      lastStepResult = stepNCA(grid, W, H, modelWeights, DEFAULT_UPDATE_RATE);
      stepCount++;
    }
    updateStepCounter();
    gridRenderer.render(grid);
    updateInspector();

    setTimeout(() => {
      animationId = requestAnimationFrame(loop);
    }, 50);
  }
}

async function togglePlay() {
  isPlaying = !isPlaying;
  document.getElementById('btn-play').textContent = isPlaying ? '⏸ Pause' : '▶ Play';
  document.getElementById('btn-play').classList.toggle('primary', isPlaying);
  if (isPlaying) {
    if (stepCount === 0) {
      await loadRandomModel();
      updateStepCounter();
    }
    loop();
  } else {
    cancelAnimationFrame(animationId);
  }
}

function setupControls() {
  const controlsDiv = document.getElementById('controls');
  
  let channelOptions = `<option value="-1">RGB Mode</option>`;
  for(let i=0; i<16; i++) {
    channelOptions += `<option value="${i}">Channel ${i}</option>`;
  }

  controlsDiv.innerHTML = `
    <div class="control-group">
      <button id="btn-play">▶ Play</button>
      <button id="btn-step">⏭ Step</button>
      <button id="btn-reset">↺ Reset</button>
      <button id="btn-seed">⊕ Seed</button>
    </div>
    <div class="control-group settings">
      <label title="Simulation steps per frame">Speed:
        <input type="range" id="speed-slider" min="1" max="20" value="1">
      </label>
      <select id="channel-select" title="View Hidden Channels">
        ${channelOptions}
      </select>
    </div>
    <span class="step-counter" id="step-counter">Step: 0</span>
  `;
  
  document.getElementById('btn-play').addEventListener('click', togglePlay);
  
  document.getElementById('btn-step').addEventListener('click', async () => {
    if (isPlaying) togglePlay();
    if (stepCount === 0) {
      await loadRandomModel();
      updateStepCounter();
    }
    doStep();
  });
  
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (isPlaying) togglePlay();
    grid = createGrid(W, H);
    lastStepResult = null;
    stepCount = 0;
    updateStepCounter();
    gridRenderer.render(grid);
    updateInspector();
  });
  
  document.getElementById('btn-seed').addEventListener('click', () => {
    seedCenter(grid, W, H);
    gridRenderer.render(grid);
    updateInspector();
  });

  document.getElementById('speed-slider').addEventListener('input', (e) => {
    stepsPerFrame = parseInt(e.target.value, 10);
  });

  document.getElementById('channel-select').addEventListener('change', (e) => {
    gridRenderer.setChannelView(parseInt(e.target.value, 10));
    gridRenderer.render(grid);
  });
}

// Initialization
setupControls();
gridRenderer.render(grid);
