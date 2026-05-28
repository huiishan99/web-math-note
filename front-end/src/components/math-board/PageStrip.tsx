import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageStripPage {
  id: string;
  title: string;
}

interface PageStripProps {
  pages: PageStripPage[];
  activePageId: string;
  onAddPage: () => void;
  onSelectPage: (id: string) => void;
}

export function PageStrip({
  pages,
  activePageId,
  onAddPage,
  onSelectPage,
}: PageStripProps) {
  return (
    <nav className="fixed left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 flex max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto rounded-md border border-white/10 bg-neutral-950/70 p-1 text-white shadow-xl shadow-black/25 backdrop-blur-2xl [-ms-overflow-style:none] [scrollbar-width:none] sm:left-4 sm:top-4 [&::-webkit-scrollbar]:hidden">
      {pages.map((page, index) => {
        const isActive = page.id === activePageId;

        return (
          <button
            key={page.id}
            type="button"
            className={cn(
              "flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm text-white/60 transition hover:bg-white/[0.08] hover:text-white",
              isActive && "bg-white/[0.14] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]",
            )}
            onClick={() => onSelectPage(page.id)}
            aria-label={page.title}
            aria-current={isActive ? "page" : undefined}
            title={page.title}
          >
            {index + 1}
          </button>
        );
      })}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="!h-8 !w-8 text-white/65 hover:bg-white/[0.08] hover:text-white"
        onClick={onAddPage}
        aria-label="New page"
        title="New page"
      >
        <Plus />
        <span className="sr-only">New page</span>
      </Button>
    </nav>
  );
}
