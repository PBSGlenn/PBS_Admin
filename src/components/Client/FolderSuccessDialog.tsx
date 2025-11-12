// PBS Admin - Folder Creation Success Dialog
// Shows success message with option to open the created folder

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { FolderOpen, CheckCircle2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export interface FolderSuccessDialogProps {
  open: boolean;
  folderPath: string;
  onClose: () => void;
}

export function FolderSuccessDialog({ open, folderPath, onClose }: FolderSuccessDialogProps) {
  const handleOpenFolder = async () => {
    try {
      // Use Tauri's opener plugin to open the folder in File Explorer
      // The opener plugin's 'open_path' command will open the path with the system's default handler
      await invoke("plugin:opener|open_path", { path: folderPath });
    } catch (error) {
      console.error("Failed to open folder:", error);
      alert(`Could not open folder: ${error}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">Folder Created Successfully</DialogTitle>
              <DialogDescription className="text-xs mt-1">
                The client folder has been created and linked to this client record.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Folder Path Display */}
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Folder Location</p>
            <p className="text-sm font-mono break-all">{folderPath}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              size="sm"
              className="h-8"
            >
              Close
            </Button>
            <Button
              onClick={handleOpenFolder}
              size="sm"
              className="h-8"
            >
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              Open Folder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
