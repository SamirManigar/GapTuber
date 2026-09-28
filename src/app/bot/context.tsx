"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { BotChat, BotMessage } from "@/db/schema";

interface ChatContextType {
    chats: BotChat[];
    activeChatId: string | null;
    activeChat: BotChat | null;
    messages: BotMessage[];
    isLoadingChats: boolean;
    isGenerating: boolean;
    channelId: string | null;
    setActiveChatId: (id: string | null) => void;
    createNewChat: (title?: string) => Promise<void>;
    createChatAndSend: (title: string, prompt: string) => Promise<void>;
    deleteChat: (id: string) => Promise<void>;
    sendMessage: (content: string) => Promise<void>;
    sendMessageWithFiles: (content: string, files: File[], taskType: string) => Promise<void>;
    stopGenerating: () => void;
    fetchChats: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children, channelId = null }: { children: ReactNode; channelId?: string | null }) {
    const [chats, setChats] = useState<BotChat[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<BotMessage[]>([]);
    const [isLoadingChats, setIsLoadingChats] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const skipFetchRef = useRef(false);

    // ── Fetch Chat History ──────────────────────────────────────────────────
    const fetchChats = async () => {
        try {
            const url = channelId ? `/api/chat?channelId=${channelId}` : "/api/chat";
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setChats(data);
                if (data.length > 0 && !activeChatId) setActiveChatId(data[0].id);
            }
        } catch (e) {
            console.error("Failed to fetch chats:", e);
        } finally {
            setIsLoadingChats(false);
        }
    };

    useEffect(() => { 
        setActiveChatId(null);
        setChats([]);
        setMessages([]);
        setIsLoadingChats(true);
        fetchChats(); 
    }, [channelId]);

    // ── Fetch Messages on Active Chat Change ────────────────────────────────
    useEffect(() => {
        if (!activeChatId) { setMessages([]); return; }
        
        let isStale = false;
        fetch(`/api/chat/${activeChatId}/messages`)
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                if (!isStale) {
                    setMessages(prev => {
                        // If we are actively generating and have optimistic local messages, don't wipe them out
                        // with an empty or smaller array from the DB, as the DB might be lagging behind the stream.
                        if (prev.length > 0 && prev[0].chatId === activeChatId && data.length < prev.length) {
                            return prev;
                        }
                        return data;
                    });
                }
            })
            .catch(console.error);
            
        return () => { isStale = true; };
    }, [activeChatId]);

    // ── Create New Chat ─────────────────────────────────────────────────────
    const createNewChat = async (title?: string) => {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, channelId }),
        });
        if (res.ok) {
            const newChat = await res.json();
            skipFetchRef.current = true;
            setChats(prev => [newChat, ...prev]);
            setActiveChatId(newChat.id);
            setMessages([]);
        }
    };

    // ── Delete Chat ─────────────────────────────────────────────────────────
    const deleteChat = async (id: string) => {
        const res = await fetch("/api/chat", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
        if (res.ok) {
            setChats(prev => prev.filter(c => c.id !== id));
            if (activeChatId === id) { setActiveChatId(null); setMessages([]); }
        }
    };

    // ── Stop Generating ─────────────────────────────────────────────────────
    const stopGenerating = () => {
        abortControllerRef.current?.abort();
        setIsGenerating(false);
    };

    // ── Core Stream Sender (via /api/aurabot with FormData) ─────────────────
    const streamAurabot = async (chatId: string, content: string, files: File[], taskType: string): Promise<void> => {
        // Smart history: truncate long AI responses and limit total context size
        const MAX_HISTORY_CHARS = 6000;
        const buildHistory = (msgs: typeof messages) => {
            const trimmed = msgs.map(m => ({
                sender: m.sender,
                // Truncate very long messages (like scripts) to avoid token overflow
                content: m.content.length > 2000 ? m.content.slice(0, 2000) + "\n...[truncated]" : m.content,
            }));
            // Walk backwards, grab as many messages as fit under the limit
            const selected: typeof trimmed = [];
            let totalChars = 0;
            for (let i = trimmed.length - 1; i >= 0; i--) {
                totalChars += trimmed[i].content.length;
                if (totalChars > MAX_HISTORY_CHARS) break;
                selected.unshift(trimmed[i]);
            }
            return selected;
        };
        const historySnap = buildHistory(messages.slice(-10));


        const aiMsgId = "ai-" + Date.now();
        setMessages(prev => [...prev, {
            id: aiMsgId, chatId, sender: "ai", content: "", createdAt: new Date()
        }]);
        setIsGenerating(true);

        const ac = new AbortController();
        abortControllerRef.current = ac;

        try {
            const formData = new FormData();
            formData.append("input", content);
            formData.append("taskType", taskType);
            formData.append("chatId", chatId);
            if (channelId) formData.append("channelId", channelId);
            formData.append("history", JSON.stringify(historySnap.map(m => ({ sender: m.sender, content: m.content }))));
            files.forEach(f => formData.append("files", f));

            const res = await fetch("/api/aurabot", { method: "POST", body: formData, signal: ac.signal });
            if (!res.ok) {
                if (res.status === 402) {
                    throw new Error("Insufficient AI Credits. Please upgrade your plan.");
                }
                throw new Error(`AuraBot error: ${res.status}`);
            }
            if (!res.body) return;

            // Deduct 1 credit locally for UI update
            window.dispatchEvent(new CustomEvent("credit-update", { detail: { deduct: 1 } }));

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                setMessages(prev => prev.map(m =>
                    m.id === aiMsgId ? { ...m, content: m.content + chunk } : m
                ));
            }
        } catch (e: any) {
            if (e.name !== "AbortError") {
                setMessages(prev => prev.map(m =>
                    m.id === aiMsgId ? { ...m, content: `Error: ${e.message || "AuraBot disconnected. Please try again."}` } : m
                ));
            }
        } finally {
            setIsGenerating(false);
            await fetchChats();
        }
    };

    // ── Send Plain Text Message ─────────────────────────────────────────────
    const sendMessage = async (content: string): Promise<void> => {
        if (!content.trim() || isGenerating) return;

        let chatId = activeChatId;
        if (!chatId) {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: content.slice(0, 40) + "...", channelId }),
            });
            if (!res.ok) return;
            const newChat = await res.json();
            skipFetchRef.current = true;
            setChats(prev => [newChat, ...prev]);
            setActiveChatId(newChat.id);
            setMessages([]);
            chatId = newChat.id;
        }

        const userMsg: BotMessage = { id: "temp-" + Date.now(), chatId: chatId!, sender: "user", content, createdAt: new Date() };
        setMessages(prev => [...prev, userMsg]);
        await streamAurabot(chatId!, content, [], "auto");
    };

    // ── Send Message With Files ─────────────────────────────────────────────
    const sendMessageWithFiles = async (content: string, files: File[], taskType: string): Promise<void> => {
        if (isGenerating) return;
        if (!content.trim() && files.length === 0) return;

        let chatId = activeChatId;
        if (!chatId) {
            const title = (content || (files[0]?.name ?? "New Chat")).slice(0, 40) + "...";
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, channelId }),
            });
            if (!res.ok) return;
            const newChat = await res.json();
            skipFetchRef.current = true;
            setChats(prev => [newChat, ...prev]);
            setActiveChatId(newChat.id);
            setMessages([]);
            chatId = newChat.id;
        }

        const displayText = content + (files.length > 0 ? ` [ATTACHMENTS:${files.map(f => f.name).join("|||")}]` : "");
        const userMsg: BotMessage = { id: "temp-" + Date.now(), chatId: chatId!, sender: "user", content: displayText, createdAt: new Date() };
        setMessages(prev => [...prev, userMsg]);
        await streamAurabot(chatId!, content, files, taskType);
    };

    // ── Create Chat and Immediately Send ────────────────────────────────────
    const createChatAndSend = async (title: string, prompt: string): Promise<void> => {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, channelId }),
        });
        if (!res.ok) return;
        const newChat = await res.json();
        skipFetchRef.current = true;
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        setMessages([]);

        const userMsg: BotMessage = { id: "temp-" + Date.now(), chatId: newChat.id, sender: "user", content: prompt, createdAt: new Date() };
        setMessages([userMsg]);
        await streamAurabot(newChat.id, prompt, [], "auto");
    };

    return (
        <ChatContext.Provider value={{
            chats, activeChatId, activeChat: chats.find(c => c.id === activeChatId) || null, messages, isLoadingChats, isGenerating, channelId: channelId ?? null,
            setActiveChatId, createNewChat, createChatAndSend, deleteChat,
            sendMessage, sendMessageWithFiles, stopGenerating, fetchChats,
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error("useChat must be used within ChatProvider");
    return ctx;
}
