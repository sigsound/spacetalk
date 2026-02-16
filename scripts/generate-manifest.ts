/**
 * Generates a static manifest of all spaces and their images.
 * Run this at build time so the API routes don't need to use fs.readdirSync.
 * 
 * Usage: npx tsx scripts/generate-manifest.ts
 */

import fs from "fs";
import path from "path";

interface SpaceManifestEntry {
  id: string;
  name: string;
  thumbnailPath: string | null;
  images: string[];
  floorplanData: string | null;
  locationData: object | null;
}

interface Manifest {
  generatedAt: string;
  spaces: SpaceManifestEntry[];
}

const spacesDir = path.join(process.cwd(), "public/data/spaces");
const outputPath = path.join(process.cwd(), "public/data/spaces-manifest.json");

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

    return {
      id: entry.name,
      name,
      thumbnailPath: fs.existsSync(thumbnailPath) 
        ? `/data/spaces/${entry.name}/thumbnail.jpg`
        : images.length > 0 
          ? `/data/spaces/${entry.name}/images/${images[0]}`
          : null,
      images,
      floorplanData,
      locationData,
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
}

export type { SpaceManifestEntry, Manifest };
