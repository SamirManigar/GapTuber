"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { useChat } from "@/app/bot/context";

export function ChatInput() {
    const [input, setInput] = useState("");
    const { sendMessage, isGenerating } = useChat();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isGenerating) return;

        const currentInput = input;
        setInput(""); // Optimistic clear
        await sendMessage(currentInput);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as unknown as React.FormEvent);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-black/20">
            <div className="relative max-w-4xl mx-auto flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl p-2 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask GapTuber AI for a video idea, script, or hook..."
                    className="flex-1 max-h-48 min-h-[44px] bg-transparent text-white placeholder-slate-500 resize-none outline-none py-3 px-3 text-sm"
                    rows={1}
                />
                <button
                    type="submit"
                    disabled={!input.trim() || isGenerating}
                    className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors shrink-0 flex items-center justify-center h-[44px] w-[44px]"
                >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
            </div>
            <div className="text-center mt-3 text-xs text-slate-500 font-medium">
                AuraBot can make mistakes. Consider verifying important information.
            </div>
        </form>
    );
}
