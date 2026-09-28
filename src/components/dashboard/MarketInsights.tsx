"use client";

import { motion } from "framer-motion";
import { TrendingUp, Users, Eye, Zap, AlertCircle, Clock, Calendar, BarChart3 } from "lucide-react";

interface OutlierVideo {
    title: string;
    channel: string;
    views: number;
    subscriberCount: number;
    uploadDate: string;
}

interface MarketInsightsProps {
    outlierVideos: OutlierVideo[];
    uploadFrequency?: number;
    optimalSchedule?: { bestDay: string; bestHour: number; insight: string };
}

export default function MarketInsights({ outlierVideos, uploadFrequency, optimalSchedule }: MarketInsightsProps) {
    if (!outlierVideos || outlierVideos.length === 0) return null;

    return (
        <div className="mt-12 space-y-8">
            {/* Strategy Overview Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-600/5 border border-emerald-500/10 rounded-2xl p-5 flex items-start gap-4">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <div className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-widest mb-1">Observed_Upload_Day</div>
                        <div className="text-xl font-bold text-white">{optimalSchedule?.bestDay || "Not enough data"}</div>
                        <p className="text-[10px] text-zinc-500 mt-1 line-clamp-1">{optimalSchedule?.insight || "No reliable publishing window in this sample"}</p>
                    </div>
                </div>

                <div className="bg-emerald-600/5 border border-emerald-500/10 rounded-2xl p-5 flex items-start gap-4">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <div className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-widest mb-1">Observed_Hour_UTC</div>
                        <div className="text-xl font-bold text-white">
                            {optimalSchedule && optimalSchedule.bestHour >= 0 ? `${String(optimalSchedule.bestHour).padStart(2, "0")}:00` : "Not enough data"}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1 line-clamp-1">Correlation in sampled uploads; not audience activity</p>
                    </div>
                </div>

                <div className="bg-emerald-600/5 border border-emerald-500/10 rounded-2xl p-5 flex items-start gap-4">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                        <BarChart3 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <div className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-widest mb-1">Upload_Velocity</div>
                        <div className="text-xl font-bold text-white">{uploadFrequency != null ? `${uploadFrequency} / wk` : "Not enough data"}</div>
                        <p className="text-[10px] text-zinc-500 mt-1 line-clamp-1">Observed sample rate, not a recommended target</p>
                    </div>
                </div>
            </div>

            {/* Outliers Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Public Performance Outliers</h2>
                        <p className="text-sm text-zinc-500">Videos with unusually high views relative to the channel&apos;s public subscriber count.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {outlierVideos.map((video, i) => {
                        const viewMultiplier = Math.round(video.views / (video.subscriberCount || 1));
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="group bg-[#111113]/60 backdrop-blur-md border border-[#1e1e22]/50 rounded-2xl p-5 hover:border-emerald-500/30 transition-all duration-300"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                                        <Zap className="w-3 h-3 fill-current" />
                                        Outlier detected
                                    </div>
                                    <span className="text-[10px] font-mono text-zinc-600">
                                        {new Date(video.uploadDate).toLocaleDateString()}
                                    </span>
                                </div>

                                <h3 className="text-sm font-semibold text-zinc-100 mb-4 line-clamp-2 leading-relaxed group-hover:text-emerald-400 transition-colors">
                                    {video.title}
                                </h3>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-500 flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5" />
                                            {video.channel}
                                        </span>
                                        <span className="text-zinc-400 font-medium">
                                            {(video.subscriberCount / 1000).toFixed(1)}K subs
                                        </span>
                                    </div>

                                    <div className="p-3 bg-[#0c0c0e]/50 border border-[#1e1e22] rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-white">
                                                    {(video.views / 1000).toFixed(0)}K views
                                                </div>
                                                <div className="text-[9px] font-mono text-zinc-600 uppercase">Total views</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-emerald-400">+{viewMultiplier}x</div>
                                            <div className="text-[9px] font-mono text-zinc-600 uppercase">Views / subscriber</div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-emerald-400/50 shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-400 leading-relaxed">
                        <span className="text-emerald-400 font-bold">How to use this:</span> Treat these as packaging and topic examples worth investigating. Views relative to subscribers can reveal an outlier, but it does not prove algorithmic promotion or predict that copying the topic will work for your channel.
                    </p>
                </div>
            </div>
        </div>
    );
}
