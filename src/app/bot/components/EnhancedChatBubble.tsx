"use client";

import { FC, useState, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Bot, User, Copy, Check, ThumbsUp, ThumbsDown, RefreshCw, FileText, Sparkles, Library } from "lucide-react";
import type { BotMessage } from "@/db/schema";
import { useChat } from "@/app/bot/context";

// ─── Code Block with Copy ────────────────────────────────────────────────────
const CodeBlock = memo(({ language, code }: { language: string; code: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [code]);

    return (
        <div className="relative my-3 rounded-xl overflow-hidden border border-white/10">
            <div className="flex items-center justify-between bg-[#0d1117] px-4 py-2">
                <span className="text-xs font-mono text-slate-400 uppercase">{language}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors"
                >
                    {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
            </div>
            <SyntaxHighlighter
                style={oneDark}
                language={language}
                PreTag="div"
                className="!m-0 !text-sm"
                showLineNumbers={code.split("\n").length > 5}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    );
});
CodeBlock.displayName = "CodeBlock";

// ─── Markdown Renderer ───────────────────────────────────────────────────────
const MarkdownContent = memo(({ content }: { content: string }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
            code({ className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || "");
                const inline = !match && !className;
                const code = String(children).replace(/\n$/, "");

                if (!inline && code.length > 0) {
                    return <CodeBlock language={match ? match[1] : "text"} code={code} />;
                }
                return (
                    <code className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded px-1.5 py-0.5 text-sm font-mono" {...props}>
                        {children}
                    </code>
                );
            },
            table: ({ children, ...props }: any) => (
                <div className="my-5 overflow-hidden rounded-xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-emerald-500/10" {...props}>{children}</table>
                    </div>
                </div>
            ),
            thead: ({ children, ...props }: any) => <thead className="bg-emerald-500/10 border-b border-emerald-500/20" {...props}>{children}</thead>,
            tbody: ({ children, ...props }: any) => <tbody className="divide-y divide-emerald-500/5 bg-black/20" {...props}>{children}</tbody>,
            th: ({ children, ...props }: any) => <th className="px-5 py-3.5 text-left text-[11px] font-bold text-emerald-300 uppercase tracking-widest whitespace-nowrap" {...props}>{children}</th>,
            td: ({ children, ...props }: any) => <td className="px-5 py-4 text-sm text-slate-300 align-top leading-relaxed" {...props}>{children}</td>,
            ul: ({ children, ...props }: any) => <ul className="my-3 ml-5 space-y-1 list-disc marker:text-emerald-400" {...props}>{children}</ul>,
            ol: ({ children, ...props }: any) => <ol className="my-3 ml-5 space-y-1 list-decimal marker:text-emerald-400" {...props}>{children}</ol>,
            li: ({ children, ...props }: any) => <li className="text-slate-300 leading-relaxed" {...props}>{children}</li>,
            h1: ({ children, ...props }: any) => <h1 className="text-2xl font-bold text-white mt-6 mb-3 pb-2 border-b border-white/10" {...props}>{children}</h1>,
            h2: ({ children, ...props }: any) => <h2 className="text-xl font-bold text-white mt-5 mb-2" {...props}>{children}</h2>,
            h3: ({ children, ...props }: any) => <h3 className="text-lg font-semibold text-slate-100 mt-4 mb-2" {...props}>{children}</h3>,
            p: ({ children, ...props }: any) => <p className="text-slate-300 leading-relaxed my-2" {...props}>{children}</p>,
            blockquote: ({ children, ...props }: any) => (
                <blockquote className="border-l-4 border-emerald-500 pl-4 py-1 my-3 italic text-slate-400 bg-emerald-500/5 rounded-r-lg" {...props}>
                    {children}
                </blockquote>
            ),
            a: ({ children, href, ...props }: any) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline decoration-emerald-400/30" {...props}>
                    {children}
                </a>
            ),
            strong: ({ children, ...props }: any) => <strong className="font-bold text-white" {...props}>{children}</strong>,
            hr: ({ ...props }: any) => <hr className="my-4 border-white/10" {...props} />,
        }}
    >
        {content}
    </ReactMarkdown>
));
MarkdownContent.displayName = "MarkdownContent";

// ─── Chat Bubble ─────────────────────────────────────────────────────────────
interface ChatBubbleProps {
    message: BotMessage;
    onRegenerate?: () => void;
}

