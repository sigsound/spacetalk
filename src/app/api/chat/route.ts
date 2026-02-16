import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { sampleImages } from "@/lib/sampling";

import { AnalysisType } from "@/lib/types";

const anthropic = new Anthropic();

// Helper to read JSON file safely
function readJsonFile(filePath: string): object | null {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
    console.warn(`Failed to read JSON: ${filePath}`, e);
  }
  return null;
}

// Helper to read text file
function readTextFile(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch (e) {
    console.warn(`Failed to read text file: ${filePath}`, e);
  }
  return null;
}

// Sleep helper for retry logic
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Resource files for each analysis type
const RESOURCE_FILES: Record<AnalysisType, string[]> = {
  ada: ['ADAcompliance.txt'],
  compliance: ['LocalCompliance.txt'],
  damage: ['DamageAssessment.txt'],
};

// System prompts for each analysis type
const SYSTEM_PROMPTS: Record<AnalysisType, string> = {
  ada: `You are an ADA (Americans with Disabilities Act) compliance specialist analyzing 3D-captured spaces.

You have been provided with:
1. Reference documentation on ADA accessibility requirements
2. Floor plan data with room layouts, dimensions, doors, and fixtures
3. Physical location data (address, jurisdiction)
4. Photographs of the space

Your task is to evaluate the space for ADA compliance issues. Focus on:
- Doorway widths (min 32" clear, 36" preferred)
- Hallway widths (min 36", 60" for wheelchair turning)
- Bathroom accessibility (grab bars, clearances, fixture heights)
- Ramp requirements and slope (max 1:12 ratio)
- Threshold heights (max 1/2")
- Reach ranges (15"-48" for side reach)
- Signage and wayfinding
- Parking and entrance accessibility

Workflow:
1. First, review the provided ADA reference documentation
2. Then search the web for any jurisdiction-specific accessibility requirements
3. Analyze the space data and images against these requirements
4. Provide a clear compliance report with specific issues and recommendations

Be specific—cite measurements, room names, and exact requirements. Organize findings by severity (critical, moderate, minor).`,

  compliance: `You are a building code and zoning compliance specialist analyzing 3D-captured spaces.

You have been provided with:
1. Reference documentation on building codes and zoning requirements
2. Floor plan data with room layouts, dimensions, walls, doors, and fixtures
3. Physical location data (address, city, county, state)
4. Photographs of the space

Your task is to evaluate the space for building code and zoning compliance. Focus on:
- Structural requirements (ceiling heights, room sizes, egress)
- Electrical code (outlet spacing, GFCI/AFCI requirements)
- Plumbing code (fixture clearances, ventilation)
- Fire safety (smoke/CO detectors, exit routes)
- Zoning compliance (permitted use, setbacks)
- Permit requirements for any visible modifications

Workflow:
1. First, review the provided compliance reference documentation
2. Use the location data to identify the jurisdiction (city/county/state)
3. Search the web for current building codes specific to that jurisdiction
4. Analyze the space against both general and local requirements
5. Provide a compliance report with specific findings

Be specific—cite measurements, room names, and code references. Note items requiring professional inspection.`,

  damage: `You are a property damage assessment specialist assisting insurance adjusters and investigators.

You have been provided with:
1. Reference documentation on damage assessment and fire investigation
2. Floor plan data with room layouts and dimensions
3. Physical location data
4. Photographs of the damaged space

Your task is to analyze the damage and assist with investigation. Focus on:
- Damage type identification (fire, water, structural, etc.)
- Fire origin analysis (V-patterns, char depth, pour patterns)
- Damage extent and severity classification
- Affected materials and systems inventory
- Safety hazards requiring immediate attention
- Potential red flags or inconsistencies

Workflow:
1. First, review the provided damage assessment reference documentation
2. Carefully examine all images for damage patterns and indicators
3. Search the web for relevant investigation techniques if needed
4. Document findings systematically by area/room
5. Provide preliminary damage assessment with specific observations

Be thorough and objective. Note what you can observe directly vs. what requires on-site verification. Flag any patterns that warrant further investigation.`,
};

