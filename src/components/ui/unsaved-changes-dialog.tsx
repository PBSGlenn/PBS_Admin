// Unsaved Changes Dialog Component
// Shows a warning when user attempts to navigate away with unsaved changes

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { AlertTriangle } from "lucide-react";

interface UnsavedChangesDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when user cancels (stays on form) */
  onCancel: () => void;
  /** Called when user confirms discard */
  onConfirm: () => void;
  /** Custom title (optional) */
  title?: string;
  /** Custom description (optional) */
  description?: string;
  /** Custom cancel button text (optional) */
  cancelText?: string;
  /** Custom confirm button text (optional) */
  confirmText?: string;
}

export function UnsavedChangesDialog({
  isOpen,
  onCancel,
  onConfirm,
  title = "Unsaved Changes",
  description = "You have unsaved changes that will be lost if you leave this page. Are you sure you want to continue?",
  cancelText = "Keep Editing",
  confirmText = "Discard Changes",
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
