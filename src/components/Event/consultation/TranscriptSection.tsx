// PBS Admin - Transcript Section
// Handles transcript paste/save/replace and file selection

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileCheck, Loader2, FileText } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface TranscriptSectionProps {
  isEditing: boolean;
  transcriptText: string;
  onTranscriptTextChange: (text: string) => void;
  onSaveTranscript: () => void;
  onReplaceTranscript: () => void;
  isSaving: boolean;
  savedFileName: string | null;
  hasTranscriptFilePath: boolean;
  eventId: number | undefined;
  clientFolderPath: string | undefined;
  // File selector
  txtFiles: Array<{ name: string; path: string }>;
  selectedFilePath: string;
  onSelectedFilePathChange: (path: string) => void;
  // Confirm dialog
  isReplaceConfirmOpen: boolean;
  onReplaceConfirmOpenChange: (open: boolean) => void;
  onConfirmReplace: () => void;
}

export const TranscriptSection = React.memo(function TranscriptSection({
  isEditing,
  transcriptText,
  onTranscriptTextChange,
  onSaveTranscript,
  onReplaceTranscript,
  isSaving,
  savedFileName,
  hasTranscriptFilePath,
  eventId,
  clientFolderPath,
  txtFiles,
  selectedFilePath,
  onSelectedFilePathChange,
  isReplaceConfirmOpen,
  onReplaceConfirmOpenChange,
  onConfirmReplace,
}: TranscriptSectionProps) {
  return (
    <>
      <Card className="p-3">
        <h4 className="text-xs font-semibold mb-2">TRANSCRIPT</h4>

        {isEditing ? (
          // Editing mode - show textarea
          <div className="space-y-2">
            <Label htmlFor="transcript" className="text-[10px]">
              Paste Transcript
            </Label>
            <Textarea
              id="transcript"
              value={transcriptText}
              onChange={(e) => onTranscriptTextChange(e.target.value)}
              placeholder="Paste consultation transcript here..."
              className="min-h-[200px] text-[11px] font-mono"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {transcriptText.length} characters
              </span>
              <Button
                size="sm"
                onClick={onSaveTranscript}
                disabled={
                  !transcriptText ||
                  transcriptText.trim().length < 10 ||
                  isSaving ||
                  !eventId ||
                  !clientFolderPath
                }
                className="h-7 text-xs"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FileCheck className="h-3 w-3 mr-1" />
                    Save Transcript
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // Confirmation mode - show saved message and file selector
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex items-start gap-2">
                <FileCheck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-green-800 font-medium">
                    Transcript saved
                  </p>
                  <p className="text-[10px] text-green-700 mt-1 break-all">
                    {savedFileName}
                  </p>
                </div>
              </div>
            </div>

            {/* Transcript file selector dropdown */}
            <div className="space-y-1">
              <Label className="text-[10px]">
                Transcript Files in Folder
              </Label>
              <Select
                value={selectedFilePath}
                onValueChange={onSelectedFilePathChange}
                disabled={txtFiles.length === 0}
              >
                <SelectTrigger className="h-8 text-[11px]">
                  <SelectValue
                    placeholder={
                      txtFiles.length === 0
                        ? "No txt files found"
                        : "Select a transcript file"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {txtFiles.length === 0 ? (
                    <SelectItem
                      value="none"
                      disabled
                      className="text-[11px] text-muted-foreground"
                    >
                      No txt files found
                    </SelectItem>
                  ) : (
                    txtFiles.map((file) => (
                      <SelectItem
                        key={file.path}
                        value={file.path}
                        className="text-[11px]"
                      >
                        {file.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onReplaceTranscript}
              className="h-7 text-xs w-full"
            >
              <FileText className="h-3 w-3 mr-1" />
              Replace Transcript
            </Button>
          </div>
        )}
      </Card>

      {/* Replace Transcript Confirm Dialog */}
      <ConfirmDialog
        open={isReplaceConfirmOpen}
        onOpenChange={onReplaceConfirmOpenChange}
        title="Replace Transcript"
        description="Are you sure you want to replace the existing transcript file? This will overwrite the previous version."
        confirmText="Replace"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={onConfirmReplace}
      />
    </>
  );
});
