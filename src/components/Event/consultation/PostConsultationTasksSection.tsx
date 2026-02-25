// PBS Admin - Post-Consultation Tasks Section
// Handles standard tasks, AI-extracted tasks, and manual task entry

import React, { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, ListTodo, Plus, Trash2, FileCheck } from "lucide-react";
import { toast } from "sonner";
import type { StandardTask, CaseTask, Priority } from "./types";

interface PostConsultationTasksSectionProps {
  eventId: number | undefined;
  // Standard tasks
  standardTasks: StandardTask[];
  onToggleStandardTask: (taskId: string) => void;
  // Case tasks
  caseTasks: CaseTask[];
  onRemoveCaseTask: (taskId: string) => void;
  onAddCaseTask: (task: CaseTask) => void;
  // AI extraction
  isExtractingTasks: boolean;
  onExtractTasks: () => void;
  // Task creation
  showOptions: boolean;
  onShowOptionsChange: (show: boolean) => void;
  hasCreatedTasks: boolean;
  isCreating: boolean;
  onCreateTasks: () => void;
  onResetTasks: () => void;
}

export const PostConsultationTasksSection = React.memo(function PostConsultationTasksSection({
  eventId,
  standardTasks,
  onToggleStandardTask,
  caseTasks,
  onRemoveCaseTask,
  onAddCaseTask,
  isExtractingTasks,
  onExtractTasks,
  showOptions,
  onShowOptionsChange,
  hasCreatedTasks,
  isCreating,
  onCreateTasks,
  onResetTasks,
}: PostConsultationTasksSectionProps) {
  // Manual task entry state (local to this component)
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskOffset, setNewTaskOffset] = useState("1 week");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>(2);

  const handleAddManualTask = () => {
    if (!newTaskDescription.trim()) {
      toast.error("Please enter a task description");
      return;
    }

    onAddCaseTask({
      id: `manual-${Date.now()}`,
      description: newTaskDescription.trim(),
      offset: newTaskOffset,
      priority: newTaskPriority,
      context: "Manually added",
    });
    setNewTaskDescription("");
    setNewTaskOffset("1 week");
    setNewTaskPriority(2);
    setShowAddTaskForm(false);
    toast.success("Task added");
  };

  const totalTasks =
    standardTasks.filter((t) => t.selected).length + caseTasks.length;

  return (
    <Card className="p-3">
      <h4 className="text-xs font-semibold mb-2">POST-CONSULTATION TASKS</h4>

      {/* Success state - tasks created */}
      {hasCreatedTasks && !showOptions && (
        <div className="space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <FileCheck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-green-800 font-medium">
                  Tasks created successfully
                </p>
                <p className="text-[10px] text-green-700 mt-1">
                  Tasks have been added to your task list
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onResetTasks}
            className="h-7 text-xs w-full"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Create More Tasks
          </Button>
        </div>
      )}

      {/* Initial state - show button to expand */}
      {!showOptions && !hasCreatedTasks && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onShowOptionsChange(true)}
          disabled={!eventId}
          className="h-8 text-xs w-full"
        >
          <ListTodo className="h-3 w-3 mr-1.5" />
          Create Post-Consultation Tasks
        </Button>
      )}

      {/* Expanded state - show task selection */}
      {showOptions && (
        <div className="space-y-4">
          {/* Standard Tasks Section */}
          <div>
            <Label className="text-[10px] text-muted-foreground font-semibold">
              Standard Follow-up Tasks
            </Label>
            <p className="text-[9px] text-muted-foreground mb-2">
              Uncheck any tasks you don't want to create
            </p>
            <div className="space-y-1.5 border rounded-md p-2 bg-muted/30">
              {standardTasks.map((task) => (
                <label
                  key={task.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-1"
                >
                  <Checkbox
                    checked={task.selected}
                    onCheckedChange={() => onToggleStandardTask(task.id)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="flex-1 text-[10px]">
                    {task.description}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    +{task.offset}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Case-Specific Tasks Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <Label className="text-[10px] text-muted-foreground font-semibold">
                  Case-Specific Tasks
                </Label>
                <p className="text-[9px] text-muted-foreground">
                  Tasks extracted from the transcript
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onExtractTasks}
                disabled={isExtractingTasks}
                className="h-6 text-[10px] px-2"
              >
                {isExtractingTasks ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1" />
                    {caseTasks.length > 0
                      ? "Re-extract"
                      : "Extract from Transcript"}
                  </>
                )}
              </Button>
            </div>

            {caseTasks.length > 0 ? (
              <div className="space-y-1.5 border rounded-md p-2 bg-blue-50/50">
                {caseTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-2 bg-white rounded px-2 py-1.5 border border-blue-100"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium">
                        {task.description}
                      </p>
                      {task.context && task.context !== "Manually added" && (
                        <p className="text-[9px] text-muted-foreground mt-0.5 italic truncate">
                          "{task.context}"
                        </p>
                      )}
                      {task.context === "Manually added" && (
                        <p className="text-[9px] text-blue-600 mt-0.5">
                          Manual
                        </p>
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                      +{task.offset}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveCaseTask(task.id)}
                      className="h-5 w-5 p-0 hover:bg-red-100 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border rounded-md p-3 bg-muted/20 text-center">
                <p className="text-[10px] text-muted-foreground">
                  Click "Extract from Transcript" or add tasks manually
                </p>
              </div>
            )}

            {/* Manual Task Entry */}
            {!showAddTaskForm ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddTaskForm(true)}
                className="h-6 text-[10px] w-full text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Task Manually
              </Button>
            ) : (
              <div className="border rounded-md p-2 bg-muted/20 space-y-2">
                <div>
                  <Label className="text-[9px] text-muted-foreground">
                    Description
                  </Label>
                  <Textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Enter task description..."
                    className="h-16 text-[10px] resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-[9px] text-muted-foreground">
                      Due
                    </Label>
                    <Select
                      value={newTaskOffset}
                      onValueChange={setNewTaskOffset}
                    >
                      <SelectTrigger className="h-7 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1 day">+1 day</SelectItem>
                        <SelectItem value="2 days">+2 days</SelectItem>
                        <SelectItem value="3 days">+3 days</SelectItem>
                        <SelectItem value="5 days">+5 days</SelectItem>
                        <SelectItem value="1 week">+1 week</SelectItem>
                        <SelectItem value="2 weeks">+2 weeks</SelectItem>
                        <SelectItem value="3 weeks">+3 weeks</SelectItem>
                        <SelectItem value="4 weeks">+4 weeks</SelectItem>
                        <SelectItem value="6 weeks">+6 weeks</SelectItem>
                        <SelectItem value="8 weeks">+8 weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-[9px] text-muted-foreground">
                      Priority
                    </Label>
                    <Select
                      value={String(newTaskPriority)}
                      onValueChange={(v) =>
                        setNewTaskPriority(Number(v) as Priority)
                      }
                    >
                      <SelectTrigger className="h-7 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Highest</SelectItem>
                        <SelectItem value="2">2 - High</SelectItem>
                        <SelectItem value="3">3 - Medium</SelectItem>
                        <SelectItem value="4">4 - Low</SelectItem>
                        <SelectItem value="5">5 - Lowest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddTaskForm(false);
                      setNewTaskDescription("");
                    }}
                    className="h-6 text-[10px] flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddManualTask}
                    disabled={!newTaskDescription.trim()}
                    className="h-6 text-[10px] flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Task
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Task count summary */}
          <div className="text-[10px] text-muted-foreground text-center py-1 border-t">
            {totalTasks} task(s) will be created
          </div>

          {/* Create Tasks Button */}
          <Button
            size="sm"
            onClick={onCreateTasks}
            disabled={isCreating || totalTasks === 0}
            className="h-8 text-xs w-full bg-orange-600 hover:bg-orange-700"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Creating Tasks...
              </>
            ) : (
              <>
                <ListTodo className="h-3 w-3 mr-1.5" />
                Create {totalTasks} Task(s)
              </>
            )}
          </Button>
        </div>
      )}

      {!eventId && (
        <p className="text-[10px] text-amber-600 mt-2">
          ⚠ Save the event first before creating tasks
        </p>
      )}
    </Card>
  );
});
