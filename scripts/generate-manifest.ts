/**
 * Generates a static manifest of all spaces and their images.
 * Run this at build time so the API routes don't need to use fs.readdirSync.
 * 
 * Usage: npx tsx scripts/generate-manifest.ts
 */

import fs from "fs";
import path from "path";

// Camera JSON structure (transform matrix)
interface CameraData {
  t_03: number;  // X position
  t_13: number;  // Y position (height)
  t_23: number;  // Z position
  timestamp: number;
}

// Room structure from optimized_roomplan.json
interface RoomData {
  id: string;
  category: string;
  label_automated: string;
  vertices_x: number[];
  vertices_z: number[];
  center_xz: number[];
  story: number;
}

interface RoomPlan {
  rooms: RoomData[];
}

interface SpaceManifestEntry {
  id: string;
  name: string;
  thumbnailPath: string | null;
  images: string[];
  imagesByRoom: { [roomLabel: string]: string[] } | null;
  floorplanData: string | null;
  locationData: object | null;
  // Floorplan file paths (if they exist)
  floorplanSvgPath: string | null;
  floorplanCsvPath: string | null;
  reportPdfPath: string | null;
}

interface Manifest {
  generatedAt: string;
  spaces: SpaceManifestEntry[];
}

const spacesDir = path.join(process.cwd(), "public/data/spaces");
const outputPath = path.join(process.cwd(), "public/data/spaces-manifest.json");

/**
 * Point-in-polygon test using ray casting algorithm.
 * Returns true if point (x, z) is inside the polygon defined by vertices.
 */
