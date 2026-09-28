import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCachedUser, getCachedChannels } from "@/lib/data";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import AuraBackground from "@/components/dashboard/AuraBackground";
import ClientLayoutWrapper from "@/components/dashboard/ClientLayoutWrapper";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user?.email) {
        redirect("/auth/signin");
    }

    const user = await getCachedUser(session.user.email);
    if (!user) {
        redirect("/auth/signin");
    }

    const allChannels = await getCachedChannels(user.id);

    if (allChannels.length === 0) {
        redirect("/onboarding");
    }

    const activeChannel = allChannels[0];
    
    // Determine background color vibe based on category
    const category = activeChannel.category?.toLowerCase() || "";
    let variant: "emerald" | "blue" | "purple" | "amber" = "emerald";
    if (category.includes("finance") || category.includes("business")) variant = "blue";
    else if (category.includes("gaming") || category.includes("entertainment")) variant = "purple";
    else if (category.includes("lifestyle") || category.includes("vlog")) variant = "amber";

    return (
        <div className="bg-transparent flex flex-col md:flex-row min-h-screen relative">
            <AuraBackground variant={variant} />
            <DashboardSidebar
                session={session}
                user={user}
                allChannels={allChannels}
                activeChannel={activeChannel}
            />
            <main className="flex-1 min-h-screen overflow-y-auto relative z-10">
                <ClientLayoutWrapper>
                    {children}
                </ClientLayoutWrapper>
            </main>
        </div>
    );
}
