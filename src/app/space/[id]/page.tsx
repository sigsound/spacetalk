"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Space, ChatMessage as ChatMessageType, UploadedFile, AnalysisType, SampledImagesData, FloorplanAnnotation } from "@/lib/types";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import SampledImagesGallery from "@/components/SampledImagesGallery";
import FloorplanAnnotations from "@/components/FloorplanAnnotations";
import AnnotationEditor from "@/components/AnnotationEditor";
import AnnotationToolbar from "@/components/AnnotationToolbar";
import { mapRoomsToPixels, findRoomByName, findRoomsByPattern, type RoomBounds, type FloorplanData } from "@/lib/roomMapper";

export default function SpaceViewPage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.id as string;

  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [documentSetupOpen, setDocumentSetupOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [sampledImagesData, setSampledImagesData] = useState<SampledImagesData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [annotations, setAnnotations] = useState<FloorplanAnnotation[]>([]);
  const [roomMap, setRoomMap] = useState<Map<string, RoomBounds> | null>(null);
  const [activeTool, setActiveTool] = useState<"pan" | "select" | "pencil" | "circle" | "rectangle" | "text">("pan");
  const [selectedColor, setSelectedColor] = useState("#fbbf24");
  const [selectedOpacity, setSelectedOpacity] = useState(0.6);
  const [fillEnabled, setFillEnabled] = useState(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isDrawingAnnotations, setIsDrawingAnnotations] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Floorplan zoom/pan state
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const floorplanContainerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev / 1.25, 0.25));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(0.5);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.min(Math.max(prev * delta, 0.25), 5));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && activeTool === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan, activeTool]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleScreenshot = useCallback(async () => {
    if (!floorplanContainerRef.current) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(floorplanContainerRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${space?.name || 'floorplan'}-annotated.png`;
        link.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Screenshot failed:', error);
    }
  }, [space]);

  // Fetch space data and coordinate bounds
  useEffect(() => {
    async function fetchSpace() {
      try {
        const res = await fetch("/api/spaces");
        const data = await res.json();
        const foundSpace = data.spaces.find((s: Space) => s.id === spaceId);
        if (foundSpace) {
          setSpace(foundSpace);
          
          // Load floorplan JSON to map rooms to pixel coordinates
          try {
            const floorplanRes = await fetch(`/data/spaces/${spaceId}/floorplan.json`);
            if (floorplanRes.ok) {
              const floorplanData: FloorplanData = await floorplanRes.json();
              const mappedRooms = mapRoomsToPixels(floorplanData);
              setRoomMap(mappedRooms);
              
              console.log(`Loaded floorplan with ${mappedRooms.size} rooms`);
              console.log('Available rooms:', Array.from(mappedRooms.keys()));
            }
          } catch (jsonError) {
            console.warn('Failed to load floorplan data:', jsonError);
          }
        } else {
          router.push("/");
        }
      } catch (error) {
        console.error("Failed to fetch space:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    }
    fetchSpace();
  }, [spaceId, router]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync toolbar state with selected annotation
  useEffect(() => {
    if (selectedAnnotationId) {
      const selectedAnnotation = annotations.find(ann => ann.id === selectedAnnotationId);
      if (selectedAnnotation) {
        // Update fill state to match the annotation
        if (selectedAnnotation.fill !== undefined) {
          setFillEnabled(selectedAnnotation.fill);
        }
        // Update opacity to match
        if (selectedAnnotation.opacity !== undefined) {
          setSelectedOpacity(selectedAnnotation.opacity);
        }
      }
    }
  }, [selectedAnnotationId, annotations]);

  const handleAnalyze = async (type: AnalysisType) => {
    const prompts: Record<AnalysisType, string> = {
      ada: `Conduct a comprehensive ADA accessibility compliance check on this space.

Provide:
1. **Executive Summary** - Overall accessibility status
2. **Critical Issues** - Violations that prevent access or pose safety risks
3. **Moderate Issues** - Non-compliant items that should be addressed
4. **Minor Issues** - Recommendations for improved accessibility
5. **Compliant Features** - Areas meeting ADA requirements
6. **Recommendations** - Prioritized list of remediation steps with estimated complexity`,

      compliance: `Conduct a comprehensive building code and zoning compliance check on this space.

Provide:
1. **Property Overview** - Location, jurisdiction, apparent use/occupancy type
2. **Structural Compliance** - Room sizes, ceiling heights, egress analysis
3. **Electrical Compliance** - Visible electrical concerns
4. **Plumbing Compliance** - Fixture placement, ventilation
5. **Fire Safety** - Detector presence, exit routes, fire separation
6. **Zoning Observations** - Apparent permitted use, any obvious concerns
7. **Permit Concerns** - Signs of unpermitted work
8. **Recommendations** - Items requiring professional inspection or remediation`,

      damage: `Conduct a comprehensive damage assessment on this space.

Provide:
1. **Damage Overview** - Type(s) of damage observed, overall severity
2. **Origin Analysis** - If fire damage, analyze patterns to identify likely origin area
3. **Room-by-Room Assessment** - Detailed damage in each affected area
4. **Structural Concerns** - Any compromised structural elements
5. **Systems Affected** - Electrical, plumbing, HVAC impact
6. **Safety Hazards** - Immediate concerns requiring attention
7. **Documentation Notes** - Key evidence and observations for the claim file
8. **Investigation Flags** - Any patterns or inconsistencies warranting further review`,
    };

    await handleSend(prompts[type], type);
  };

  const handleSend = async (content: string, analysisType?: AnalysisType) => {
    if (!space) return;

    const userMessage: ChatMessageType = {
      id: uuidv4(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setIsStreaming(true);
    setInputValue("");
    // Clear annotations on new query
    setAnnotations([]);

    const assistantMessage: ChatMessageType = {
      id: uuidv4(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          selectedSpaces: [space.id],
          uploadedFiles,
          analysisType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let metaReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "meta" && !metaReceived) {
                metaReceived = true;
                if (!parsed.isFollowUp) {
                  fullContent = `*Analyzing ${parsed.sampledImages} sampled images...*\n\n`;
                  // Store sampled images data for the gallery
                  if (parsed.sampledImagesData) {
                    setSampledImagesData(parsed.sampledImagesData);
                  }
                }
                if (fullContent) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: fullContent }
                        : m
                    )
                  );
                }
              } else if (parsed.error) {
                throw new Error(parsed.error || "An error occurred");
              } else if (parsed.text) {
                fullContent += parsed.text;
                
                // Check for annotation JSON blocks (but don't show them to user)
                const annotationMatch = fullContent.match(/```json-annotations\n([\s\S]*?)```/);
                if (annotationMatch) {
                  setIsDrawingAnnotations(true);
                  try {
                    const annotationData = JSON.parse(annotationMatch[1]);
                    if (annotationData.annotations && Array.isArray(annotationData.annotations)) {
                      if (!roomMap) {
                        console.warn('Room map not loaded yet, cannot process annotations');
                        setIsDrawingAnnotations(false);
                        return;
                      }
                      
                      const timestamp = Date.now();
                      console.log('Parsing annotations:', annotationData.annotations);
                      console.log('Available rooms:', Array.from(roomMap.keys()));
                      
                      const newAnnotations = annotationData.annotations.map((ann: any, idx: number) => {
                        // Handle room-based annotations
                        if (ann.type === 'room-highlight' || ann.type === 'room-circle' || ann.type === 'room-label') {
                          console.log(`Looking for room: "${ann.roomName}" (type: ${ann.type})`);
                          const roomBounds = findRoomByName(roomMap, ann.roomName);
                          if (!roomBounds) {
                            console.error(`Room not found: "${ann.roomName}"`);
                            console.log('Did you mean one of these?', Array.from(roomMap.keys()));
                            return null;
                          }
                          
                          console.log(`✓ Found room: ${ann.roomName} ->`, roomBounds.bounds);
                          
                          // Convert to pixel-based annotation format
                          if (ann.type === 'room-highlight') {
                            return {
                              id: `annotation-${timestamp}-${idx}-${Math.random()}`,
                              type: 'highlight',
                              x: roomBounds.bounds.x,
                              y: roomBounds.bounds.y,
                              width: roomBounds.bounds.width,
                              height: roomBounds.bounds.height,
                              color: ann.color || '#fbbf24',
                              opacity: ann.opacity !== undefined ? ann.opacity : 0.4,
                              room: ann.roomName
                            };
                          } else if (ann.type === 'room-circle') {
                            return {
                              id: `annotation-${timestamp}-${idx}-${Math.random()}`,
                              type: 'circle',
                              x: roomBounds.bounds.centerX,
                              y: roomBounds.bounds.centerY,
                              radius: ann.radius || 50,
                              color: ann.color || '#3b82f6',
                              opacity: ann.opacity !== undefined ? ann.opacity : 0.6,
                              room: ann.roomName
                            };
                          } else if (ann.type === 'room-label') {
                            return {
                              id: `annotation-${timestamp}-${idx}-${Math.random()}`,
                              type: 'label',
                              x: roomBounds.bounds.centerX,
                              y: roomBounds.bounds.centerY,
                              label: ann.label,
                              color: ann.color || '#111827',
                              opacity: ann.opacity !== undefined ? ann.opacity : 0.9,
                              room: ann.roomName
                            };
                          }
                        }
                        
                        // Legacy pixel-based annotations (still supported)
                        console.log('Pixel annotation:', ann);
                        return {
                          id: `annotation-${timestamp}-${idx}-${Math.random()}`,
                          type: ann.type,
                          x: Number(ann.x),
                          y: Number(ann.y),
                          width: ann.width ? Number(ann.width) : undefined,
                          height: ann.height ? Number(ann.height) : undefined,
                          radius: ann.radius ? Number(ann.radius) : undefined,
                          color: ann.color,
                          opacity: ann.opacity !== undefined ? ann.opacity : 0.6,
                          room: ann.room,
                          label: ann.label,
                          toX: ann.toX ? Number(ann.toX) : undefined,
                          toY: ann.toY ? Number(ann.toY) : undefined,
                        };
                      }).filter(Boolean);
                      
                      console.log('Setting annotations:', newAnnotations);
                      // Replace any existing AI annotations from Claude (identified by annotation- prefix)
                      setAnnotations((prev) => {
                        const manualAnnotations = prev.filter(ann => !ann.id.startsWith('annotation-'));
                        return [...manualAnnotations, ...newAnnotations as FloorplanAnnotation[]];
                      });
                      
                      // Remove the annotation JSON block from the message content completely
                      fullContent = fullContent.replace(/```json-annotations\n[\s\S]*?```/, '');
                      // Clean up any extra newlines
                      fullContent = fullContent.replace(/\n{3,}/g, '\n\n');
                      
                      setIsDrawingAnnotations(false);
                    }
                  } catch (e) {
                    console.warn('Failed to parse annotations:', e);
                    setIsDrawingAnnotations(false);
                  }
                }
                
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: fullContent }
                      : m
                  )
                );
              }
            } catch (parseError) {
              if (parseError instanceof Error && parseError.message !== "Unexpected token") {
                throw parseError;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Something went wrong";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, content: `**Error:** ${errorMessage}` }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && inputValue.trim() && !isLoading) {
      e.preventDefault();
      handleSend(inputValue.trim());
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#100f0f] flex items-center justify-center">
        <div className="text-gray-500">Loading space...</div>
      </div>
    );
  }

  if (!space) {
    return null;
  }

  return (
    <div className="h-screen bg-[#100f0f] flex overflow-hidden fixed inset-0">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-[#1a1918] border border-[#3a3837] rounded-lg text-white"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-30
        w-[85vw] sm:w-[320px] min-w-0 lg:min-w-[320px]
        bg-[#1a1918] border-r border-[#2a2827] flex flex-col h-full overflow-hidden
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Close button and Floor selector */}
        <div className="p-4 border-b border-[#2a2827]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">Floor 1</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              {/* Close sidebar button - mobile only */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1.5 text-gray-400 hover:text-white hover:bg-[#2a2827] rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2a2827] rounded transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <Link
                href="/"
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2a2827] rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Screenshot button */}
          <button 
            onClick={handleScreenshot}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2a2827] hover:bg-[#3a3837] text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Screenshot
          </button>
        </div>

        {/* Accordions */}
        <div className="border-b border-[#2a2827]">
          {/* Document setup */}
          <button
            onClick={() => setDocumentSetupOpen(!documentSetupOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-gray-200 hover:bg-[#2a2827]/50 transition-colors"
          >
            <span className="text-sm">Document setup</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${documentSetupOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {documentSetupOpen && (
            <div className="px-4 pb-3 text-sm text-gray-500">
              Document settings will appear here
            </div>
          )}

          {/* Visibility */}
          <button
            onClick={() => setVisibilityOpen(!visibilityOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-gray-200 hover:bg-[#2a2827]/50 transition-colors"
          >
            <span className="text-sm">Visibility</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${visibilityOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {visibilityOpen && (
            <div className="px-4 pb-3 text-sm text-gray-500">
              Visibility settings will appear here
            </div>
          )}
        </div>

        {/* Sampled Images Gallery */}
        {sampledImagesData && (
          <div className="border-b border-[#2a2827] max-h-[40%] overflow-y-auto">
            <SampledImagesGallery data={sampledImagesData} />
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`${message.role === "user" ? "ml-4" : ""}`}
            >
              <div
                className={`rounded-xl px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-[#FF8E80] text-[#100f0f] ml-auto max-w-[90%]"
                    : "bg-[#2a2827] text-gray-100 max-w-full"
                }`}
              >
                {message.role === "user" ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-bold mb-2 mt-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2">{children}</h3>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                    {isStreaming && index === messages.length - 1 && message.role === "assistant" && (
                      <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
                    )}
                    {isDrawingAnnotations && index === messages.length - 1 && message.role === "assistant" && (
                      <div className="mt-2 text-xs text-blue-400 italic flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                        <span className="animate-pulse">Drawing annotations...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-[#2a2827]">
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-white hover:bg-[#2a2827] rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your spaces"
              disabled={isLoading}
              className="flex-1 bg-[#2a2827] border border-[#3a3837] rounded-full px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#4a4847] disabled:opacity-50"
            />
            <button
              onClick={() => inputValue.trim() && handleSend(inputValue.trim())}
              disabled={isLoading || !inputValue.trim()}
              className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-full transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Analysis buttons - top right */}
        <div className="absolute top-4 right-4 z-50 flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3">
          <button
            onClick={() => handleAnalyze("ada")}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-medium rounded-full transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span className="sm:hidden">ADA</span>
            <span className="hidden sm:inline">ADA Accessibility</span>
          </button>
          <button
            onClick={() => handleAnalyze("compliance")}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#1a1918] hover:bg-[#2a2827] disabled:opacity-50 disabled:cursor-not-allowed border border-[#3a3837] text-white text-xs sm:text-sm font-medium rounded-full transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="sm:hidden">Code</span>
            <span className="hidden sm:inline">Building Code</span>
          </button>
          <button
            onClick={() => handleAnalyze("damage")}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#1a1918] hover:bg-[#2a2827] disabled:opacity-50 disabled:cursor-not-allowed border border-amber-600 text-amber-500 text-xs sm:text-sm font-medium rounded-full transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Damage</span>
          </button>
        </div>

        {/* Annotation Toolbar - Fixed to viewport */}
        {space.floorplanSvgUrl && (
          <AnnotationToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            selectedColor={selectedColor}
            onColorChange={(color) => {
              setSelectedColor(color);
              // If an annotation is selected, update its color
              if (selectedAnnotationId) {
                setAnnotations(
                  annotations.map((ann) =>
                    ann.id === selectedAnnotationId ? { ...ann, color } : ann
                  )
                );
              }
            }}
            selectedAnnotationId={selectedAnnotationId}
            annotations={annotations}
            selectedOpacity={selectedOpacity}
            fillEnabled={fillEnabled}
            onFillToggle={(enabled) => {
              setFillEnabled(enabled);
              // If an annotation is selected, update its fill property
              if (selectedAnnotationId) {
                setAnnotations(
                  annotations.map((ann) =>
                    ann.id === selectedAnnotationId ? { ...ann, fill: enabled } : ann
                  )
                );
              }
            }}
            onOpacityChange={(opacity) => {
              setSelectedOpacity(opacity);
              if (selectedAnnotationId) {
                setAnnotations(
                  annotations.map((ann) =>
                    ann.id === selectedAnnotationId ? { ...ann, opacity } : ann
                  )
                );
              }
            }}
            hasSelection={selectedAnnotationId !== null}
            onDelete={() => {
              if (selectedAnnotationId) {
                setAnnotations(annotations.filter((ann) => ann.id !== selectedAnnotationId));
                setSelectedAnnotationId(null);
              }
            }}
            annotationCount={annotations.length}
            onClearAll={() => {
              setAnnotations([]);
              setSelectedAnnotationId(null);
            }}
          />
        )}

        {/* Floorplan viewer */}
        <div className="h-full flex flex-col p-4 sm:p-8 pt-16 sm:pt-16 pl-14 lg:pl-4 sm:pl-8">
          {/* Floorplan container with zoom/pan */}
          <div className="relative flex-1 w-full">
            {space.floorplanSvgUrl ? (
              <>
                {/* Zoom controls */}
                <div className="absolute top-4 left-0 sm:left-4 z-20 flex flex-col gap-2">
                  <button
                    onClick={handleZoomIn}
                    className="p-2 bg-[#1a1918] hover:bg-[#2a2827] border border-[#3a3837] text-white rounded-lg transition-colors"
                    title="Zoom in"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-2 bg-[#1a1918] hover:bg-[#2a2827] border border-[#3a3837] text-white rounded-lg transition-colors"
                    title="Zoom out"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                    </svg>
                  </button>
                  <button
                    onClick={handleResetView}
                    className="p-2 bg-[#1a1918] hover:bg-[#2a2827] border border-[#3a3837] text-white rounded-lg transition-colors"
                    title="Reset view"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                </div>

                {/* Zoom level indicator */}
                <div className="absolute top-4 left-12 sm:left-16 z-20 px-2 py-1 bg-[#1a1918]/80 border border-[#3a3837] rounded text-xs text-gray-400">
                  {Math.round(zoom * 100)}%
                </div>
                
                {/* Annotation counter */}
                {annotations.length > 0 && (
                  <div className="absolute top-16 left-12 sm:left-16 z-20 px-2 py-1 bg-blue-600/80 rounded text-xs text-white flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                  </div>
                )}

                {/* Pan/zoom container */}
                <div
                  ref={floorplanContainerRef}
                  className="absolute inset-0"
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  style={{
                    cursor: activeTool === "pan" ? (isPanning ? "grabbing" : "grab") : "default",
                  }}
                >
                  {/* SVG floorplan with transform */}
                  <img
                    src={space.floorplanSvgUrl}
                    alt="Floorplan"
                    className="pointer-events-none select-none"
                    draggable={false}
                    style={{
                      filter: "invert(1)",
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: "center center",
                      transition: isPanning ? "none" : "transform 0.1s ease-out",
                      maxWidth: "none",
                      maxHeight: "none",
                      zIndex: 1,
                    }}
                  />
                  
                  {/* Annotation overlay with interactive editor - ALWAYS ON TOP */}
                  <div
                    className="absolute inset-0"
                    style={{
                      zIndex: 10,
                      pointerEvents: activeTool === "pan" ? "none" : "auto",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: "center center",
                        transition: isPanning ? "none" : "transform 0.1s ease-out",
                      }}
                    >
                      <AnnotationEditor
                        annotations={annotations}
                        onAnnotationsChange={setAnnotations}
                        width={1779}
                        height={1770}
                        transform={{ zoom, pan }}
                        isPanning={isPanning}
                      activeTool={activeTool}
                      selectedColor={selectedColor}
                      selectedOpacity={selectedOpacity}
                      fillEnabled={fillEnabled}
                      onSelectionChange={setSelectedAnnotationId}
                      selectedAnnotationId={selectedAnnotationId}
                      />
                    </div>
                  </div>
                </div>

                {/* Instructions hint */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 text-xs text-gray-500 bg-[#1a1918]/80 px-3 py-1.5 rounded-lg border border-[#3a3837] hidden sm:block">
                  {activeTool === "pan" ? "Scroll to zoom • Drag to pan" : "Use Pan tool to move floor plan"}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <svg className="w-20 h-20 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <p>No floorplan available for this space</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
