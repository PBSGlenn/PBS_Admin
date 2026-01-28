// Hook for tracking unsaved changes and warning before navigation
// Provides a dialog-based warning when attempting to leave with unsaved changes

import { useState, useCallback, useEffect } from "react";

interface UseUnsavedChangesOptions {
  /** Initial dirty state */
  initialDirty?: boolean;
  /** Callback to check if form has unsaved changes (optional, uses internal state if not provided) */
  checkDirty?: () => boolean;
}

interface UseUnsavedChangesReturn {
  /** Whether the form has unsaved changes */
  isDirty: boolean;
  /** Set the dirty state */
  setIsDirty: (dirty: boolean) => void;
  /** Mark form as dirty */
  markDirty: () => void;
  /** Mark form as clean (after save) */
  markClean: () => void;
  /** Whether the unsaved changes dialog is open */
  showUnsavedDialog: boolean;
  /** Open the unsaved changes dialog */
  openUnsavedDialog: () => void;
  /** Close the unsaved changes dialog */
  closeUnsavedDialog: () => void;
  /** Pending navigation callback (called when user confirms discard) */
  pendingAction: (() => void) | null;
  /** Set a pending navigation action */
  setPendingAction: (action: (() => void) | null) => void;
  /** Handle navigation attempt - shows dialog if dirty, otherwise executes action */
  handleNavigationAttempt: (action: () => void) => void;
  /** Confirm discard and execute pending action */
  confirmDiscard: () => void;
  /** Cancel discard and stay on form */
  cancelDiscard: () => void;
}

export function useUnsavedChanges(
  options: UseUnsavedChangesOptions = {}
): UseUnsavedChangesReturn {
  const { initialDirty = false, checkDirty } = options;

  const [isDirty, setIsDirty] = useState(initialDirty);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  const openUnsavedDialog = useCallback(() => {
    setShowUnsavedDialog(true);
  }, []);

  const closeUnsavedDialog = useCallback(() => {
    setShowUnsavedDialog(false);
  }, []);

  const handleNavigationAttempt = useCallback((action: () => void) => {
    const currentlyDirty = checkDirty ? checkDirty() : isDirty;

    if (currentlyDirty) {
      setPendingAction(() => action);
      setShowUnsavedDialog(true);
    } else {
      action();
    }
  }, [isDirty, checkDirty]);

  const confirmDiscard = useCallback(() => {
    setShowUnsavedDialog(false);
    setIsDirty(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const cancelDiscard = useCallback(() => {
    setShowUnsavedDialog(false);
    setPendingAction(null);
  }, []);

  // Warn before browser refresh/close if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentlyDirty = checkDirty ? checkDirty() : isDirty;
      if (currentlyDirty) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, checkDirty]);

  return {
    isDirty,
    setIsDirty,
    markDirty,
    markClean,
    showUnsavedDialog,
    openUnsavedDialog,
    closeUnsavedDialog,
    pendingAction,
    setPendingAction,
    handleNavigationAttempt,
    confirmDiscard,
    cancelDiscard,
  };
}