// User prompts for initial analysis
const ANALYSIS_PROMPTS: Record<AnalysisType, string> = {
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

interface ChatRequestMessage {
  role: "user" | "assistant";
  content: string;
}

interface UploadedFile {
  name: string;
  content: string;
}

function isValidAnalysisType(type: unknown): type is AnalysisType {
  return type === 'ada' || type === 'compliance' || type === 'damage';
}

export async function POST(req: NextRequest) {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "API key not configured", code: "NO_API_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let requestData: {
    messages: ChatRequestMessage[];
    selectedSpaces: string[];
    uploadedFiles?: UploadedFile[];
    analysisType?: AnalysisType;
  };

  try {
    requestData = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body", code: "INVALID_JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, selectedSpaces, uploadedFiles, analysisType } = requestData;

  // Validate required fields
  if (!messages || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "No messages provided", code: "NO_MESSAGES" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!selectedSpaces || selectedSpaces.length === 0) {
    return new Response(
      JSON.stringify({ error: "No spaces selected", code: "NO_SPACES" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const isFollowUp = messages.length > 1;
    const validAnalysisType = isValidAnalysisType(analysisType) ? analysisType : null;
    
    // Build content array with images and metadata for selected spaces
    const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];
    let totalSampledImages = 0;

    // Load reference resources for the analysis type (only on initial analysis)
    if (!isFollowUp && validAnalysisType) {
      const resourceFiles = RESOURCE_FILES[validAnalysisType];
      const resourcesDir = path.join(process.cwd(), "public/data/resources");
      
      for (const resourceFile of resourceFiles) {
        const resourceContent = readTextFile(path.join(resourcesDir, resourceFile));
        if (resourceContent) {
          contentBlocks.push({
            type: "text",
            text: `\n=== REFERENCE DOCUMENTATION: ${resourceFile} ===\n${resourceContent}`
          });
        }
      }
    }

    for (const spacePath of selectedSpaces) {
      const spaceDir = path.join(process.cwd(), "public/data/spaces", spacePath);
      const imagesDir = path.join(spaceDir, "images");
      const locationDir = path.join(spaceDir, "location");

      contentBlocks.push({
        type: "text",
        text: `\n=== SPACE: ${spacePath} ===`
      });

      // Read floorplan.csv first - contains the most relevant structured data
      const floorplanPath = path.join(spaceDir, "floorplan.csv");
      if (fs.existsSync(floorplanPath)) {
        const csvContent = fs.readFileSync(floorplanPath, "utf-8");
        contentBlocks.push({
          type: "text",
          text: `\n--- Floor Plan Data (floorplan.csv) ---\n${csvContent}`
        });
      }

      // Load location data (just first file - they're all the same location)
      if (fs.existsSync(locationDir)) {
        const locationFiles = fs.readdirSync(locationDir).filter(f => f.endsWith(".json"));
        if (locationFiles.length > 0) {
          const locationData = readJsonFile(path.join(locationDir, locationFiles[0]));
          if (locationData) {
            contentBlocks.push({
              type: "text",
              text: `\n--- Location Data ---\n${JSON.stringify(locationData, null, 2)}`
            });
          }
        }
      }

      // Only load images for the initial question, not follow-ups
      if (!isFollowUp) {
        // Add thumbnail first as overview
        const thumbnailPath = path.join(spaceDir, "thumbnail.jpg");
        if (fs.existsSync(thumbnailPath)) {
          const thumbData = fs.readFileSync(thumbnailPath).toString("base64");
          contentBlocks.push({
            type: "text",
            text: `\n[Thumbnail overview of 3D model]`
          });
          contentBlocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: thumbData
            }
          });
          totalSampledImages++;
        }

        // Sample a few representative images
        if (fs.existsSync(imagesDir)) {
          const allImages = fs.readdirSync(imagesDir)
            .filter(f => f.endsWith(".jpg") || f.endsWith(".jpeg"))
            .sort();

          const sampleIndices = sampleImages(allImages.length);

          contentBlocks.push({
            type: "text",
            text: `\n[Sampled ${sampleIndices.length} of ${allImages.length} capture images]`
          });

          for (const idx of sampleIndices) {
            const imgPath = path.join(imagesDir, allImages[idx]);
            const imgData = fs.readFileSync(imgPath).toString("base64");

            contentBlocks.push({
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imgData
              }
            });
          }

          totalSampledImages += sampleIndices.length;
        }
      } else {
        // For follow-ups, note context from initial analysis
        contentBlocks.push({
          type: "text",
          text: `[Images and detailed JSON data were analyzed in the initial question]`
        });
      }
    }

    // Add any uploaded file contents
    if (uploadedFiles?.length) {
      for (const file of uploadedFiles) {
        contentBlocks.push({
          type: "text",
          text: `\n--- UPLOADED FILE: ${file.name} ---\n${file.content}\n`
        });
      }
    }

    // Build the Claude messages array
    const claudeMessages: Anthropic.Messages.MessageParam[] = [];

    // First message includes the space context (with images only on initial request)
    claudeMessages.push({
      role: "user",
      content: [
        ...contentBlocks,
        { type: "text", text: messages[0].content }
      ]
    });

    // Add subsequent messages as-is (for follow-up conversation)
    for (let i = 1; i < messages.length; i++) {
      claudeMessages.push({
        role: messages[i].role,
        content: messages[i].content
      });
    }

    // Stream the response with retry logic for rate limits
    const MAX_RETRIES = 3;
    let stream: ReturnType<typeof anthropic.messages.stream> | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Use analysis-specific system prompt or default
        const systemPrompt = validAnalysisType 
          ? SYSTEM_PROMPTS[validAnalysisType]
          : SYSTEM_PROMPTS.compliance; // Default to compliance for general queries
          
        stream = anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages: claudeMessages,
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
            }
          ]
        });
        break; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (error instanceof Anthropic.APIError && error.status === 429) {
          const retryAfter = error.headers?.get?.("retry-after");
          const waitMs = retryAfter 
            ? parseInt(retryAfter, 10) * 1000 
            : Math.min(2000 * Math.pow(2, attempt), 30000);
          
          console.log(`Rate limited, waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(waitMs);
          continue;
        }
        throw error;
      }
    }

    if (!stream) {
      throw lastError || new Error("Failed to create stream after retries");
    }

    // Return as a streaming response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: "meta", 
            spacesCount: selectedSpaces.length,
            sampledImages: totalSampledImages,
            isFollowUp
          })}\n\n`));

          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (streamError) {
          console.error("Stream error:", streamError);
          
          // Determine error type and message
          let errorCode = "STREAM_ERROR";
          let errorMessage = "An error occurred during streaming";
          
          if (streamError instanceof Anthropic.APIError) {
            if (streamError.status === 429) {
              errorCode = "RATE_LIMITED";
              errorMessage = "Rate limit exceeded. Please wait and try again.";
            } else if (streamError.status === 503 || streamError.status === 500) {
              errorCode = "SERVICE_UNAVAILABLE";
              errorMessage = "Claude is temporarily unavailable. Please try again.";
            }
          } else if (streamError instanceof Error && streamError.message.includes("overloaded")) {
            errorCode = "OVERLOADED";
            errorMessage = "Claude is currently overloaded. Please wait and try again.";
          }
          
          // Send error through SSE stream
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: "error", 
            error: errorMessage, 
            code: errorCode 
          })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);

    // Handle Anthropic API errors
    if (error instanceof Anthropic.APIError) {
      const status = error.status || 500;
      let errorMessage = "Claude API error";
      let errorCode = "API_ERROR";

      if (status === 401) {
        errorMessage = "Invalid API key";
        errorCode = "INVALID_API_KEY";
      } else if (status === 429) {
        errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
        errorCode = "RATE_LIMITED";
      } else if (status === 400) {
        errorMessage = "Request too large. Try selecting fewer spaces.";
        errorCode = "REQUEST_TOO_LARGE";
      } else if (status === 500 || status === 503) {
        errorMessage = "Claude is temporarily unavailable. Please try again.";
        errorCode = "SERVICE_UNAVAILABLE";
      }

      return new Response(
        JSON.stringify({ error: errorMessage, code: errorCode, details: error.message }),
        { status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle file system errors
    if (error instanceof Error && error.message.includes("ENOENT")) {
      return new Response(
        JSON.stringify({ error: "Space data not found", code: "SPACE_NOT_FOUND" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generic error
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to process request", code: "UNKNOWN", details: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
