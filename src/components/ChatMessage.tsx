"use client";

import ReactMarkdown from "react-markdown";
import { ChatMessage as ChatMessageType } from "@/lib/types";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export default function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-[#1a1a1a] text-gray-100 border border-gray-800"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  return isBlock ? (
                    <pre className="bg-black/50 rounded p-3 overflow-x-auto my-2">
                      <code className={className}>{children}</code>
                    </pre>
                  ) : (
                    <code className="bg-black/50 px-1.5 py-0.5 rounded text-sm">{children}</code>
                  );
                },
                h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-4">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-2">{children}</h3>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                a: ({ href, children }) => (
                  <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
