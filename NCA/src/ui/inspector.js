import { C, HIDDEN_C } from '../core/config.js';
import { FILTERS } from '../core/math.js';

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

// Generate channel names dynamically based on C
function makeChannelNames(count) {
  const names = ['R', 'G', 'B', 'α'];
  for (let i = 4; i < count; i++) {
    const digits = String(i).split('').map(d => SUBSCRIPTS[parseInt(d)]).join('');
    names.push(`h${digits}`);
  }
  return names;
}

const CH_NAMES = makeChannelNames(C);
const CH_COLORS = [
  '#ef4444', '#22c55e', '#3b82f6', '#f59e0b',  // RGBA
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',  // hidden 4-7
  '#f97316', '#14b8a6', '#a855f7', '#e879f9',  // hidden 8-11
  '#fb923c', '#2dd4bf', '#818cf8', '#c084fc'   // hidden 12-15
];

function fmt(v) { return v.toFixed(4); }
function fmtShort(v) { return Math.abs(v) < 0.001 ? '0' : v.toFixed(2); }

// ── Channel bar chart: horizontal bars showing channel values ──
function renderChannelBars(vec, title, compareVec) {
  const count = vec.length;
  const maxAbs = Math.max(0.01, ...Array.from(vec).map(v => Math.abs(v)));

  let rows = '';
  for (let i = 0; i < count; i++) {
    const val = vec[i];
    const pct = Math.min(100, (Math.abs(val) / maxAbs) * 100);
    const name = i < CH_NAMES.length ? CH_NAMES[i] : `ch${i}`;
    const color = i < CH_COLORS.length ? CH_COLORS[i] : '#888';
    const dir = val >= 0 ? 'right' : 'left';

    let delta = '';
    if (compareVec) {
      const d = val - compareVec[i];
      if (Math.abs(d) > 0.0001) {
        const arrow = d > 0 ? '▲' : '▼';
        const dColor = d > 0 ? '#22c55e' : '#ef4444';
        delta = `<span class="ch-delta" style="color:${dColor}">${arrow}${Math.abs(d).toFixed(3)}</span>`;
      }
    }

    rows += `<div class="ch-row">
      <span class="ch-label" style="color:${color}">${name}</span>
      <div class="ch-bar-track">
        <div class="ch-bar-center"></div>
        <div class="ch-bar-fill ${dir}" style="width:${pct / 2}%;background:${color}"></div>
      </div>
      <span class="ch-val">${fmt(val)}</span>
      ${delta}
    </div>`;
  }

  return `<div class="channel-chart">
    <div class="chart-title">${title}</div>
    ${rows}
  </div>`;
}

// ── 3x3 Matrix visualization (for filters or neighborhood alpha) ──
function renderMatrix3x3(values, title, cellSize) {
  const size = cellSize || 48;
  let cells = '';
  for (let i = 0; i < 9; i++) {
    const v = values[i];
    const absV = Math.abs(v);
    const maxV = Math.max(0.01, ...values.map(x => Math.abs(x)));
    const intensity = absV / maxV;
    const bg = v > 0
      ? `rgba(59,130,246,${intensity * 0.6})`
      : v < 0
        ? `rgba(239,68,68,${intensity * 0.6})`
        : 'transparent';
    const highlight = i === 4 ? 'border:1px solid var(--accent-hover);' : '';
    cells += `<div class="m3-cell" style="width:${size}px;height:${size}px;background:${bg};${highlight}">${fmtShort(v)}</div>`;
  }
  return `<div class="matrix-block">
    <div class="tensor-title">${title}</div>
    <div class="m3-grid">${cells}</div>
  </div>`;
}

// ── Equation box ──
function renderEquation(text) {
  return `<div class="equation">${text}</div>`;
}

// ── Main Inspector ──
// Receives pre-computed debug data from app.js — does not call core logic directly.
export class Inspector {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  // Render when no step has been taken yet
  renderPlaceholder(cx, cy) {
    this.container.innerHTML = `
    <div class="card card-header">
      <div class="cell-info">
        <span class="cell-coord">Cell (${cx}, ${cy})</span>
        <span class="badge">Press Step to see computation details</span>
      </div>
    </div>`;
  }

