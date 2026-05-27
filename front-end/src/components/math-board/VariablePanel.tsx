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
    <aside className="fixed bottom-4 left-4 z-30 max-w-[calc(100vw-2rem)] rounded-md border border-white/10 bg-neutral-950/72 p-2 text-white shadow-xl shadow-black/30 backdrop-blur-xl">
      <div className="flex max-w-80 flex-wrap gap-2">
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
