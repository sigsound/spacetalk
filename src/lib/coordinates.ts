/**
 * Coordinate transformation utilities for Space Talk
 * 
 * The space JSON files use a meter-based coordinate system with origin at top-left:
 * - X-axis: Points to the right
 * - Y-axis: Points down
 * - Origin: Top left corner of the floor plan
 * 
 * The SVG floor plans are 1779×1770 pixels.
 * This utility handles transformation between the two coordinate systems.
 */

export interface CoordinateBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface SpaceJson {
  walls?: Array<{
    centerline: {
      p1: [number, number];
      p2: [number, number];
    };
  }>;
  rooms?: Array<{
    id: string;
    name: string;
    story: number;
    vertices: Array<[number, number]>;
  }>;
  [key: string]: unknown;
}

export interface RoomBounds {
  roomId: string;
  roomName: string;
  story: number;
  // Meter coordinates
  jsonBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    centerX: number;
    centerY: number;
  };
  // Pixel coordinates
  pixelBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
}

/**
 * Extract coordinate bounds from space JSON
 */
export function extractCoordinateBounds(spaceJson: SpaceJson): CoordinateBounds {
  const xCoords: number[] = [];
  const yCoords: number[] = [];
  
  // Collect all X and Y coordinates from walls
  if (spaceJson.walls) {
    for (const wall of spaceJson.walls) {
      xCoords.push(wall.centerline.p1[0], wall.centerline.p2[0]);
      yCoords.push(wall.centerline.p1[1], wall.centerline.p2[1]);
    }
  }
  
  // Also collect from room vertices for completeness
  if (spaceJson.rooms) {
    for (const room of spaceJson.rooms) {
      for (const vertex of room.vertices) {
        xCoords.push(vertex[0]);
        yCoords.push(vertex[1]);
      }
    }
  }
  
  if (xCoords.length === 0 || yCoords.length === 0) {
    throw new Error("No coordinate data found in space JSON");
  }
  
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const minY = Math.min(...yCoords);
  const maxY = Math.max(...yCoords);
  
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Transform JSON coordinates (meters) to SVG pixel coordinates
 * 
 * @param jsonX - X coordinate in JSON space (meters)
 * @param jsonY - Y coordinate in JSON space (meters)
 * @param bounds - Coordinate bounds from the JSON
 * @param svgWidth - SVG width in pixels (default 1779)
 * @param svgHeight - SVG height in pixels (default 1770)
 * @returns [pixelX, pixelY]
 */
export function jsonToPixel(
  jsonX: number,
  jsonY: number,
  bounds: CoordinateBounds,
  svgWidth = 1779,
  svgHeight = 1770
): [number, number] {
  // Normalize to 0-1 range
  const normalizedX = (jsonX - bounds.minX) / bounds.width;
  const normalizedY = (jsonY - bounds.minY) / bounds.height;
  
  // Scale to pixel coordinates
  const pixelX = normalizedX * svgWidth;
  const pixelY = normalizedY * svgHeight;
  
  return [Math.round(pixelX), Math.round(pixelY)];
}

/**
 * Transform SVG pixel coordinates back to JSON coordinates (meters)
 * 
 * @param pixelX - X coordinate in pixels
 * @param pixelY - Y coordinate in pixels
 * @param bounds - Coordinate bounds from the JSON
 * @param svgWidth - SVG width in pixels (default 1779)
 * @param svgHeight - SVG height in pixels (default 1770)
 * @returns [jsonX, jsonY]
 */
export function pixelToJson(
  pixelX: number,
  pixelY: number,
  bounds: CoordinateBounds,
  svgWidth = 1779,
  svgHeight = 1770
): [number, number] {
  // Normalize to 0-1 range
  const normalizedX = pixelX / svgWidth;
  const normalizedY = pixelY / svgHeight;
  
  // Scale to JSON coordinate space
  const jsonX = normalizedX * bounds.width + bounds.minX;
  const jsonY = normalizedY * bounds.height + bounds.minY;
  
  return [jsonX, jsonY];
}

/**
 * Get scaling factors for the transformation
 */
export function getScalingFactors(
  bounds: CoordinateBounds,
  svgWidth = 1779,
  svgHeight = 1770
): { scaleX: number; scaleY: number } {
  return {
    scaleX: svgWidth / bounds.width,
    scaleY: svgHeight / bounds.height,
  };
}

/**
 * Compute bounding boxes for all rooms in pixel space
 */
export function computeAllRoomBounds(
  spaceJson: SpaceJson,
  coordinateBounds: CoordinateBounds,
  svgWidth = 1779,
  svgHeight = 1770
): Map<string, RoomBounds> {
  const roomBoundsMap = new Map<string, RoomBounds>();
  
  if (!spaceJson.rooms) {
    return roomBoundsMap;
  }
  
  for (const room of spaceJson.rooms) {
    if (!room.vertices || room.vertices.length === 0) {
      continue;
    }
    
    // Compute bounding box in JSON (meter) coordinates
    const xCoords = room.vertices.map(v => v[0]);
    const yCoords = room.vertices.map(v => v[1]);
    
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Transform to pixel coordinates
    const [pixelMinX, pixelMinY] = jsonToPixel(minX, minY, coordinateBounds, svgWidth, svgHeight);
    const [pixelMaxX, pixelMaxY] = jsonToPixel(maxX, maxY, coordinateBounds, svgWidth, svgHeight);
    const [pixelCenterX, pixelCenterY] = jsonToPixel(centerX, centerY, coordinateBounds, svgWidth, svgHeight);
    
    roomBoundsMap.set(room.id, {
      roomId: room.id,
      roomName: room.name,
      story: room.story,
      jsonBounds: {
        minX,
        maxX,
        minY,
        maxY,
        centerX,
        centerY,
      },
      pixelBounds: {
        x: pixelMinX,
        y: pixelMinY,
        width: pixelMaxX - pixelMinX,
        height: pixelMaxY - pixelMinY,
        centerX: pixelCenterX,
        centerY: pixelCenterY,
      },
    });
  }
  
  return roomBoundsMap;
}
