// PBS Admin - Window Manager Component
// Global container for all windows

import { useWindowContext } from "@/contexts/WindowContext";
import { Window } from "./Window";
import { WindowTaskbar } from "./WindowTaskbar";

export function WindowManager() {
  const { windows } = useWindowContext();

  // Only render visible (non-minimized) windows
  const visibleWindows = windows.filter((w) => !w.isMinimized);
  const minimizedWindows = windows.filter((w) => w.isMinimized);

  return (
    <>
      {/* Window Container - Full viewport minus taskbar */}
      <div className="fixed inset-0 bottom-10 pointer-events-none z-50">
        {visibleWindows.map((window) => (
          <Window key={window.id} window={window} />
        ))}
      </div>

      {/* Taskbar for minimized windows */}
      {minimizedWindows.length > 0 && (
        <WindowTaskbar windows={minimizedWindows} />
      )}
    </>
  );
}
