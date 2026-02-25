// PBS Admin - Context File Selector
// Reusable file picker for selecting additional context files for AI generation

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, File, FileImage } from "lucide-react";
import type { ContextFile } from "./types";

interface ContextFileSelectorProps {
  contextFiles: ContextFile[];
  selectedTranscriptPath: string;
  onToggle: (path: string) => void;
}

export const ContextFileSelector = React.memo(function ContextFileSelector({
  contextFiles,
  selectedTranscriptPath,
  onToggle,
}: ContextFileSelectorProps) {
  const filteredFiles = contextFiles.filter(
    (file) => file.path !== selectedTranscriptPath
  );

  if (filteredFiles.length === 0) return null;

  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">
        Additional Context Files (optional)
      </Label>
      <div className="mt-1.5 space-y-1 max-h-[120px] overflow-y-auto border rounded-md p-2 bg-muted/30">
        {filteredFiles.map((file) => (
          <label
            key={file.path}
            className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
          >
            <Checkbox
              checked={file.selected}
              onCheckedChange={() => onToggle(file.path)}
              className="h-3.5 w-3.5"
            />
            <span className="flex items-center gap-1.5 text-[10px] truncate flex-1">
              {file.type === "pdf" && (
                <FileImage className="h-3 w-3 text-red-500 flex-shrink-0" />
              )}
              {file.type === "json" && (
                <File className="h-3 w-3 text-yellow-600 flex-shrink-0" />
              )}
              {file.type === "txt" && (
                <FileText className="h-3 w-3 text-blue-500 flex-shrink-0" />
              )}
              {file.type === "docx" && (
                <File className="h-3 w-3 text-blue-700 flex-shrink-0" />
              )}
              <span className="truncate">{file.name}</span>
            </span>
            <span className="text-[9px] text-muted-foreground uppercase flex-shrink-0">
              {file.type}
            </span>
          </label>
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground mt-1">
        {filteredFiles.filter((f) => f.selected).length} file(s) selected
        {" \u2022 "}Questionnaires auto-selected
      </p>
    </div>
  );
});
