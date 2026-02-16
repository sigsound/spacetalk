// Sample 50 images per space for visual analysis
const MAX_SAMPLED_IMAGES = 50;

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
