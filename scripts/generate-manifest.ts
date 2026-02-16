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
  hasFloorplan: boolean;
  hasLocationData: boolean;
}

interface Manifest {
  generatedAt: string;
  spaces: SpaceManifestEntry[];
}

const spacesDir = path.join(process.cwd(), "public/data/spaces");
const outputPath = path.join(process.cwd(), "public/data/spaces-manifest.json");

function generateManifest(): Manifest {
  if (!fs.existsSync(spacesDir)) {
    console.error("Spaces directory not found:", spacesDir);
    return { generatedAt: new Date().toISOString(), spaces: [] };
  }

  const entries = fs.readdirSync(spacesDir, { withFileTypes: true })
    .filter(e => e.isDirectory());

  const spaces: SpaceManifestEntry[] = entries.map(entry => {
    const spaceDir = path.join(spacesDir, entry.name);
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

    return {
      id: entry.name,
      name,
      thumbnailPath: fs.existsSync(thumbnailPath) 
        ? `/data/spaces/${entry.name}/thumbnail.jpg`
        : images.length > 0 
          ? `/data/spaces/${entry.name}/images/${images[0]}`
          : null,
      images,
      hasFloorplan: fs.existsSync(floorplanPath),
      hasLocationData: fs.existsSync(locationDir),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    spaces,
  };
}

const manifest = generateManifest();
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
console.log(`Generated manifest with ${manifest.spaces.length} spaces at ${outputPath}`);
console.log(`Total images indexed: ${manifest.spaces.reduce((sum, s) => sum + s.images.length, 0)}`);
