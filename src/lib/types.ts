export type AnalysisType = 'ada' | 'compliance' | 'damage';

export interface Space {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  imageCount: number;
  metadata: Record<string, unknown>;
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
