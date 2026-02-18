import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { join } from "path";
import manifest from "@/../public/data/spaces-manifest.json";

export async function GET() {
  const publicDir = join(process.cwd(), "public");
  
  const spaces = manifest.spaces.map(space => {
    const spaceDir = `/data/spaces/${space.id}`;
    const spacePath = join(publicDir, spaceDir);
    
    // Check for floorplan files
    const hasFloorplanSvg = existsSync(join(spacePath, "floorplan.svg"));
    const hasFloorplanCsv = existsSync(join(spacePath, "floorplan.csv"));
    const hasReportPdf = existsSync(join(spacePath, "report.pdf"));
    
    return {
      id: space.id,
      name: space.name,
      thumbnailUrl: space.thumbnailPath,
      imageCount: space.images.length,
      floorplanSvgUrl: hasFloorplanSvg ? `${spaceDir}/floorplan.svg` : null,
      floorplanCsvUrl: hasFloorplanCsv ? `${spaceDir}/floorplan.csv` : null,
      reportPdfUrl: hasReportPdf ? `${spaceDir}/report.pdf` : null,
      // TODO: Extract address and area from metadata if available
      address: "310 Russell Hill Rd, Toronto, ON",
      area: 513,
    };
  });

  return NextResponse.json({ spaces });
}
