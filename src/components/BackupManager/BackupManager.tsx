// PBS Admin - Backup Manager Component
// UI for database backup and restore operations with scheduled backups

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Database,
  Download,
  Upload,
  Trash2,
  FolderOpen,
  Loader2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import {
  createBackupWithTracking,
  restoreBackup,
  listBackups,
  deleteBackup,
  getBackupsPath,
  getBackupSettings,
  saveBackupSettings,
  restartScheduledBackups,
  formatFileSize,
  type BackupInfo,
  type BackupSettings,
} from "@/lib/services/backupService";
import { format, formatDistanceToNow, parseISO } from "date-fns";

export interface BackupManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BackupManager({ isOpen, onClose }: BackupManagerProps) {
  const queryClient = useQueryClient();
  const [backupsPath, setBackupsPath] = useState<string>("");
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupInfo | null>(null);

  // Scheduled backup settings state
  const [settings, setSettings] = useState<BackupSettings>(getBackupSettings());
  const [hasSettingsChanges, setHasSettingsChanges] = useState(false);

  // Fetch backups path and settings on mount
  useEffect(() => {
    if (isOpen) {
      getBackupsPath().then(setBackupsPath);
      setSettings(getBackupSettings());
      setHasSettingsChanges(false);
    }
  }, [isOpen]);

  // Handle settings change
  const handleSettingChange = <K extends keyof BackupSettings>(
    key: K,
    value: BackupSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasSettingsChanges(true);
  };

  // Save settings
  const handleSaveSettings = () => {
    saveBackupSettings(settings);
    restartScheduledBackups();
    setHasSettingsChanges(false);
    toast.success("Backup settings saved");
  };

