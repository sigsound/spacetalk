import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { generateManifest } from "../generate-manifest";

describe("generateManifest", () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary directory for test data
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "spacetalk-test-"));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("correctly generates manifest for all spaces including images, thumbnails, floorplan and location data", () => {
    // Create space-001 with all features
    const space1Dir = path.join(testDir, "space-001");
    fs.mkdirSync(space1Dir);
    fs.mkdirSync(path.join(space1Dir, "images"));
    fs.mkdirSync(path.join(space1Dir, "location"));

    // Add metadata
    fs.writeFileSync(
      path.join(space1Dir, "metadata.json"),
      JSON.stringify({ name: "Office Building A" })
    );

    // Add images
    fs.writeFileSync(path.join(space1Dir, "images", "frame_00001.jpg"), "");
    fs.writeFileSync(path.join(space1Dir, "images", "frame_00002.jpg"), "");
    fs.writeFileSync(path.join(space1Dir, "images", "frame_00003.jpeg"), "");

    // Add thumbnail
    fs.writeFileSync(path.join(space1Dir, "thumbnail.jpg"), "");

    // Add floorplan
    fs.writeFileSync(path.join(space1Dir, "floorplan.csv"), "room,x,y\nliving,0,0");

    // Add location data
    fs.writeFileSync(
      path.join(space1Dir, "location", "address.json"),
      JSON.stringify({ city: "San Francisco" })
    );

    // Create space-002 with minimal features (no thumbnail, no floorplan)
    const space2Dir = path.join(testDir, "space-002");
    fs.mkdirSync(space2Dir);
    fs.mkdirSync(path.join(space2Dir, "images"));

    fs.writeFileSync(
      path.join(space2Dir, "metadata.json"),
      JSON.stringify({ name: "Warehouse B" })
    );
    fs.writeFileSync(path.join(space2Dir, "images", "img_001.jpg"), "");

    // Generate manifest
    const manifest = generateManifest(testDir);

    // Verify manifest structure
    expect(manifest.generatedAt).toBeDefined();
    expect(manifest.spaces).toHaveLength(2);

    // Verify space-001
    const space1 = manifest.spaces.find((s) => s.id === "space-001");
    expect(space1).toBeDefined();
    expect(space1!.name).toBe("Office Building A");
    expect(space1!.thumbnailPath).toBe("/data/spaces/space-001/thumbnail.jpg");
    expect(space1!.images).toEqual([
      "frame_00001.jpg",
      "frame_00002.jpg",
      "frame_00003.jpeg",
    ]);
    expect(space1!.hasFloorplan).toBe(true);
    expect(space1!.hasLocationData).toBe(true);
    expect(space1!.locationFile).toBe("address.json");

    // Verify space-002
    const space2 = manifest.spaces.find((s) => s.id === "space-002");
    expect(space2).toBeDefined();
    expect(space2!.name).toBe("Warehouse B");
    // Should fall back to first image as thumbnail
    expect(space2!.thumbnailPath).toBe(
      "/data/spaces/space-002/images/img_001.jpg"
    );
    expect(space2!.images).toEqual(["img_001.jpg"]);
    expect(space2!.hasFloorplan).toBe(false);
    expect(space2!.hasLocationData).toBe(false);
    expect(space2!.locationFile).toBeNull();
  });

  it("handles spaces with missing metadata files gracefully", () => {
    // Create space with no metadata.json
    const space1Dir = path.join(testDir, "space-no-metadata");
    fs.mkdirSync(space1Dir);
    fs.mkdirSync(path.join(space1Dir, "images"));
    fs.writeFileSync(path.join(space1Dir, "images", "img.jpg"), "");

    const manifest = generateManifest(testDir);

    expect(manifest.spaces).toHaveLength(1);
    const space = manifest.spaces[0];
    // Should fall back to folder name when no metadata
    expect(space.name).toBe("space-no-metadata");
    expect(space.id).toBe("space-no-metadata");
  });

  it("handles spaces with invalid/malformed metadata JSON gracefully", () => {
    const spaceDir = path.join(testDir, "space-bad-json");
    fs.mkdirSync(spaceDir);
    fs.mkdirSync(path.join(spaceDir, "images"));
    fs.writeFileSync(path.join(spaceDir, "images", "img.jpg"), "");

    // Write invalid JSON
    fs.writeFileSync(
      path.join(spaceDir, "metadata.json"),
      "{ invalid json content"
    );

    const manifest = generateManifest(testDir);

    expect(manifest.spaces).toHaveLength(1);
    // Should fall back to folder name when metadata is invalid
    expect(manifest.spaces[0].name).toBe("space-bad-json");
  });

  it("handles spaces with metadata missing name field gracefully", () => {
    const spaceDir = path.join(testDir, "space-no-name");
    fs.mkdirSync(spaceDir);

    // Valid JSON but no name field
    fs.writeFileSync(
      path.join(spaceDir, "metadata.json"),
      JSON.stringify({ description: "Some space", size: 1000 })
    );

    const manifest = generateManifest(testDir);

    expect(manifest.spaces).toHaveLength(1);
    // Should fall back to folder name when name field is missing
    expect(manifest.spaces[0].name).toBe("space-no-name");
  });

  it("handles empty spaces directory", () => {
    const manifest = generateManifest(testDir);

    expect(manifest.spaces).toEqual([]);
    expect(manifest.generatedAt).toBeDefined();
  });

  it("handles non-existent spaces directory", () => {
    const nonExistentDir = path.join(testDir, "does-not-exist");

    const manifest = generateManifest(nonExistentDir);

    expect(manifest.spaces).toEqual([]);
    expect(manifest.generatedAt).toBeDefined();
  });

  it("handles space with no images directory", () => {
    const spaceDir = path.join(testDir, "space-no-images");
    fs.mkdirSync(spaceDir);
    fs.writeFileSync(
      path.join(spaceDir, "metadata.json"),
      JSON.stringify({ name: "Empty Space" })
    );

    const manifest = generateManifest(testDir);

    expect(manifest.spaces).toHaveLength(1);
    expect(manifest.spaces[0].images).toEqual([]);
    expect(manifest.spaces[0].thumbnailPath).toBeNull();
  });

  it("sorts images alphabetically", () => {
    const spaceDir = path.join(testDir, "space-unsorted");
    fs.mkdirSync(spaceDir);
    fs.mkdirSync(path.join(spaceDir, "images"));

    // Create images in non-alphabetical order
    fs.writeFileSync(path.join(spaceDir, "images", "z_last.jpg"), "");
    fs.writeFileSync(path.join(spaceDir, "images", "a_first.jpg"), "");
    fs.writeFileSync(path.join(spaceDir, "images", "m_middle.jpg"), "");

    const manifest = generateManifest(testDir);

    expect(manifest.spaces[0].images).toEqual([
      "a_first.jpg",
      "m_middle.jpg",
      "z_last.jpg",
    ]);
  });

  it("filters out non-jpg files from images", () => {
    const spaceDir = path.join(testDir, "space-mixed-files");
    fs.mkdirSync(spaceDir);
    fs.mkdirSync(path.join(spaceDir, "images"));

    fs.writeFileSync(path.join(spaceDir, "images", "valid.jpg"), "");
    fs.writeFileSync(path.join(spaceDir, "images", "valid2.jpeg"), "");
    fs.writeFileSync(path.join(spaceDir, "images", "readme.txt"), "");
    fs.writeFileSync(path.join(spaceDir, "images", "data.json"), "");
    fs.writeFileSync(path.join(spaceDir, "images", "image.png"), "");

    const manifest = generateManifest(testDir);

    expect(manifest.spaces[0].images).toEqual(["valid.jpg", "valid2.jpeg"]);
  });
});
