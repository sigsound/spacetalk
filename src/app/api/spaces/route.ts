import { NextResponse } from "next/server";
import manifest from "@/../public/data/spaces-manifest.json";

export async function GET() {
  const spaces = manifest.spaces.map(space => {
    // Extract address from location data
    const placemark = space.locationData?.placemark;
    const address = placemark?.name 
      ? `${placemark.name}, ${placemark.locality || ''}, ${placemark.administrativeArea || ''}`.replace(/, ,/g, ',').replace(/,$/, '')
      : "Address not available";
    
    // Extract area from floorplan data (look for "Total livable floor area")
    let area = 513; // default
    if (space.floorplanData) {
      const areaMatch = space.floorplanData.match(/Total livable floor area \[ft\^2\],(\d+\.\d+)/);
      if (areaMatch) {
        area = Math.round(parseFloat(areaMatch[1]));
      }
    }
    
    return {
      id: space.id,
      name: space.name,
      thumbnailUrl: space.thumbnailPath,
      imageCount: space.images.length,
      // Use paths from manifest (generated at build time)
      floorplanSvgUrl: space.floorplanSvgPath || null,
      floorplanCsvUrl: space.floorplanCsvPath || null,
      reportPdfUrl: space.reportPdfPath || null,
      address,
      area,
    };
  });

  return NextResponse.json({ spaces });
}
