/**
 * Maps room names to pixel coordinates by transforming floorplan.json data
 * to match the coordinate system of floorplan.svg
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

interface RoomBounds {
  roomId: string;
  roomName: string;
  story: number;
  vertices: Point[];
  bounds: {
    x: number;      // top-left x
    y: number;      // top-left y
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
}

// SVG dimensions (matching the original floorplan.svg)
const SVG_WIDTH = 1779;
const SVG_HEIGHT = 1770;

/**
 * Calculate bounds for rooms on a specific story
 */
function calculateStoryBounds(rooms: Room[], story: number) {
  const storyRooms = rooms.filter(r => r.story === story);
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const room of storyRooms) {
    for (const [x, y] of room.vertices) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  
  return { minX, maxX, minY, maxY };
}

/**
 * Create a coordinate transformer that matches the original floorplan.svg layout
 */
function createTransformer(data: FloorplanData) {
  const story0Bounds = calculateStoryBounds(data.rooms, 0);
  const story1Bounds = calculateStoryBounds(data.rooms, 1);
  
  // Calculate meter dimensions
  const story0Width = story0Bounds.maxX - story0Bounds.minX;
  const story0Height = story0Bounds.maxY - story0Bounds.minY;
  const story1Width = story1Bounds.maxX - story1Bounds.minX;
  const story1Height = story1Bounds.maxY - story1Bounds.minY;
  
  // The SVG maintains aspect ratio with uniform scale
  // Measured from actual SVG polylines (e.g., Kitchen room):
  //   Kitchen JSON: (0.371, 8.109)m to (3.918, 11.224)m
  //   Kitchen SVG: (167, 1019)px to (532, 1341)px
  //   Scale: ~103 pixels per meter (uniform)
  //   Offset: ~(129, 194)px
  
  const totalMetersWidth = story0Width + story1Width;
  const maxMetersHeight = Math.max(story0Height, story1Height);
  
  // Uniform scale measured from SVG
  const scale = 103;  // pixels per meter
  const SVG_OFFSET_X = 129;
  const SVG_OFFSET_Y = 194;
  
  const scaleX = scale;
  const scaleY = scale;
  
  // Both floors share the same Y coordinate system, so use global minY
  const globalMinY = Math.min(story0Bounds.minY, story1Bounds.minY);
  
  return {
    transform: (x: number, y: number, story: number): Point => {
      if (story === 0) {
        return {
          x: SVG_OFFSET_X + (x - story0Bounds.minX) * scaleX,
          y: SVG_OFFSET_Y + (y - globalMinY) * scaleY
        };
      } else {
        const story0PixelWidth = story0Width * scaleX;
        return {
          x: SVG_OFFSET_X + story0PixelWidth + (x - story1Bounds.minX) * scaleX,
          y: SVG_OFFSET_Y + (y - globalMinY) * scaleY
        };
      }
    },
    scaleX,
    scaleY,
    story0Bounds,
    story1Bounds
  };
}

/**
 * Map all rooms to pixel coordinates
 */
export function mapRoomsToPixels(data: FloorplanData): Map<string, RoomBounds> {
  const transformer = createTransformer(data);
  const roomMap = new Map<string, RoomBounds>();
  
  for (const room of data.rooms) {
    // Transform all vertices to pixels
    const pixelVertices = room.vertices.map(([x, y]) => 
      transformer.transform(x, y, room.story)
    );
    
    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const pt of pixelVertices) {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y);
      maxY = Math.max(maxY, pt.y);
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;
    
    roomMap.set(room.name.toLowerCase(), {
      roomId: room.id,
      roomName: room.name,
      story: room.story,
      vertices: pixelVertices,
      bounds: {
        x: minX,
        y: minY,
        width,
        height,
        centerX,
        centerY
      }
    });
  }
  
  return roomMap;
}

/**
 * Find a room by name (case-insensitive, fuzzy match)
 */
export function findRoomByName(
  roomMap: Map<string, RoomBounds>,
  searchName: string
): RoomBounds | null {
  const search = searchName.toLowerCase().trim();
  
  // Try exact match first
  if (roomMap.has(search)) {
    return roomMap.get(search)!;
  }
  
  // Try partial match
  for (const [name, bounds] of roomMap.entries()) {
    if (name.includes(search) || search.includes(name)) {
      return bounds;
    }
  }
  
  // Try fuzzy match - extract key words
  const searchWords = search.split(/\s+/);
  const keyWords = ['kitchen', 'bathroom', 'bedroom', 'living', 'dining', 'office', 'other', 'hallway', 'closet', 'stairway', 'mud', 'room'];
  
  for (const [name, bounds] of roomMap.entries()) {
    // Check if any search word matches any room type
    for (const word of searchWords) {
      if (keyWords.some(k => word.includes(k) || k.includes(word))) {
        // Check if this word is in the room name
        if (name.includes(word)) {
          return bounds;
        }
      }
    }
  }
  
  // Last resort: find closest match by room type
  const searchType = searchWords.find(w => keyWords.some(k => w.includes(k) || k.includes(w)));
  if (searchType) {
    for (const [name, bounds] of roomMap.entries()) {
      if (name.includes(searchType)) {
        console.warn(`Fuzzy matched "${searchName}" to "${bounds.roomName}"`);
        return bounds;
      }
    }
  }
  
  return null;
}

/**
 * Find multiple rooms by name pattern (e.g., "bedroom", "bathroom")
 */
export function findRoomsByPattern(
  roomMap: Map<string, RoomBounds>,
  pattern: string
): RoomBounds[] {
  const search = pattern.toLowerCase().trim();
  const matches: RoomBounds[] = [];
  
  for (const [name, bounds] of roomMap.entries()) {
    if (name.includes(search)) {
      matches.push(bounds);
    }
  }
  
  return matches;
}

/**
 * Export type for room bounds
 */
export type { RoomBounds, FloorplanData };
