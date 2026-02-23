"use client";

import { Space } from "@/lib/types";
import Image from "next/image";

interface SpaceSidebarProps {
  spaces: Space[];
  selectedSpaces: string[];
  onToggleSpace: (spaceId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  loading?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function SpaceSidebar({
  spaces,
  selectedSpaces,
  onToggleSpace,
  onSelectAll,
  onDeselectAll,
  loading,
  collapsed,
  onToggleCollapse,
}: SpaceSidebarProps) {
  const allSelected = spaces.length > 0 && selectedSpaces.length === spaces.length;

  if (collapsed) {
    return (
      <div className="w-12 bg-background border-r border-border flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-muted hover:text-foreground hover:bg-card rounded-lg transition-colors"
          title="Expand sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="mt-4 text-xs text-muted-fg writing-mode-vertical">
          {selectedSpaces.length}/{spaces.length}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[280px] bg-background border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-foreground font-medium">Spaces</h2>
          <span className="text-xs bg-surface text-muted px-2 py-0.5 rounded-full">
            {spaces.length}
          </span>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 text-muted hover:text-foreground hover:bg-card rounded transition-colors"
            title="Collapse sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Select all/none toggle */}
      <div className="px-4 py-2 border-b border-border">
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          {allSelected ? "Deselect All" : "Select All"}
        </button>
      </div>

      {/* Spaces list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-muted-fg text-sm">Loading spaces...</div>
        ) : spaces.length === 0 ? (
          <div className="p-4 text-muted-fg text-sm">
            No spaces found. Add space folders to /public/data/spaces/
          </div>
        ) : (
          <div className="p-2">
            {spaces.map((space) => (
              <label
                key={space.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-card cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedSpaces.includes(space.id)}
                  onChange={() => onToggleSpace(space.id)}
                  className="mt-1 w-4 h-4 rounded border-border-hover bg-card text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                />
                <div className="flex-1 min-w-0">
                  {/* Thumbnail */}
                  <div className="w-full aspect-video bg-card rounded-lg overflow-hidden mb-2 relative">
                    {space.thumbnailUrl ? (
                      <Image
                        src={space.thumbnailUrl}
                        alt={space.name}
                        fill
                        className="object-cover"
                        sizes="200px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-fg">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Name and count */}
                  <div className="text-sm text-foreground truncate">{space.name}</div>
                  <div className="text-xs text-muted-fg">{space.imageCount} images</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
