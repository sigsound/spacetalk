/**
 * Renders a floor plan from JSON data to SVG
 * This gives us precise control over coordinate transformation
 */

interface Point {
  x: number;
  y: number;
}

interface Room {
  id: string;
  story: number;
  name: string;
  vertices: number[][];
}

interface FloorplanData {
  rooms: Room[];
}

interface RenderOptions {
  width: number;
  height: number;
  padding: number;
  showLabels: boolean;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Calculate bounds for all rooms on a specific story
 */
function calculateStoryBounds(rooms: Room[], story: number): Bounds {
  const storyRooms = rooms.filter(r => r.story === story);
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const room of storyRooms) {
    for (const vertex of room.vertices) {
      const [x, y] = vertex;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  
  return { minX, maxX, minY, maxY };
}

/**
 * Transform JSON meter coordinates to SVG pixel coordinates
 */
export function createCoordinateTransformer(
  data: FloorplanData,
  options: RenderOptions
) {
  // Calculate bounds for each story
  const story0Bounds = calculateStoryBounds(data.rooms, 0);
  const story1Bounds = calculateStoryBounds(data.rooms, 1);
  
  // Calculate dimensions in meters
  const story0Width = story0Bounds.maxX - story0Bounds.minX;
  const story0Height = story0Bounds.maxY - story0Bounds.minY;
  const story1Width = story1Bounds.maxX - story1Bounds.minX;
  const story1Height = story1Bounds.maxY - story1Bounds.minY;
  
  // Total width includes both stories side by side with padding between
  const totalMetersWidth = story0Width + story1Width;
  const maxMetersHeight = Math.max(story0Height, story1Height);
  
  // Calculate scale to fit in target dimensions
  const availableWidth = options.width - (options.padding * 3); // padding on left, middle, right
  const availableHeight = options.height - (options.padding * 2); // padding on top, bottom
  
  const scaleX = availableWidth / totalMetersWidth;
  const scaleY = availableHeight / maxMetersHeight;
  const scale = Math.min(scaleX, scaleY); // Use uniform scale
  
  // Transform function
  return {
    transform: (x: number, y: number, story: number): Point => {
      if (story === 0) {
        // Story 0 on the left
        return {
          x: options.padding + (x - story0Bounds.minX) * scale,
          y: options.padding + (y - story0Bounds.minY) * scale
        };
      } else {
        // Story 1 on the right, offset by story 0 width + padding
        const story0PixelWidth = story0Width * scale;
        return {
          x: options.padding + story0PixelWidth + options.padding + (x - story1Bounds.minX) * scale,
          y: options.padding + (y - story1Bounds.minY) * scale
        };
      }
    },
    scale,
    story0Bounds,
    story1Bounds
  };
}

/**
 * Generate SVG path data for a room polygon
 */
function roomToPath(vertices: number[][], story: number, transformer: any): string {
  const points = vertices.map(([x, y]) => {
    const pt = transformer.transform(x, y, story);
    return `${pt.x},${pt.y}`;
  });
  
  return `M ${points.join(' L ')} Z`;
}

/**
 * Generate color for a room based on its name/type
 */
function getRoomColor(roomName: string): string {
  const name = roomName.toLowerCase();
  
  if (name.includes('kitchen')) return '#fef3c7';
  if (name.includes('bathroom')) return '#dbeafe';
  if (name.includes('bedroom')) return '#fce7f3';
  if (name.includes('living')) return '#dcfce7';
  if (name.includes('dining')) return '#fed7aa';
  if (name.includes('closet')) return '#e0e7ff';
  if (name.includes('hallway')) return '#f3f4f6';
  
  return '#f9fafb'; // Default gray
}

/**
 * Render floor plan to SVG string
 */
export function renderFloorplanToSVG(
  data: FloorplanData,
  options: RenderOptions = {
    width: 1779,
    height: 1770,
    padding: 50,
    showLabels: true
  }
): string {
  const transformer = createCoordinateTransformer(data, options);
  
  let svg = `<svg width="${options.width}" height="${options.height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Background
  svg += `<rect width="${options.width}" height="${options.height}" fill="#ffffff"/>`;
  
  // Group rooms by story
  const story0Rooms = data.rooms.filter(r => r.story === 0);
  const story1Rooms = data.rooms.filter(r => r.story === 1);
  
  // Render Story 0
  svg += `<g id="story-0">`;
  for (const room of story0Rooms) {
    const path = roomToPath(room.vertices, 0, transformer);
    const color = getRoomColor(room.name);
    
    svg += `<path d="${path}" fill="${color}" stroke="#374151" stroke-width="2"/>`;
    
    // Add label if enabled
    if (options.showLabels && room.vertices.length > 0) {
      // Calculate centroid
      let sumX = 0, sumY = 0;
      for (const [x, y] of room.vertices) {
        const pt = transformer.transform(x, y, 0);
        sumX += pt.x;
        sumY += pt.y;
      }
      const centerX = sumX / room.vertices.length;
      const centerY = sumY / room.vertices.length;
      
      svg += `<text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#374151">${room.name}</text>`;
    }
  }
  svg += `</g>`;
  
  // Render Story 1
  svg += `<g id="story-1">`;
  for (const room of story1Rooms) {
    const path = roomToPath(room.vertices, 1, transformer);
    const color = getRoomColor(room.name);
    
    svg += `<path d="${path}" fill="${color}" stroke="#374151" stroke-width="2"/>`;
    
    // Add label if enabled
    if (options.showLabels && room.vertices.length > 0) {
      let sumX = 0, sumY = 0;
      for (const [x, y] of room.vertices) {
        const pt = transformer.transform(x, y, 1);
        sumX += pt.x;
        sumY += pt.y;
      }
      const centerX = sumX / room.vertices.length;
      const centerY = sumY / room.vertices.length;
      
      svg += `<text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#374151">${room.name}</text>`;
    }
  }
  svg += `</g>`;
  
  // Add story labels
  svg += `<text x="${options.padding}" y="${options.padding - 20}" font-size="16" font-weight="bold" fill="#111827">First Floor</text>`;
  const story0PixelWidth = (transformer.story0Bounds.maxX - transformer.story0Bounds.minX) * transformer.scale;
  svg += `<text x="${options.padding + story0PixelWidth + options.padding}" y="${options.padding - 20}" font-size="16" font-weight="bold" fill="#111827">Second Floor</text>`;
  
  svg += `</svg>`;
  
  return svg;
}

/**
 * Export the transformer for use in annotation coordinate conversion
 */
export function getTransformerForSpace(data: FloorplanData): any {
  const options = {
    width: 1779,
    height: 1770,
    padding: 50,
    showLabels: true
  };
  
  return createCoordinateTransformer(data, options);
}
