import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the manifest import with test data
vi.mock("@/../public/data/spaces-manifest.json", () => ({
  default: {
    generatedAt: "2024-01-15T10:30:00.000Z",
    spaces: [
      {
        id: "office-building",
        name: "Office Building A",
        thumbnailPath: "/data/spaces/office-building/thumbnail.jpg",
        images: [
          "frame_00001.jpg",
          "frame_00002.jpg",
          "frame_00003.jpg",
          "frame_00004.jpg",
          "frame_00005.jpg",
        ],
        hasFloorplan: true,
        hasLocationData: true,
      },
      {
        id: "warehouse-b",
        name: "Warehouse B",
        thumbnailPath: "/data/spaces/warehouse-b/images/img_001.jpg",
        images: ["img_001.jpg", "img_002.jpg"],
        hasFloorplan: false,
        hasLocationData: false,
      },
      {
        id: "empty-space",
        name: "Empty Space",
        thumbnailPath: null,
        images: [],
        hasFloorplan: false,
        hasLocationData: false,
      },
    ],
  },
}));

describe("GET /api/spaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct space list from manifest", async () => {
    const { GET } = await import("../route");

    const response = await GET();
    const data = await response.json();

    expect(data.spaces).toHaveLength(3);
    expect(data.spaces.map((s: { id: string }) => s.id)).toEqual([
      "office-building",
      "warehouse-b",
      "empty-space",
    ]);
  });

  it("returns correct metadata for each space", async () => {
    const { GET } = await import("../route");

    const response = await GET();
    const data = await response.json();

    // Verify office building
    const officeBuilding = data.spaces.find(
      (s: { id: string }) => s.id === "office-building"
    );
    expect(officeBuilding).toEqual({
      id: "office-building",
      name: "Office Building A",
      thumbnailUrl: "/data/spaces/office-building/thumbnail.jpg",
      imageCount: 5,
    });

    // Verify warehouse
    const warehouse = data.spaces.find(
      (s: { id: string }) => s.id === "warehouse-b"
    );
    expect(warehouse).toEqual({
      id: "warehouse-b",
      name: "Warehouse B",
      thumbnailUrl: "/data/spaces/warehouse-b/images/img_001.jpg",
      imageCount: 2,
    });

    // Verify empty space
    const emptySpace = data.spaces.find(
      (s: { id: string }) => s.id === "empty-space"
    );
    expect(emptySpace).toEqual({
      id: "empty-space",
      name: "Empty Space",
      thumbnailUrl: null,
      imageCount: 0,
    });
  });

  it("maps thumbnailPath to thumbnailUrl in response", async () => {
    const { GET } = await import("../route");

    const response = await GET();
    const data = await response.json();

    // Every space should have thumbnailUrl (mapped from thumbnailPath)
    for (const space of data.spaces) {
      expect(space).toHaveProperty("thumbnailUrl");
      expect(space).not.toHaveProperty("thumbnailPath");
    }
  });

  it("calculates imageCount from images array length", async () => {
    const { GET } = await import("../route");

    const response = await GET();
    const data = await response.json();

    const officeBuilding = data.spaces.find(
      (s: { id: string }) => s.id === "office-building"
    );
    expect(officeBuilding.imageCount).toBe(5);

    const warehouse = data.spaces.find(
      (s: { id: string }) => s.id === "warehouse-b"
    );
    expect(warehouse.imageCount).toBe(2);

    const emptySpace = data.spaces.find(
      (s: { id: string }) => s.id === "empty-space"
    );
    expect(emptySpace.imageCount).toBe(0);
  });

  it("excludes internal manifest fields from response", async () => {
    const { GET } = await import("../route");

    const response = await GET();
    const data = await response.json();

    // Response should not include raw manifest fields
    for (const space of data.spaces) {
      expect(space).not.toHaveProperty("images");
      expect(space).not.toHaveProperty("hasFloorplan");
      expect(space).not.toHaveProperty("hasLocationData");
    }
  });

  it("returns valid JSON response", async () => {
    const { GET } = await import("../route");

    const response = await GET();

    expect(response.headers.get("content-type")).toContain("application/json");

    // Should not throw when parsing
    const data = await response.json();
    expect(data).toBeDefined();
    expect(data.spaces).toBeDefined();
    expect(Array.isArray(data.spaces)).toBe(true);
  });

  it("returns 200 status code", async () => {
    const { GET } = await import("../route");

    const response = await GET();

    expect(response.status).toBe(200);
  });
});

describe("GET /api/spaces - empty manifest", () => {
  it("handles empty spaces array gracefully", async () => {
    // Re-mock with empty spaces
    vi.doMock("@/../public/data/spaces-manifest.json", () => ({
      default: {
        generatedAt: "2024-01-15T10:30:00.000Z",
        spaces: [],
      },
    }));

    // Need to re-import after mocking
    vi.resetModules();

    const { GET } = await import("../route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spaces).toEqual([]);
  });
});
