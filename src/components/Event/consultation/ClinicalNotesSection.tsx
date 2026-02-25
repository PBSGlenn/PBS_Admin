// PBS Admin - Clinical Notes Section
// Handles abridged clinical notes generation from transcript

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { ContextFileSelector } from "./ContextFileSelector";
import type { ContextFile } from "./types";

interface ClinicalNotesSectionProps {
  selectedFilePath: string;
  contextFiles: ContextFile[];
  onToggleContextFile: (path: string) => void;
  hasPets: boolean;
  // Generation state
  showOptions: boolean;
  onShowOptionsChange: (show: boolean) => void;
  hasGenerated: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
}

export const ClinicalNotesSection = React.memo(function ClinicalNotesSection({
  selectedFilePath,
  contextFiles,
  onToggleContextFile,
  hasPets,
  showOptions,
  onShowOptionsChange,
  hasGenerated,
  isGenerating,
  onGenerate,
}: ClinicalNotesSectionProps) {
  return (
    <Card className="p-3">
      <h4 className="text-xs font-semibold mb-2">CLINICAL NOTES</h4>

      {!showOptions ? (
        // Collapsed state - show button to expand
        <Button
          variant="outline"
          size="sm"
          onClick={() => onShowOptionsChange(true)}
          disabled={!hasPets}
          className="h-8 text-xs w-full"
        >
          <Sparkles className="h-3 w-3 mr-1.5" />
          {hasGenerated
            ? "Regenerate Clinical Notes"
            : "Generate Clinical Notes from Transcript"}
        </Button>
      ) : (
        // Expanded state - show file selection and generate button
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground">
            Generate clinical notes from the transcript using AI.
          </p>

          <ContextFileSelector
            contextFiles={contextFiles}
            selectedTranscriptPath={selectedFilePath}
            onToggle={onToggleContextFile}
          />

          <Button
            size="sm"
            onClick={onGenerate}
            disabled={isGenerating || !selectedFilePath || !hasPets}
            className="h-8 text-xs w-full bg-violet-600 hover:bg-violet-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Generating Clinical Notes...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1.5" />
                Generate Clinical Notes
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
    </Card>
  );
});
