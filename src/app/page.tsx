"use client";

import { useState, useEffect } from "react";
import { Space } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import PolycamLogo from "@/components/PolycamLogo";
import ThemeToggle from "@/components/ThemeToggle";

export default function SpaceSelectionPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSpaces() {
      try {
        const res = await fetch("/api/spaces");
        const data = await res.json();
        setSpaces(data.spaces);
      } catch (error) {
        console.error("Failed to fetch spaces:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSpaces();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <PolycamLogo className="w-6 h-7" color="currentColor" />
          <h1 className="text-xl font-semibold text-foreground">Space Talk</h1>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm text-muted-fg flex items-center gap-1.5">
            <span>Powered by</span>
            <PolycamLogo className="w-4 h-5" color="currentColor" />
            <span>Polycam</span>
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-3">Select a Space</h2>
          <p className="text-muted">
            Choose a space to analyze with AI-powered insights
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-fg">Loading spaces...</div>
          </div>
        ) : spaces.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-card flex items-center justify-center">
                <svg className="w-10 h-10 text-muted-fg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-foreground mb-2">No spaces found</h3>
              <p className="text-muted-fg">
                Add space folders to /public/data/spaces/
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {spaces.map((space) => (
              <Link
                key={space.id}
                href={`/space/${space.id}`}
                className="group block bg-card border border-border rounded-2xl overflow-hidden hover:border-border-hover transition-all hover:shadow-lg hover:shadow-black/20"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-background relative overflow-hidden">
                  {space.thumbnailUrl ? (
                    <Image
                      src={space.thumbnailUrl}
                      alt={space.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-fg">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Floorplan badge */}
                  {space.floorplanSvgUrl && (
                    <div className="absolute top-3 right-3 bg-emerald-600/90 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Floorplan
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="text-lg font-medium text-foreground mb-1 group-hover:text-accent transition-colors">
                    {space.name}
                  </h3>
                  {space.address && (
                    <p className="text-sm text-muted mb-2">{space.address}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-fg">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {space.imageCount} images
                    </span>
                    {space.area && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                        {space.area} m² total
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
