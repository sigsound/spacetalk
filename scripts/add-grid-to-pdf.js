#!/usr/bin/env node

/**
 * Add a reference grid overlay to the floorplan PDF
 * This creates a new PDF with a visible 20x20 grid labeled A-T (columns) and 1-20 (rows)
 * 
 * Usage: node scripts/add-grid-to-pdf.js <input.pdf> <output.pdf>
 */

const fs = require('fs');
const { spawn } = require('child_process');

// For this to work, we need pdf-lib or similar
// For now, let's use ImageMagick/GraphicsMagick or a simpler approach

console.log('Grid overlay tool');
console.log('This would require pdf-lib or similar PDF manipulation library');
console.log('For now, we can create a grid overlay SVG and composite it');

// Alternative: Create an SVG grid overlay that can be displayed on top
const svgGrid = `
<svg width="1779" height="1770" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="88.95" height="88.5" patternUnits="userSpaceOnUse">
      <rect width="88.95" height="88.5" fill="none" stroke="rgba(255,0,0,0.3)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1779" height="1770" fill="url(#grid)" />
  
  <!-- Column labels A-T -->
  ${Array.from({length: 20}, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    const x = i * 88.95 + 44.5;
    return `<text x="${x}" y="20" text-anchor="middle" fill="red" font-size="14" font-weight="bold">${letter}</text>`;
  }).join('\n  ')}
  
  <!-- Row labels 1-20 -->
  ${Array.from({length: 20}, (_, i) => {
    const num = i + 1;
    const y = i * 88.5 + 50;
    return `<text x="15" y="${y}" text-anchor="middle" fill="red" font-size="14" font-weight="bold">${num}</text>`;
  }).join('\n  ')}
</svg>
`;

const outputPath = './public/data/grid-overlay.svg';
fs.writeFileSync(outputPath, svgGrid);
console.log(`Created grid overlay SVG at ${outputPath}`);
console.log('You can now overlay this on the floorplan in the UI');
