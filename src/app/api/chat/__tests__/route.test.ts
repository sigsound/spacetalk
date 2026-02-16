import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the Anthropic SDK with a proper class
class MockAnthropic {
  messages = {
    stream: vi.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Test response" },
        };
      },
    }),
  };
}

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: MockAnthropic,
    APIError: class APIError extends Error {
      status: number;
      headers: Map<string, string>;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
        this.headers = new Map();
      }
    },
  };
});

// Mock the manifest import
vi.mock("@/../public/data/spaces-manifest.json", () => ({
  default: {
    generatedAt: "2024-01-01T00:00:00.000Z",
    spaces: [
      {
        id: "space-001",
        name: "Test Space",
        thumbnailPath: "/data/spaces/space-001/thumbnail.jpg",
        images: ["frame_00001.jpg", "frame_00002.jpg", "frame_00003.jpg"],
        floorplanData: null,
        locationData: null,
      },
      {
        id: "space-002",
        name: "Another Space",
        thumbnailPath: null,
        images: ["img_001.jpg"],
        floorplanData: "room,x,y\nliving,0,0",
        locationData: { city: "Test City" },
      },
    ],
  },
}));

// Store fetch calls for assertions
const fetchCalls: { url: string }[] = [];

// Mock global fetch
const mockFetch = vi.fn().mockImplementation(async (url: string) => {
  fetchCalls.push({ url });
  return {
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(100),
  };
});

vi.stubGlobal("fetch", mockFetch);

// Set API key for tests
process.env.ANTHROPIC_API_KEY = "test-api-key";

describe("POST /api/chat - Image Fetching", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches thumbnail via HTTP using correct CDN URL", async () => {
    const { POST } = await import("../route");

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Analyze this space" }],
        selectedSpaces: ["space-001"],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify thumbnail was fetched with correct CDN URL
    const thumbnailFetch = fetchCalls.find((call) =>
      call.url.includes("thumbnail.jpg")
    );
    expect(thumbnailFetch).toBeDefined();
    expect(thumbnailFetch!.url).toBe(
      "http://localhost:3000/data/spaces/space-001/thumbnail.jpg"
    );
  });

  it("fetches sampled images via HTTP using correct CDN URLs", async () => {
    const { POST } = await import("../route");

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Analyze this space" }],
        selectedSpaces: ["space-001"],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify sampled images were fetched with correct CDN URLs
    const imageFetches = fetchCalls.filter((call) =>
      call.url.includes("/images/frame_")
    );
    expect(imageFetches.length).toBeGreaterThan(0);

    // All image URLs should follow the pattern: baseUrl/data/spaces/{spaceId}/images/{imageName}
    for (const fetch of imageFetches) {
      expect(fetch.url).toMatch(
        /^http:\/\/localhost:3000\/data\/spaces\/space-001\/images\/frame_\d+\.jpg$/
      );
    }
  });

  it("uses VERCEL_URL env var for CDN URL when present", async () => {
    // Set VERCEL_URL environment variable
    process.env.VERCEL_URL = "my-app.vercel.app";

    const { POST } = await import("../route");

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Analyze this space" }],
        selectedSpaces: ["space-001"],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify CDN URL uses VERCEL_URL
    const thumbnailFetch = fetchCalls.find((call) =>
      call.url.includes("thumbnail.jpg")
    );
    expect(thumbnailFetch).toBeDefined();
    expect(thumbnailFetch!.url).toBe(
      "https://my-app.vercel.app/data/spaces/space-001/thumbnail.jpg"
    );

    // Clean up
    delete process.env.VERCEL_URL;
  });

  it("includes fetched images in response content blocks", async () => {
    const { POST } = await import("../route");

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Analyze this space" }],
        selectedSpaces: ["space-001"],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    // Read the SSE stream to verify metadata
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullResponse += decoder.decode(value);
    }

    // Parse the meta event to verify image count
    const metaMatch = fullResponse.match(/data: ({.*"type":"meta".*})/);
    expect(metaMatch).toBeDefined();
    const metaData = JSON.parse(metaMatch![1]);
    expect(metaData.sampledImages).toBeGreaterThan(0);
  });

  it("handles spaces without thumbnails gracefully", async () => {
    const { POST } = await import("../route");

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Analyze this space" }],
        selectedSpaces: ["space-002"], // This space has no thumbnail
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify no thumbnail fetch was attempted for space-002
    const thumbnailFetch = fetchCalls.find(
      (call) =>
        call.url.includes("space-002") && call.url.includes("thumbnail")
    );
    expect(thumbnailFetch).toBeUndefined();
  });

  it("does not fetch images for follow-up messages", async () => {
    const { POST } = await import("../route");

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Analyze this space" },
          { role: "assistant", content: "The space looks good" },
          { role: "user", content: "Tell me more about the kitchen" },
        ],
        selectedSpaces: ["space-001"],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify no images were fetched for follow-up
    const imageFetches = fetchCalls.filter(
      (call) =>
        call.url.includes("thumbnail") || call.url.includes("/images/")
    );
    expect(imageFetches).toHaveLength(0);
  });

  it("handles fetch errors gracefully and continues processing", async () => {
    // Make fetch fail for this test
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { POST } = await import("../route");

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Analyze this space" }],
        selectedSpaces: ["space-001"],
      }),
    });

    // Should not throw, should handle gracefully
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
