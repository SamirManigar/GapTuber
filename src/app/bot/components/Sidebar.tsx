"use client";

import { useChat } from "@/app/bot/context";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { BotChat } from "@/db/schema";

export function BotSidebar() {
    const { chats, activeChatId, setActiveChatId, createNewChat, deleteChat, isLoadingChats } = useChat();

    return (
        <div className="w-64 border-r border-white/5 bg-black/20 flex flex-col h-full">
            <div className="p-4 border-b border-white/5">
                <button 
                    onClick={() => createNewChat()}
                    className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Chat
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {isLoadingChats ? (
                    <div className="text-center p-4 text-sm text-slate-500">Loading chats...</div>
                ) : chats.length === 0 ? (
                    <div className="text-center p-4 text-sm text-slate-500">No chats yet.</div>
                ) : (
                    chats.map((chat: BotChat) => (
                        <div 
                            key={chat.id}
                            onClick={() => setActiveChatId(chat.id)}
                            className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                                activeChatId === chat.id 
                                    ? "bg-emerald-500/20 text-emerald-300" 
                                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                            }`}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <MessageSquare className="w-4 h-4 shrink-0" />
                                <span className="text-sm truncate">{chat.title}</span>
                            </div>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteChat(chat.id);
                                }}
                                className={`text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ${
                                    activeChatId === chat.id ? "opacity-100 text-emerald-400/50 hover:text-red-400" : ""
                                }`}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
