// PBS Admin - Zod Schemas for Runtime Validation
// Validates external data at system boundaries:
// - Supabase booking responses
// - Jotform API submissions
// - Settings deserialization from SQLite

import { z } from "zod";

// ============================================================================
// Supabase Booking Schema
// ============================================================================

export const WebsiteBookingSchema = z.object({
  id: z.string(),
  booking_reference: z.string(),
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().nullable(),
  pet_name: z.string().min(1),
  pet_species: z.string().nullable(),
  pet_breed: z.string().nullable(),
  service_type: z.string(),
  service_delivery: z.string(),
  customer_postcode: z.string().nullable(),
  base_price: z.number().nullable(),
  travel_charge: z.number().nullable(),
  total_price: z.number().nullable(),
  currency: z.string().nullable(),
  booking_date: z.string().nullable(),
  consultation_date: z.string(), // YYYY-MM-DD
  consultation_time: z.string(), // HH:mm
  timezone: z.string().nullable(),
  zoom_link: z.string().nullable(),
  payment_status: z.enum(["pending", "completed", "failed", "refunded"]),
  stripe_session_id: z.string().nullable(),
  stripe_customer_id: z.string().nullable(),
  stripe_payment_intent_id: z.string().nullable(),
  referral_required: z.boolean(),
  referral_file_path: z.string().nullable(),
  referral_file_name: z.string().nullable(),
  problem_description: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
  created_at: z.string(),
  updated_at: z.string(),
  synced_to_admin: z.boolean().nullable(),
  training_package_id: z.string().nullable().optional(),
});

export type WebsiteBookingValidated = z.infer<typeof WebsiteBookingSchema>;

// ============================================================================
// Jotform Submission Schema
// ============================================================================

export const JotformAnswerSchema = z.object({
  name: z.string(),
  order: z.string(),
  text: z.string(),
  type: z.string(),
  answer: z.union([z.string(), z.record(z.string(), z.string())]),
  prettyFormat: z.string().optional(),
});

export const JotformSubmissionSchema = z.object({
  id: z.string(),
  form_id: z.string(),
  ip: z.string(),
  created_at: z.string(),
  status: z.string(),
  new: z.string(),
  flag: z.string(),
  notes: z.string(),
  updated_at: z.string().nullable(),
  answers: z.record(z.string(), z.any()), // Answers have complex nested structure, validated per-field in parseSubmission
});

export type JotformSubmissionValidated = z.infer<typeof JotformSubmissionSchema>;

// ============================================================================
// Settings Schemas
// ============================================================================

export const ApiKeysSchema = z.object({
  anthropicApiKey: z.string().nullable(),
  resendApiKey: z.string().nullable(),
  openaiApiKey: z.string().nullable(),
  perplexityApiKey: z.string().nullable().default(null),
});

export const AIModelConfigSchema = z.object({
  reportModel: z.string().min(1),
  taskExtractionModel: z.string().min(1),
});

export const BackupSettingsSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["daily", "weekly", "manual"]),
  retentionCount: z.number().int().min(1).max(100),
  lastBackupDate: z.string().nullable(),
});

export const VetClinicSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const TranscriptionStatsSchema = z.object({
  totalTranscriptions: z.number().int().min(0),
  totalDuration: z.number().min(0),
  totalCost: z.number().min(0),
  lastTranscription: z.string().optional(),
});

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Safely parse data with a Zod schema, returning the default value on failure.
 * Logs validation errors for debugging.
 */
export function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  defaultValue: T,
  context?: string
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  const label = context || "unknown";
  console.warn(
    `[Zod] Validation failed for ${label}:`,
    result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
  );
  return defaultValue;
}

/**
 * Validate an array of items, filtering out invalid entries.
 * Returns only the items that pass validation.
 */
export function safeParseArray<T>(
  schema: z.ZodType<T>,
  data: unknown[],
  context?: string
): T[] {
  const valid: T[] = [];
  for (let i = 0; i < data.length; i++) {
    const result = schema.safeParse(data[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      const label = context || "unknown";
      console.warn(
        `[Zod] Invalid item at index ${i} in ${label}:`,
        result.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`)
      );
    }
  }
  return valid;
}
