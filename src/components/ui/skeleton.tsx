import { tw } from "@/lib/format";

export function Skeleton({ className }: { className?: string }) {
  return <div className={tw("skeleton", className)} aria-hidden />;
}

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={tw("flex flex-col gap-2", className)} aria-busy aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-[60px] w-full rounded-xl" />
      ))}
    </div>
  );
}
