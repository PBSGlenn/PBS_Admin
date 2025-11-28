// PBS Admin - Questionnaire Selector Component
// Dropdown to select questionnaire JSON file from client folder

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileCheck } from "lucide-react";

export interface QuestionnaireSelectorProps {
  clientFolderPath?: string;
  selectedPath?: string | null;
  onSelect: (filePath: string | null) => void;
}

export function QuestionnaireSelector({
  clientFolderPath,
  selectedPath,
  onSelect
}: QuestionnaireSelectorProps) {

  const [availableFiles, setAvailableFiles] = useState<Array<{ name: string, path: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load available questionnaire files from client folder
  useEffect(() => {
    if (!clientFolderPath) {
      console.log('QuestionnaireSelector: No clientFolderPath provided');
      setAvailableFiles([]);
      return;
    }

    const loadFiles = async () => {
      setIsLoading(true);
      try {
        console.log('QuestionnaireSelector: Loading files from:', clientFolderPath);
        const { listQuestionnaireFiles } = await import('@/lib/services/transcriptFileService');
        const result = await listQuestionnaireFiles(clientFolderPath);
        console.log('QuestionnaireSelector: Result:', result);
        if (result.success && result.files) {
          setAvailableFiles(result.files);
        } else {
          setAvailableFiles([]);
          if (result.error) {
            console.error('QuestionnaireSelector: Error loading files:', result.error);
          }
        }
      } catch (error) {
        console.error('Failed to load questionnaire files:', error);
        setAvailableFiles([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadFiles();
  }, [clientFolderPath]);

  const handleValueChange = (value: string) => {
    if (value === 'none') {
      onSelect(null);
    } else {
      onSelect(value);
    }
  };

  if (!clientFolderPath) {
    return (
      <div className="space-y-1">
        <Label className="text-xs">Questionnaire (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Client folder not created. Cannot select questionnaire.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">Questionnaire (optional)</Label>
      <Select
        value={selectedPath || 'none'}
        onValueChange={handleValueChange}
        disabled={isLoading}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={isLoading ? "Loading..." : "Select questionnaire..."} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none" className="text-xs">
            No questionnaire
          </SelectItem>
          {availableFiles.map((file) => (
            <SelectItem key={file.path} value={file.path} className="text-xs">
              <FileCheck className="h-3 w-3 inline mr-1" />
              {file.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {availableFiles.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground">
          No questionnaire files found in client folder
        </p>
      )}
    </div>
  );
}
