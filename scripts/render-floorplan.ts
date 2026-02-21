import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { renderFloorplanToSVG } from '../src/lib/floorplanRenderer';

// Load the floorplan JSON
const jsonPath = join(process.cwd(), 'public/data/spaces/space1/floorplan.json');
const floorplanData = JSON.parse(readFileSync(jsonPath, 'utf-8'));

console.log('Loaded floorplan data:');
console.log(`- ${floorplanData.rooms.length} rooms total`);
console.log(`- Story 0: ${floorplanData.rooms.filter((r: any) => r.story === 0).length} rooms`);
console.log(`- Story 1: ${floorplanData.rooms.filter((r: any) => r.story === 1).length} rooms`);

// Render to SVG
console.log('\nRendering floor plan...');
const svg = renderFloorplanToSVG(floorplanData, {
  width: 1779,
  height: 1770,
  padding: 50,
  showLabels: true
});

// Save the SVG
const outputPath = join(process.cwd(), 'public/data/spaces/space1/floorplan-rendered.svg');
writeFileSync(outputPath, svg);
console.log(`✓ Saved rendered floor plan to: ${outputPath}`);

// Also save it without the full path for easier viewing
const publicOutputPath = join(process.cwd(), 'public/floorplan-rendered.svg');
writeFileSync(publicOutputPath, svg);
console.log(`✓ Also saved to: ${publicOutputPath}`);

console.log('\nYou can now view the SVG at:');
console.log('  http://localhost:3000/floorplan-rendered.svg');
