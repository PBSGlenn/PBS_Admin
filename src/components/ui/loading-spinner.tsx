// Loading Spinner Component
// Reusable loading indicators for async operations

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-6 w-6",
};

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <Loader2 className={cn("animate-spin", sizeClasses[size], className)} />
  );
}

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message = "Loading...", className }: LoadingOverlayProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-4 text-center",
      className
    )}>
      <LoadingSpinner size="lg" className="text-muted-foreground mb-2" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

interface LoadingCardProps {
  message?: string;
  className?: string;
}

export function LoadingCard({ message = "Loading...", className }: LoadingCardProps) {
  return (
    <div className={cn(
      "flex items-center justify-center h-full min-h-[100px]",
      className
    )}>
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="md" className="text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

interface LoadingButtonContentProps {
  isLoading: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function LoadingButtonContent({
  isLoading,
  loadingText = "Loading...",
  children
}: LoadingButtonContentProps) {
  if (isLoading) {
    return (
      <>
        <LoadingSpinner size="sm" className="mr-2" />
        {loadingText}
      </>
    );
  }
  return <>{children}</>;
}

interface LoadingTableRowProps {
  colSpan: number;
  message?: string;
}

export function LoadingTableRow({ colSpan, message = "Loading..." }: LoadingTableRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <LoadingSpinner size="md" className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
      </td>
    </tr>
  );
}

// Skeleton loading placeholders
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn(
      "animate-pulse rounded-md bg-muted",
      className
    )} />
  );
}

export function SkeletonText({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-3 w-full", className)} />;
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn("space-y-3 p-4 border rounded-lg", className)}>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-2 px-3">
          <Skeleton className="h-3 w-full" />
        </td>
      ))}
    </tr>
  );
}
