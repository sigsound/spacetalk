// Sample 50 images per space for visual analysis
const MAX_SAMPLED_IMAGES = 50;
// Minimum images to sample per room (ensures coverage)
const MIN_IMAGES_PER_ROOM = 2;

/**
 * Simple uniform sampling (original behavior).
 * Used as fallback when room data is not available.
 */
export function sampleImages(totalCount: number): number[] {
  if (totalCount <= MAX_SAMPLED_IMAGES) {
    return Array.from({ length: totalCount }, (_, i) => i);
  }

  // Evenly distribute samples across the image set
  const interval = Math.floor(totalCount / MAX_SAMPLED_IMAGES);
  const indices: number[] = [];
  for (let i = 0; i < totalCount && indices.length < MAX_SAMPLED_IMAGES; i += interval) {
    indices.push(i);
  }
  return indices;
}

/**
 * Sample images evenly from within a single room.
 * Returns indices within the room's image array.
 */
function sampleFromRoom(roomImages: string[], count: number): number[] {
  if (roomImages.length <= count) {
    return Array.from({ length: roomImages.length }, (_, i) => i);
  }
  
  const interval = Math.floor(roomImages.length / count);
  const indices: number[] = [];
  for (let i = 0; i < roomImages.length && indices.length < count; i += interval) {
    indices.push(i);
  }
  return indices;
}

export interface ImagesByRoom {
  [roomLabel: string]: string[];
}

export interface RoomSamplingResult {
  images: string[];           // Flat list of sampled image filenames
  roomBreakdown: {            // For logging/debugging
    [roomLabel: string]: number;
  };
}

/**
 * Sample images proportionally from each room to ensure spatial coverage.
 * 
 * Algorithm:
 * 1. Calculate each room's proportion of total images
 * 2. Allocate samples proportionally, with minimum per room
 * 3. Sample evenly within each room's image set
 */
export function sampleImagesByRoom(
  imagesByRoom: ImagesByRoom,
  maxTotal: number = MAX_SAMPLED_IMAGES
): RoomSamplingResult {
  const roomLabels = Object.keys(imagesByRoom).filter(r => imagesByRoom[r].length > 0);
  const totalImages = roomLabels.reduce((sum, r) => sum + imagesByRoom[r].length, 0);
  
  if (totalImages === 0) {
    return { images: [], roomBreakdown: {} };
  }
  
  // If total images <= max, just return all
  if (totalImages <= maxTotal) {
    const allImages: string[] = [];
    const roomBreakdown: { [roomLabel: string]: number } = {};
    for (const room of roomLabels) {
      allImages.push(...imagesByRoom[room]);
      roomBreakdown[room] = imagesByRoom[room].length;
    }
    return { images: allImages, roomBreakdown };
  }
  
  // Calculate proportional allocation with minimum per room
  const allocations: { [room: string]: number } = {};
  let totalAllocated = 0;
  
  // First pass: allocate minimum to each room
  for (const room of roomLabels) {
    const roomCount = imagesByRoom[room].length;
    allocations[room] = Math.min(MIN_IMAGES_PER_ROOM, roomCount);
    totalAllocated += allocations[room];
  }
  
  // Second pass: distribute remaining budget proportionally
  const remaining = maxTotal - totalAllocated;
  if (remaining > 0) {
    // Calculate proportions excluding already-allocated minimum
    const proportions: { room: string; proportion: number; maxAdditional: number }[] = [];
    for (const room of roomLabels) {
      const roomCount = imagesByRoom[room].length;
      const proportion = roomCount / totalImages;
      const maxAdditional = roomCount - allocations[room];
      proportions.push({ room, proportion, maxAdditional });
    }
    
    // Sort by proportion descending to allocate to larger rooms first
    proportions.sort((a, b) => b.proportion - a.proportion);
    
    let leftToAllocate = remaining;
    for (const { room, proportion, maxAdditional } of proportions) {
      if (leftToAllocate <= 0) break;
      const additional = Math.min(
        Math.floor(proportion * remaining),
        maxAdditional,
        leftToAllocate
      );
      allocations[room] += additional;
      leftToAllocate -= additional;
    }
    
    // Distribute any remaining one by one to largest rooms
    while (leftToAllocate > 0) {
      for (const { room, maxAdditional } of proportions) {
        if (leftToAllocate <= 0) break;
        const currentAlloc = allocations[room];
        const roomCount = imagesByRoom[room].length;
        if (currentAlloc < roomCount) {
          allocations[room]++;
          leftToAllocate--;
        }
      }
    }
  }
  
  // Sample from each room according to allocation
  const sampledImages: string[] = [];
  const roomBreakdown: { [roomLabel: string]: number } = {};
  
  for (const room of roomLabels) {
    const roomImages = imagesByRoom[room];
    const count = allocations[room];
    const indices = sampleFromRoom(roomImages, count);
    
    for (const idx of indices) {
      sampledImages.push(roomImages[idx]);
    }
    roomBreakdown[room] = indices.length;
  }
  
  return { images: sampledImages, roomBreakdown };
}
