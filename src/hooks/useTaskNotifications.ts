// PBS Admin - Task Notifications Hook
// Polls for due/overdue tasks and shows notifications

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getDueTasksForNotification, type TaskNotification } from '@/lib/services/notificationService';
import { format } from 'date-fns';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
const INITIAL_DELAY = 30 * 1000; // 30 seconds after app starts

/**
 * Hook to check for due/overdue tasks and show notifications
 */
export function useTaskNotifications() {
  const [notificationCount, setNotificationCount] = useState(0);
  const notifiedTasksRef = useRef<Set<number>>(new Set());
  const isInitializedRef = useRef(false);

  const checkForNotifications = async () => {
    try {
      const notifications = await getDueTasksForNotification();

      // Update count
      setNotificationCount(notifications.length);

      // Show toast notifications for new tasks only
      for (const notification of notifications) {
        // Skip if we've already notified about this task
        if (notifiedTasksRef.current.has(notification.taskId)) {
          continue;
        }

        // Show notification based on status
        const clientInfo = notification.clientName ? ` (${notification.clientName})` : '';
        const dueTime = format(new Date(notification.dueDate), 'h:mm a');

        if (notification.status === 'overdue') {
          toast.error(`Overdue Task${clientInfo}`, {
            description: `${notification.description} - was due ${dueTime}`,
            duration: 10000,
            action: {
              label: 'View',
              onClick: () => {
                // Navigate to client view or task
                console.log('Navigate to task:', notification.taskId);
              },
            },
          });
        } else if (notification.status === 'due-today') {
          toast.warning(`Task Due Today${clientInfo}`, {
            description: `${notification.description} - due at ${dueTime}`,
            duration: 8000,
            action: {
              label: 'View',
              onClick: () => {
                console.log('Navigate to task:', notification.taskId);
              },
            },
          });
        } else if (notification.status === 'due-tomorrow') {
          // Only show tomorrow notifications once, less intrusively
          toast(`Task Due Tomorrow${clientInfo}`, {
            description: `${notification.description} - due at ${dueTime}`,
            duration: 5000,
          });
        }

        // Mark as notified
        notifiedTasksRef.current.add(notification.taskId);
      }

      // Clean up notified tasks that are no longer in the list
      // (task was completed or cancelled)
      const currentTaskIds = new Set(notifications.map(n => n.taskId));
      notifiedTasksRef.current.forEach(taskId => {
        if (!currentTaskIds.has(taskId)) {
          notifiedTasksRef.current.delete(taskId);
        }
      });

    } catch (error) {
      console.error('Failed to check for task notifications:', error);
    }
  };

  useEffect(() => {
    // Initial check after delay (don't overwhelm user on startup)
    const initialTimeout = setTimeout(() => {
      isInitializedRef.current = true;
      checkForNotifications();
    }, INITIAL_DELAY);

    // Set up polling interval
    const intervalId = setInterval(() => {
      if (isInitializedRef.current) {
        checkForNotifications();
      }
    }, POLL_INTERVAL);

    // Cleanup
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, []);

  return {
    notificationCount,
    checkNow: checkForNotifications,
  };
}
