import { motion, AnimatePresence } from "framer-motion";
import { X, PlayCircle, Loader2, Save, Copy, CheckCheck } from "lucide-react";
import { useState, useEffect } from "react";

interface VideoIdea {
    id: string;
    title: string;
    hook: string;
    format: string;
    duration: string;
}

export default function ScriptModal({ idea, onClose }: { idea: VideoIdea, onClose: () => void }) {
    const [copied, setCopied] = useState(false);
    const [messages, setMessages] = useState<{role: string; content: string}[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const prompt = `Write a detailed YouTube script for a ${idea.format} video titled "${idea.title}". The hook must be: "${idea.hook}". Target duration: ${idea.duration}. Include sections for Intro, Main Content, and Outro/Call to action.`;
        generateScript(prompt);
    }, [idea]); // eslint-disable-line react-hooks/exhaustive-deps

    const generateScript = async (prompt: string) => {
        setIsLoading(true);
        setMessages([{ role: "assistant", content: "" }]);
        
        try {
            const res = await fetch("/api/generate-script", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
            });
            
            if (!res.body) throw new Error("No response body");
            
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    return [{ role: "assistant", content: last.content + chunk }];
                });
            }
            window.dispatchEvent(new CustomEvent("credit-update", { detail: { deduct: 2 } }));
        } catch (error) {
            console.error("Failed to generate script:", error);
            setMessages([{ role: "assistant", content: "Error generating script. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        const scriptText = messages.map(m => m.content).join("\n");
        navigator.clipboard.writeText(scriptText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-4xl max-h-[90vh] bg-[#1a1b1e] border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-[#1a1b1e] z-10">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <span className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg">
                                    <PlayCircle className="w-5 h-5" />
                                </span>
                                AI Script Generator
                            </h3>
                            <p className="text-sm text-gray-400 mt-1">Generating for: <span className="text-gray-200">{idea.title}</span></p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-4 text-emerald-500" />
                                <p>Initializing GapTuber AI Engine...</p>
                            </div>
                        )}
                        
                        {messages.map((message: any, index: number) => (
                            message.role === " assistant" || message.role === "assistant" ? (
                                <div key={message.id || `msg-${index}`} className="prose prose-invert max-w-none text-gray-300">
                                    <div className="whitespace-pre-wrap">{message.content}</div>
                                </div>
                            ) : null
                        ))}

                        {isLoading && messages.length > 0 && (
                            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mt-4">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>GapTuber AI is writing...</span>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-800 bg-[#131415] flex items-center justify-between">
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                           GapTuber AI Engine connected
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={handleCopy}
                                disabled={isLoading || messages.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                {copied ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                {copied ? "Copied!" : "Copy Script"}
                            </button>
                            <button 
                                onClick={onClose}
                                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors shadow-lg shadow-emerald-500/20"
                            >
                                <Save className="w-4 h-4" />
                                Done
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
