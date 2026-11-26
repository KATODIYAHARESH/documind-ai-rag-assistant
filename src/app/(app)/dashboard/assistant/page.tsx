import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full w-full" aria-busy aria-label="Loading assistant">
      <div className="hidden w-[300px] shrink-0 flex-col gap-2 border-r border-white/10 p-3 xl:flex">
        <Skeleton className="h-9" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-14 shrink-0 border-b border-white/10" />
        <div className="flex flex-1 items-center justify-center p-6">
          <Skeleton className="h-40 w-full max-w-xl" />
        </div>
        <div className="h-28 shrink-0 border-t border-white/10 p-4">
          <Skeleton className="h-full max-w-3xl" />
        </div>
      </div>
      <div className="hidden w-[340px] shrink-0 flex-col gap-3 border-l border-white/10 p-3 lg:flex">
        <Skeleton className="h-10" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AssistantWorkspace />
    </Suspense>
  );
}
