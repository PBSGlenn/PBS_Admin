// PBS Admin - Email Templates
// Editable email templates for client communications

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[]; // List of variables that will be replaced
  description: string;
}

/**
 * Email templates for various client communications
 *
 * Available variables:
 * - {{clientFirstName}} - Client's first name
 * - {{clientLastName}} - Client's last name
 * - {{clientEmail}} - Client's email
 * - {{petName}} - Pet's name
 * - {{petSpecies}} - Pet's species (Dog/Cat)
 * - {{consultationDate}} - Consultation date
 * - {{formUrl}} - Jotform questionnaire URL
 * - {{formType}} - Form type (Dog/Cat)
 * - {{dueDate}} - Task due date
 * - {{currentDate}} - Current date
 */
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'questionnaire-reminder-dog',
    name: 'Dog Questionnaire Reminder',
    subject: 'Reminder: Dog Behaviour Questionnaire - Pet Behaviour Services',
    body: `Dear {{clientFirstName}},

Thank you for booking your consultation with Pet Behaviour Services on {{consultationDate}}.

To help us provide the best possible service for {{petName}}, please complete our Dog Behaviour Questionnaire before your consultation:

{{formUrl}}

The questionnaire takes approximately 15-20 minutes to complete and provides valuable information about your dog's behaviour, history, and current concerns.

Please ensure you submit the questionnaire at least 48 hours before your consultation to allow us time to review your responses.

If you have any questions or concerns, please don't hesitate to contact us.

Best regards,
Pet Behaviour Services`,
    variables: ['clientFirstName', 'consultationDate', 'petName', 'formUrl'],
    description: 'Reminder email for clients to complete the dog behaviour questionnaire'
  },
  {
    id: 'questionnaire-reminder-cat',
    name: 'Cat Questionnaire Reminder',
    subject: 'Reminder: Cat Behaviour Questionnaire - Pet Behaviour Services',
    body: `Dear {{clientFirstName}},

Thank you for booking your consultation with Pet Behaviour Services on {{consultationDate}}.

To help us provide the best possible service for {{petName}}, please complete our Cat Behaviour Questionnaire before your consultation:

{{formUrl}}

The questionnaire takes approximately 15-20 minutes to complete and provides valuable information about your cat's behaviour, history, and current concerns.

Please ensure you submit the questionnaire at least 48 hours before your consultation to allow us time to review your responses.

If you have any questions or concerns, please don't hesitate to contact us.

Best regards,
Pet Behaviour Services`,
    variables: ['clientFirstName', 'consultationDate', 'petName', 'formUrl'],
    description: 'Reminder email for clients to complete the cat behaviour questionnaire'
  },
  {
    id: 'protocol-send',
    name: 'Protocol Document Email',
    subject: 'Your Behaviour Consultation Protocol - Pet Behaviour Services',
    body: `Dear {{clientFirstName}},

Thank you for attending your consultation with Pet Behaviour Services on {{consultationDate}}.

As discussed, I've attached your personalised behaviour protocol for {{petName}}. This document contains:

• Summary of the consultation
• Behaviour modification plan
• Training exercises
• Management strategies
• Timeline and expectations

Please review the protocol carefully and don't hesitate to contact me if you have any questions or need clarification on any of the recommendations.

Remember that consistency and patience are key to success. I look forward to hearing about {{petName}}'s progress at our follow-up session.

Best regards,
Pet Behaviour Services`,
    variables: ['clientFirstName', 'consultationDate', 'petName'],
    description: 'Email template for sending protocol documents after consultation'
  },
  {
    id: 'follow-up-check',
    name: 'Follow-up Check Email',
    subject: 'Follow-up: How is {{petName}} progressing?',
    body: `Dear {{clientFirstName}},

I hope this email finds you and {{petName}} well.

It's been a week since our consultation on {{consultationDate}}, and I wanted to check in to see how things are progressing with the behaviour modification plan.

How are you finding the exercises? Have you noticed any changes in {{petName}}'s behaviour?

Please don't hesitate to reach out if you:
• Have any questions about the protocol
• Need clarification on any exercises
• Are experiencing any challenges
• Would like to schedule a follow-up session

Your feedback is valuable and helps ensure {{petName}} gets the best possible support.

Looking forward to hearing from you.

Best regards,
Pet Behaviour Services`,
    variables: ['clientFirstName', 'petName', 'consultationDate'],
    description: 'Follow-up email to check on client progress after consultation'
  },
  {
    id: 'general',
    name: 'General Email Template',
    subject: 'Pet Behaviour Services',
    body: `Dear {{clientFirstName}},

{{content}}

Best regards,
Pet Behaviour Services`,
    variables: ['clientFirstName', 'content'],
    description: 'General purpose email template'
  }
];

/**
 * Get email template by ID
 */
export function getEmailTemplate(templateId: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Replace template variables with actual values
 */
export function processTemplate(template: string, variables: Record<string, string>): string {
  let processed = template;

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(regex, value || '');
  });

  return processed;
}

/**
 * Get template for questionnaire reminder based on pet species
 */
export function getQuestionnaireReminderTemplate(species: string): EmailTemplate | undefined {
  const templateId = species.toLowerCase() === 'cat'
    ? 'questionnaire-reminder-cat'
    : 'questionnaire-reminder-dog';
  return getEmailTemplate(templateId);
}

/**
 * Save custom template (for future implementation with localStorage or database)
 */
export function saveCustomTemplate(template: EmailTemplate): void {
  // TODO: Implement saving to localStorage or database
  // For now, templates are hardcoded but this function provides the interface
  // for future enhancement to allow user-editable templates
  console.log('Saving template:', template);
  // localStorage.setItem(`email_template_${template.id}`, JSON.stringify(template));
}

/**
 * Load custom templates (for future implementation)
 */
export function loadCustomTemplates(): EmailTemplate[] {
  // TODO: Load from localStorage or database
  // For now, return empty array
  return [];
}