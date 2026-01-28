// PBS Admin - Tasks Table Component
// Displays tasks for a client with add/edit/delete functionality

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { TaskForm } from "./TaskForm";
import { getTasksByClientId, deleteTask, markTaskDone } from "@/lib/services/taskService";
import type { Task } from "@/lib/types";
import { Plus, Edit, Trash2, CheckCircle2 } from "lucide-react";
import { format, isPast } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { LoadingSpinner } from "../ui/loading-spinner";

export interface TasksTableProps {
  clientId: number;
}

export function TasksTable({ clientId }: TasksTableProps) {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Fetch tasks for this client
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", clientId],
    queryFn: () => getTasksByClientId(clientId),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      toast.success("Task deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete task", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  // Mark done mutation
  const markDoneMutation = useMutation({
    mutationFn: markTaskDone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      toast.success("Task marked as done");
    },
    onError: (error) => {
      toast.error("Failed to mark task as done", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const handleDelete = (task: Task) => {
    setTaskToDelete(task);
  };

  const confirmDelete = () => {
    if (taskToDelete) {
      deleteMutation.mutate(taskToDelete.taskId);
      setTaskToDelete(null);
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
  };

  const handleMarkDone = (task: Task) => {
    markDoneMutation.mutate(task.taskId);
  };

  const handleCloseEditDialog = () => {
    setEditingTask(null);
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "dd/MM/yyyy h:mm a");
    } catch {
      return "—";
    }
  };

  const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    if (task.status === "Done" || task.status === "Canceled") return false;
    return isPast(new Date(task.dueDate));
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Done":
        return "default";
      case "InProgress":
        return "secondary";
      case "Blocked":
        return "destructive";
      case "Canceled":
        return "outline";
      default:
        return "outline";
    }
  };

  const getPriorityDisplay = (priority: number) => {
    const colors = {
      1: "text-red-600 font-semibold",
      2: "text-orange-600 font-medium",
      3: "text-yellow-600",
      4: "text-blue-600",
      5: "text-gray-600",
    };
    return <span className={colors[priority as keyof typeof colors] || ""}>{priority}</span>;
  };

  const truncateDescription = (description: string | null) => {
    if (!description) return "—";
    return description.length > 60 ? description.substring(0, 60) + "..." : description;
  };

  return (
    <>
      <Card>
        <CardHeader className="py-2 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Tasks</CardTitle>
              <CardDescription className="text-xs">
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"} assigned
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
              className="h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {isLoading ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              No tasks assigned yet. Click "Add Task" to get started.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] h-8 py-1.5">Description</TableHead>
                    <TableHead className="text-[11px] h-8 py-1.5">Due Date</TableHead>
                    <TableHead className="text-[11px] h-8 py-1.5">Priority</TableHead>
                    <TableHead className="text-[11px] h-8 py-1.5">Status</TableHead>
                    <TableHead className="text-[11px] h-8 py-1.5 w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.taskId} className={isOverdue(task) ? "bg-red-50 h-10" : "h-10"}>
                      <TableCell className="text-[11px] font-medium py-1.5">
                        {truncateDescription(task.description)}
                        {isOverdue(task) && (
                          <Badge variant="destructive" className="ml-2 text-[10px]">Overdue</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] py-1.5">{formatDateTime(task.dueDate)}</TableCell>
                      <TableCell className="text-[11px] py-1.5">{getPriorityDisplay(task.priority)}</TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant={getStatusBadgeVariant(task.status)} className="text-[10px]">
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-1">
                          {task.status !== "Done" && task.status !== "Canceled" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkDone(task)}
                              className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                              disabled={markDoneMutation.isPending}
                              title="Mark as Done"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Mark Done</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(task)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(task)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Task Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>
              Enter the details for the new task below.
            </DialogDescription>
          </DialogHeader>
          <TaskForm
            clientId={clientId}
            onClose={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && handleCloseEditDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update the details for this task.
            </DialogDescription>
          </DialogHeader>
          {editingTask && (
            <TaskForm
              clientId={clientId}
              task={editingTask}
              onClose={handleCloseEditDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirmation Dialog */}
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
