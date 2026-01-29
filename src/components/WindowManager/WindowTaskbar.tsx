// PBS Admin - Window Taskbar Component
// Displays minimized windows at the bottom of the screen

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWindowContext, WindowState } from "@/contexts/WindowContext";
import { cn } from "@/lib/utils";

interface WindowTaskbarProps {
  windows: WindowState[];
}

export function WindowTaskbar({ windows }: WindowTaskbarProps) {
  const { restoreWindow, closeWindow } = useWindowContext();

  if (windows.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-10 bg-background border-t z-[200] flex items-center px-2 gap-1">
      {windows.map((window) => (
        <div
          key={window.id}
          className={cn(
            "group flex items-center gap-1 h-8 px-2 rounded",
            "bg-muted/50 hover:bg-muted cursor-pointer",
            "border border-border/50"
          )}
        >
          {/* Click to restore */}
          <button
            className="flex items-center gap-2 h-full"
            onClick={() => restoreWindow(window.id)}
            title={`Restore ${window.title}`}
          >
            {window.icon && (
              <span className="text-muted-foreground flex-shrink-0">
                {window.icon}
              </span>
            )}
            <span className="text-xs font-medium truncate max-w-[150px]">
              {window.title}
            </span>
          </button>

          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(window.id);
            }}
            title="Close"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
