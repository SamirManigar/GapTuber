import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BotMessage } from "@/db/schema";
import { Bot, User } from "lucide-react";

export function ChatBubble({ message }: { message: BotMessage }) {
    const isAi = message.sender === "ai";

    return (
        <div className={`flex gap-4 p-6 ${isAi ? "bg-[#1a1b1e] border-y border-white/5" : "bg-transparent"} w-full`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-1 ${
                isAi ? "bg-emerald-600/20 text-emerald-400" : "bg-white/10 text-white"
            }`}>
                {isAi ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>

            {/* Message Content */}
            <div className="flex-1 min-w-0 max-w-4xl max-w-[85ch] mx-auto overflow-hidden">
                <div className="prose prose-invert prose-emerald max-w-none text-slate-300">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mb-4 mt-6" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-xl font-bold text-white mb-3 mt-5" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg font-bold text-white mb-2 mt-4" {...props} />,
                            p: ({node, ...props}) => <p className="mb-4 leading-relaxed whitespace-pre-wrap" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-inside mb-4 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-4 space-y-1" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-bold text-emerald-300" {...props} />,
                            code: ({className, children, ...props}) => {
                                const match = /language-(\w+)/.exec(className || '');
                                const isInline = !match && !className;
                                return isInline ? (
                                    <code className="bg-white/10 text-emerald-300 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                        {children}
                                    </code>
                                ) : (
                                    <div className="bg-[#0d0e12] rounded-xl overflow-hidden mb-4 border border-white/10">
                                        <div className="bg-black/40 px-4 py-2 text-xs text-slate-400 flex justify-between items-center border-b border-white/5">
                                            <span>{match ? match[1] : 'code'}</span>
                                        </div>
                                        <div className="p-4 overflow-x-auto text-sm font-mono text-slate-300">
                                            {children}
                                        </div>
                                    </div>
                                );
                            }
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}
