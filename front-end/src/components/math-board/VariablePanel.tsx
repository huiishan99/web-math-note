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
    <aside className="fixed bottom-4 right-4 z-30 w-72 rounded-md border border-white/10 bg-zinc-950/85 p-3 text-white shadow-lg backdrop-blur">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Variables</div>
      <div className="space-y-2">
        {entries.map(([name, value]) => (
          <div key={name} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5">
            <code className="min-w-0 flex-1 truncate text-sm">
              {name} = {String(value)}
            </code>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-zinc-300 hover:text-white"
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
