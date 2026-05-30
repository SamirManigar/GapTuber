"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Chrome } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
};

export default function FinalCta() {
    const { data: session } = useSession();

    return (
        <section className="py-24 px-5 bg-[#111113] border-t border-[#1e1e22]">
            <div className="max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-10 items-center">
                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-80px" }}
                    >
                        <p className="text-xs font-mono text-zinc-600 tracking-widest uppercase mb-5">Ship your next video</p>
                        <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
                            Your competitors<br />are guessing.
                        </h2>
                        <p className="text-zinc-500 text-base leading-relaxed max-w-md">
                            Run your first gap scan in minutes. Get a statistical confidence score, a ready-to-use hook, and a content outline — before anyone else spots the opportunity.
                        </p>
                    </motion.div>

                    <motion.div
                        variants={stagger}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-60px" }}
                        className="flex flex-col sm:flex-row lg:justify-end gap-3"
                    >
                        {session ? (
                            <motion.div variants={fadeUp}>
                                <Link
                                    href="/dashboard"
                                    className="block bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-md font-semibold text-sm transition-colors text-center"
                                >
                                    Open Dashboard →
                                </Link>
                            </motion.div>
                        ) : (
                            <>
                                <motion.div variants={fadeUp}>
                                    <Link
                                        href="/auth/signin"
                                        className="block bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-md font-semibold text-sm transition-colors text-center"
                                    >
                                        Start for free →
                                    </Link>
                                </motion.div>
                                <motion.div variants={fadeUp}>
                                    <a
                                        href="#"
                                        title="GapTuber Chrome Extension — coming soon"
                                        className="flex items-center justify-center gap-2 border border-[#2a2a30] hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 px-8 py-3 rounded-md text-sm transition-all"
                                    >
                                        <Chrome className="w-4 h-4" />
                                        Get Extension
                                    </a>
                                </motion.div>
                                <motion.div variants={fadeUp}>
                                    <a
                                        href="#how-it-works"
                                        className="block border border-[#2a2a30] hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 px-8 py-3 rounded-md text-sm transition-colors text-center"
                                    >
                                        See how it works
                                    </a>
                                </motion.div>
                            </>
                        )}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
