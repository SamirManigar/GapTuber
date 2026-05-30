"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { MessageSquareText, TrendingUp, Plus, Trash2, Loader2, Youtube, AlertTriangle, X, Target, Library, Settings, LogOut, Sun, Moon, MoreVertical, Radar, MessageCircle, Zap } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { signOut } from "next-auth/react";
import { useEffect, useState as useReactState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { PricingModal } from "./PricingModal";

interface DashboardSidebarProps {
    session: any;
    user?: any; // The database user object containing credits
    allChannels: any[];
    activeChannel: any;
}

// ─── Delete Confirmation Modal ─────────────────────────────────────────────────

function DeleteModal({
    channelName,
    onConfirm,
    onCancel,
    isDeleting,
}: {
    channelName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
            {/* Modal */}
            <div className="relative bg-[#111113] border border-[#2a2a30] rounded-xl p-6 max-w-sm w-full shadow-2xl">
                <button
                    onClick={onCancel}
                    className="absolute top-3 right-3 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white mb-1">Delete Channel?</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            <span className="text-zinc-200 font-semibold">&ldquo;{channelName}&rdquo;</span> and all its scan data will be permanently removed. This cannot be undone.
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 mt-5">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2 rounded border border-[#1e1e22] text-zinc-400 text-sm hover:text-white hover:bg-[#1e1e22] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="flex-1 py-2 rounded bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Credit History Modal ──────────────────────────────────────────────────────

function CreditHistoryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [history, setHistory] = useReactState<any[]>([]);
    const [isLoading, setIsLoading] = useReactState(true);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            fetch("/api/credits/history")
                .then(res => res.json())
                .then(data => {
                    if (data.history) setHistory(data.history);
                })
                .catch(err => console.error(err))
                .finally(() => setIsLoading(false));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#111113] border border-[#2a2a30] rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-[#2a2a30] flex items-center justify-between shrink-0">
                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        Credit History
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center p-8 text-zinc-500 text-sm">
                            No credit history found.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a1e] border border-[#2a2a30]">
                                    <div>
                                        <p className="text-sm font-semibold text-zinc-200">{item.action}</p>
                                        <p className="text-xs text-zinc-500">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p>
                                    </div>
                                    <div className={`font-bold ${item.amount > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                                        {item.amount > 0 ? "+" : ""}{item.amount}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t border-[#2a2a30] shrink-0">
                    <p className="text-xs text-zinc-500 text-center mb-2">Need more credits?</p>
                </div>
            </div>
        </div>
    );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

export function DashboardSidebar({ session, user, allChannels, activeChannel: defaultChannel }: DashboardSidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const activeChannelId = searchParams.get("channelId") || defaultChannel?.id;
    const activeChannel = allChannels.find(c => c.id === activeChannelId) || defaultChannel;

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
    const [theme, setTheme] = useState<"dark" | "light">("dark");
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const [localCredits, setLocalCredits] = useState<number>(user?.credits ?? 0);

    useEffect(() => {
        if (user) {
            setLocalCredits(user.credits);
        }
    }, [user]);

    useEffect(() => {
        const handleCreditUpdate = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && typeof customEvent.detail.deduct === 'number') {
                setLocalCredits(prev => Math.max(0, prev - customEvent.detail.deduct));
            }
        };

        window.addEventListener("credit-update", handleCreditUpdate);
        return () => window.removeEventListener("credit-update", handleCreditUpdate);
    }, []);

    useEffect(() => {
        const isLight = document.documentElement.classList.contains("light-mode");
        if (isLight) setTheme("light");
    }, []);

    const toggleTheme = () => {
        const isLight = document.documentElement.classList.toggle("light-mode");
        setTheme(isLight ? "light" : "dark");
        localStorage.setItem("theme", isLight ? "light" : "dark");
    };

    const handleDeleteClick = (e: React.MouseEvent, channelId: string, channelName: string) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmDelete({ id: channelId, name: channelName });
    };

    const handleDeleteConfirm = async () => {
        if (!confirmDelete) return;
        const { id: channelId, name: channelName } = confirmDelete;

        setDeletingId(channelId);
        setConfirmDelete(null);
        try {
            const res = await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
            if (res.ok) {
                if (activeChannel.id === channelId) {
                    const remaining = allChannels.filter((c: any) => c.id !== channelId);
                    if (remaining.length > 0) {
                        router.push(`/dashboard?channelId=${remaining[0].id}`);
                    } else {
                        router.push(`/onboarding`);
                    }
                }
                router.refresh();
            } else {
                toast.error("Failed to delete channel.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred while deleting the channel.");
        } finally {
            setDeletingId(null);
        }
    };



    const isBotPage = pathname?.startsWith("/dashboard/bot");
    const isSettingsPage = pathname?.startsWith("/dashboard/settings");
    const isCompetitorsPage = pathname?.startsWith("/dashboard/competitors");
    const isVaultPage = pathname?.startsWith("/dashboard/vault");
    const isWatchtowerPage = pathname?.startsWith("/dashboard/watchtower");
    const isMinerPage = pathname?.startsWith("/dashboard/miner");
    const isDashboardHome = pathname === "/dashboard" || (!isBotPage && !isSettingsPage && !isCompetitorsPage && !isVaultPage && !isWatchtowerPage && !isMinerPage && pathname?.startsWith("/dashboard"));

    return (
        <>
            {confirmDelete && (
                <DeleteModal
                    channelName={confirmDelete.name}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setConfirmDelete(null)}
                    isDeleting={!!deletingId}
                />
            )}

            <aside className="w-full md:w-72 md:h-screen md:sticky md:top-0 bg-[#0c0c0e]/80 backdrop-blur-xl border-r border-[#1e1e22]/50 flex flex-col z-20 shrink-0 overflow-hidden">
                {/* Fixed top section: logo + nav */}
                <div className="p-6 pb-4 shrink-0">
                    <Link href="/" className="flex items-center gap-2.5 mb-8">
                        <img src="/logo.svg" alt="GapTuber Logo" className="h-[28px] w-auto" />
                        <span className="text-sm font-bold text-white font-mono tracking-tight">GapTuber</span>
                        <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">beta</span>
                    </Link>

                    {/* Main Navigation — always visible, never scrolls */}
                    <div className="space-y-1 mb-8">
                        <div className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-3 px-2">Menu</div>
                        <Link
                            href={`/dashboard?channelId=${activeChannel.id}`}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all font-medium text-sm ${isDashboardHome
                                    ? "bg-[#111113] text-white border border-[#1e1e22]"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-[#111113] border border-transparent hover:translate-x-1"
                                }`}
                        >
                            <TrendingUp className={`w-4 h-4 ${isDashboardHome ? "text-emerald-400" : "text-zinc-500"}`} />
                            Growth Dashboard
                        </Link>
                        <Link
                            href={`/dashboard/bot?channelId=${activeChannel.id}`}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all font-medium text-sm ${isBotPage
                                    ? "bg-[#111113] text-white border border-[#1e1e22]"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-[#111113] border border-transparent hover:translate-x-1"
                                }`}
                        >
                            <MessageSquareText className={`w-4 h-4 ${isBotPage ? "text-emerald-400" : "text-zinc-500"}`} />
                            GapTuber AI Studio
                        </Link>
                        <Link
                            href={`/dashboard/competitors?channelId=${activeChannel.id}`}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all font-medium text-sm ${isCompetitorsPage
                                    ? "bg-[#111113] text-white border border-[#1e1e22]"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-[#111113] border border-transparent hover:translate-x-1"
                                }`}
                        >
                            <Target className={`w-4 h-4 ${isCompetitorsPage ? "text-emerald-400" : "text-zinc-500"}`} />
                            Competitor Analysis
                        </Link>
                        <Link
                            href={`/dashboard/watchtower?channelId=${activeChannel.id}`}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all font-medium text-sm ${isWatchtowerPage
                                    ? "bg-[#111113] text-white border border-[#1e1e22]"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-[#111113] border border-transparent hover:translate-x-1"
                                }`}
                        >
                            <Radar className={`w-4 h-4 ${isWatchtowerPage ? "text-emerald-400" : "text-zinc-500"}`} />
                            Competitor Watchtower
                        </Link>
                        <Link
                            href={`/dashboard/miner?channelId=${activeChannel.id}`}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all font-medium text-sm ${isMinerPage
                                    ? "bg-[#111113] text-white border border-[#1e1e22]"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-[#111113] border border-transparent hover:translate-x-1"
                                }`}
                        >
                            <MessageCircle className={`w-4 h-4 ${isMinerPage ? "text-emerald-400" : "text-zinc-500"}`} />
                            Comment Miner
                        </Link>
                        <Link
                            href={`/dashboard/vault?channelId=${activeChannel.id}`}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all font-medium text-sm ${isVaultPage
                                    ? "bg-[#111113] text-white border border-[#1e1e22]"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-[#111113] border border-transparent hover:translate-x-1"
                                }`}
                        >
                            <Library className={`w-4 h-4 ${isVaultPage ? "text-emerald-400" : "text-zinc-500"}`} />
                            Idea Vault
                        </Link>
                        <Link
                            href={`/dashboard/settings?channelId=${activeChannel.id}`}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all font-medium text-sm ${isSettingsPage
                                    ? "bg-[#111113] text-white border border-[#1e1e22]"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-[#111113] border border-transparent hover:translate-x-1"
                                }`}
                        >
                            <div className="relative">
                                <Youtube className={`w-4 h-4 ${isSettingsPage ? "text-emerald-400" : "text-zinc-500"}`} />
                                {activeChannel.youtubeAccessToken && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-[#0c0c0e]"></span>
                                )}
                            </div>
                            YouTube Connection
                        </Link>
                    </div>

                    {/* Projects header */}
                    <div className="flex items-center justify-between mb-3 px-2">
                        <h2 className="text-xs font-mono text-zinc-600 uppercase tracking-widest">Projects</h2>
                        <Link
                            href="/onboarding?force=true"
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                            title="Add New Channel"
                        >
                            <Plus className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {/* Scrollable channels list */}
                <div className="flex-1 overflow-y-auto px-6 pb-2">
                    <div className="space-y-1">
                        {allChannels.map((channel: any) => (
                            <Link
                                key={channel.id}
                                href={`/dashboard?channelId=${channel.id}`}
                                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md transition-all group ${activeChannel.id === channel.id
                                        ? "bg-[#111113]/80 backdrop-blur-md border border-emerald-500/20 text-white shadow-[0_0_20px_rgba(16,185,129,0.05)]"
                                        : "hover:bg-[#111113]/50 border border-transparent text-zinc-500"
                                    }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {channel.brandingData?.thumbnail ? (
                                        <img src={channel.brandingData.thumbnail} alt={channel.name} className="w-6 h-6 rounded-full shrink-0 object-cover border border-[#1e1e22]" />
                                    ) : (
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeChannel.id === channel.id ? "bg-emerald-400" : "bg-zinc-700 opacity-50 group-hover:opacity-100 transition-opacity"}`} />
                                    )}
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-medium truncate">{channel.name}</span>
                                        {channel.role === "existing_tuber" && channel.youtubeAccessToken ? (
                                            <span className="text-[10px] text-emerald-400 font-mono tracking-tight flex items-center gap-1">
                                                <Youtube className="w-3 h-3" /> Connected {channel.brandingData?.subscribers ? `· ${Number(channel.brandingData.subscribers).toLocaleString()} subs` : ""}
                                            </span>
                                        ) : channel.role === "existing_tuber" ? (
                                            <span className="text-[10px] text-zinc-500 font-mono tracking-tight flex items-center gap-1">Existing Channel {channel.brandingData?.subscribers ? `· ${Number(channel.brandingData.subscribers).toLocaleString()} subs` : ""}</span>
                                        ) : (
                                            <span className="text-[10px] text-zinc-500 font-mono tracking-tight">New Project</span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => handleDeleteClick(e, channel.id, channel.name)}
                                    disabled={deletingId === channel.id}
                                    className={`shrink-0 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all ${deletingId === channel.id
                                            ? "opacity-100 cursor-not-allowed"
                                            : "hover:bg-[#1e1e22] text-zinc-600 hover:text-red-400"
                                        }`}
                                    title="Delete Channel"
                                >
                                    {deletingId === channel.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* User & Settings */}
                <div className="p-4 border-t border-[#1e1e22]">
                    
                    {/* Credit Widget */}
                    {user && (
                        <div 
                            onClick={() => setIsHistoryOpen(true)}
                            className="mb-4 p-3 bg-[#0c0c0e] border border-[#2a2a30] rounded-xl flex items-center justify-between group cursor-pointer hover:border-amber-500/50 transition-colors"
                        >
                            <div>
                                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1 group-hover:text-amber-500/70 transition-colors">AI Credits</p>
                                <p className={`text-sm font-bold flex items-center gap-1.5 ${localCredits > 5 ? "text-emerald-400" : "text-amber-400"}`}>
                                    <Zap className="w-4 h-4 fill-current" />
                                    {localCredits} remaining
                                </p>
                            </div>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsPricingOpen(true);
                                }}
                                className="px-2.5 py-1 text-[10px] font-bold text-zinc-900 bg-emerald-500 hover:bg-emerald-400 rounded-md transition-colors shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            >
                                UPGRADE
                            </button>
                        </div>
                    )}

                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button className="flex items-center gap-3 w-full p-2 hover:bg-[#1e1e22] rounded-lg transition-colors group outline-none">
                                {session.user.image ? (
                                    <img src={session.user.image} alt={session.user.name ?? "User"} className="w-8 h-8 rounded border border-[#2a2a30] opacity-90 group-hover:opacity-100 transition-opacity" />
                                ) : (
                                    <div className="w-8 h-8 rounded border border-[#2a2a30] bg-[#1e1e22] flex items-center justify-center text-xs font-bold text-zinc-500">
                                        {session.user.name?.[0]?.toUpperCase() ?? "U"}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-semibold text-zinc-200 truncate">{session.user.name}</p>
                                    <p className="text-xs text-zinc-600 truncate">{session.user.email}</p>
                                </div>
                                <MoreVertical className="w-4 h-4 text-zinc-600 shrink-0" />
                            </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                align="end"
                                sideOffset={8}
                                className="z-50 w-56 bg-[#111113] border border-[#2a2a30] rounded-lg shadow-xl p-1 animate-fade-in no-invert"
                            >
                                <DropdownMenu.Item
                                    onSelect={() => router.push(`/dashboard/settings?channelId=${activeChannel.id}`)}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-[#1e1e22] rounded cursor-pointer outline-none transition-colors"
                                >
                                    <Settings className="w-4 h-4 text-zinc-500" />
                                    Account Settings
                                </DropdownMenu.Item>

                                <DropdownMenu.Item
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        toggleTheme();
                                    }}
                                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-[#1e1e22] rounded cursor-pointer outline-none transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {theme === "dark" ? <Moon className="w-4 h-4 text-zinc-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
                                        {theme === "dark" ? "Dark Mode" : "Light Mode"}
                                    </div>
                                    <div className={`w-8 h-4 rounded-full border border-[#2a2a30] relative transition-colors ${theme === "dark" ? "bg-emerald-500/20 border-emerald-500/50" : "bg-[#0c0c0e]"}`}>
                                        <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-zinc-400 transition-all ${theme === "dark" ? "left-4 bg-emerald-400" : "left-0.5"}`} />
                                    </div>
                                </DropdownMenu.Item>

                                <DropdownMenu.Separator className="h-px bg-[#2a2a30] my-1 mx-2" />

                                <DropdownMenu.Item
                                    onSelect={() => signOut({ callbackUrl: "/" })}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded cursor-pointer outline-none transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Log Out
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                </div>
            </aside>
            <CreditHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
            <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
        </>
    );
}