  // Render full step debug data (data comes from getCellStepDebug)
  render(data, cx, cy) {
    // Save scroll position to prevent jumping during real-time updates
    const prevScrollTop = this.container.scrollTop;

    // ━━━━━━━━━ CARD 0: Cell Info ━━━━━━━━━
    const updatedBadge = data.wasUpdated
      ? '<span class="badge badge-ok">Updated ✓</span>'
      : '<span class="badge badge-skip">Skipped ✗</span>';

    const preAliveBadge = data.preAlive
      ? '<span class="badge badge-ok">Pre-Alive</span>'
      : '<span class="badge badge-dead">Pre-Dead</span>';
    const postAliveBadge = data.postAlive
      ? '<span class="badge badge-ok">Post-Alive</span>'
      : '<span class="badge badge-dead">Post-Dead</span>';

    // ━━━━━━━━━ CARD 1: Neighborhood + Current State ━━━━━━━━━
    const neighborAlpha = data.neighborhood.map(n => n[3]);

    // ━━━━━━━━━ CARD 3: Neural Network stats ━━━━━━━━━
    const activeNeurons = Array.from(data.X).filter(v => v > 0).length;
    const maxHidden = Math.max(...Array.from(data.X));

    let html = `
    <!-- Cell Header -->
    <div class="card card-header">
      <div class="cell-info">
        <span class="cell-coord">Cell (${cx}, ${cy})</span>
        ${preAliveBadge}
        ${postAliveBadge}
        ${updatedBadge}
      </div>
    </div>
    
    <!-- CARD 1: Current State + Neighborhood -->
    <div class="card">
      <div class="card-title">Current State  S<sub>t</sub></div>
      ${renderEquation('S<sub>t</sub> ∈ ℝ<sup>16</sup> &nbsp;=&nbsp; [R, G, B, α, h₄, h₅, ..., h₁₅]')}
      <div class="card-body-row">
        <div>
          ${renderMatrix3x3(neighborAlpha, '3×3 이웃 Alpha (α)', 42)}
        </div>
        <div style="flex:1">
          ${renderChannelBars(data.currentState, '16-Channel State Vector')}
        </div>
      </div>
    </div>
    
    <!-- CARD 2: Perception -->
    <div class="card">
      <div class="card-title">Step 1 — Perception (합성곱)</div>
      ${renderEquation('P<sub>i,j</sub> = [ S<sub>t</sub> ∗ I,&nbsp; S<sub>t</sub> ∗ K<sub>x</sub>,&nbsp; S<sub>t</sub> ∗ K<sub>y</sub> ] ∈ ℝ<sup>48</sup>')}
      <p class="card-desc">각 채널별로 3개의 고정 필터(Identity, Sobel X÷8, Sobel Y÷8)를 적용하여 48차원 인지 벡터를 생성합니다.</p>
      
      <div class="filter-row">
        ${renderMatrix3x3(FILTERS.identity, 'Identity (I)', 36)}
        <span class="op-symbol">,</span>
        ${renderMatrix3x3(FILTERS.sobelX.map(v => v * 8), 'Sobel X (÷8)', 36)}
        <span class="op-symbol">,</span>
        ${renderMatrix3x3(FILTERS.sobelY.map(v => v * 8), 'Sobel Y (÷8)', 36)}
      </div>
      
      <div class="perception-results">
        ${renderChannelBars(data.pIdentity, 'P[0:16] = S∗I (Self)')}
        ${renderChannelBars(data.pSobelX, 'P[16:32] = S∗Kₓ (Horizontal Gradient)')}
        ${renderChannelBars(data.pSobelY, 'P[32:48] = S∗Kᵧ (Vertical Gradient)')}
      </div>
    </div>
    
    <!-- CARD 3: Neural Network -->
    <div class="card">
      <div class="card-title">Step 2 — Neural Network (1×1 Conv MLP)</div>
      ${renderEquation('X = ReLU( P · W₁ + b₁ ) &nbsp;&nbsp;&nbsp; W₁ ∈ ℝ<sup>48×128</sup>')}
      ${renderEquation('ΔS = X · W₂ + b₂ &nbsp;&nbsp;&nbsp; W₂ ∈ ℝ<sup>128×16</sup>')}
      
      <div class="nn-flow">
        <div class="nn-block">
          <div class="tensor-title">Input P</div>
          <div class="nn-shape">48-dim</div>
        </div>
        <span class="flow-arrow">→ W₁ →</span>
        <div class="nn-block">
          <div class="tensor-title">Hidden (pre-ReLU)</div>
          <div class="nn-shape">128-dim</div>
        </div>
        <span class="flow-arrow">→ ReLU →</span>
        <div class="nn-block nn-active">
          <div class="tensor-title">Hidden X</div>
          <div class="nn-shape">${activeNeurons}/${HIDDEN_C} active</div>
          <div class="nn-shape">max: ${maxHidden.toFixed(3)}</div>
        </div>
        <span class="flow-arrow">→ W₂ →</span>
        <div class="nn-block">
          <div class="tensor-title">Output ΔS</div>
          <div class="nn-shape">${C}-dim</div>
        </div>
      </div>
      
      ${renderChannelBars(data.dS, 'ΔS (State Update Delta)', null)}
    </div>
    
    <!-- CARD 4: State Update -->
    <div class="card">
      <div class="card-title">Step 3 — State Update</div>
      ${data.wasUpdated
        ? renderEquation('S<sub>t+1</sub> = ( S<sub>t</sub> + M ⊙ ΔS ) × AliveMask &nbsp;&nbsp; <em style="color:var(--accent-hover)">M=1 (Updated)</em>')
        : renderEquation('S<sub>t+1</sub> = S<sub>t</sub> × AliveMask &nbsp;&nbsp; <em style="color:var(--danger)">M=0 (Skipped by Stochastic Mask)</em>')}
      <p class="card-desc">
        M ~ Bernoulli(0.5): 각 셀은 50% 확률로만 업데이트됩니다.<br/>
        AliveMask = PreAlive ∧ PostAlive: 업데이트 전후 모두 3×3 이웃 중 α > 0.1인 셀이 있어야 생존합니다.
      </p>
      
      <div class="update-comparison">
        ${renderChannelBars(data.newState, 'S<sub>t+1</sub> (Next State)', data.currentState)}
      </div>
    </div>
    `;

    this.container.innerHTML = html;

    // Restore scroll position
    this.container.scrollTop = prevScrollTop;
  }
}
