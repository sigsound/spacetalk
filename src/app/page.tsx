"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Space, ChatMessage as ChatMessageType, UploadedFile, AnalysisType } from "@/lib/types";
import SpaceSidebar from "@/components/SpaceSidebar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import PolycamLogo from "@/components/PolycamLogo";

export default function Home() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch spaces on mount
  useEffect(() => {
    async function fetchSpaces() {
      try {
        const res = await fetch("/api/spaces");
        const data = await res.json();
        setSpaces(data.spaces);
        setSelectedSpaces(data.spaces.map((s: Space) => s.id));
      } catch (error) {
        console.error("Failed to fetch spaces:", error);
      } finally {
        setSpacesLoading(false);
      }
    }
    fetchSpaces();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cmd+K to focus input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleToggleSpace = useCallback((spaceId: string) => {
    setSelectedSpaces((prev) =>
      prev.includes(spaceId)
        ? prev.filter((id) => id !== spaceId)
        : [...prev, spaceId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedSpaces(spaces.map((s) => s.id));
  }, [spaces]);

  const handleDeselectAll = useCallback(() => {
    setSelectedSpaces([]);
  }, []);

  const handleNewAnalysis = useCallback(() => {
    setMessages([]);
    setUploadedFiles([]);
    setHasAnalyzed(false);
  }, []);

  const handleAnalyze = async (type: AnalysisType) => {
    if (selectedSpaces.length === 0) {
      alert("Please select at least one space to analyze.");
      return;
    }

    const prompts: Record<AnalysisType, string> = {
      ada: `Conduct a comprehensive ADA accessibility compliance check on the selected space(s). 

Provide:
1. **Executive Summary** - Overall accessibility status
2. **Critical Issues** - Violations that prevent access or pose safety risks
3. **Moderate Issues** - Non-compliant items that should be addressed
4. **Minor Issues** - Recommendations for improved accessibility
5. **Compliant Features** - Areas meeting ADA requirements
6. **Recommendations** - Prioritized list of remediation steps with estimated complexity`,

      compliance: `Conduct a comprehensive building code and zoning compliance check on the selected space(s).

Provide:
1. **Property Overview** - Location, jurisdiction, apparent use/occupancy type
2. **Structural Compliance** - Room sizes, ceiling heights, egress analysis
3. **Electrical Compliance** - Visible electrical concerns
4. **Plumbing Compliance** - Fixture placement, ventilation
5. **Fire Safety** - Detector presence, exit routes, fire separation
6. **Zoning Observations** - Apparent permitted use, any obvious concerns
7. **Permit Concerns** - Signs of unpermitted work
8. **Recommendations** - Items requiring professional inspection or remediation`,

      damage: `Conduct a comprehensive damage assessment on the selected space(s).

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

    await handleSend(prompts[type], true, type);
    setHasAnalyzed(true);
  };

  const handleSend = async (content: string, isInitialAnalysis = false, analysisType?: AnalysisType) => {
    if (selectedSpaces.length === 0) {
      alert("Please select at least one space to analyze.");
      return;
    }

    const userMessage: ChatMessageType = {
      id: uuidv4(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setIsStreaming(true);

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
          selectedSpaces,
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
            if (data === "[DONE]") {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              
              // Handle metadata message
              if (parsed.type === "meta" && !metaReceived) {
                metaReceived = true;
                if (parsed.isFollowUp) {
                  // Don't show analyzing message for follow-ups
                  fullContent = "";
                } else {
                  fullContent = `*Analyzing ${parsed.spacesCount} space${parsed.spacesCount > 1 ? 's' : ''} (${parsed.sampledImages} sampled images)...*\n\n`;
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
              }
              // Handle streaming error
              else if (parsed.type === "error") {
                throw new Error(parsed.error || "An error occurred");
              }
              // Handle text delta
              else if (parsed.text) {
                fullContent += parsed.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: fullContent }
                      : m
                  )
                );
              }
            } catch (parseError) {
              // Re-throw if it's our intentional error, otherwise ignore parse errors
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

  const handleFileUpload = (files: UploadedFile[]) => {
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex h-screen bg-[#100f0f]">
      {/* Sidebar */}
      <SpaceSidebar
        spaces={spaces}
        selectedSpaces={selectedSpaces}
        onToggleSpace={handleToggleSpace}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        loading={spacesLoading}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-[#2a2827] flex items-center justify-between px-6 bg-[#100f0f]">
          <div className="flex items-center gap-3">
            <PolycamLogo className="w-6 h-7" color="#ffffff" />
            <h1 className="text-xl font-semibold text-white">Space Talk</h1>
          </div>
          <div className="flex items-center gap-4">
            {hasAnalyzed && (
              <button
                onClick={handleNewAnalysis}
                className="text-sm text-[#FF8E80] hover:text-[#FF7A6A] transition-colors"
              >
                New Analysis
              </button>
            )}
            <span className="text-sm text-gray-500 flex items-center gap-1.5">
              <span>Powered by</span>
              <PolycamLogo className="w-4 h-5" color="currentColor" />
              <span>Polycam</span>
            </span>
          </div>
        </header>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-lg">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                  <PolycamLogo className="w-10 h-12" color="#ffffff" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-3">Analyze Your Spaces</h2>
                <p className="text-gray-400 mb-2">
                  Select spaces from the sidebar, then click Analyze to generate a comprehensive report.
                </p>
                <p className="text-gray-500 text-sm mb-6">
                  After analysis, you can ask follow-up questions about anything in the report.
                </p>
                
                <div className="flex flex-col gap-3">
                  {/* ADA Check Button */}
                  <button
                    onClick={() => handleAnalyze('ada')}
                    disabled={isLoading || selectedSpaces.length === 0}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-[#2a2827] disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors inline-flex items-center justify-center gap-2 min-w-[240px]"
                  >
                    {isLoading ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        ADA Accessibility Check
                      </>
                    )}
                  </button>

                  {/* Compliance Check Button */}
                  <button
                    onClick={() => handleAnalyze('compliance')}
                    disabled={isLoading || selectedSpaces.length === 0}
                    className="px-6 py-3 bg-[#FF8E80] hover:bg-[#FF7A6A] disabled:bg-[#2a2827] disabled:cursor-not-allowed text-[#100f0f] disabled:text-white font-medium rounded-xl transition-colors inline-flex items-center justify-center gap-2 min-w-[240px]"
                  >
                    {isLoading ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Building Code & Zoning
                      </>
                    )}
                  </button>

                  {/* Damage Check Button */}
                  <button
                    onClick={() => handleAnalyze('damage')}
                    disabled={isLoading || selectedSpaces.length === 0}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-[#2a2827] disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors inline-flex items-center justify-center gap-2 min-w-[240px]"
                  >
                    {isLoading ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                        </svg>
                        Damage Assessment
                      </>
                    )}
                  </button>
                </div>
                
                {selectedSpaces.length === 0 && (
                  <p className="text-yellow-500/80 text-sm mt-4">
                    Select at least one space from the sidebar
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={isStreaming && index === messages.length - 1 && message.role === "assistant"}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area - only show after initial analysis */}
        {hasAnalyzed && (
          <ChatInput
            onSend={handleSend}
            onFileUpload={handleFileUpload}
            uploadedFiles={uploadedFiles}
            onRemoveFile={handleRemoveFile}
            disabled={isLoading}
          />
        )}
      </div>
    </div>
  );
}
