import { NextResponse } from "next/server";
import manifest from "@/../public/data/spaces-manifest.json";

export async function GET() {
  const spaces = manifest.spaces.map(space => ({
    id: space.id,
    name: space.name,
    thumbnailUrl: space.thumbnailPath,
    imageCount: space.images.length,
    // Use paths from manifest (generated at build time)
    floorplanSvgUrl: space.floorplanSvgPath || null,
    floorplanCsvUrl: space.floorplanCsvPath || null,
    reportPdfUrl: space.reportPdfPath || null,
    // TODO: Extract address and area from metadata if available
    address: "310 Russell Hill Rd, Toronto, ON",
    area: 513,
  }));

  return NextResponse.json({ spaces });
}
