// PBS Admin - Application Constants

export const APP_NAME = "PBS Admin";
export const APP_VERSION = "0.1.0";
export const BUSINESS_NAME = "Pet Behaviour Services";

// Timezone
export const TIMEZONE = "Australia/Melbourne";

// Event Types
export const EVENT_TYPES = [
  { value: "Booking", label: "Booking" },
  { value: "Consultation", label: "Consultation" },
  { value: "TrainingSession", label: "Training Session" },
  { value: "Payment", label: "Payment" },
  { value: "FollowUp", label: "Follow-Up" },
  { value: "QuestionnaireReceived", label: "Questionnaire Received" },
  { value: "ReportSent", label: "Report Sent" },
  { value: "Note", label: "Note" },
] as const;

// Task Statuses
export const TASK_STATUSES = [
  { value: "Pending", label: "Pending", color: "gray" },
  { value: "InProgress", label: "In Progress", color: "blue" },
  { value: "Blocked", label: "Blocked", color: "red" },
  { value: "Done", label: "Done", color: "green" },
  { value: "Canceled", label: "Canceled", color: "gray" },
] as const;

// Task Priorities
export const TASK_PRIORITIES = [
  { value: 1, label: "Highest", color: "red" },
  { value: 2, label: "High", color: "orange" },
  { value: 3, label: "Medium", color: "yellow" },
  { value: 4, label: "Low", color: "blue" },
  { value: 5, label: "Lowest", color: "gray" },
] as const;

// Pet Species
export const PET_SPECIES = [
  { value: "Dog", label: "Dog" },
  { value: "Cat", label: "Cat" },
  { value: "Bird", label: "Bird" },
  { value: "Rabbit", label: "Rabbit" },
  { value: "Other", label: "Other" },
] as const;

// Pet Sex
export const PET_SEX = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Unknown", label: "Unknown" },
] as const;

// Australian States
export const AUSTRALIAN_STATES = [
  { value: "NSW", label: "New South Wales" },
  { value: "VIC", label: "Victoria" },
  { value: "QLD", label: "Queensland" },
  { value: "SA", label: "South Australia" },
  { value: "WA", label: "Western Australia" },
  { value: "TAS", label: "Tasmania" },
  { value: "NT", label: "Northern Territory" },
  { value: "ACT", label: "Australian Capital Territory" },
] as const;

// Booking workflow constants
export const QUESTIONNAIRE_CHECK_HOURS_BEFORE = 48;

// Date format patterns
export const DATE_FORMATS = {
  DISPLAY_DATE: "dd/MM/yyyy",
  DISPLAY_TIME: "h:mm a",
  DISPLAY_DATETIME: "dd/MM/yyyy h:mm a",
  DISPLAY_DATETIME_LONG: "EEEE, MMMM d, yyyy 'at' h:mm a",
  ISO_DATE: "yyyy-MM-dd",
} as const;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

// Upcoming bookings filter options (days)
export const UPCOMING_DAYS_OPTIONS = [
  { value: 7, label: "Next 7 days" },
  { value: 14, label: "Next 14 days" },
  { value: 30, label: "Next 30 days" },
  { value: 90, label: "Next 90 days" },
] as const;

// Validation patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  MOBILE_AU: /^(\+?61|0)[4-5]\d{8}$/,
  POSTCODE_AU: /^\d{4}$/,
} as const;

// Validation messages
export const VALIDATION_MESSAGES = {
  REQUIRED: "This field is required",
  EMAIL_INVALID: "Please enter a valid email address",
  MOBILE_INVALID: "Please enter a valid Australian mobile number (e.g., 0412345678)",
  POSTCODE_INVALID: "Please enter a valid 4-digit postcode",
  DUPLICATE_CLIENT: "A client with this email or mobile already exists",
} as const;

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  SAVE: "Ctrl+S",
  CANCEL: "Escape",
  EDIT: "F2",
  DELETE: "Delete",
  MARK_DONE: "Ctrl+D",
  NEW_CLIENT: "Ctrl+N",
  SEARCH: "Ctrl+F",
} as const;
