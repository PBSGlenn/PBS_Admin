// PBS Admin - Email Template Manager
// UI for managing email templates in the application

import { useState, useEffect } from "react";
import {
  getAllTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  resetToDefaultTemplate,
  EMAIL_TEMPLATES,
  type EmailTemplate
} from "@/lib/emailTemplates";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Plus, Edit, Trash2, RotateCcw, Save, X, Copy } from "lucide-react";
import { toast } from "sonner";

export function EmailTemplateManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    setTemplates(getAllTemplates());
  };

  const handleNewTemplate = () => {
    const newTemplate: EmailTemplate = {
      id: `custom_${Date.now()}`,
      name: 'New Template',
      subject: 'Subject here',
      body: 'Dear {{clientFirstName}},\n\n\n\nBest regards,\nPet Behaviour Services',
      variables: ['clientFirstName'],
      description: 'New custom email template'
    };
    setEditingTemplate(newTemplate);
    setIsEditDialogOpen(true);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate({ ...template });
    setIsEditDialogOpen(true);
  };

  const handleDuplicateTemplate = (template: EmailTemplate) => {
    const duplicated: EmailTemplate = {
      ...template,
      id: `custom_${Date.now()}`,
      name: `${template.name} (Copy)`,
      description: `Copy of ${template.description}`
    };
    setEditingTemplate(duplicated);
    setIsEditDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;

    saveCustomTemplate(editingTemplate);
    loadTemplates();
    setIsEditDialogOpen(false);
    setEditingTemplate(null);
    toast.success(`Template "${editingTemplate.name}" saved successfully`);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteCustomTemplate(templateId);
      loadTemplates();
      toast.success("Template deleted successfully");
    }
  };

  const handleResetTemplate = (templateId: string) => {
    const defaultTemplate = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (!defaultTemplate) {
      toast.error("This is not a default template");
      return;
    }

    if (confirm("Reset this template to its default version? Any customizations will be lost.")) {
      resetToDefaultTemplate(templateId);
      loadTemplates();
      toast.success("Template reset to default");
    }
  };

  const isDefaultTemplate = (templateId: string): boolean => {
    return EMAIL_TEMPLATES.some(t => t.id === templateId);
  };

  const isCustomized = (template: EmailTemplate): boolean => {
    const defaultTemplate = EMAIL_TEMPLATES.find(t => t.id === template.id);
    if (!defaultTemplate) return false;
    return template.subject !== defaultTemplate.subject || template.body !== defaultTemplate.body;
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full">
      {/* Template List */}
      <div className="w-1/3 border-r border-border bg-muted/10">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Email Templates</h2>
            <Button
              size="sm"
              onClick={handleNewTemplate}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              New
            </Button>
          </div>
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        <div className="overflow-y-auto" style={{ height: 'calc(100% - 120px)' }}>
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              className={`p-3 border-b border-border hover:bg-muted cursor-pointer ${
                selectedTemplate?.id === template.id ? 'bg-muted' : ''
              }`}
              onClick={() => setSelectedTemplate(template)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-xs">{template.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {template.description}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!isDefaultTemplate(template.id) && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">
                      Custom
                    </Badge>
                  )}
                  {isCustomized(template) && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      Modified
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Template Preview/Editor */}
      <div className="flex-1 p-4">
        {selectedTemplate ? (
          <div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedTemplate.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedTemplate.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicateTemplate(selectedTemplate)}
                  className="h-8 text-xs"
                >
                  <Copy className="h-3 w-3 mr-1.5" />
                  Duplicate
                </Button>
                {isCustomized(selectedTemplate) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResetTemplate(selectedTemplate.id)}
                    className="h-8 text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1.5" />
                    Reset
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditTemplate(selectedTemplate)}
                  className="h-8 text-xs"
                >
                  <Edit className="h-3 w-3 mr-1.5" />
                  Edit
                </Button>
                {!isDefaultTemplate(selectedTemplate.id) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                    className="h-8 text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1.5" />
                    Delete
                  </Button>
                )}
              </div>
            </div>

            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="variables">Variables</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Subject</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs font-mono bg-muted p-2 rounded">
                      {selectedTemplate.subject}
                    </div>
                  </CardContent>
                </Card>

                <Card className="mt-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Body</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs font-mono bg-muted p-3 rounded whitespace-pre-wrap">
                      {selectedTemplate.body}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="variables" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Available Variables</CardTitle>
                    <CardDescription className="text-xs">
                      Use these variables in your template. They will be replaced with actual values when sending.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{"{{clientFirstName}}"}</code>
                        <span className="ml-2 text-muted-foreground">Client's first name</span>
                      </div>
                      <div className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{"{{clientLastName}}"}</code>
                        <span className="ml-2 text-muted-foreground">Client's last name</span>
                      </div>
                      <div className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{"{{clientEmail}}"}</code>
                        <span className="ml-2 text-muted-foreground">Client's email</span>
                      </div>
                      <div className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{"{{petName}}"}</code>
                        <span className="ml-2 text-muted-foreground">Pet's name</span>
                      </div>
                      <div className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{"{{petSpecies}}"}</code>
                        <span className="ml-2 text-muted-foreground">Dog or Cat</span>
                      </div>
                      <div className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{"{{consultationDate}}"}</code>
                        <span className="ml-2 text-muted-foreground">Consultation date</span>
                      </div>
                      <div className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{"{{formUrl}}"}</code>
                        <span className="ml-2 text-muted-foreground">Jotform URL</span>
                      </div>
                      <div className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{"{{formType}}"}</code>
                        <span className="ml-2 text-muted-foreground">Dog or Cat</span>
                      </div>
                      <div className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{"{{currentDate}}"}</code>
                        <span className="ml-2 text-muted-foreground">Today's date</span>
                      </div>
                      <div className="text-xs">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{"{{dueDate}}"}</code>
                        <span className="ml-2 text-muted-foreground">Task due date</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Select a template to preview</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewTemplate}
                className="mt-4 h-8 text-xs"
              >
                <Plus className="h-3 w-3 mr-1.5" />
                Create New Template
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate?.id.startsWith('custom_') ? 'New Template' : 'Edit Template'}
            </DialogTitle>
            <DialogDescription>
              Create or modify the email template. Use variables like {"{{clientFirstName}}"} for dynamic content.
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name" className="text-xs">
                    Template Name
                  </Label>
                  <Input
                    id="template-name"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      name: e.target.value
                    })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-id" className="text-xs">
                    Template ID
                  </Label>
                  <Input
                    id="template-id"
                    value={editingTemplate.id}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      id: e.target.value
                    })}
                    className="h-8 text-xs"
                    disabled={!editingTemplate.id.startsWith('custom_')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-description" className="text-xs">
                  Description
                </Label>
                <Input
                  id="template-description"
                  value={editingTemplate.description}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    description: e.target.value
                  })}
                  className="h-8 text-xs"
                  placeholder="Brief description of this template"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-subject" className="text-xs">
                  Subject
                </Label>
                <Input
                  id="template-subject"
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    subject: e.target.value
                  })}
                  className="h-8 text-xs"
                  placeholder="Email subject line"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-body" className="text-xs">
                  Body
                </Label>
                <Textarea
                  id="template-body"
                  value={editingTemplate.body}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    body: e.target.value
                  })}
                  className="min-h-[300px] text-xs font-mono"
                  placeholder="Email body content"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">
                  Used Variables
                </Label>
                <div className="text-xs text-muted-foreground">
                  Variables found in template: {
                    [...new Set([
                      ...Array.from(editingTemplate.subject.matchAll(/\{\{(\w+)\}\}/g), m => m[1]),
                      ...Array.from(editingTemplate.body.matchAll(/\{\{(\w+)\}\}/g), m => m[1])
                    ])].join(', ') || 'None'
                  }
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingTemplate(null);
              }}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTemplate}
              className="h-8 text-xs"
            >
              <Save className="h-3 w-3 mr-1.5" />
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}