export function EnhancedChatBubble({ message, onRegenerate }: ChatBubbleProps) {
    const isAI = message.sender === "ai";
    const [copied, setCopied] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
    const { channelId, activeChat } = useChat();

    // Extract attachment markers
    let displayText = message.content;
    let attachedFiles: string[] = [];
    const attachmentMatch = displayText.match(/\[ATTACHMENTS:(.*?)\]/);
    if (attachmentMatch?.[1]) {
        displayText = displayText.replace(/\[ATTACHMENTS:.*?\]/, "").trim();
        attachedFiles = attachmentMatch[1].split("|||").filter(Boolean);
    }

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(displayText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [displayText]);

    const handleSaveToVault = async () => {
        if (!channelId || saveStatus !== "idle") return;
        setSaveStatus("saving");
        try {
            const res = await fetch(`/api/channels/${channelId}/ideas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script: displayText,
                    attachToIdeaTitle: activeChat?.title,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                if (data.error === "idea not save in vault") {
                    setErrorMessage("Idea not saved in vault");
                    setSaveStatus("error");
                    setTimeout(() => { setSaveStatus("idle"); setErrorMessage(""); }, 3000);
                    return;
                }
                throw new Error("Failed");
            }
            setSaveStatus("saved");
        } catch (e) {
            console.error(e);
            setSaveStatus("error");
            setTimeout(() => setSaveStatus("idle"), 3000);
        }
    };

    return (
        <div className={`flex gap-3 px-5 py-4 ${isAI ? "bg-[#13141a] border-y border-white/[0.04]" : ""}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5 ${
                isAI ? "bg-gradient-to-br from-emerald-600/30 to-indigo-600/30 border border-emerald-500/20" : "bg-gradient-to-br from-slate-700 to-slate-600"
            }`}>
                {isAI ? <Bot className="w-4.5 h-4.5 text-emerald-400" /> : <User className="w-4 h-4 text-white" />}
            </div>

            {/* Message Body */}
            <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold mb-1.5 text-slate-500">{isAI ? "GapTuber AI" : "You"}</div>

                {/* Attached files display */}
                {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {attachedFiles.map((name, i) => (
                            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300">
                                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="truncate max-w-[200px]">{name}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Content */}
                {isAI ? (
                    <div className="prose prose-invert max-w-none">
                        <MarkdownContent content={displayText} />
                    </div>
                ) : (
                    (() => {
                        const scriptMatch = displayText.match(/Write a (?:full, highly-detailed|comprehensive, professionally-structured) YouTube script for a (.*?) video titled: "(.*?)"/);
                        if (scriptMatch) {
                            return (
                                <div className="bg-gradient-to-br from-emerald-500/10 to-indigo-500/5 border border-emerald-500/20 rounded-xl p-4 my-2">
                                    <div className="flex items-center gap-2 text-emerald-300 font-bold mb-2">
                                        <Sparkles className="w-4 h-4" />
                                        Script Generation Request
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-300 text-sm">
                                            <strong className="text-white font-medium mr-2">Title:</strong> 
                                            <span className="italic">{scriptMatch[2]}</span>
                                        </p>
                                        <p className="text-slate-300 text-sm">
                                            <strong className="text-white font-medium mr-2">Format:</strong> 
                                            <span className="capitalize">{scriptMatch[1]} Video</span>
                                        </p>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-4 uppercase tracking-widest font-semibold">
                                        System Prompt Attached
                                    </p>
                                </div>
                            );
                        }
                        
                        return <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{displayText}</p>;
                    })()
                )}

                {/* AI Actions */}
                {isAI && (
                    <div className="flex items-center gap-1 mt-2">
                        <button onClick={handleCopy} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors" title="Copy">
                            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                        {onRegenerate && (
                            <button onClick={onRegenerate} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors" title="Regenerate">
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        )}
                        <button onClick={handleSaveToVault} disabled={saveStatus !== "idle"} className={`p-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${saveStatus === "saved" ? "text-emerald-400 bg-emerald-400/10" : saveStatus === "error" ? "text-red-400 bg-red-400/10" : "text-slate-500 hover:text-white hover:bg-white/5"}`} title="Save Script to Vault">
                            {saveStatus === "saved" ? <Check className="w-4 h-4" /> : <Library className="w-4 h-4" />}
                            <span className="text-[10px] font-mono uppercase font-bold">
                                {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Script Saved" : saveStatus === "error" ? errorMessage || "Error" : "Save Script"}
                            </span>
                        </button>
                        <div className="flex-1" />
                        <button
                            onClick={() => setFeedback("up")}
                            className={`p-1.5 rounded-lg transition-colors ${feedback === "up" ? "text-emerald-400 bg-emerald-400/10" : "text-slate-500 hover:text-emerald-400 hover:bg-white/5"}`}
                        >
                            <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setFeedback("down")}
                            className={`p-1.5 rounded-lg transition-colors ${feedback === "down" ? "text-red-400 bg-red-400/10" : "text-slate-500 hover:text-red-400 hover:bg-white/5"}`}
                        >
                            <ThumbsDown className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
