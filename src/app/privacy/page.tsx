import Navbar from "@/components/Navbar";
import Footer from "@/components/landing/Footer";
import Link from "next/link";

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-[#0c0c0e] text-zinc-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
            <Navbar />
            <div className="max-w-4xl mx-auto px-5 py-24 sm:py-32">
                <div className="mb-12 border-b border-[#1e1e22] pb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">Privacy Policy</h1>
                    <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Last Updated: May 30, 2026</p>
                </div>

                <div className="space-y-8 text-sm sm:text-base leading-relaxed text-zinc-400">
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white tracking-tight">1. Introduction</h2>
                        <p>
                            Welcome to GapTuber. We are committed to protecting your personal information and your right to privacy. 
                            This Privacy Policy explains what information we collect, how we use it, and what rights you have in relation to it.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white tracking-tight">2. Information We Collect</h2>
                        <p>
                            When you use GapTuber, we collect the following types of information:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-zinc-500">
                            <li><strong>Account Information:</strong> Your email address and basic profile information when you sign in via Google.</li>
                            <li><strong>YouTube Channel Data:</strong> Publicly available statistics and performance metrics regarding your connected YouTube channel.</li>
                            <li><strong>Usage Data:</strong> Information on how you interact with the GapTuber platform, including API usage and feature interaction.</li>
                        </ul>
                    </section>

                    <section className="space-y-4 p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                        <h2 className="text-xl font-bold text-emerald-400 tracking-tight">3. YouTube API Services</h2>
                        <p className="text-emerald-100/70">
                            GapTuber utilizes <strong>YouTube API Services</strong> to fetch data about your channel and competitors. By using GapTuber, you are agreeing to be bound by the YouTube Terms of Service.
                        </p>
                        <p className="text-emerald-100/70">
                            You can review the Google Privacy Policy here:{" "}
                            <a 
                                href="http://www.google.com/policies/privacy" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4 font-semibold"
                            >
                                Google Privacy Policy
                            </a>
                        </p>
                        <p className="text-emerald-100/70">
                            You can manage or revoke GapTuber's access to your data via the Google Security Settings page:{" "}
                            <a 
                                href="https://security.google.com/settings/security/permissions" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4 font-semibold"
                            >
                                Google Security Settings
                            </a>
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white tracking-tight">4. How We Use Your Information</h2>
                        <p>
                            We use the information we collect strictly to provide and improve the GapTuber service. This includes:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-zinc-500">
                            <li>Generating statistical insights and gap analyses for your channel.</li>
                            <li>Providing AI-driven recommendations based on public channel data.</li>
                            <li>Managing your subscription and credit usage.</li>
                        </ul>
                        <p className="font-semibold text-zinc-300">
                            We do NOT sell your personal data. We do NOT share your data with third parties for marketing purposes.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white tracking-tight">5. Data Retention</h2>
                        <p>
                            We retain your connected YouTube data only for as long as necessary to provide the GapTuber service. If you disconnect your channel or delete your GapTuber account, your specific channel OAuth tokens are revoked and deleted from our active databases.
                        </p>
                    </section>

                    <section className="space-y-4 border-t border-[#1e1e22] pt-8 mt-12">
                        <h2 className="text-xl font-bold text-white tracking-tight">6. Contact Us</h2>
                        <p>
                            If you have questions or comments about this Privacy Policy, you may contact us at:{" "}
                            <a href="mailto:hello@aurionstack.dev" className="text-sky-400 hover:text-sky-300">hello@aurionstack.dev</a>
                        </p>
                    </section>
                </div>
            </div>
            <Footer />
        </main>
    );
}
