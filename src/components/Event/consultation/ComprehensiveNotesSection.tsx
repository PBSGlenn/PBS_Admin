// PBS Admin - Comprehensive Notes Section
// Handles comprehensive clinical report generation (DOCX output)

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, FileOutput, FileCheck, ExternalLink } from "lucide-react";
import { ContextFileSelector } from "./ContextFileSelector";
import type { ContextFile } from "./types";

interface ComprehensiveNotesSectionProps {
  selectedFilePath: string;
  contextFiles: ContextFile[];
  onToggleContextFile: (path: string) => void;
  hasPets: boolean;
  clientFolderPath: string | undefined;
  // Generation state
  showOptions: boolean;
  onShowOptionsChange: (show: boolean) => void;
  hasGenerated: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  // Generated file info
  generatedDocxName: string | null;
  onOpenDocx: () => void;
}

export const ComprehensiveNotesSection = React.memo(function ComprehensiveNotesSection({
  selectedFilePath,
  contextFiles,
  onToggleContextFile,
  hasPets,
  clientFolderPath,
  showOptions,
  onShowOptionsChange,
  hasGenerated,
  isGenerating,
  onGenerate,
  generatedDocxName,
  onOpenDocx,
}: ComprehensiveNotesSectionProps) {
  return (
    <Card className="p-3">
      <h4 className="text-xs font-semibold mb-2">
        COMPREHENSIVE CLINICAL NOTES
      </h4>

      {/* Success state - show generated file with open button */}
      {hasGenerated && generatedDocxName && !showOptions && (
        <div className="space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <FileCheck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-green-800 font-medium">
                  Report generated successfully
                </p>
                <p className="text-[10px] text-green-700 mt-1 break-all">
                  {generatedDocxName}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onOpenDocx}
              className="h-7 text-xs flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <ExternalLink className="h-3 w-3 mr-1.5" />
              Open Document
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShowOptionsChange(true)}
              className="h-7 text-xs"
            >
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {/* Initial state - show button to expand */}
      {!showOptions && !hasGenerated && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onShowOptionsChange(true)}
          disabled={!hasPets || !clientFolderPath}
          className="h-8 text-xs w-full"
        >
          <FileOutput className="h-3 w-3 mr-1.5" />
          Generate Comprehensive Report (DOCX)
        </Button>
      )}

      {/* Expanded state - show file selection and generate button */}
      {showOptions && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground">
            Generate a detailed clinical report (3-5 pages) and save as DOCX in
            the client folder.
          </p>

          <ContextFileSelector
            contextFiles={contextFiles}
            selectedTranscriptPath={selectedFilePath}
            onToggle={onToggleContextFile}
          />

          <Button
            size="sm"
            onClick={onGenerate}
            disabled={
              isGenerating ||
              !selectedFilePath ||
              !hasPets ||
              !clientFolderPath
            }
            className="h-8 text-xs w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileOutput className="h-3 w-3 mr-1.5" />
                Generate Comprehensive Report (DOCX)
              </>
            )}
          </Button>
        </div>
      )}

      {!hasPets && (
        <p className="text-[10px] text-amber-600 mt-2">
          ⚠ No pets found for this client - add a pet first
        </p>
      )}

      {!clientFolderPath && (
        <p className="text-[10px] text-amber-600 mt-2">
          ⚠ Client folder required - create folder first
        </p>
      )}
    </Card>
  );
});
