import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCachedUser, getCachedChannels } from "@/lib/data";
import { CompetitorScannerForm } from "@/components/dashboard/CompetitorScannerForm";

export const metadata = {
    title: "Competitor Analysis — GapTuber",
};

export default async function CompetitorsPage({
    searchParams,
}: {
    searchParams: Promise<{ channelId?: string }>;
}) {
    const session = await auth();
    const { channelId: selectedId } = await searchParams;

    if (!session?.user?.email) {
        redirect("/auth/signin");
    }

    const user = await getCachedUser(session.user.email);
    if (!user) {
        redirect("/auth/signin");
    }

    const allChannels = await getCachedChannels(user.id);

    const activeChannel = selectedId
        ? allChannels.find((c) => c.id === selectedId) || allChannels[0]
        : allChannels[0];

    if (!activeChannel) {
        redirect("/onboarding");
    }

    return (
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10 fade-up">
            <div className="mb-8 border-b border-[#1e1e22] pb-6">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-[#1e1e22] text-zinc-400 rounded text-[10px] font-mono font-bold uppercase tracking-wider mb-3">
                    project_{activeChannel.name.replace(/\s+/g, '_').toLowerCase()}
                </div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Competitor Analysis</h1>
                <p className="text-zinc-500 text-sm mt-2 max-w-xl">
                    Run deep market analysis against up to 3 competitors directly from your dashboard. 
                    Results will automatically be saved to your scan history.
                </p>
            </div>

            <CompetitorScannerForm channelId={activeChannel.id} topic={activeChannel.topic || ""} />
        </div>
    );
}
