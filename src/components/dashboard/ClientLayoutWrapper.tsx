export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-full min-h-full">
            {children}
        </div>
    );
}
