// PBS Admin - Tasks Overview Component
// Displays pending and in-progress tasks with overdue highlighting

import { useQuery } from "@tanstack/react-query";
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
import { getTasksForDashboard, markTaskDone } from "@/lib/services/taskService";
import { formatDate, isTaskOverdue } from "@/lib/utils/dateUtils";
import { getPriorityColor } from "@/lib/utils";
import { Check } from "lucide-react";

export function TasksOverview() {
  const { data: tasks, isLoading, error, refetch } = useQuery({
    queryKey: ["tasks", "dashboard"],
    queryFn: getTasksForDashboard,
  });

  const handleMarkDone = async (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    try {
      await markTaskDone(taskId);
      refetch();
    } catch (error) {
      console.error("Failed to mark task as done:", error);
    }
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
                    onClick={() => {
                      // TODO: Navigate to task detail
                      console.log("View task:", task.taskId);
                    }}
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
    </div>
  );
}
