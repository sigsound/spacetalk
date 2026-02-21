"use client";

import { FloorplanAnnotation } from "@/lib/types";

interface FloorplanAnnotationsProps {
  annotations: FloorplanAnnotation[];
  width: number;
  height: number;
}

export default function FloorplanAnnotations({ 
  annotations, 
  width, 
  height 
}: FloorplanAnnotationsProps) {
  // Debug: show coordinate grid (set to true to enable)
  const showGrid = false;
  
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ 
        display: 'block',
        pointerEvents: 'none'
      }}
    >
      {/* Debug grid */}
      {showGrid && (
        <>
          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(percent => (
            <g key={`grid-${percent}`}>
              <line x1={(percent/100)*width} y1={0} x2={(percent/100)*width} y2={height} stroke="#ff00ff" strokeWidth="1" opacity="0.3" />
              <line x1={0} y1={(percent/100)*height} x2={width} y2={(percent/100)*height} stroke="#ff00ff" strokeWidth="1" opacity="0.3" />
              <text x={(percent/100)*width + 5} y={20} fill="#ff00ff" fontSize="12">{percent}</text>
              <text x={5} y={(percent/100)*height + 15} fill="#ff00ff" fontSize="12">{percent}</text>
            </g>
          ))}
        </>
      )}
      {annotations.map((annotation) => {
        // Coordinates are already in pixels (not percentages)
        const x = annotation.x;
        const y = annotation.y;
        const opacity = annotation.opacity !== undefined ? annotation.opacity : 0.6;

        switch (annotation.type) {
          case 'pencil':
            if (annotation.pathData) {
              return (
                <path
                  key={annotation.id}
                  d={annotation.pathData}
                  stroke={annotation.color || '#fbbf24'}
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={opacity}
                />
              );
            }
            return null;

          case 'circle':
            const radius = annotation.radius || 60; // Default 60px radius
            return (
              <circle
                key={annotation.id}
                cx={x}
                cy={y}
                r={radius}
                fill="none"
                stroke={annotation.color || '#ef4444'}
                strokeWidth="3"
                opacity={opacity}
              />
            );

          case 'rectangle':
            const rectWidth = annotation.width || 150; // Default 150px
            const rectHeight = annotation.height || 150; // Default 150px
            return (
              <rect
                key={annotation.id}
                x={x - rectWidth / 2}
                y={y - rectHeight / 2}
                width={rectWidth}
                height={rectHeight}
                fill="none"
                stroke={annotation.color || '#ef4444'}
                strokeWidth="3"
                opacity={opacity}
              />
            );

          case 'highlight':
            const highlightWidth = annotation.width || 150; // Default 150px
            const highlightHeight = annotation.height || 120; // Default 120px
            // x,y represent top-left corner (not center) when width/height are provided
            const highlightX = annotation.width ? x : (x - highlightWidth / 2);
            const highlightY = annotation.height ? y : (y - highlightHeight / 2);
            return (
              <rect
                key={annotation.id}
                x={highlightX}
                y={highlightY}
                width={highlightWidth}
                height={highlightHeight}
                fill={annotation.color || '#fbbf24'}
                opacity={opacity}
                stroke={annotation.color || '#fbbf24'}
                strokeWidth="2"
              />
            );

          case 'arrow':
            const toX = annotation.toX || (x + 100); // Default 100px to the right
            const toY = annotation.toY || (y + 100); // Default 100px down
            const angle = Math.atan2(toY - y, toX - x);
            const arrowSize = 15;
            
            return (
              <g key={annotation.id}>
                <line
                  x1={x}
                  y1={y}
                  x2={toX}
                  y2={toY}
                  stroke={annotation.color || '#ef4444'}
                  strokeWidth="3"
                  markerEnd="url(#arrowhead)"
                />
                <polygon
                  points={`${toX},${toY} ${toX - arrowSize * Math.cos(angle - Math.PI / 6)},${toY - arrowSize * Math.sin(angle - Math.PI / 6)} ${toX - arrowSize * Math.cos(angle + Math.PI / 6)},${toY - arrowSize * Math.sin(angle + Math.PI / 6)}`}
                  fill={annotation.color || '#ef4444'}
                />
              </g>
            );

          case 'label':
            return (
              <g key={annotation.id}>
                <circle
                  cx={x}
                  cy={y}
                  r="20"
                  fill={annotation.color || '#3b82f6'}
                  opacity="0.9"
                />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="14"
                  fontWeight="bold"
                >
                  {annotation.label || '?'}
                </text>
              </g>
            );

          default:
            return null;
        }
      })}
    </svg>
  );
}
