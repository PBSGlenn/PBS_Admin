// PBS Admin - Shared types for Consultation sub-components

import type { Event } from "@/lib/types";
import type { Pet } from "@/lib/types";

// Supported file types for context
export type ContextFileType = "txt" | "pdf" | "docx" | "json";

export interface ContextFile {
  name: string;
  path: string;
  type: ContextFileType;
  selected: boolean;
}

// Priority type matching TaskPriority
export type Priority = 1 | 2 | 3 | 4 | 5;

// Standard post-consultation tasks (pre-checked by default)
export interface StandardTask {
  id: string;
  description: string;
  offset: string; // e.g., "5 days", "7 days", "14 days"
  priority: Priority;
  selected: boolean;
}

// Case-specific task extracted from transcript
export interface CaseTask {
  id: string;
  description: string;
  offset: string;
  priority: Priority;
  context?: string; // Original context from transcript
}

// Processing log tracks what has been done in this consultation
export interface ProcessingLog {
  transcriptSaved?: string;
  clinicalNotesGenerated?: string;
  comprehensiveReportGenerated?: string;
  vetReportGenerated?: string;
  tasksCreated?: string;
}

// Helper to get file extension
export function getFileType(filename: string): ContextFileType | null {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'txt') return 'txt';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'json') return 'json';
  return null;
}

// Default standard tasks
export const DEFAULT_STANDARD_TASKS: StandardTask[] = [
  {
    id: "report",
    description: "Send consultation report to client",
    offset: "5 days",
    priority: 1,
    selected: true
  },
  {
    id: "followup-7",
    description: "Post-consultation follow-up email",
    offset: "7 days",
    priority: 2,
    selected: true
  },
  {
    id: "followup-14",
    description: "2-week post-consultation follow-up email",
    offset: "14 days",
    priority: 2,
    selected: true
  }
];
