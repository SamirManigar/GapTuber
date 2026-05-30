"use client";

import { ChatProvider, useChat } from "@/app/bot/context";
import { EnhancedChatInput } from "@/app/bot/components/EnhancedChatInput";
import { EnhancedChatBubble } from "@/app/bot/components/EnhancedChatBubble";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import { Bot, Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight, ArrowDown } from "lucide-react";
import type { BotMessage, BotChat } from "@/db/schema";

// ── Chat History Sidebar ─────────────────────────────────────────────────────
function ChatHistorySidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
    const { chats, activeChatId, setActiveChatId, createNewChat, deleteChat, isLoadingChats } = useChat();

    return (
        <div className={`relative flex flex-col border-r border-[#1e1e22] bg-[#0c0c0e] transition-all duration-300 ${collapsed ? "w-0 overflow-hidden border-r-0" : "w-64 shrink-0"}`}>
            <div className="p-4 border-b border-[#1e1e22]">
                <button
                    onClick={() => createNewChat()}
                    className="w-full flex items-center justify-center gap-2 bg-[#111113] border border-[#1e1e22] hover:bg-[#1e1e22] text-white py-2.5 rounded font-mono text-xs uppercase tracking-widest transition-colors"
                >
                    <Plus className="w-4 h-4" /> New_Thread
                </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
                {isLoadingChats ? (
                    <div className="flex flex-col gap-2 p-3">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-9 rounded bg-[#1e1e22] animate-pulse" />)}
                    </div>
                ) : chats.length === 0 ? (
                    <div className="text-center px-4 py-8">
                        <MessageSquare className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">No history</p>
                    </div>
                ) : (
                    <div className="px-2 space-y-0.5">
                        {chats.map((chat: BotChat) => (
                            <div
                                key={chat.id}
                                onClick={() => setActiveChatId(chat.id)}
                                className={`group flex items-center justify-between px-3 py-2.5 rounded cursor-pointer transition-all ${activeChatId === chat.id ? "bg-[#111113] text-white border border-[#1e1e22]" : "text-zinc-500 hover:bg-[#111113] hover:text-zinc-300 border border-transparent"}`}
                            >
                                <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${activeChatId === chat.id ? "text-emerald-400" : "text-zinc-600"}`} />
                                    <span className="text-xs truncate">{chat.title}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                                    className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-1 bg-[#1e1e22] p-1 rounded"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-6 h-6 bg-[#111113] border border-[#1e1e22] rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all hover:bg-[#1e1e22]"
            >
                <ChevronLeft className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// ── Welcome Screen ───────────────────────────────────────────────────────────
function WelcomeScreen() {
    const { sendMessage } = useChat();
    const suggestions = [
        { icon: "✍️", text: "Write a YouTube script for my next video" },
        { icon: "🎣", text: "Generate 5 viral video hooks for my niche" },
        { icon: "🔍", text: "Optimize my video title for YouTube SEO" },
        { icon: "📊", text: "Analyze this PDF and summarize key points" },
        { icon: "📅", text: "Create a 30-day content calendar" },
        { icon: "💻", text: "Write a Python script to download YouTube data" },
    ];

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto w-full">
            <div className="w-16 h-16 bg-[#111113] border border-[#1e1e22] rounded-xl flex items-center justify-center mb-5">
                <Bot className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">GapTuber AI Studio</h2>
            <p className="text-zinc-500 text-sm text-center mb-8 max-w-sm">Channel-aware scriptwriter and growth strategist. Upload PDFs, images, DOCX, PPTX, and more.</p>
            <div className="grid grid-cols-2 gap-2.5 w-full">
                {suggestions.map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s.text)} className="flex items-center gap-3 p-3.5 bg-[#0c0c0e] border border-[#1e1e22] rounded text-left hover:bg-[#111113] hover:border-[#2a2a30] transition-colors">
                        <span className="text-lg grayscale opacity-80">{s.icon}</span>
                        <span className="text-xs text-zinc-400 leading-snug">{s.text}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Chat Messages Area ───────────────────────────────────────────────────────
function ChatArea() {
    const { messages, activeChatId, isGenerating, sendMessage } = useChat();
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;
        const atBottom = distanceToBottom < 100;
        setIsAtBottom(atBottom);
        setShowScrollButton(!atBottom);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Auto-scroll when messages update, but only if user is at the bottom
    useEffect(() => {
        if (isAtBottom) {
            scrollToBottom();
        }
    }, [messages, isAtBottom]);

    // Force scroll when switching chats
    useEffect(() => {
        setTimeout(scrollToBottom, 50);
    }, [activeChatId]);

    if (!activeChatId && messages.length === 0) return <WelcomeScreen />;

    return (
        <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col bg-[#0c0c0e]">
            {/* Custom Scrollbar Styles */}
            <style jsx global>{`
                .chat-scroll-area::-webkit-scrollbar {
                    width: 6px;
                }
                .chat-scroll-area::-webkit-scrollbar-track {
                    background: transparent;
                }
                .chat-scroll-area::-webkit-scrollbar-thumb {
                    background: #1e1e22;
                }
                .chat-scroll-area:hover::-webkit-scrollbar-thumb {
                    background: #2a2a30;
                }
                .chat-scroll-area {
                    scrollbar-gutter: stable;
                }
            `}</style>

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto chat-scroll-area scroll-smooth pt-4 pb-20 px-4 md:px-8"
            >
                <div className="max-w-4xl mx-auto w-full">
                    {messages.map((msg: BotMessage, index: number) => {
                        const isLastAI = index === messages.length - 1 && msg.sender === "ai" && !isGenerating;
                        const isScript = msg.content.includes("| Scene / Section |");

                        // Skip rendering empty AI messages to avoid double avatars with the "generating..." skeleton
                        if (msg.sender === "ai" && msg.content.trim() === "") {
                            return null;
                        }

                        return (
                            <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <EnhancedChatBubble message={msg} />
                                {isLastAI && isScript && (
                                    <div className="flex flex-wrap gap-2 px-14 py-3 mt-1 mb-4">
                                        <div className="w-full text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1">Modify_Script:</div>
                                        {[
                                            "Make the video longer (detailed)",
                                            "Make the video shorter (concise)",
                                            "Make the hook more aggressive",
                                            "Condense the timestamps",
                                            "Change the tone to be more humorous",
                                        ].map(suggestion => (
                                            <button
                                                key={suggestion}
                                                onClick={() => sendMessage(suggestion)}
                                                className="px-3 py-1.5 rounded bg-[#111113] border border-[#1e1e22] hover:border-emerald-600/50 hover:bg-emerald-600/10 text-xs text-zinc-400 hover:text-emerald-300 transition-colors"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {isGenerating && messages.length > 0 && messages[messages.length - 1]?.content === "" && (
                        <div className="flex items-center gap-3 px-5 py-4">
                            <div className="w-8 h-8 rounded bg-[#111113] border border-[#1e1e22] flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="flex gap-1.5 text-xs font-mono text-zinc-500 uppercase tracking-widest bg-[#111113] border border-[#1e1e22] px-3 py-1.5 rounded">
                                generating...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-1" />
                </div>
            </div>

            {/* Jump to bottom button */}
            {showScrollButton && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-[#111113] hover:bg-[#1e1e22] text-zinc-300 border border-[#2a2a30] px-4 py-2 rounded text-[10px] font-mono font-bold uppercase tracking-widest transition-colors flex items-center gap-2 group"
                >
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>Scroll to bottom</span>
                </button>
            )}
        </div>
    );
}

// ── Bot Page Header ──────────────────────────────────────────────────────────
function BotHeader({ title, collapsed, setCollapsed }: { title?: string; collapsed: boolean; setCollapsed: (v: boolean) => void }) {
    return (
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1e1e22] bg-[#0c0c0e] shrink-0">
            {collapsed && (
                <button onClick={() => setCollapsed(false)} className="w-7 h-7 rounded bg-[#111113] border border-[#1e1e22] flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                    <ChevronRight className="w-4 h-4" />
                </button>
            )}
            <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-[#111113] border border-[#1e1e22] rounded flex items-center justify-center">
                    <Bot className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-zinc-200 leading-none line-clamp-1">{title || "[ NEW_SESSION ]"}</p>
                    <p className="text-[10px] font-mono text-zinc-600 uppercase mt-1 tracking-widest">GapTuber Engine · Vision Enabled</p>
                </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 bg-[#111113] border border-[#1e1e22] px-2 py-1 rounded">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-widest">Online</span>
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
function BotPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { createChatAndSend, sendMessage, chats, activeChatId, isLoadingChats } = useChat();
    const hasSentRef = useRef(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        if (hasSentRef.current || isLoadingChats) return;
        const title = searchParams?.get("title");
        const prompt = searchParams?.get("prompt");
        const channelId = searchParams?.get("channelId");

        if (title && prompt) {
            hasSentRef.current = true;
            createChatAndSend(title, prompt);

            // Clean URL to prevent re-trigger on reload
            const newParams = new URLSearchParams();
            if (channelId) newParams.set("channelId", channelId);
            router.replace(`/dashboard/bot?${newParams.toString()}`);
        }
        else if (prompt) {
            hasSentRef.current = true;
            sendMessage(prompt);

            // Clean URL
            const newParams = new URLSearchParams();
            if (channelId) newParams.set("channelId", channelId);
            router.replace(`/dashboard/bot?${newParams.toString()}`);
        }
    }, [searchParams, createChatAndSend, sendMessage, isLoadingChats, router]);

    const activeChat = chats.find(c => c.id === activeChatId);

    return (
        <div className="flex h-screen md:h-[calc(100vh-0px)] bg-[#0c0c0e] overflow-hidden">
            <ChatHistorySidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <BotHeader title={activeChat?.title} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
                <ChatArea />
                <div className="bg-[#0c0c0e]">
                    <EnhancedChatInput />
                </div>
            </div>
        </div>
    );
}

function BotPageContent() {
    const searchParams = useSearchParams();
    const channelId = searchParams?.get("channelId");

    return (
        <ChatProvider channelId={channelId}>
            <div className="h-full flex flex-col overflow-hidden">
                <BotPageInner />
            </div>
        </ChatProvider>
    );
}

export default function BotPage() {
    return (
        <Suspense fallback={<div className="h-full bg-[#0c0c0e] flex items-center justify-center text-zinc-500">Loading AI Studio...</div>}>
            <BotPageContent />
        </Suspense>
    );
}
