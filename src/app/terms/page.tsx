import Navbar from "@/components/Navbar";
import Footer from "@/components/landing/Footer";
import Link from "next/link";

export default function TermsOfServicePage() {
    return (
        <main className="min-h-screen bg-[#0c0c0e] text-zinc-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
            <Navbar />
            <div className="max-w-4xl mx-auto px-5 py-24 sm:py-32">
                <div className="mb-12 border-b border-[#1e1e22] pb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">Terms of Service</h1>
                    <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Last Updated: May 30, 2026</p>
                </div>

                <div className="space-y-8 text-sm sm:text-base leading-relaxed text-zinc-400">
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white tracking-tight">1. Agreement to Terms</h2>
                        <p>
                            By accessing or using GapTuber ("the Service"), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the Service.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white tracking-tight">2. Use of YouTube Data</h2>
                        <p>
                            GapTuber uses YouTube API Services to function. By using our Service, you also explicitly agree to be bound by the{" "}
                            <a 
                                href="https://www.youtube.com/t/terms" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
                            >
                                YouTube Terms of Service
                            </a>.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white tracking-tight">3. Accounts and Subscriptions</h2>
                        <ul className="list-disc pl-5 space-y-2 text-zinc-500">
                            <li>You must provide accurate and complete information when creating an account.</li>
                            <li>You are responsible for safeguarding the password and access credentials that you use to access the Service.</li>
                            <li>Subscriptions and credit purchases are processed securely. Unused credits may expire depending on the terms of your specific subscription tier.</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white tracking-tight">4. Acceptable Use</h2>
                        <p>
                            You agree not to use the Service to:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-zinc-500">
                            <li>Violate any laws, third-party rights, or our policies.</li>
                            <li>Attempt to reverse engineer, decompile, or hack the GapTuber platform or Chrome Extension.</li>
                            <li>Abuse the AI generation tools to create spam, malicious content, or content that violates YouTube's community guidelines.</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white tracking-tight">5. Disclaimer of Warranties</h2>
                        <p>
                            The Service is provided on an "AS IS" and "AS AVAILABLE" basis. GapTuber makes no warranties, expressed or implied, regarding the accuracy of AI-generated content, SEO metadata, or predicted video performance.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white tracking-tight">6. Limitation of Liability</h2>
                        <p>
                            In no event shall GapTuber, nor its directors, employees, partners, or agents, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                        </p>
                    </section>

                    <section className="space-y-4 border-t border-[#1e1e22] pt-8 mt-12">
                        <h2 className="text-xl font-bold text-white tracking-tight">7. Contact Us</h2>
                        <p>
                            If you have questions or comments about these Terms of Service, you may contact us at:{" "}
                            <a href="mailto:hello@aurionstack.dev" className="text-sky-400 hover:text-sky-300">hello@aurionstack.dev</a>
                        </p>
                    </section>
                </div>
            </div>
            <Footer />
        </main>
    );
}
