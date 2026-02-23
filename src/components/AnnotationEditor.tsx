"use client";

import { useState, useRef, useEffect } from "react";
import { FloorplanAnnotation } from "@/lib/types";

interface AnnotationEditorProps {
  annotations: FloorplanAnnotation[];
  onAnnotationsChange: (annotations: FloorplanAnnotation[]) => void;
  width: number;
  height: number;
  transform: {
    zoom: number;
    pan: { x: number; y: number };
  };
  isPanning: boolean;
  activeTool: "pan" | "select" | "pencil" | "circle" | "rectangle" | "text";
  selectedColor: string;
  selectedOpacity: number;
  fillEnabled: boolean;
  onSelectionChange: (id: string | null) => void;
  selectedAnnotationId: string | null;
}

type DrawingTool = "select" | "pencil" | "circle" | "rectangle";

interface PencilStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export default function AnnotationEditor({
  annotations,
  onAnnotationsChange,
  width,
  height,
  transform,
  isPanning,
  activeTool,
  selectedColor,
  selectedOpacity,
  fillEnabled,
  onSelectionChange,
  selectedAnnotationId,
}: AnnotationEditorProps) {
  const [editingText, setEditingText] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [resizeStart, setResizeStart] = useState<{ annotation: FloorplanAnnotation; point: { x: number; y: number } } | null>(null);
  const [currentStroke, setCurrentStroke] = useState<PencilStroke | null>(null);
  const [tempShape, setTempShape] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);

  const colors = [
    { name: "Yellow", value: "#fbbf24" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Red", value: "#ef4444" },
    { name: "Green", value: "#10b981" },
    { name: "Purple", value: "#a855f7" },
    { name: "Orange", value: "#f97316" },
  ];

  // Convert screen coordinates to SVG coordinates
  const screenToSvg = (screenX: number, screenY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    
    // Use SVG's native getScreenCTM for accurate coordinate transformation
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning || activeTool === "pan") return;
    
    const point = screenToSvg(e.clientX, e.clientY);

    if (activeTool === "select") {
      // Check if clicking on resize handle first
      if (selectedAnnotationId) {
        const selected = annotations.find(ann => ann.id === selectedAnnotationId);
        if (selected) {
          let handleHit: string | null = null;
          
          if (selected.type === "circle") {
            const radius = selected.radius || 60;
            const handleDist = Math.sqrt(
              Math.pow(point.x - (selected.x + radius), 2) + Math.pow(point.y - selected.y, 2)
            );
            if (handleDist <= 8) {
              handleHit = "radius";
            }
          } else if (selected.type === "highlight") {
            const w = selected.width || 150;
            const h = selected.height || 150;
            // Check corner handles (8px hit area)
            if (Math.abs(point.x - (selected.x + w)) <= 8 && Math.abs(point.y - (selected.y + h)) <= 8) {
              handleHit = "se";
            } else if (Math.abs(point.x - selected.x) <= 8 && Math.abs(point.y - (selected.y + h)) <= 8) {
              handleHit = "sw";
            } else if (Math.abs(point.x - (selected.x + w)) <= 8 && Math.abs(point.y - selected.y) <= 8) {
              handleHit = "ne";
            } else if (Math.abs(point.x - selected.x) <= 8 && Math.abs(point.y - selected.y) <= 8) {
              handleHit = "nw";
            }
          }
          
          if (handleHit) {
            setIsResizing(true);
            setResizeHandle(handleHit);
            setResizeStart({ annotation: selected, point });
            return;
          }
        }
      }
      
      // Check if clicking on an annotation
      const clicked = annotations.find((ann) => {
        if (ann.type === "pencil" && ann.bounds) {
          // Check if click is within pencil stroke bounds
          return (
            point.x >= ann.bounds.minX &&
            point.x <= ann.bounds.maxX &&
            point.y >= ann.bounds.minY &&
            point.y <= ann.bounds.maxY
          );
        } else if (ann.type === "circle") {
          const dx = point.x - ann.x;
          const dy = point.y - ann.y;
          const radius = ann.radius || 60;
          return Math.sqrt(dx * dx + dy * dy) <= radius;
        } else if (ann.type === "rectangle" || ann.type === "highlight") {
          const rectWidth = ann.width || 150;
          const rectHeight = ann.height || 150;
          const x1 = ann.x;
          const y1 = ann.y;
          return (
            point.x >= x1 &&
            point.x <= x1 + rectWidth &&
            point.y >= y1 &&
            point.y <= y1 + rectHeight
          );
        } else if (ann.type === "text") {
          // Rough bounds check for text (can be refined)
          const textWidth = ((ann.text?.length || 0) * (ann.fontSize || 16)) * 0.6;
          const textHeight = (ann.fontSize || 16) * 1.2;
          return (
            point.x >= ann.x &&
            point.x <= ann.x + textWidth &&
            point.y >= ann.y - textHeight &&
            point.y <= ann.y
          );
        }
        return false;
      });

      if (clicked) {
        onSelectionChange(clicked.id);
        setIsDragging(true);
        setDragStart(point);
      } else {
        onSelectionChange(null);
      }
    } else if (activeTool === "pencil") {
      setIsDrawing(true);
      setCurrentStroke({
        id: `pencil-${Date.now()}`,
        points: [point],
        color: selectedColor,
        width: 3,
      });
    } else if (activeTool === "circle" || activeTool === "rectangle") {
      setIsDrawing(true);
      setTempShape({ start: point, end: point });
    } else if (activeTool === "text") {
      e.stopPropagation(); // Prevent pan/other handlers
      // Create text annotation and start editing
      const newAnnotation: FloorplanAnnotation = {
        id: `text-${Date.now()}`,
        type: "text",
        x: point.x,
        y: point.y,
        text: "",
        fontSize: 16,
        color: selectedColor,
        opacity: selectedOpacity,
      };
      onAnnotationsChange([...annotations, newAnnotation]);
      setTimeout(() => {
        setEditingText(newAnnotation.id);
        setTextInput("");
      }, 0);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning || activeTool === "pan") return;
    
    const point = screenToSvg(e.clientX, e.clientY);

    if (isResizing && resizeStart && resizeHandle) {
      const dx = point.x - resizeStart.point.x;
      const dy = point.y - resizeStart.point.y;
      const ann = resizeStart.annotation;
      
      onAnnotationsChange(
        annotations.map((a) => {
          if (a.id !== selectedAnnotationId) return a;
          
          if (a.type === "circle" && resizeHandle === "radius") {
            const newRadius = Math.max(10, (ann.radius || 60) + dx);
            return { ...a, radius: newRadius };
          } else if (a.type === "highlight") {
            const origW = ann.width || 150;
            const origH = ann.height || 150;
            const origX = ann.x;
            const origY = ann.y;
            let newX = origX;
            let newY = origY;
            let newW = origW;
            let newH = origH;
            
            if (resizeHandle === "se") {
              newW = Math.max(20, origW + dx);
              newH = Math.max(20, origH + dy);
            } else if (resizeHandle === "sw") {
              newX = origX + dx;
              newW = Math.max(20, origW - dx);
              newH = Math.max(20, origH + dy);
            } else if (resizeHandle === "ne") {
              newY = origY + dy;
              newW = Math.max(20, origW + dx);
              newH = Math.max(20, origH - dy);
            } else if (resizeHandle === "nw") {
              newX = origX + dx;
              newY = origY + dy;
              newW = Math.max(20, origW - dx);
              newH = Math.max(20, origH - dy);
            }
            
            return { ...a, x: newX, y: newY, width: newW, height: newH };
          }
          return a;
        })
      );
      // DON'T update resizeStart - keep the original reference point
    } else if (isDragging && selectedAnnotationId && dragStart) {
      const dx = point.x - dragStart.x;
      const dy = point.y - dragStart.y;

      onAnnotationsChange(
        annotations.map((ann) => {
          if (ann.id !== selectedAnnotationId) return ann;
          
          // Special handling for pencil strokes - move all points
          if (ann.type === "pencil" && ann.pathData) {
            // Parse and update the path data
            const pathRegex = /([ML])\s*([\d.]+)\s+([\d.]+)/g;
            const newPathData = ann.pathData.replace(pathRegex, (match, cmd, x, y) => {
              const newX = parseFloat(x) + dx;
              const newY = parseFloat(y) + dy;
              return `${cmd} ${newX} ${newY}`;
            });
            
            // Update bounds if they exist
            const newBounds = ann.bounds ? {
              minX: ann.bounds.minX + dx,
              maxX: ann.bounds.maxX + dx,
              minY: ann.bounds.minY + dy,
              maxY: ann.bounds.maxY + dy,
            } : undefined;
            
            return { 
              ...ann, 
              x: ann.x + dx, 
              y: ann.y + dy,
              pathData: newPathData,
              bounds: newBounds,
            };
          }
          
          // Normal position update for other types
          return { ...ann, x: ann.x + dx, y: ann.y + dy };
        })
      );
      setDragStart(point);
    } else if (isDrawing && activeTool === "pencil" && currentStroke) {
      setCurrentStroke({
        ...currentStroke,
        points: [...currentStroke.points, point],
      });
    } else if (isDrawing && tempShape) {
      setTempShape({ ...tempShape, end: point });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning || activeTool === "pan") return;

    if (isDrawing && activeTool === "pencil" && currentStroke) {
      // Convert pencil stroke to path annotation
      const pathData = currentStroke.points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
        .join(" ");
      
      // Calculate bounds for selection
      const xs = currentStroke.points.map(p => p.x);
      const ys = currentStroke.points.map(p => p.y);
      const bounds = {
        minX: Math.min(...xs) - 5,
        maxX: Math.max(...xs) + 5,
        minY: Math.min(...ys) - 5,
        maxY: Math.max(...ys) + 5,
      };
      
      const newAnnotation: FloorplanAnnotation = {
        id: currentStroke.id,
        type: "pencil" as any,
        x: currentStroke.points[0].x,
        y: currentStroke.points[0].y,
        color: currentStroke.color,
        pathData,
        bounds,
        opacity: selectedOpacity,
      };

      onAnnotationsChange([...annotations, newAnnotation]);
      setCurrentStroke(null);
    } else if (isDrawing && tempShape && (activeTool === "circle" || activeTool === "rectangle")) {
      const { start, end } = tempShape;
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;

      if (activeTool === "circle") {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const radius = Math.sqrt(dx * dx + dy * dy) / 2;

        const newAnnotation: FloorplanAnnotation = {
          id: `circle-${Date.now()}`,
          type: "circle",
          x: centerX,
          y: centerY,
          radius,
          color: selectedColor,
          fill: fillEnabled,
          opacity: selectedOpacity,
        };

        onAnnotationsChange([...annotations, newAnnotation]);
      } else if (activeTool === "rectangle") {
        const rectWidth = Math.abs(end.x - start.x);
        const rectHeight = Math.abs(end.y - start.y);

        const newAnnotation: FloorplanAnnotation = {
          id: `rectangle-${Date.now()}`,
          type: "highlight",
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width: rectWidth,
          height: rectHeight,
          color: selectedColor,
          fill: fillEnabled,
          opacity: selectedOpacity,
        };

        onAnnotationsChange([...annotations, newAnnotation]);
      }

      setTempShape(null);
    }

    setIsDrawing(false);
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setResizeStart(null);
    setDragStart(null);
  };

  return (
    <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          display: "block",
          cursor:
            activeTool === "pan"
              ? "grab"
              : activeTool === "select"
              ? isDragging
                ? "grabbing"
                : "default"
              : "crosshair",
          pointerEvents: activeTool === "pan" ? "none" : "auto",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Render existing annotations */}
        {annotations.map((annotation) => {
          const isSelected = annotation.id === selectedAnnotationId;
          const opacity = annotation.opacity !== undefined ? annotation.opacity : 0.6;

          if (annotation.type === "pencil" && (annotation as any).pathData) {
            return (
              <g key={annotation.id}>
                <path
                  d={(annotation as any).pathData}
                  stroke={annotation.color || "#fbbf24"}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={opacity}
                />
                {isSelected && annotation.bounds && (
                  <rect
                    x={annotation.bounds.minX}
                    y={annotation.bounds.minY}
                    width={annotation.bounds.maxX - annotation.bounds.minX}
                    height={annotation.bounds.maxY - annotation.bounds.minY}
                    fill="none"
                    stroke="white"
                    strokeWidth={2}
                    strokeDasharray="5,5"
                  />
                )}
              </g>
            );
          } else if (annotation.type === "circle") {
            const radius = annotation.radius || 60;
            const hasFill = annotation.fill !== undefined ? annotation.fill : false;
            return (
              <g key={annotation.id}>
                <circle
                  cx={annotation.x}
                  cy={annotation.y}
                  r={radius}
                  fill={hasFill ? annotation.color || "#ef4444" : "none"}
                  stroke={annotation.color || "#ef4444"}
                  strokeWidth={3}
                  opacity={opacity}
                />
                {isSelected && (
                  <>
                    <circle
                      cx={annotation.x}
                      cy={annotation.y}
                      r={radius}
                      fill="none"
                      stroke="white"
                      strokeWidth={2}
                      strokeDasharray="5,5"
                    />
                    <circle cx={annotation.x} cy={annotation.y} r={4} fill="white" />
                    {/* Resize handle */}
                    <circle
                      cx={annotation.x + radius}
                      cy={annotation.y}
                      r={6}
                      fill="white"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      style={{ cursor: "ew-resize" }}
                    />
                  </>
                )}
              </g>
            );
          } else if (annotation.type === "highlight") {
            const rectWidth = annotation.width || 150;
            const rectHeight = annotation.height || 150;
            const hasFill = annotation.fill !== undefined ? annotation.fill : true;
            return (
              <g key={annotation.id}>
                <rect
                  x={annotation.x}
                  y={annotation.y}
                  width={rectWidth}
                  height={rectHeight}
                  fill={hasFill ? annotation.color || "#fbbf24" : "none"}
                  opacity={opacity}
                  stroke={annotation.color || "#fbbf24"}
                  strokeWidth={3}
                />
                {isSelected && (
                  <>
                    <rect
                      x={annotation.x}
                      y={annotation.y}
                      width={rectWidth}
                      height={rectHeight}
                      fill="none"
                      stroke="white"
                      strokeWidth={2}
                      strokeDasharray="5,5"
                    />
                    <circle cx={annotation.x + rectWidth / 2} cy={annotation.y + rectHeight / 2} r={4} fill="white" />
                    {/* Corner resize handles */}
                    <circle cx={annotation.x} cy={annotation.y} r={6} fill="white" stroke="#3b82f6" strokeWidth={2} style={{ cursor: "nwse-resize" }} />
                    <circle cx={annotation.x + rectWidth} cy={annotation.y} r={6} fill="white" stroke="#3b82f6" strokeWidth={2} style={{ cursor: "nesw-resize" }} />
                    <circle cx={annotation.x} cy={annotation.y + rectHeight} r={6} fill="white" stroke="#3b82f6" strokeWidth={2} style={{ cursor: "nesw-resize" }} />
                    <circle cx={annotation.x + rectWidth} cy={annotation.y + rectHeight} r={6} fill="white" stroke="#3b82f6" strokeWidth={2} style={{ cursor: "nwse-resize" }} />
                  </>
                )}
              </g>
            );
          } else if (annotation.type === "text") {
            return (
              <g key={annotation.id}>
                <text
                  x={annotation.x}
                  y={annotation.y}
                  fill={annotation.color || "#fbbf24"}
                  fontSize={annotation.fontSize || 16}
                  opacity={opacity}
                  fontFamily="sans-serif"
                  style={{ userSelect: "none", cursor: "pointer" }}
                  onDoubleClick={() => {
                    if (activeTool === "select") {
                      setEditingText(annotation.id);
                      setTextInput(annotation.text || "");
                    }
                  }}
                >
                  {annotation.text || ""}
                </text>
                {isSelected && (
                  <>
                    <rect
                      x={annotation.x - 2}
                      y={annotation.y - (annotation.fontSize || 16) * 1.2}
                      width={((annotation.text?.length || 0) * (annotation.fontSize || 16)) * 0.6 + 4}
                      height={(annotation.fontSize || 16) * 1.4}
                      fill="none"
                      stroke="white"
                      strokeWidth={2}
                      strokeDasharray="5,5"
                    />
                    <circle cx={annotation.x} cy={annotation.y - (annotation.fontSize || 16) * 0.6} r={4} fill="white" />
                  </>
                )}
              </g>
            );
          }
          return null;
        })}

        {/* Render current stroke (pencil) */}
        {currentStroke && (
          <path
            d={currentStroke.points
              .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
              .join(" ")}
            stroke={currentStroke.color}
            strokeWidth={currentStroke.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={selectedOpacity}
          />
        )}

        {/* Render temp shape */}
        {tempShape && activeTool === "circle" && (
          <circle
            cx={(tempShape.start.x + tempShape.end.x) / 2}
            cy={(tempShape.start.y + tempShape.end.y) / 2}
            r={
              Math.sqrt(
                Math.pow(tempShape.end.x - tempShape.start.x, 2) +
                  Math.pow(tempShape.end.y - tempShape.start.y, 2)
              ) / 2
            }
            fill={fillEnabled ? selectedColor : "none"}
            stroke={selectedColor}
            strokeWidth={3}
            opacity={selectedOpacity}
          />
        )}
        {tempShape && activeTool === "rectangle" && (
          <rect
            x={Math.min(tempShape.start.x, tempShape.end.x)}
            y={Math.min(tempShape.start.y, tempShape.end.y)}
            width={Math.abs(tempShape.end.x - tempShape.start.x)}
            height={Math.abs(tempShape.end.y - tempShape.start.y)}
            fill={fillEnabled ? selectedColor : "none"}
            opacity={selectedOpacity}
            stroke={selectedColor}
            strokeWidth={3}
          />
        )}
        
        {/* Text input overlay */}
        {editingText && (() => {
          const textAnn = annotations.find(a => a.id === editingText);
          if (!textAnn) return null;
          return (
            <foreignObject
              x={textAnn.x}
              y={textAnn.y - 30}
              width="300"
              height="40"
            >
              <div style={{ width: "100%", height: "100%" }}>
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onBlur={() => {
                    if (textInput.trim()) {
                      onAnnotationsChange(
                        annotations.map(ann =>
                          ann.id === editingText ? { ...ann, text: textInput } : ann
                        )
                      );
                    } else {
                      // Remove empty text annotations
                      onAnnotationsChange(annotations.filter(ann => ann.id !== editingText));
                    }
                    setEditingText(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (textInput.trim()) {
                        onAnnotationsChange(
                          annotations.map(ann =>
                            ann.id === editingText ? { ...ann, text: textInput } : ann
                          )
                        );
                      } else {
                        onAnnotationsChange(annotations.filter(ann => ann.id !== editingText));
                      }
                      setEditingText(null);
                    } else if (e.key === "Escape") {
                      onAnnotationsChange(annotations.filter(ann => ann.id !== editingText));
                      setEditingText(null);
                    }
                  }}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    fontSize: "16px",
                    border: "2px solid #3b82f6",
                    borderRadius: "4px",
                    backgroundColor: "var(--card)",
                    color: "var(--foreground)",
                    outline: "none",
                    fontFamily: "sans-serif",
                  }}
                  placeholder="Type text..."
                />
              </div>
            </foreignObject>
          );
        })()}
      </svg>
  );
}
