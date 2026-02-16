# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Space Talk is a Next.js 14 demo app for Polycam board meetings. It enables users to ask natural language questions about 3D-captured environments using Claude's vision API to analyze JSON metadata and sampled JPG images from each capture.

## Commands

```bash
npm run dev      # Start development server at http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
```

## Environment Setup

Create `.env.local` with:
```
ANTHROPIC_API_KEY=sk-ant-...
```

## Architecture

### Data Flow
```
Browser (Chat UI) → POST /api/chat → Claude API (claude-sonnet-4-20250514 with vision + web_search)
                 ↑
                 └── Space selector fetches from GET /api/spaces
```

### Expected Data Structure
```
/public/data/spaces/
  space-001/
    metadata.json        # 3D capture metadata (dimensions, point counts, etc.)
    images/
      frame_00001.jpg    # Could be 500–2,000+ images per space
      ...
  space-002/
    ...
```

### Key Directories
- `src/app/api/chat/route.ts` - Claude API integration with SSE streaming
- `src/app/api/spaces/route.ts` - Discovers spaces from data directory
- `src/components/` - React components (ChatMessage, ChatInput, SpaceSidebar)
- `src/lib/sampling.ts` - Image sampling logic (caps at ~50-150 images per space)
- `src/lib/types.ts` - TypeScript interfaces (Space, ChatMessage, UploadedFile)

### Image Sampling Strategy
Cannot send all images to Claude. Sampling intervals based on total count:
- ≤500 images: interval=10 (~50 sampled)
- ≤2000 images: interval=25 (~80 sampled)
- ≤5000 images: interval=50 (~100 sampled)
- >5000 images: interval=100 (~100-150 sampled)

### Streaming Implementation
- API route returns Server-Sent Events (SSE)
- Client uses `fetch()` with `ReadableStream` reader
- Format: `data: {"text": "..."}\n\n` with `data: [DONE]\n\n` terminator

## Tech Stack
- Next.js 16 with App Router and TypeScript
- Tailwind CSS v4
- `@anthropic-ai/sdk` for Claude API
- `react-markdown` for rendering assistant responses
- `uuid` for message IDs

## UI Design
- Dark theme: #0a0a0a background, #1a1a1a cards
- Left sidebar (280px): space selector with thumbnails and checkboxes
- Main area: streaming chat with markdown rendering
- Bottom input bar: text input, send button, file upload (.pdf, .txt, .csv, .json)
