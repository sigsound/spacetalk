"use client";

interface AnnotationToolbarProps {
  activeTool: "pan" | "select" | "pencil" | "circle" | "rectangle" | "text";
  onToolChange: (tool: "pan" | "select" | "pencil" | "circle" | "rectangle" | "text") => void;
  selectedColor: string;
  onColorChange: (color: string) => void;
  selectedAnnotationId: string | null;
  annotations: any[];
  selectedOpacity: number;
  onOpacityChange: (opacity: number) => void;
  fillEnabled: boolean;
  onFillToggle: (enabled: boolean) => void;
  hasSelection: boolean;
  onDelete: () => void;
  annotationCount: number;
  onClearAll: () => void;
}

export default function AnnotationToolbar({
  activeTool,
  onToolChange,
  selectedColor,
  onColorChange,
  selectedAnnotationId,
  annotations,
  selectedOpacity,
  onOpacityChange,
  fillEnabled,
  onFillToggle,
  hasSelection,
  onDelete,
  annotationCount,
  onClearAll,
}: AnnotationToolbarProps) {
  const colors = [
    { name: "Yellow", value: "#fbbf24" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Red", value: "#ef4444" },
    { name: "Green", value: "#10b981" },
    { name: "Purple", value: "#a855f7" },
    { name: "Orange", value: "#f97316" },
  ];

  return (
    <div className="fixed bottom-8 right-8 z-40 bg-[#1a1918]/95 border border-[#3a3837] rounded-lg shadow-xl p-3 flex flex-col gap-3 backdrop-blur-sm">
      {/* Tool selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToolChange("pan")}
          className={`p-2 rounded transition-colors ${
            activeTool === "pan"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-[#2a2827]"
          }`}
          title="Pan & Zoom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
          </svg>
        </button>
        <button
          onClick={() => onToolChange("select")}
          className={`p-2 rounded transition-colors ${
            activeTool === "select"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-[#2a2827]"
          }`}
          title="Select & Move"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </button>
        <button
          onClick={() => onToolChange("pencil")}
          className={`p-2 rounded transition-colors ${
            activeTool === "pencil"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-[#2a2827]"
          }`}
          title="Pencil"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={() => onToolChange("circle")}
          className={`p-2 rounded transition-colors ${
            activeTool === "circle"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-[#2a2827]"
          }`}
          title="Circle"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={2} />
          </svg>
        </button>
        <button
          onClick={() => onToolChange("rectangle")}
          className={`p-2 rounded transition-colors ${
            activeTool === "rectangle"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-[#2a2827]"
          }`}
          title="Rectangle"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" strokeWidth={2} rx="2" />
          </svg>
        </button>
        <button
          onClick={() => onToolChange("text")}
          className={`p-2 rounded transition-colors ${
            activeTool === "text"
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-[#2a2827]"
          }`}
          title="Text"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      </div>

      {/* Fill/Stroke toggle */}
      <div className="flex items-center gap-2 border-t border-[#3a3837] pt-3">
        <button
          onClick={() => onFillToggle(!fillEnabled)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            fillEnabled
              ? "bg-blue-600 text-white"
              : "bg-[#2a2827] text-gray-400 hover:text-white"
          }`}
          title="Toggle Fill"
        >
          <svg className="w-4 h-4" fill={fillEnabled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" strokeWidth={2} rx="2" />
          </svg>
          Fill
        </button>
      </div>

      {/* Color picker */}
      <div className="flex items-center gap-2 border-t border-[#3a3837] pt-3">
        {colors.map((color) => (
          <button
            key={color.value}
            onClick={() => onColorChange(color.value)}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              selectedColor === color.value
                ? "border-white scale-110 ring-2 ring-blue-500"
                : "border-transparent hover:scale-105"
            }`}
            style={{ backgroundColor: color.value }}
            title={`${color.name}${hasSelection ? " (change selected)" : ""}`}
          />
        ))}
      </div>

      {/* Opacity slider (when annotation selected) */}
      {hasSelection && (
        <div className="flex flex-col gap-1 border-t border-[#3a3837] pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Opacity</span>
            <span className="text-xs text-gray-400">
              {Math.round(selectedOpacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={selectedOpacity}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      )}

      {/* Delete button (when annotation selected) */}
      {hasSelection && (
        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-2 p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors border-t border-[#3a3837] pt-3"
          title="Delete"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-xs">Delete</span>
        </button>
      )}

      {/* Clear all */}
      {annotationCount > 0 && (
        <button
          onClick={() => {
            if (confirm("Clear all annotations?")) {
              onClearAll();
            }
          }}
          className="p-2 text-gray-400 hover:text-white hover:bg-[#2a2827] rounded transition-colors text-xs border-t border-[#3a3837] pt-3"
          title="Clear All"
        >
          Clear All ({annotationCount})
        </button>
      )}
    </div>
  );
}
