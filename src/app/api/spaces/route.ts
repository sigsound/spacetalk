import { NextResponse } from "next/server";
import manifest from "@/../public/data/spaces-manifest.json";

export async function GET() {
  const spaces = manifest.spaces.map(space => ({
    id: space.id,
    name: space.name,
    thumbnailUrl: space.thumbnailPath,
    imageCount: space.images.length,
  }));

  return NextResponse.json({ spaces });
}
