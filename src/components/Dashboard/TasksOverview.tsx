// PBS Admin - Tasks Overview Component
// Displays pending and in-progress tasks with overdue highlighting

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { getTasksForDashboard, markTaskDone, deleteTask, getTaskById } from "@/lib/services/taskService";
import { formatDate, isTaskOverdue } from "@/lib/utils/dateUtils";
import { getPriorityColor } from "@/lib/utils";
import { Check, Edit, Trash2, Mail } from "lucide-react";
import { TaskForm } from "../Task/TaskForm";
import type { Task } from "@/lib/types";

export function TasksOverview() {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ["tasks", "dashboard"],
    queryFn: getTasksForDashboard,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "dashboard"] });
      setIsDialogOpen(false);
      setSelectedTask(null);
    },
    onError: (error) => {
      alert(`Failed to delete task: ${error}`);
    },
  });

  // Mark done mutation
  const markDoneMutation = useMutation({
    mutationFn: markTaskDone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "dashboard"] });
    },
    onError: (error) => {
      alert(`Failed to mark task as done: ${error}`);
    },
  });

  const handleRowClick = async (taskId: number, clientName: string) => {
    try {
      const task = await getTaskById(taskId);
      if (task) {
        setSelectedTask(task);
        setSelectedClientName(clientName);
        setIsDialogOpen(true);
      }
    } catch (error) {
      console.error("Failed to load task:", error);
    }
  };

  const handleMarkDone = async (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    markDoneMutation.mutate(taskId);
  };

  const handleDelete = () => {
    if (!selectedTask) return;
    if (window.confirm(`Are you sure you want to delete this task? This action cannot be undone.`)) {
      deleteMutation.mutate(selectedTask.taskId);
    }
  };

  const handleSendReminder = async () => {
    if (!selectedTask) return;
    // TODO: Implement email reminder functionality
    alert("Email reminder functionality coming soon!");
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedTask(null);
    setSelectedClientName("");
  };

  const handleTaskSaved = () => {
    // Invalidate dashboard query to refresh the list
    queryClient.invalidateQueries({ queryKey: ["tasks", "dashboard"] });
    handleCloseDialog();
  };

  const isQuestionnaireTask = (task: Task | null) => {
    return task?.automatedAction === "CheckQuestionnaireReturned";
  };

  return (
    <div>
      {isLoading ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">Loading tasks...</p>
        </div>
      ) : error ? (
        <div className="text-center py-4">
          <p className="text-xs text-destructive">Error loading tasks</p>
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">No pending tasks</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            All caught up!
          </p>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-7 text-[11px] py-1">Description</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Client</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Event</TableHead>
                <TableHead className="h-7 text-[11px] py-1 text-center">P</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Due Date</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Status</TableHead>
                <TableHead className="h-7 text-[11px] py-1 text-center w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task: any) => {
                const overdue = isTaskOverdue(task.dueDate, task.status);
                return (
                  <TableRow
                    key={task.taskId}
                    className={`cursor-pointer h-10 ${
                      overdue ? "bg-destructive/5" : ""
                    }`}
                    onClick={() => handleRowClick(task.taskId, task.clientName || "")}
                  >
                    <TableCell className="font-medium text-xs max-w-[200px] truncate py-1">
                      {task.description}
                    </TableCell>
                    <TableCell className="text-xs py-1">
                      {task.clientName || "-"}
                    </TableCell>
                    <TableCell className="py-1">
                      {task.eventType ? (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          {task.eventType}
                        </Badge>
                      ) : (
                        <span className="text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-1">
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: `hsl(var(--${getPriorityColor(task.priority)}))`,
                          color: `hsl(var(--${getPriorityColor(task.priority)}))`,
                        }}
                        className="text-[10px] h-5 w-5 px-0 justify-center"
                      >
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1">
                      <div className={`text-[11px] leading-tight ${overdue ? "text-destructive font-medium" : ""}`}>
                        <div>{formatDate(task.dueDate)}</div>
                        {overdue && (
                          <div className="text-[10px] text-destructive">Overdue</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1">
                      <Badge
                        variant={
                          task.status === "Done"
                            ? "success"
                            : task.status === "Blocked"
                            ? "destructive"
                            : task.status === "InProgress"
                            ? "info"
                            : "secondary"
                        }
                        className="text-[10px] h-5 px-1.5"
                      >
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center py-1">
                      {task.status !== "Done" && task.status !== "Canceled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => handleMarkDone(task.taskId, e)}
                          title="Mark as Done"
                          className="h-6 w-6 p-0"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Task Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <div>
                <span>Task Details</span>
                {selectedClientName && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    - {selectedClientName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isQuestionnaireTask(selectedTask) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendReminder}
                    className="h-8 text-xs"
                  >
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Send Reminder
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="h-8 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              {isQuestionnaireTask(selectedTask)
                ? "Questionnaire return task - Edit details or send a reminder to the client."
                : "View or edit task details below."}
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <TaskForm
              clientId={selectedTask.clientId || undefined}
              eventId={selectedTask.eventId || undefined}
              task={selectedTask}
              onClose={handleCloseDialog}
              onSave={handleTaskSaved}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
