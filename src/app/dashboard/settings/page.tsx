"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Youtube, RefreshCw, CheckCircle, AlertCircle, Eye, ThumbsUp, MessageSquare, BarChart2, Zap, X } from "lucide-react";

interface ChannelData {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    customUrl: string;
    subscribers: string;
    views: string;
    videoCount: string;
}

interface VideoData {
    id: string;
    title: string;
    thumbnail: string;
    publishedAt: string;
    views: string;
    likes: string;
    comments: string;
    type: "short" | "video";
}

function StatBadge({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
    return (
        <div className="flex items-center gap-3 bg-[#0c0c0e] border border-[#1e1e22] rounded-lg px-4 py-3">
            <div className="text-zinc-500 opacity-70">{icon}</div>
            <div>
                <div className="text-lg font-bold text-white tabular-nums tracking-tight">
                    {Number(value).toLocaleString()}
                </div>
                <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{label}</div>
            </div>
        </div>
    );
}

function YouTubeSettingsContent() {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const channelIdFromUrl = searchParams?.get("channelId");
    const [channel, setChannel] = useState<ChannelData | null>(null);
    const [videos, setVideos] = useState<VideoData[]>([]);
    const [videoTab, setVideoTab] = useState<"videos" | "shorts">("videos");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Handle cross-account link success message
    useEffect(() => {
        if (searchParams?.get("link_success")) {
            setSuccess("YouTube channel linked successfully!");
            // Clean up URL without reload
            if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.delete('link_success');
                window.history.replaceState({}, '', url.toString());
            }
        }
    }, [searchParams]);

    const displayedVideos = videos.filter(v => videoTab === "videos" ? v.type === "video" : v.type === "short");

    const fetchYouTubeData = useCallback(async () => {
        if (!channelIdFromUrl) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/youtube?channelId=${channelIdFromUrl}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error ?? "Failed to fetch YouTube data.");
                return;
            }
            setChannel(data.channel);
            setVideos(data.videos);
            // If the user already generated ideas, we'd ideally fetch them here.
            // But since this is a new feature, we'll let them click the button.
        } catch {
            setError("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchYouTubeData();
    }, [fetchYouTubeData]);

    const isNotConnected = error?.toLowerCase().includes("reconnect") || error?.toLowerCase().includes("no youtube");

    return (
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10 space-y-8 fade-up">
            {/* Header */}
            <div className="border-b border-[#1e1e22] pb-6">
                <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">System Settings</h1>
                </div>
                <p className="text-zinc-500 text-sm">
                    Manage service integrations and connected YouTube channel access controls.
                </p>
            </div>

            {/* Success State */}
            {success && (
                <div className="flex items-center gap-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl px-5 py-4 mb-6">
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                    <p className="text-sm font-medium text-emerald-400">{success}</p>
                    <button 
                        onClick={() => setSuccess(null)}
                        className="ml-auto text-emerald-900 hover:text-emerald-400 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="flex items-start gap-4 bg-amber-950/20 border border-amber-900/30 rounded-xl p-5 mb-6">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-400 tracking-tight">Auth Required</p>
                        <p className="text-sm text-amber-500/80 mt-1">{error}</p>
                        <button
                            onClick={() => {
                                if (channelIdFromUrl) {
                                    document.cookie = `connect_channel_id=${channelIdFromUrl}; path=/; max-age=3600`;
                                    signIn("google", { callbackUrl: `/dashboard/settings?channelId=${channelIdFromUrl}` });
                                }
                            }}
                            className="mt-4 inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500 hover:text-amber-300 bg-amber-950/50 hover:bg-amber-900/50 px-3 py-1.5 rounded border border-amber-900/30 transition-colors"
                        >
                            <Youtube className="w-3 h-3" />
                            Grant OAUTH Scopes
                        </button>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && !channel && (
                <div className="text-center py-20 bg-[#111113] border border-[#1e1e22] rounded-xl flex flex-col items-center mb-6">
                    <RefreshCw className="w-6 h-6 text-zinc-600 animate-spin mx-auto mb-4" />
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Querying API...</p>
                </div>
            )}

            {/* YouTube Integration Card */}
            <div className="bg-[#111113] border border-[#1e1e22] rounded-xl p-6">
                <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 border-b border-[#1e1e22] pb-3 mb-6">YouTube Integration</h3>

                {channel ? (
                    <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6 pb-6 border-b border-[#1e1e22]">
                            <div className="flex items-center gap-5">
                                <img
                                    src={channel.thumbnail}
                                    alt={channel.title}
                                    className="w-14 h-14 rounded object-cover border border-[#1e1e22]"
                                />
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">{channel.title}</h2>
                                    {channel.customUrl && (
                                        <a
                                            href={`https://youtube.com/${channel.customUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-mono text-zinc-500 hover:text-emerald-400 transition-colors"
                                        >
                                            /{channel.customUrl}
                                        </a>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-emerald-400 border border-emerald-900/50 bg-emerald-950/20 rounded px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-widest">
                                    <CheckCircle className="w-3 h-3" />
                                    Active
                                </div>
                                <button
                                    onClick={() => {
                                        if (channelIdFromUrl) {
                                            document.cookie = `connect_channel_id=${channelIdFromUrl}; path=/; max-age=3600`;
                                            if (session?.user?.email) {
                                                document.cookie = `connect_source_email=${session.user.email}; path=/; max-age=3600`;
                                            }
                                            signIn("google", { callbackUrl: `/dashboard/settings?channelId=${channelIdFromUrl}` });
                                        }
                                    }}
                                    className="flex items-center gap-2 bg-[#0c0c0e] hover:bg-[#1e1e22] border border-[#2a2a30] text-zinc-200 hover:text-white px-4 py-2 rounded text-[11px] font-mono font-bold uppercase tracking-widest transition-colors"
                                >
                                    <Youtube className="w-3.5 h-3.5" />
                                    Re-Auth
                                </button>
                                <button
                                    onClick={fetchYouTubeData}
                                    disabled={loading}
                                    className="p-2 rounded border border-[#1e1e22] bg-[#0c0c0e] text-zinc-500 hover:text-white hover:border-[#2a2a30] transition-colors"
                                    title="Refresh data"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <StatBadge icon={<BarChart2 className="w-5 h-5" />} value={channel.subscribers} label="Subscribers" />
                            <StatBadge icon={<Eye className="w-5 h-5" />} value={channel.views} label="Total_Views" />
                            <StatBadge icon={<Youtube className="w-5 h-5" />} value={channel.videoCount} label="Video_Count" />
                        </div>
                    </>
                ) : !loading && (
                    <div className="flex flex-col items-center justify-center py-10">
                        <div className="w-16 h-16 rounded-full border border-[#1e1e22] bg-[#0c0c0e] flex items-center justify-center mb-4">
                            <Youtube className="w-8 h-8 text-zinc-600" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">No Channel Connected</h3>
                        <p className="text-sm text-zinc-500 max-w-md text-center mb-6">
                            Connect your YouTube channel to this project to enable live performance tracking and data-driven AI ideation.
                        </p>
                        <button
                            onClick={() => {
                                if (channelIdFromUrl) {
                                    document.cookie = `connect_channel_id=${channelIdFromUrl}; path=/; max-age=3600`;
                                    if (session?.user?.email) {
                                        document.cookie = `connect_source_email=${session.user.email}; path=/; max-age=3600`;
                                    }
                                    signIn("google", { callbackUrl: `/dashboard/settings?channelId=${channelIdFromUrl}` });
                                } else {
                                    toast.error("No project selected to connect!");
                                }
                            }}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
                        >
                            <Youtube className="w-4 h-4" />
                            Connect Channel
                        </button>
                    </div>
                )}
            </div>

            {/* Additional Content (Videos, Ideas) */}
            {channel && (
                <div className="space-y-6">

                    {/* Recent Videos */}
                    {videos.length > 0 && (
                        <div className="bg-[#111113] border border-[#1e1e22] rounded-xl overflow-hidden">
                            <div className="flex items-center gap-6 px-6 pt-5 pb-0 border-b border-[#1e1e22]">
                                <button
                                    onClick={() => setVideoTab("videos")}
                                    className={`pb-4 text-[11px] font-mono font-bold uppercase tracking-widest transition-colors border-b-2 ${
                                        videoTab === "videos" ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-300"
                                    }`}
                                >
                                    Videos
                                </button>
                                <button
                                    onClick={() => setVideoTab("shorts")}
                                    className={`pb-4 text-[11px] font-mono font-bold uppercase tracking-widest transition-colors border-b-2 ${
                                        videoTab === "shorts" ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-300"
                                    }`}
                                >
                                    Shorts
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-3">
                                {displayedVideos.length === 0 ? (
                                    <div className="text-center py-10 text-zinc-500 text-sm font-mono uppercase tracking-widest">
                                        No {videoTab} found
                                    </div>
                                ) : (
                                    displayedVideos.map((video) => (
                                        <a
                                            key={video.id}
                                            href={`https://youtube.com/watch?v=${video.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-4 bg-[#0c0c0e] border border-[#1e1e22] hover:border-[#2a2a30] rounded-lg p-3 transition-colors group"
                                        >
                                            {video.thumbnail && (
                                                <div className={`relative flex-shrink-0 ${video.type === "short" ? "w-12 h-20" : "w-20 h-12"}`}>
                                                    <img
                                                        src={video.thumbnail}
                                                        alt={video.title}
                                                        className="w-full h-full object-cover rounded opacity-80 group-hover:opacity-100 transition-opacity"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">
                                                    {video.title}
                                                </p>
                                                <p className="text-[10px] font-mono text-zinc-600 mt-1 uppercase">
                                                    {new Date(video.publishedAt).toLocaleDateString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4 flex-shrink-0 text-right">
                                                <div className="text-[10px] font-mono text-zinc-500 uppercase">
                                                    <div className="flex items-center justify-end gap-1.5 min-w-[50px]">
                                                        <span className="text-zinc-300 font-bold">{Number(video.views).toLocaleString()}</span>
                                                    </div>
                                                    <span className="text-zinc-600">VIW</span>
                                                </div>
                                                <div className="text-[10px] font-mono text-zinc-500 uppercase hidden sm:block">
                                                    <div className="flex items-center justify-end gap-1.5 min-w-[50px]">
                                                        <span className="text-zinc-300 font-bold">{Number(video.likes).toLocaleString()}</span>
                                                    </div>
                                                    <span className="text-zinc-600">LKS</span>
                                                </div>
                                            </div>
                                        </a>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}

export default function YouTubeSettingsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[50vh]">
                <RefreshCw className="w-6 h-6 text-zinc-600 animate-spin" />
            </div>
        }>
            <YouTubeSettingsContent />
        </Suspense>
    );
}
