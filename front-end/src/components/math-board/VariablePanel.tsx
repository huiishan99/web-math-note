import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { VariableMap } from "@/types/calculator";

interface VariablePanelProps {
  variables: VariableMap;
  onRemove: (name: string) => void;
}

export function VariablePanel({ variables, onRemove }: VariablePanelProps) {
  const entries = Object.entries(variables);

  if (entries.length === 0) {
    return null;
  }

  return (
    <aside className="fixed bottom-[calc(env(safe-area-inset-bottom)+7.5rem)] left-3 right-3 z-30 rounded-md border border-white/10 bg-neutral-950/72 p-2 text-white shadow-xl shadow-black/30 backdrop-blur-xl sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-[calc(100vw-2rem)]">
      <div className="flex max-h-20 flex-wrap gap-2 overflow-y-auto sm:max-h-none sm:max-w-80">
        {entries.map(([name, value]) => (
          <div key={name} className="flex min-w-0 items-center gap-2 rounded-md bg-white/[0.07] px-2 py-1.5">
            <code className="max-w-48 truncate text-sm text-white/90">
              {name} = {String(value)}
            </code>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-white/55 hover:bg-white/10 hover:text-white"
              onClick={() => onRemove(name)}
              title={`Remove ${name}`}
            >
              <X />
              <span className="sr-only">Remove {name}</span>
            </Button>
          </div>
        ))}
      </div>
    </aside>
  );
}
