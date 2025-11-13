// PBS Admin - Task Templates
// Predefined task types with preset values for common workflows

import { addDays, addWeeks, format } from 'date-fns';

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  descriptionTemplate: string;
  priority: number;
  status: string;
  daysFromNow: number; // Offset for due date calculation
  triggeredBy: string;
  automatedAction?: string;
}

/**
 * Predefined task templates for common workflows
 */
export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'general',
    name: 'General Task',
    description: 'Custom task with no preset values',
    descriptionTemplate: '',
    priority: 3,
    status: 'Pending',
    daysFromNow: 1,
    triggeredBy: 'Manual',
  },
  {
    id: 'questionnaire-followup',
    name: 'Questionnaire Return Follow-up',
    description: 'Check if client has submitted/returned questionnaire',
    descriptionTemplate: 'Check if questionnaire has been submitted/returned',
    priority: 1,
    status: 'Pending',
    daysFromNow: 2,
    triggeredBy: 'Manual',
    automatedAction: 'CheckQuestionnaireReturned',
  },
  {
    id: 'protocol-send',
    name: 'Protocol Send',
    description: 'Send protocol document to client',
    descriptionTemplate: 'Send protocol document to client via email',
    priority: 2,
    status: 'Pending',
    daysFromNow: 1,
    triggeredBy: 'Manual',
    automatedAction: 'SendProtocol',
  },
  {
    id: 'followup-call',
    name: 'Follow-up Call',
    description: 'Schedule follow-up call with client',
    descriptionTemplate: 'Schedule follow-up call to check on progress',
    priority: 3,
    status: 'Pending',
    daysFromNow: 7,
    triggeredBy: 'Manual',
  },
  {
    id: 'training-prep',
    name: 'Training Session Preparation',
    description: 'Prepare materials for upcoming training session',
    descriptionTemplate: 'Prepare training materials and equipment',
    priority: 2,
    status: 'Pending',
    daysFromNow: 2,
    triggeredBy: 'Manual',
    automatedAction: 'PrepareTrainingMaterials',
  },
];

/**
 * Get task template by ID
 */
export function getTaskTemplate(id: string): TaskTemplate | undefined {
  return TASK_TEMPLATES.find(t => t.id === id);
}

/**
 * Calculate due date from template offset
 */
export function calculateDueDateFromTemplate(daysFromNow: number): string {
  const dueDate = addDays(new Date(), daysFromNow);
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  return format(dueDate, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Get template values for form population
 */
export function getTemplateFormValues(templateId: string) {
  const template = getTaskTemplate(templateId);

  if (!template || template.id === 'general') {
    return {
      description: '',
      priority: '3',
      status: 'Pending',
      dueDate: '',
      triggeredBy: 'Manual',
      automatedAction: '',
    };
  }

  return {
    description: template.descriptionTemplate,
    priority: template.priority.toString(),
    status: template.status,
    dueDate: calculateDueDateFromTemplate(template.daysFromNow),
    triggeredBy: template.triggeredBy,
    automatedAction: template.automatedAction || '',
  };
}
