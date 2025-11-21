// PBS Admin - TypeScript Type Definitions

// Base entity types (matching Prisma schema)
export interface Client {
  clientId: number;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  folderPath: string | null;
  stripeCustomerId: string | null;
  primaryCareVet: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Pet {
  petId: number;
  clientId: number;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Event {
  eventId: number;
  clientId: number;
  eventType: string;
  date: string;
  notes: string | null;
  calendlyEventUri: string;
  calendlyStatus: string;
  invoiceFilePath: string | null;
  hostedInvoiceUrl: string | null;
  transcriptFilePath: string | null;
  questionnaireFilePath: string | null;
  parentEventId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  taskId: number;
  clientId: number | null;
  eventId: number | null;
  description: string;
  dueDate: string;
  status: string;
  priority: number;
  automatedAction: string;
  triggeredBy: string;
  completedOn: string | null;
  parentTaskId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Extended types with computed fields
export interface ClientWithRelations extends Client {
  pets?: Pet[];
  events?: Event[];
  tasks?: Task[];
  _count?: {
    pets: number;
    events: number;
    tasks: number;
  };
}

export interface EventWithRelations extends Event {
  client?: Client;
  parentEvent?: Event | null;
  childEvents?: Event[];
  tasks?: Task[];
}

export interface TaskWithRelations extends Task {
  client?: Client | null;
  event?: Event | null;
  parentTask?: Task | null;
  childTasks?: Task[];
}

// Enums and Constants

export const EVENT_TYPES = [
  "Booking",
  "Consultation",
  "TrainingSession",
  "Payment",
  "FollowUp",
  "QuestionnaireReceived",
  "ReportSent",
  "Note",
] as const;

export type EventType = typeof EVENT_TYPES[number];

export const TASK_STATUSES = [
  "Pending",
  "InProgress",
  "Blocked",
  "Done",
  "Canceled",
] as const;

export type TaskStatus = typeof TASK_STATUSES[number];

export const TASK_PRIORITIES = [1, 2, 3, 4, 5] as const;

export type TaskPriority = typeof TASK_PRIORITIES[number];

export const PET_SPECIES = ["Dog", "Cat", "Bird", "Rabbit", "Other"] as const;

export type PetSpecies = typeof PET_SPECIES[number];

export const PET_SEX = ["Male", "Male Castrated", "Female", "Female Spayed", "Unknown"] as const;

export type PetSex = typeof PET_SEX[number];

// Form Input Types

export interface ClientInput {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postcode?: string;
  folderPath?: string;
  stripeCustomerId?: string;
  primaryCareVet?: string;
  notes?: string;
}

export interface PetInput {
  clientId: number;
  name: string;
  species: string;
  breed?: string;
  sex?: string;
  dateOfBirth?: string;
  notes?: string;
}

export interface EventInput {
  clientId: number;
  eventType: EventType;
  date: string; // ISO 8601 string
  notes?: string;
  calendlyEventUri?: string;
  calendlyStatus?: string;
  invoiceFilePath?: string;
  hostedInvoiceUrl?: string;
  transcriptFilePath?: string;
  questionnaireFilePath?: string;
  parentEventId?: number;
}

export interface TaskInput {
  clientId?: number;
  eventId?: number;
  description: string;
  dueDate: string; // ISO 8601 string
  status: TaskStatus;
  priority: TaskPriority;
  automatedAction?: string;
  triggeredBy: string;
  parentTaskId?: number;
}

// Dashboard View Types

export interface DashboardClient {
  clientId: number;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  city?: string | null;
  state?: string | null;
  petCount: number;
  lastEventDate?: string | null;
  hasNotes: boolean;
}

export interface UpcomingBooking {
  eventId: number;
  eventType: string;
  clientName: string;
  petNames: string[];
  date: string;
  status: string;
}

export interface DashboardTask {
  taskId: number;
  description: string;
  clientName?: string | null;
  eventType?: string | null;
  priority: number;
  status: TaskStatus;
  dueDate: string;
  isOverdue: boolean;
}

// Validation and Error Types

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: ValidationError[];
}

// Search and Filter Types

export interface ClientSearchParams {
  query?: string;
  city?: string;
  state?: string;
  hasNotes?: boolean;
  sortBy?: "firstName" | "lastName" | "email" | "city" | "lastEventDate";
  sortDirection?: "asc" | "desc";
}

export interface EventSearchParams {
  clientId?: number;
  eventType?: EventType;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  sortBy?: "date" | "eventType";
  sortDirection?: "asc" | "desc";
}

export interface TaskSearchParams {
  clientId?: number;
  eventId?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDateFrom?: string;
  dueDateTo?: string;
  isOverdue?: boolean;
  sortBy?: "dueDate" | "priority" | "status";
  sortDirection?: "asc" | "desc";
}
