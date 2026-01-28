// PBS Admin - AI Prompt Template Manager
// Manage and edit system prompts for report generation

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  FileText,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  Save,
  X,
  Cpu,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllPromptTemplates,
  getPromptTemplate,
  saveCustomPromptTemplate,
  resetToDefaultPromptTemplate,
  isTemplateCustomized,
  getDefaultPromptTemplate,
  type PromptTemplate
} from "@/lib/prompts/promptTemplates";

export interface PromptTemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Current AI model configuration
const AI_MODEL = {
  provider: "Anthropic",
  name: "Claude Opus 4.5",
  modelId: "claude-opus-4-5-20251101",
  releaseDate: "November 2025"
};

export function PromptTemplateManager({ isOpen, onClose }: PromptTemplateManagerProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editedTemplate, setEditedTemplate] = useState<PromptTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  // Load templates on mount and when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = () => {
    const allTemplates = getAllPromptTemplates();
    setTemplates(allTemplates);

    // Select first template if none selected
    if (!selectedTemplateId && allTemplates.length > 0) {
      setSelectedTemplateId(allTemplates[0].id);
      setEditedTemplate({ ...allTemplates[0] });
    }
  };

  // Load selected template
  useEffect(() => {
    if (selectedTemplateId) {
      const template = getPromptTemplate(selectedTemplateId);
      if (template) {
        setEditedTemplate({ ...template });
        setHasChanges(false);
      }
    }
  }, [selectedTemplateId]);

  // Filter templates by search query
  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTemplate = editedTemplate;
  const isCustomized = selectedTemplateId ? isTemplateCustomized(selectedTemplateId) : false;

  const handleCopyPrompt = async () => {
    if (!selectedTemplate) return;

    try {
      await navigator.clipboard.writeText(selectedTemplate.systemPrompt);
      setCopied(true);
      toast.success("Prompt copied to clipboard!");

      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleSaveChanges = () => {
    if (!editedTemplate) return;

    try {
      saveCustomPromptTemplate(editedTemplate);
      toast.success(`Saved changes to "${editedTemplate.name}"`);
      loadTemplates();
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error("Failed to save template");
    }
  };

  const handleRestoreDefault = () => {
    if (!selectedTemplateId) return;

    const defaultTemplate = getDefaultPromptTemplate(selectedTemplateId);
    if (!defaultTemplate) {
      toast.error("No default template found");
      return;
    }

    setIsRestoreConfirmOpen(true);
  };

  const confirmRestoreDefault = () => {
    if (!selectedTemplateId) return;

    const defaultTemplate = getDefaultPromptTemplate(selectedTemplateId);
    if (defaultTemplate) {
      resetToDefaultPromptTemplate(selectedTemplateId);
      toast.success(`Restored "${defaultTemplate.name}" to default`);
      loadTemplates();

      // Reload the template
      setEditedTemplate({ ...defaultTemplate });
      setHasChanges(false);
    }
    setIsRestoreConfirmOpen(false);
  };

  const handleFieldChange = (field: keyof PromptTemplate, value: any) => {
    if (!editedTemplate) return;

    setEditedTemplate({
      ...editedTemplate,
      [field]: value
    });
    setHasChanges(true);
  };

  const handleCancel = () => {
    if (hasChanges) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const confirmClose = () => {
    setHasChanges(false);
    setIsCloseConfirmOpen(false);
    onClose();
  };

  const handleCheckForUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus(null);

    try {
      // Open Anthropic's models page in a new browser window
      window.open("https://docs.anthropic.com/en/docs/about-claude/models", "_blank");

      setUpdateStatus("Opened Anthropic models documentation. Check for newer model versions.");
      toast.info("Check the Anthropic docs for the latest model versions");
    } catch (error) {
      console.error("Failed to check for updates:", error);
      setUpdateStatus("Failed to open documentation");
      toast.error("Failed to open Anthropic documentation");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI Prompt Templates
          </DialogTitle>
          <DialogDescription>
            Manage system prompts for AI report generation. Copy prompts to edit in Claude Chat, then paste back here.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Left Pane - Template List */}
          <div className="w-80 flex flex-col gap-3">
            {/* AI Model Info Card */}
            <Card className="p-3 bg-muted/50">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold">AI Model</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider:</span>
                    <span className="font-medium">{AI_MODEL.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model:</span>
                    <span className="font-medium">{AI_MODEL.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID:</span>
                    <code className="text-[10px] bg-background px-1 py-0.5 rounded">{AI_MODEL.modelId}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Release:</span>
                    <span className="font-medium">{AI_MODEL.releaseDate}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCheckForUpdate}
                  disabled={isCheckingUpdate}
                  className="w-full h-7 text-xs mt-2"
                >
                  {isCheckingUpdate ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-3 w-3 mr-1.5" />
                      Check for Updates
                    </>
                  )}
                </Button>
                {updateStatus && (
                  <p className="text-[10px] text-muted-foreground mt-1">{updateStatus}</p>
                )}
              </div>
            </Card>

            {/* Search */}
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs"
            />

            {/* Template List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                    selectedTemplateId === template.id ? 'border-primary bg-accent' : ''
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold">{template.name}</h3>
                      {isTemplateCustomized(template.id) && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                    {template.category && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-1">
                        {template.category}
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Right Pane - Template Editor */}
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {selectedTemplate ? (
              <>
                {/* Template Metadata */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Name</Label>
                      <Input
                        value={selectedTemplate.name}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Category</Label>
                      <Input
                        value={selectedTemplate.category || ''}
                        onChange={(e) => handleFieldChange('category', e.target.value)}
                        className="h-8 text-xs"
                        placeholder="e.g., Clinical Reports"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Description</Label>
                    <Input
                      value={selectedTemplate.description}
                      onChange={(e) => handleFieldChange('description', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Output Format</Label>
                      <select
                        value={selectedTemplate.outputFormat}
                        onChange={(e) => handleFieldChange('outputFormat', e.target.value as 'markdown' | 'html')}
                        className="w-full h-8 text-xs rounded-md border border-input bg-background px-3"
                      >
                        <option value="markdown">Markdown</option>
                        <option value="html">HTML</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Max Tokens</Label>
                      <Input
                        type="number"
                        value={selectedTemplate.maxTokens}
                        onChange={(e) => handleFieldChange('maxTokens', parseInt(e.target.value))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Status Indicators */}
                  <div className="flex items-center gap-2">
                    {isCustomized && (
                      <Badge variant="secondary" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Customized
                      </Badge>
                    )}
                    {hasChanges && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                        Unsaved Changes
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Tabs for Prompt and Variables */}
                <Tabs defaultValue="prompt" className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="prompt" className="text-xs">System Prompt</TabsTrigger>
                    <TabsTrigger value="variables" className="text-xs">Variables</TabsTrigger>
                  </TabsList>

                  <TabsContent value="prompt" className="flex-1 overflow-hidden mt-3">
                    <div className="h-full flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">
                          System Prompt ({selectedTemplate.systemPrompt.length} characters)
                        </Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCopyPrompt}
                          className="h-7 text-xs"
                        >
                          {copied ? (
                            <>
                              <Check className="h-3 w-3 mr-1.5" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 mr-1.5" />
                              Copy Prompt
                            </>
                          )}
                        </Button>
                      </div>
                      <Textarea
                        value={selectedTemplate.systemPrompt}
                        onChange={(e) => handleFieldChange('systemPrompt', e.target.value)}
                        className="flex-1 text-xs font-mono resize-none"
                        placeholder="Enter system prompt..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Copy this prompt to Claude Chat for editing, then paste the updated version back here.
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="variables" className="flex-1 overflow-hidden mt-3">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-semibold">Available Variables</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          These variables will be replaced with actual values when generating reports:
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedTemplate.variables.map((variable) => (
                          <div
                            key={variable}
                            className="p-2 rounded-md bg-muted border border-border"
                          >
                            <code className="text-xs font-mono text-primary">
                              {`{{${variable}}}`}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex gap-2">
                    {isCustomized && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRestoreDefault}
                        className="h-8 text-xs"
                      >
                        <RotateCcw className="h-3 w-3 mr-1.5" />
                        Restore Default
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                      className="h-8 text-xs"
                    >
                      <X className="h-3 w-3 mr-1.5" />
                      Close
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveChanges}
                      disabled={!hasChanges}
                      className="h-8 text-xs"
                    >
                      <Save className="h-3 w-3 mr-1.5" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Select a template to edit</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Restore Default Confirmation */}
      <ConfirmDialog
        open={isRestoreConfirmOpen}
        onOpenChange={setIsRestoreConfirmOpen}
        title="Restore Default"
        description={`Restore "${editedTemplate?.name}" to default? This will discard all your changes.`}
        confirmText="Restore"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmRestoreDefault}
      />

      {/* Close with Unsaved Changes Confirmation */}
      <ConfirmDialog
        open={isCloseConfirmOpen}
        onOpenChange={setIsCloseConfirmOpen}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to close?"
        confirmText="Close Without Saving"
        cancelText="Keep Editing"
        variant="destructive"
        onConfirm={confirmClose}
      />
    </Dialog>
  );
}
