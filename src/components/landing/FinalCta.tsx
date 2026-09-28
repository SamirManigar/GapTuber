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
                            Run a grounded gap scan in minutes. See the public evidence and data coverage, then turn the strongest hypothesis into a hook and outline worth testing.
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
                                    <span
                                        aria-disabled="true"
                                        title="Chrome Web Store release is not available yet"
                                        className="flex cursor-not-allowed items-center justify-center gap-2 rounded-md border border-[#2a2a30] px-8 py-3 text-sm text-zinc-600"
                                    >
                                        <Chrome className="w-4 h-4" />
                                        Extension coming soon
                                    </span>
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
