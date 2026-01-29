// PBS Admin - Window Component
// Draggable and resizable window shell using react-rnd

import { ReactNode, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import { X, Minus, Square, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useWindowContext,
  WindowState,
  WindowPosition,
  WindowSize,
} from "@/contexts/WindowContext";

interface WindowProps {
  window: WindowState;
}

export function Window({ window: windowState }: WindowProps) {
  const {
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
    activeWindowId,
  } = useWindowContext();

  const rndRef = useRef<Rnd>(null);
  const isActive = activeWindowId === windowState.id;

  // Store position/size before maximize for restore
  const prevStateRef = useRef<{
    position: WindowPosition;
    size: WindowSize;
  } | null>(null);

  // Handle maximize/restore
  useEffect(() => {
    if (windowState.isMaximized) {
      // Store current state before maximizing
      prevStateRef.current = {
        position: windowState.position,
        size: windowState.size,
      };
      // Update to maximized state
      updateWindowPosition(windowState.id, { x: 0, y: 0 });
      updateWindowSize(windowState.id, {
        width: window.innerWidth,
        height: window.innerHeight - 40, // Leave space for taskbar
      });
    } else if (prevStateRef.current) {
      // Restore previous state
      updateWindowPosition(windowState.id, prevStateRef.current.position);
      updateWindowSize(windowState.id, prevStateRef.current.size);
      prevStateRef.current = null;
    }
  }, [windowState.isMaximized, windowState.id, updateWindowPosition, updateWindowSize]);

  // Don't render if minimized
  if (windowState.isMinimized) {
    return null;
  }

  const handleDragStart = () => {
    focusWindow(windowState.id);
  };

  const handleDragStop = (_e: unknown, d: { x: number; y: number }) => {
    updateWindowPosition(windowState.id, { x: d.x, y: d.y });
  };

  const handleResizeStop = (
    _e: unknown,
    _direction: unknown,
    ref: HTMLElement,
    _delta: unknown,
    position: { x: number; y: number }
  ) => {
    updateWindowSize(windowState.id, {
      width: ref.offsetWidth,
      height: ref.offsetHeight,
    });
    updateWindowPosition(windowState.id, position);
  };

  const handleMouseDown = () => {
    if (!isActive) {
      focusWindow(windowState.id);
    }
  };

  return (
    <Rnd
      ref={rndRef}
      position={windowState.position}
      size={windowState.size}
      minWidth={windowState.minSize?.width || 400}
      minHeight={windowState.minSize?.height || 300}
      maxWidth={windowState.maxSize?.width}
      maxHeight={windowState.maxSize?.height}
      onDragStart={handleDragStart}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onMouseDown={handleMouseDown}
      dragHandleClassName="window-drag-handle"
      disableDragging={windowState.isMaximized}
      enableResizing={!windowState.isMaximized}
      bounds="parent"
      style={{
        zIndex: windowState.zIndex,
      }}
      className={cn(
        "absolute rounded-lg shadow-2xl overflow-hidden pointer-events-auto",
        "border bg-background",
        isActive ? "border-primary/50 shadow-primary/20" : "border-border"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Title Bar */}
        <div
          className={cn(
            "window-drag-handle flex items-center justify-between px-3 h-10 select-none",
            "border-b cursor-move",
            isActive ? "bg-muted/80" : "bg-muted/50"
          )}
        >
          {/* Icon and Title */}
          <div className="flex items-center gap-2 overflow-hidden">
            {windowState.icon && (
              <span className="flex-shrink-0 text-muted-foreground">
                {windowState.icon}
              </span>
            )}
            <span className="text-sm font-medium truncate">
              {windowState.title}
            </span>
          </div>

          {/* Window Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                minimizeWindow(windowState.id);
              }}
              title="Minimize"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                maximizeWindow(windowState.id);
              }}
              title={windowState.isMaximized ? "Restore" : "Maximize"}
            >
              {windowState.isMaximized ? (
                <Square className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => {
                e.stopPropagation();
                closeWindow(windowState.id);
              }}
              title="Close"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Window Content */}
        <div className="flex-1 overflow-auto">
          {windowState.component}
        </div>
      </div>
    </Rnd>
  );
}
