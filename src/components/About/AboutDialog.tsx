// PBS Admin - About Dialog
// Shows app version and checks for updates

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getAppVersion,
  checkForUpdates,
  type UpdateInfo,
} from "@/lib/services/updateService";
import {
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    try {
      const info = await checkForUpdates();
      setUpdateInfo(info);
    } finally {
      setIsChecking(false);
    }
  };

  const openReleaseUrl = () => {
    if (updateInfo?.releaseUrl) {
      window.open(updateInfo.releaseUrl, "_blank");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            About PBS Admin
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* App Info */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">PBS Admin</h3>
              <p className="text-xs text-muted-foreground">
                Pet Behaviour Services Administration
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              v{getAppVersion()}
            </Badge>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Update Check Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Updates</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCheckForUpdates}
                disabled={isChecking}
                className="h-7 text-xs"
              >
                <RefreshCw
                  className={`h-3 w-3 mr-1.5 ${isChecking ? "animate-spin" : ""}`}
                />
                {isChecking ? "Checking..." : "Check for Updates"}
              </Button>
            </div>

            {/* Update Status */}
            {updateInfo && (
              <div className="rounded-md border p-3 space-y-2">
                {updateInfo.error ? (
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium">Could not check for updates</p>
                      <p className="text-muted-foreground">{updateInfo.error}</p>
                    </div>
                  </div>
                ) : updateInfo.updateAvailable ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-amber-600">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="text-xs">
                        <p className="font-medium">Update available!</p>
                        <p className="text-muted-foreground">
                          Version {updateInfo.latestVersion} is available
                          (you have v{updateInfo.currentVersion})
                        </p>
                      </div>
                    </div>
                    {updateInfo.releaseUrl && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={openReleaseUrl}
                        className="h-7 text-xs w-full"
                      >
                        <ExternalLink className="h-3 w-3 mr-1.5" />
                        Download Update
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium">You're up to date!</p>
                      <p className="text-muted-foreground">
                        Version {updateInfo.currentVersion} is the latest
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Footer Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Built with Tauri, React, and TypeScript</p>
            <p>Database: SQLite (local storage)</p>
            <p className="pt-1">
              &copy; {new Date().getFullYear()} Pet Behaviour Services
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
