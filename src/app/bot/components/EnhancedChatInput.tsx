"use client";

import { FC, useState, useRef, useEffect } from "react";
import { Brain, Mic, Send, Square, Paperclip, X, FileText, AlertCircle, Loader2, Zap } from "lucide-react";
import { useChat } from "@/app/bot/context";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
const ALLOWED = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv", "application/json",
    "image/jpeg", "image/png", "image/gif", "image/webp",
];

const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

// ─── Enhanced Chat Input ──────────────────────────────────────────────────────
export function EnhancedChatInput() {
    const { sendMessageWithFiles, isGenerating, stopGenerating } = useChat();
    const [input, setInput] = useState("");
    const [attachments, setAttachments] = useState<File[]>([]);
    const [error, setError] = useState("");
    const [isListening, setIsListening] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
        }
    }, [input]);

    // Clear error after 5s
    useEffect(() => {
        if (error) {
            const t = setTimeout(() => setError(""), 5000);
            return () => clearTimeout(t);
        }
    }, [error]);

    const validateFile = (file: File): string | null => {
        if (file.size > MAX_FILE_SIZE) return `"${file.name}" exceeds 25MB limit`;
        const isAllowed = ALLOWED.includes(file.type) || file.type.startsWith("image/") || file.type.startsWith("text/");
        if (!isAllowed) return `File type "${file.type}" is not supported`;
        const currentTotal = attachments.reduce((s, f) => s + f.size, 0);
        if (currentTotal + file.size > MAX_TOTAL_SIZE) return "Total file size would exceed 50MB";
        return null;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = Array.from(e.target.files);
        for (const file of newFiles) {
            const err = validateFile(file);
            if (err) { setError(err); if (fileInputRef.current) fileInputRef.current.value = ""; return; }
        }
        setAttachments(prev => [...prev, ...newFiles]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeAttachment = (idx: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== idx));
    };

    const handleMic = () => {
        if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
            setError("Speech recognition not supported in this browser");
            return;
        }

        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const r = new SR();
        r.continuous = true;
        r.interimResults = true;
        r.lang = "en-US";
        r.onstart = () => setIsListening(true);
        r.onresult = (event: any) => {
            const transcript = Array.from(event.results).map((res: any) => res[0].transcript).join("");
            setInput(transcript);
        };
        r.onerror = (event: any) => { setError(`Mic error: ${event.error}`); setIsListening(false); };
        r.onend = () => setIsListening(false);
        recognitionRef.current = r;
        r.start();
    };

    useEffect(() => () => recognitionRef.current?.stop(), []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isGenerating || (!input.trim() && attachments.length === 0)) return;
        const currentInput = input;
        const currentFiles = [...attachments];
        setInput("");
        setAttachments([]);
        await sendMessageWithFiles(currentInput, currentFiles, "auto");
    };

    const totalSize = attachments.reduce((s, f) => s + f.size, 0);
    const sizePct = (totalSize / MAX_TOTAL_SIZE) * 100;

    return (
        <div className="p-4 border-t border-white/[0.06] bg-black/10">
            {/* Error Banner */}
            {error && (
                <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError("")} className="p-0.5 hover:bg-red-500/20 rounded"><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <div className="mb-3 p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                    <div className="flex flex-wrap gap-2 mb-2">
                        {attachments.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg pl-2.5 pr-1 py-1.5">
                                <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                <div className="min-w-0">
                                    <div className="text-xs truncate max-w-[160px] text-slate-200">{file.name}</div>
                                    <div className="text-[10px] text-slate-500">{formatSize(file.size)}</div>
                                </div>
                                <button onClick={() => removeAttachment(i)} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-500 hover:text-white ml-1">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${sizePct > 80 ? "bg-red-500" : sizePct > 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${sizePct}%` }}
                            />
                        </div>
                        <span className={sizePct > 80 ? "text-red-400" : ""}>{formatSize(totalSize)} / {formatSize(MAX_TOTAL_SIZE)}</span>
                    </div>
                </div>
            )}

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.pptx,.xlsx"
            />

            {/* Input Row */}
            <form onSubmit={handleSubmit}>
                <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3 py-2.5 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all">
                    {/* Left controls */}
                    <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
                        {/* File Attach */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={attachments.length >= 5}
                            title="Attach files (PDF, DOCX, PPTX, XLSX, Images)"
                            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
                        >
                            <Paperclip className="w-4.5 h-4.5" />
                        </button>
                    </div>

                    {/* Textarea */}
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e as any);
                            }
                        }}
                        placeholder={isListening ? "Listening..." : "Message GapTuber Engine... (attach files to analyze)"}
                        className="flex-1 bg-transparent text-white text-sm resize-none outline-none py-2 min-h-[24px] max-h-[150px] overflow-y-auto placeholder-slate-500"
                        rows={1}
                        disabled={isGenerating}
                    />

                    {/* Right controls */}
                    <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
                        {/* Mic */}
                        <button
                            type="button"
                            onClick={handleMic}
                            className={`p-2 rounded-lg transition-all ${isListening ? "text-red-400 bg-red-400/10 animate-pulse" : "text-slate-500 hover:text-white hover:bg-white/5"}`}
                            title={isListening ? "Stop listening" : "Voice input"}
                        >
                            <Mic className="w-4.5 h-4.5" />
                        </button>

                        {/* Send / Stop */}
                        {isGenerating ? (
                            <button
                                type="button"
                                onClick={stopGenerating}
                                className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
                                title="Stop generating"
                            >
                                <Square className="w-4.5 h-4.5" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={!input.trim() && attachments.length === 0}
                                className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                                title="Send"
                            >
                                <Send className="w-4 h-4" />
                                <span className="flex items-center gap-0.5 text-[10px] font-mono font-bold bg-black/20 px-1.5 py-0.5 rounded text-emerald-100">
                                    <Zap className="w-3 h-3 fill-amber-400 text-amber-400" /> -1
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="text-center mt-2 text-[10px] text-slate-600">
                    Supports PDF, DOCX, PPTX, XLSX, images · Shift+Enter for new line · GapTuber Engine can make mistakes
                </div>
            </form>
        </div>
    );
}
