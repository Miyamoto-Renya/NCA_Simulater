import { C } from '../core/config.js';

export class GridRenderer {
  constructor(canvasId, W, H, onCellClick) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.W = W;
    this.H = H;
    this.scale = Math.floor(Math.min(600 / W, 600 / H));
    
    this.canvas.width = this.W * this.scale;
    this.canvas.height = this.H * this.scale;
    
    this.imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / this.scale);
      const y = Math.floor((e.clientY - rect.top) / this.scale);
      if (x >= 0 && x < W && y >= 0 && y < H) {
        onCellClick(x, y);
      }
    });
    
    this.selectedCell = null;
    this.viewChannel = -1;
  }
  
  setChannelView(channelIdx) {
    this.viewChannel = channelIdx;
  }
  
  setSelectedCell(x, y) {
    this.selectedCell = {x, y};
  }
  
  render(grid) {
    // Fill imageData
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const offset = (y * this.W + x) * C;
        let r, g, b;
        
        if (this.viewChannel === -1) {
          // RGB Mode (pre-multiplied by alpha)
          r = Math.min(255, Math.max(0, grid[offset + 0] * 255));
          g = Math.min(255, Math.max(0, grid[offset + 1] * 255));
          b = Math.min(255, Math.max(0, grid[offset + 2] * 255));
        } else {
          // Hidden Channel Mode (Grayscale)
          // Value range is roughly -1.0 to 1.0, map to 0~255 with 0 mapped to 127.5
          const val = grid[offset + this.viewChannel];
          const c = Math.min(255, Math.max(0, Math.floor((val + 1) * 127.5)));
          r = g = b = c;
        }
        
        // Render scaled pixels
        for (let dy = 0; dy < this.scale; dy++) {
          for (let dx = 0; dx < this.scale; dx++) {
            const px = x * this.scale + dx;
            const py = y * this.scale + dy;
            const idx = (py * this.canvas.width + px) * 4;
            
            this.imageData.data[idx + 0] = r;
            this.imageData.data[idx + 1] = g;
            this.imageData.data[idx + 2] = b;
            this.imageData.data[idx + 3] = 255; // Always opaque to prevent canvas transparency
          }
        }
      }
    }
    
    this.ctx.putImageData(this.imageData, 0, 0);
    
    // Draw selection box
    if (this.selectedCell) {
      this.ctx.strokeStyle = '#ef4444'; // danger red
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(
        this.selectedCell.x * this.scale,
        this.selectedCell.y * this.scale,
        this.scale,
        this.scale
      );
      
      // Draw 3x3 perception boundary
      this.ctx.strokeStyle = '#3b82f6'; // blue
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(
        (this.selectedCell.x - 1) * this.scale,
        (this.selectedCell.y - 1) * this.scale,
        this.scale * 3,
        this.scale * 3
      );
    }
  }
}