function pointInPolygon(x: number, z: number, verticesX: number[], verticesZ: number[]): boolean {
  let inside = false;
  const n = verticesX.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = verticesX[i], zi = verticesZ[i];
    const xj = verticesX[j], zj = verticesZ[j];
    
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Find which room a camera position belongs to.
 * Returns the room label or "Unknown" if not found in any room.
 */
function findRoomForPosition(x: number, z: number, rooms: RoomData[]): string {
  for (const room of rooms) {
    if (pointInPolygon(x, z, room.vertices_x, room.vertices_z)) {
      return room.label_automated || room.category || room.id;
    }
  }
  return "Unknown";
}

/**
 * Assign each image to a room based on camera position.
 * Returns a mapping of room label to list of image filenames.
 */
function assignImagesToRooms(
  spaceDir: string,
  images: string[]
): { [roomLabel: string]: string[] } | null {
  const camerasDir = path.join(spaceDir, "cameras");
  const roomplanPath = path.join(spaceDir, "optimized_roomplan.json");
  
  // Check if both cameras and roomplan exist
  if (!fs.existsSync(camerasDir) || !fs.existsSync(roomplanPath)) {
    return null;
  }
  
  // Load roomplan
  let roomplan: RoomPlan;
  try {
    roomplan = JSON.parse(fs.readFileSync(roomplanPath, "utf-8"));
    if (!roomplan.rooms || roomplan.rooms.length === 0) {
      return null;
    }
  } catch {
    return null;
  }
  
  const imagesByRoom: { [roomLabel: string]: string[] } = {};
  
  for (const imageName of images) {
    // Camera JSON has same timestamp as image (without extension)
    const timestamp = imageName.replace(/\.(jpg|jpeg)$/i, "");
    const cameraPath = path.join(camerasDir, `${timestamp}.json`);
    
    if (!fs.existsSync(cameraPath)) {
      // If no camera data, put in Unknown
      if (!imagesByRoom["Unknown"]) imagesByRoom["Unknown"] = [];
      imagesByRoom["Unknown"].push(imageName);
      continue;
    }
    
    try {
      const camera: CameraData = JSON.parse(fs.readFileSync(cameraPath, "utf-8"));
      const roomLabel = findRoomForPosition(camera.t_03, camera.t_23, roomplan.rooms);
      
      if (!imagesByRoom[roomLabel]) imagesByRoom[roomLabel] = [];
      imagesByRoom[roomLabel].push(imageName);
    } catch {
      // If camera data is invalid, put in Unknown
      if (!imagesByRoom["Unknown"]) imagesByRoom["Unknown"] = [];
      imagesByRoom["Unknown"].push(imageName);
    }
  }
  
  return imagesByRoom;
}

export function generateManifest(spacesDirectory: string = spacesDir): Manifest {
  if (!fs.existsSync(spacesDirectory)) {
    console.error("Spaces directory not found:", spacesDirectory);
    return { generatedAt: new Date().toISOString(), spaces: [] };
  }

  const entries = fs.readdirSync(spacesDirectory, { withFileTypes: true })
    .filter(e => e.isDirectory());

  const spaces: SpaceManifestEntry[] = entries.map(entry => {
    const spaceDir = path.join(spacesDirectory, entry.name);
    const imagesDir = path.join(spaceDir, "images");
    const metadataPath = path.join(spaceDir, "metadata.json");
    const floorplanPath = path.join(spaceDir, "floorplan.csv");
    const locationDir = path.join(spaceDir, "location");
    const thumbnailPath = path.join(spaceDir, "thumbnail.jpg");
    const floorplanSvgPath = path.join(spaceDir, "floorplan.svg");
    const floorplanCsvFilePath = path.join(spaceDir, "floorplan.csv");
    const reportPdfPath = path.join(spaceDir, "report.pdf");

    // Get sorted list of all images
    const images = fs.existsSync(imagesDir)
      ? fs.readdirSync(imagesDir)
          .filter(f => f.endsWith(".jpg") || f.endsWith(".jpeg"))
          .sort()
      : [];

    // Read metadata for display name
    let name = entry.name;
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
        name = metadata.name || entry.name;
      } catch {
        // Use folder name if metadata is invalid
      }
    }

    // Read floorplan data if exists
    let floorplanData: string | null = null;
    if (fs.existsSync(floorplanPath)) {
      try {
        floorplanData = fs.readFileSync(floorplanPath, "utf-8");
      } catch {
        // Ignore read errors
      }
    }

    // Read location data if exists
    let locationData: object | null = null;
    if (fs.existsSync(locationDir)) {
      const locationFiles = fs.readdirSync(locationDir).filter(f => f.endsWith(".json"));
      if (locationFiles.length > 0) {
        try {
          locationData = JSON.parse(fs.readFileSync(path.join(locationDir, locationFiles[0]), "utf-8"));
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Assign images to rooms based on camera positions
    const imagesByRoom = assignImagesToRooms(spaceDir, images);

    return {
      id: entry.name,
      name,
      thumbnailPath: fs.existsSync(thumbnailPath) 
        ? `/data/spaces/${entry.name}/thumbnail.jpg`
        : images.length > 0 
          ? `/data/spaces/${entry.name}/images/${images[0]}`
          : null,
      images,
      imagesByRoom,
      floorplanData,
      locationData,
      floorplanSvgPath: fs.existsSync(floorplanSvgPath)
        ? `/data/spaces/${entry.name}/floorplan.svg`
        : null,
      floorplanCsvPath: fs.existsSync(floorplanCsvFilePath)
        ? `/data/spaces/${entry.name}/floorplan.csv`
        : null,
      reportPdfPath: fs.existsSync(reportPdfPath)
        ? `/data/spaces/${entry.name}/report.pdf`
        : null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    spaces,
  };
}

// Only run when executed directly (not imported)
if (require.main === module) {
  const manifest = generateManifest();
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
  console.log(`Generated manifest with ${manifest.spaces.length} spaces at ${outputPath}`);
  console.log(`Total images indexed: ${manifest.spaces.reduce((sum, s) => sum + s.images.length, 0)}`);
  
  // Log room assignment statistics
  for (const space of manifest.spaces) {
    if (space.imagesByRoom) {
      console.log(`\n${space.id} room assignments:`);
      for (const [room, imgs] of Object.entries(space.imagesByRoom)) {
        console.log(`  ${room}: ${imgs.length} images`);
      }
    }
  }
}

export type { SpaceManifestEntry, Manifest };
