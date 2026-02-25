// PBS Admin - Command Palette (Ctrl+K)
// Global search and quick actions for clients, settings, and navigation

import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search,
  User,
  UserPlus,
  Mail,
  FileText,
  FileAudio,
  Pill,
  Database,
  Info,
  Power,
  Key,
  Building2,
  ChevronRight,
} from "lucide-react";
import { searchClients } from "@/lib/services/clientService";
import type { Client } from "@/lib/types";

// ============================================================================
// Types
// ============================================================================

export interface CommandAction {
  id: string;
  label: string;
  category: "navigation" | "settings" | "client";
  icon: React.ReactNode;
  keywords?: string; // extra search terms
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandAction[];
  onOpenClient: (client: Client) => void;
}

// ============================================================================
// Component
// ============================================================================

export function CommandPalette({
  isOpen,
  onClose,
  actions,
  onOpenClient,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setClientResults([]);
      // Focus input after dialog animation
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced client search via FTS5
  useEffect(() => {
    if (!isOpen) return;

    clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setClientResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchClients(query);
        setClientResults(results.slice(0, 5)); // Limit to top 5
      } catch {
        setClientResults([]);
      }
      setIsSearching(false);
    }, 150);

    return () => clearTimeout(debounceRef.current);
  }, [query, isOpen]);

  // Filter static actions by query
  const filteredActions = query.trim()
    ? actions.filter((action) => {
        const q = query.toLowerCase();
        return (
          action.label.toLowerCase().includes(q) ||
          action.category.toLowerCase().includes(q) ||
          action.keywords?.toLowerCase().includes(q)
        );
      })
    : actions;

  // Build combined results list
  const allItems: Array<
    | { type: "action"; action: CommandAction }
    | { type: "client"; client: Client }
  > = [];

  // Clients first (when searching)
  for (const client of clientResults) {
    allItems.push({ type: "client", client });
  }

  // Then actions
  for (const action of filteredActions) {
    allItems.push({ type: "action", action });
  }

  // Clamp selected index
  const maxIndex = allItems.length - 1;
  const clampedIndex = Math.max(0, Math.min(selectedIndex, maxIndex));

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = allItems[clampedIndex];
        if (item) {
          if (item.type === "client") {
            onOpenClient(item.client);
          } else {
            item.action.onSelect();
          }
          onClose();
        }
      }
    },
    [allItems, clampedIndex, onOpenClient, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.querySelector(`[data-index="${clampedIndex}"]`);
    selected?.scrollIntoView({ block: "nearest" });
  }, [clampedIndex]);

  // Group actions by category for display
  const hasClients = clientResults.length > 0;
  const navigationActions = filteredActions.filter(
    (a) => a.category === "navigation"
  );
  const settingsActions = filteredActions.filter(
    (a) => a.category === "settings"
  );

  let currentItemIndex = 0;
  const getIndex = () => currentItemIndex++;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-lg p-0 gap-0 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search clients, actions, settings..."
            className="h-11 border-0 shadow-none focus-visible:ring-0 text-sm"
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[320px] overflow-y-auto p-1"
        >
          {allItems.length === 0 && query.trim() && !isSearching ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No results found
            </div>
          ) : (
            <>
              {/* Client results */}
              {hasClients && (
                <>
                  <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Clients
                  </div>
                  {clientResults.map((client) => {
                    const idx = getIndex();
                    return (
                      <button
                        key={`client-${client.clientId}`}
                        data-index={idx}
                        className={`w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs cursor-pointer ${
                          clampedIndex === idx
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50"
                        }`}
                        onClick={() => {
                          onOpenClient(client);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-left truncate">
                          {client.firstName} {client.lastName}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                          {client.email}
                        </span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </>
              )}

              {/* Navigation actions */}
              {navigationActions.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </div>
                  {navigationActions.map((action) => {
                    const idx = getIndex();
                    return (
                      <button
                        key={action.id}
                        data-index={idx}
                        className={`w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs cursor-pointer ${
                          clampedIndex === idx
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50"
                        }`}
                        onClick={() => {
                          action.onSelect();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <span className="text-muted-foreground shrink-0">
                          {action.icon}
                        </span>
                        <span className="flex-1 text-left">{action.label}</span>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Settings actions */}
              {settingsActions.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Settings
                  </div>
                  {settingsActions.map((action) => {
                    const idx = getIndex();
                    return (
                      <button
                        key={action.id}
                        data-index={idx}
                        className={`w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs cursor-pointer ${
                          clampedIndex === idx
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50"
                        }`}
                        onClick={() => {
                          action.onSelect();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <span className="text-muted-foreground shrink-0">
                          {action.icon}
                        </span>
                        <span className="flex-1 text-left">{action.label}</span>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Loading indicator */}
              {isSearching && (
                <div className="py-3 text-center text-xs text-muted-foreground">
                  Searching...
                </div>
              )}

              {/* Empty state when no query */}
              {!query.trim() && allItems.length > 0 && (
                <div className="px-2 py-2 text-[10px] text-muted-foreground text-center">
                  Type to search clients by name, email, mobile, or pet name
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-3 py-1.5 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[9px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[9px]">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[9px]">esc</kbd>
              close
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
