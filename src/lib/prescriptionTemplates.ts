// Prescription Template Management System
// Similar to email templates and AI prompts - allows customizable prescription format

export interface PrescriptionTemplate {
  id: string;
  name: string;
  description: string;
  template: string; // Markdown template with variables
  variables: string[]; // Available template variables
}

// Default prescription template
const DEFAULT_TEMPLATE: PrescriptionTemplate = {
  id: 'default-prescription',
  name: 'Standard Prescription',
  description: 'Standard veterinary prescription format for behavior medications',
  template: `{{prescription_date}}

**Prescription for "{{pet_name}}" {{client_surname}}, a {{pet_breed}}**

**Owner:** {{client_name}}
{{client_address}}

**To the Pharmacist,**

Please supply the following medication for this animal under my care:

**Drug name:** {{medication_name}}
**Formulation:** {{formulation}}
**Dosage and directions:** {{dosage_directions}}

**FOR ANIMAL TREATMENT ONLY**

**Quantity:** {{amount_to_dispense}}
**Number of repeats:** {{repeats}}

{{#if special_instructions}}
**Special instructions:** {{special_instructions}}

{{/if}}
Please contact us if more information is required.

Yours sincerely,

**Dr. Glenn Tobiansky (V2794)**
{{prescription_date}}
`,
  variables: [
    '{{prescription_date}}',
    '{{pet_name}}',
    '{{client_surname}}',
    '{{pet_breed}}',
    '{{client_name}}',
    '{{client_address}}',
    '{{medication_name}}',
    '{{formulation}}',
    '{{dosage_directions}}',
    '{{amount_to_dispense}}',
    '{{repeats}}',
    '{{special_instructions}}',
  ],
};

const STORAGE_KEY = 'pbs_admin_prescription_template';

/**
 * Get the current prescription template (custom or default)
 */
export function getPrescriptionTemplate(): PrescriptionTemplate {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const customTemplate = JSON.parse(stored) as PrescriptionTemplate;
      return customTemplate;
    }
  } catch (error) {
    console.error('Error loading custom prescription template:', error);
  }
  return DEFAULT_TEMPLATE;
}

/**
 * Save custom prescription template
 */
export function savePrescriptionTemplate(template: PrescriptionTemplate): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
  } catch (error) {
    console.error('Error saving prescription template:', error);
    throw new Error('Failed to save prescription template');
  }
}

/**
 * Reset to default prescription template
 */
export function resetPrescriptionTemplate(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error resetting prescription template:', error);
    throw new Error('Failed to reset prescription template');
  }
}

/**
 * Get default template (for preview/reset)
 */
export function getDefaultTemplate(): PrescriptionTemplate {
  return { ...DEFAULT_TEMPLATE };
}

/**
 * Process prescription template with actual data
 */
export function processPrescriptionTemplate(
  template: string,
  data: Record<string, string>
): string {
  let processed = template;

  // Replace all variables with actual values
  Object.entries(data).forEach(([key, value]) => {
    const variable = `{{${key}}}`;
    processed = processed.replace(new RegExp(escapeRegExp(variable), 'g'), value || '');
  });

  // Handle conditional blocks (simple if/endif)
  processed = processed.replace(
    /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g,
    (match, variable, content) => {
      const value = data[variable];
      return value && value.trim() ? content : '';
    }
  );

  return processed;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
