export type AnalysisType = 'ada' | 'compliance' | 'damage';

export interface Space {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  imageCount: number;
  metadata: Record<string, unknown>;
  // Floorplan data
  floorplanSvgUrl: string | null;
  floorplanCsvUrl: string | null;
  reportPdfUrl: string | null;
  // Optional address/location info from metadata
  address?: string;
  area?: number; // in square meters
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface UploadedFile {
  name: string;
  content: string;
  type: string;
}

// Sampled image with room assignment and URL
export interface SampledImage {
  filename: string;
  room: string;
  url: string;
  index: number;  // Position in the analysis (e.g., "Image 1", "Image 2")
}

// Sampled images grouped by space and room
export interface SampledImagesData {
  spaces: {
    spaceId: string;
    spaceName: string;
    totalImages: number;
    sampledImages: SampledImage[];
    byRoom: { [roomLabel: string]: SampledImage[] };
  }[];
  totalSampled: number;
}
