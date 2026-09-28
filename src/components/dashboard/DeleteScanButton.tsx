"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteScanButton({ scanId }: { scanId: string }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this scan?")) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/scans/${scanId}`, { method: "DELETE" });
            if (res.ok) {
                router.refresh();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 bg-[#111113] border border-[#1e1e22] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-zinc-500 rounded-lg transition-colors flex items-center justify-center shrink-0 disabled:opacity-50"
            title="Delete Scan"
        >
            <Trash2 className="w-4 h-4" />
        </button>
    );
}
