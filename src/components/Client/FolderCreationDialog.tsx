// PBS Admin - Folder Creation Dialog
// Prompts user to create a folder for the client

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Folder, FolderPlus } from "lucide-react";

export interface FolderCreationDialogProps {
  open: boolean;
  clientId: number;
  surname: string;
  defaultBasePath: string;
  onConfirm: (createFolder: boolean, customPath?: string) => void;
  onCancel: () => void;
}

export function FolderCreationDialog({
  open,
  clientId,
  surname,
  defaultBasePath,
  onConfirm,
  onCancel,
}: FolderCreationDialogProps) {
  const defaultFolderName = `${surname.toLowerCase()}_${clientId}`;
  const defaultFullPath = `${defaultBasePath}\\${defaultFolderName}`;

  const [customPath, setCustomPath] = useState(defaultFullPath);
  const [useCustomPath, setUseCustomPath] = useState(false);

  const handleConfirm = () => {
    onConfirm(true, useCustomPath ? customPath : defaultFullPath);
  };

  const handleSkip = () => {
    onConfirm(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Create Client Folder
          </DialogTitle>
          <DialogDescription>
            Would you like to create a folder for this client's records?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Default folder path */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Default Folder Location</Label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <code className="text-sm font-mono">{defaultFullPath}</code>
            </div>
            <p className="text-xs text-muted-foreground">
              Folder name format: <strong>{surname.toLowerCase()}_{clientId}</strong>
            </p>
          </div>

          {/* Custom path option */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useCustomPath"
                checked={useCustomPath}
                onChange={(e) => setUseCustomPath(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="useCustomPath" className="text-sm cursor-pointer">
                Use custom location
              </Label>
            </div>

            {useCustomPath && (
              <Input
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="C:\Custom\Path\client_folder"
                className="font-mono text-sm"
              />
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleSkip}
          >
            Skip for Now
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Create Folder
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
