"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { UploadedFile } from "@/lib/types";

interface ChatInputProps {
  onSend: (message: string) => void;
  onFileUpload: (files: UploadedFile[]) => void;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
}

export default function ChatInput({ 
  onSend, 
  onFileUpload, 
  uploadedFiles, 
  onRemoveFile,
  disabled 
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      const content = await file.text();
      newFiles.push({
        name: file.name,
        content,
        type: file.type,
      });
    }

    onFileUpload(newFiles);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="border-t border-border bg-background p-4">
      {/* Uploaded files chips */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {uploadedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-card border border-border-hover rounded-full px-3 py-1 text-sm text-muted"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="max-w-[150px] truncate">{file.name}</span>
              <button
                onClick={() => onRemoveFile(index)}
                className="text-muted-fg hover:text-muted ml-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-3">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.txt,.csv,.json"
          multiple
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-muted hover:text-accent hover:bg-card rounded-lg transition-colors"
          title="Upload files"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your spaces..."
          disabled={disabled}
          rows={1}
          className="flex-1 bg-card border border-border-hover rounded-xl px-4 py-3 text-foreground placeholder-muted-fg resize-none focus:outline-none focus:border-accent/50 disabled:opacity-50"
          style={{ minHeight: "48px", maxHeight: "200px" }}
        />

        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="p-3 bg-accent hover:bg-accent-hover disabled:bg-surface disabled:cursor-not-allowed text-background rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
