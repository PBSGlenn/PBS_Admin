// PBS Admin - Startup Settings Dialog
// Configure auto-start and minimize to tray behavior

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Settings, Power, Minimize2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  isAutoStartEnabled,
  toggleAutoStart,
  getMinimizeToTray,
  setMinimizeToTray,
} from "@/lib/services/autostartService";

interface StartupSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StartupSettingsDialog({ isOpen, onClose }: StartupSettingsDialogProps) {
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [minimizeToTray, setMinimizeToTrayState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load current settings
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const enabled = await isAutoStartEnabled();
        setAutoStartEnabled(enabled);
        setMinimizeToTrayState(getMinimizeToTray());
      } catch (error) {
        console.error("Failed to load startup settings:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const handleAutoStartToggle = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      const result = await toggleAutoStart(enabled);
      if (result.success) {
        setAutoStartEnabled(enabled);
        toast.success(enabled ? "Auto-start enabled" : "Auto-start disabled");
      } else {
        toast.error("Failed to update auto-start setting", {
          description: result.error,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleMinimizeToTrayToggle = (enabled: boolean) => {
    setMinimizeToTray(enabled);
    setMinimizeToTrayState(enabled);
    toast.success(enabled ? "Minimize to tray enabled" : "Minimize to tray disabled");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Startup Settings
          </DialogTitle>
          <DialogDescription>
            Configure how PBS Admin starts and runs in the background
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Auto-start Setting */}
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Power className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="auto-start" className="text-sm font-medium">
                    Start at Windows login
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically launch PBS Admin when you sign in to Windows
                  </p>
                </div>
              </div>
              <Switch
                id="auto-start"
                checked={autoStartEnabled}
                onCheckedChange={handleAutoStartToggle}
                disabled={isSaving}
              />
            </div>

            <Separator />

            {/* Minimize to Tray Setting */}
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Minimize2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="minimize-tray" className="text-sm font-medium">
                    Minimize to system tray
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When closing the window, minimize to tray instead of quitting
                  </p>
                </div>
              </div>
              <Switch
                id="minimize-tray"
                checked={minimizeToTray}
                onCheckedChange={handleMinimizeToTrayToggle}
              />
            </div>

            <Separator />

            {/* Info Section */}
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1.5">
              <p>
                <strong>System Tray:</strong> When minimized, PBS Admin runs in the background.
                Double-click the tray icon to restore the window.
              </p>
              <p>
                <strong>Right-click Menu:</strong> Access Show, Hide, and Quit options from the
                system tray icon.
              </p>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