  // Query for backup list
  const {
    data: backups = [],
    isLoading: isLoadingBackups,
    refetch: refetchBackups,
  } = useQuery({
    queryKey: ["backups"],
    queryFn: listBackups,
    enabled: isOpen,
  });

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: createBackupWithTracking,
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Backup created successfully", {
          description: result.fileName,
        });
        refetchBackups();
        // Refresh settings to show new last backup date
        setSettings(getBackupSettings());
      } else {
        toast.error("Backup failed", {
          description: result.error,
        });
      }
    },
    onError: (error) => {
      toast.error("Backup failed", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: (backupPath: string) => restoreBackup(backupPath),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Database restored", {
          description: "Please restart the application for changes to take effect.",
          duration: 10000,
        });
        // Invalidate all queries to force refresh
        queryClient.invalidateQueries();
      } else {
        toast.error("Restore failed", {
          description: result.error,
        });
      }
      setRestoreTarget(null);
    },
    onError: (error) => {
      toast.error("Restore failed", {
        description: error instanceof Error ? error.message : String(error),
      });
      setRestoreTarget(null);
    },
  });

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: (backupPath: string) => deleteBackup(backupPath),
    onSuccess: (success) => {
      if (success) {
        toast.success("Backup deleted");
        refetchBackups();
      } else {
        toast.error("Failed to delete backup");
      }
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error("Delete failed", {
        description: error instanceof Error ? error.message : String(error),
      });
      setDeleteTarget(null);
    },
  });

  // Open backups folder
  const handleOpenBackupsFolder = async () => {
    try {
      await invoke("plugin:opener|open_path", { path: backupsPath });
    } catch (error) {
      toast.error("Failed to open folder");
    }
  };

  // Calculate total backup size
  const totalSize = backups.reduce((sum, b) => sum + b.sizeBytes, 0);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Backup & Restore
            </DialogTitle>
            <DialogDescription>
              Create backups of your database and restore from previous backups if needed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Scheduled Backups Settings */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4" />
                <h3 className="text-sm font-semibold">Scheduled Backups</h3>
              </div>
              <div className="grid gap-3">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Automatic Backups</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Automatically backup your database
                    </p>
                  </div>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(checked) =>
                      handleSettingChange("enabled", checked)
                    }
                  />
                </div>

                {/* Frequency */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Frequency</Label>
                    <p className="text-[10px] text-muted-foreground">
                      How often to create backups
                    </p>
                  </div>
                  <Select
                    value={settings.frequency}
                    onValueChange={(value: BackupSettings["frequency"]) =>
                      handleSettingChange("frequency", value)
                    }
                    disabled={!settings.enabled}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Retention */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Keep Backups</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Number of backups to retain
                    </p>
                  </div>
                  <Select
                    value={settings.retentionCount.toString()}
                    onValueChange={(value) =>
                      handleSettingChange("retentionCount", parseInt(value, 10))
                    }
                  >
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">Last 3</SelectItem>
                      <SelectItem value="5">Last 5</SelectItem>
                      <SelectItem value="7">Last 7</SelectItem>
                      <SelectItem value="14">Last 14</SelectItem>
                      <SelectItem value="30">Last 30</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Save button and last backup info */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-[10px] text-muted-foreground">
                    {settings.lastBackupDate ? (
                      <>
                        Last backup:{" "}
                        {formatDistanceToNow(parseISO(settings.lastBackupDate), {
                          addSuffix: true,
                        })}
                      </>
                    ) : (
                      "No backups yet"
                    )}
                  </div>
                  {hasSettingsChanges && (
                    <Button
                      size="sm"
                      onClick={handleSaveSettings}
                      className="h-6 text-[10px]"
                    >
                      Save Settings
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Manual Backup Card */}
            <Card className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">Manual Backup</h3>
                  <p className="text-xs text-muted-foreground">
                    Create a backup now • {backups.length} backup{backups.length !== 1 ? "s" : ""} • {formatFileSize(totalSize)}
                  </p>
                </div>
                <Button
                  onClick={() => createBackupMutation.mutate()}
                  disabled={createBackupMutation.isPending}
                  className="h-9"
                >
                  {createBackupMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Backup Now
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Backups List */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Available Backups</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchBackups()}
                    disabled={isLoadingBackups}
                    className="h-7 text-xs"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenBackupsFolder}
                    className="h-7 text-xs"
                  >
                    <FolderOpen className="h-3 w-3 mr-1" />
                    Open Folder
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto border rounded-md">
                {isLoadingBackups ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : backups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Database className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No backups found</p>
                    <p className="text-xs">Create your first backup above</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Backup File</TableHead>
                        <TableHead className="text-xs">Created</TableHead>
                        <TableHead className="text-xs text-right">Size</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backups.map((backup) => (
                        <TableRow key={backup.filePath}>
                          <TableCell className="text-xs font-mono">
                            {backup.fileName}
                          </TableCell>
                          <TableCell className="text-xs">
                            {backup.createdAt}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {formatFileSize(backup.sizeBytes)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRestoreTarget(backup)}
                                className="h-6 text-[10px] px-2"
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Restore
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(backup)}
                                className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            {/* Info Footer */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Backups folder:</strong>{" "}
                <code className="bg-muted px-1 py-0.5 rounded">{backupsPath}</code>
              </p>
              <p className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                Restoring a backup will overwrite your current database. The app must be restarted after restore.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreTarget} onOpenChange={() => setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Restore Database?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will replace your current database with the backup from:
              </p>
              <p className="font-mono text-xs bg-muted p-2 rounded">
                {restoreTarget?.fileName}
              </p>
              <p className="text-amber-600 font-medium">
                All data added since this backup was created will be lost.
              </p>
              <p>
                The application will need to be restarted after restore.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreBackupMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreTarget && restoreBackupMutation.mutate(restoreTarget.filePath)}
              disabled={restoreBackupMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {restoreBackupMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Restore Database
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              <p>Are you sure you want to delete this backup?</p>
              <p className="font-mono text-xs bg-muted p-2 rounded mt-2">
                {deleteTarget?.fileName}
              </p>
              <p className="mt-2">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteBackupMutation.mutate(deleteTarget.filePath)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
