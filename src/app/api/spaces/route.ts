import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const spacesDir = path.join(process.cwd(), "public/data/spaces");

  if (!fs.existsSync(spacesDir)) {
    return NextResponse.json({ spaces: [] });
  }

  const entries = fs.readdirSync(spacesDir, { withFileTypes: true })
    .filter(e => e.isDirectory());

  const spaces = entries.map(entry => {
    const spaceDir = path.join(spacesDir, entry.name);
    const imagesDir = path.join(spaceDir, "images");
    const metadataPath = path.join(spaceDir, "metadata.json");

    const imageFiles = fs.existsSync(imagesDir)
      ? fs.readdirSync(imagesDir).filter(f => f.endsWith(".jpg") || f.endsWith(".jpeg")).sort()
      : [];

    const metadata = fs.existsSync(metadataPath)
      ? JSON.parse(fs.readFileSync(metadataPath, "utf-8"))
      : {};

    return {
      id: entry.name,
      name: metadata.name || entry.name,
      thumbnailUrl: imageFiles.length > 0
        ? `/data/spaces/${entry.name}/images/${imageFiles[0]}`
        : null,
      imageCount: imageFiles.length,
      metadata
    };
  });

  return NextResponse.json({ spaces });
}
