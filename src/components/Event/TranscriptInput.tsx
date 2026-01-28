// PBS Admin - Transcript Input Component
// File picker + paste area for consultation transcripts

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, Clipboard } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

export interface TranscriptInputProps {
  transcriptSource: 'file' | 'pasted' | null;
  transcriptPasted: string | null;
  transcriptFilePath?: string | null;
  onSourceChange: (source: 'file' | 'pasted') => void;
  onPastedTextChange: (text: string) => void;
  onFileSelect: (filePath: string) => void;
}

export function TranscriptInput({
  transcriptSource,
  transcriptPasted,
  transcriptFilePath,
  onSourceChange,
  onPastedTextChange,
  onFileSelect
}: TranscriptInputProps) {

  const [inputMethod, setInputMethod] = useState<'file' | 'paste'>(
    transcriptSource === 'pasted' ? 'paste' : 'file'
  );

  const handleMethodChange = (value: string) => {
    const method = value as 'file' | 'paste';
    setInputMethod(method);
    if (method === 'paste') {
      onSourceChange('pasted');
    } else {
      onSourceChange('file');
    }
  };

  const handleFileBrowse = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Text Files',
          extensions: ['txt']
        }]
      });

      if (selected && typeof selected === 'string') {
        onFileSelect(selected);
        onSourceChange('file');
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      toast.error("Failed to open file picker", {
        description: "Please try pasting the transcript instead.",
      });
    }
  };

  const handlePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    onPastedTextChange(text);
    if (text.trim()) {
      onSourceChange('pasted');
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Transcript *</Label>

      {/* Input Method Selection */}
      <RadioGroup
        value={inputMethod}
        onValueChange={handleMethodChange}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="file" id="transcript-file" />
          <Label htmlFor="transcript-file" className="text-xs font-normal cursor-pointer">
            <FileText className="h-3 w-3 inline mr-1" />
            Select file
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="paste" id="transcript-paste" />
          <Label htmlFor="transcript-paste" className="text-xs font-normal cursor-pointer">
            <Clipboard className="h-3 w-3 inline mr-1" />
            Paste text
          </Label>
        </div>
      </RadioGroup>

      {/* File Picker */}
      {inputMethod === 'file' && (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFileBrowse}
            className="h-8 text-xs"
          >
            <FileText className="h-3 w-3 mr-1" />
            Browse for .txt file...
          </Button>
          {transcriptFilePath && (
            <p className="text-xs text-muted-foreground">
              Selected: {transcriptFilePath.split('/').pop() || transcriptFilePath.split('\\').pop()}
            </p>
          )}
        </div>
      )}

      {/* Paste Area */}
      {inputMethod === 'paste' && (
        <div className="space-y-1">
          <Textarea
            placeholder="Paste your consultation transcript here..."
            value={transcriptPasted || ''}
            onChange={handlePaste}
            className="min-h-[200px] text-xs font-mono"
          />
          {transcriptPasted && (
            <p className="text-xs text-muted-foreground">
              {transcriptPasted.split(/\s+/).length} words, {transcriptPasted.length} characters
            </p>
          )}
        </div>
      )}
    </div>
  );
}
