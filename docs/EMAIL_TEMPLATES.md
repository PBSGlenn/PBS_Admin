# Email Templates Guide

## Overview

PBS Admin includes a customizable email template system for client communications. Templates are stored in `src/lib/emailTemplates.ts` and can be easily modified to suit your needs.

## Available Templates

1. **Dog Questionnaire Reminder** (`questionnaire-reminder-dog`)
   - For clients with dogs who need to complete the behaviour questionnaire

2. **Cat Questionnaire Reminder** (`questionnaire-reminder-cat`)
   - For clients with cats who need to complete the behaviour questionnaire

3. **Protocol Document Email** (`protocol-send`)
   - For sending behaviour protocols after consultation

4. **Follow-up Check Email** (`follow-up-check`)
   - For checking on client progress after consultation

5. **General Email Template** (`general`)
   - For any general communication

## How to Modify Templates

### 1. Locate the Template File

Open `src/lib/emailTemplates.ts` in your code editor.

### 2. Find the Template to Edit

Templates are stored in the `EMAIL_TEMPLATES` array:

```typescript
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'questionnaire-reminder-dog',
    name: 'Dog Questionnaire Reminder',
    subject: 'Reminder: Dog Behaviour Questionnaire - Pet Behaviour Services',
    body: `Dear {{clientFirstName}}, ...`,
    variables: ['clientFirstName', 'consultationDate', 'petName', 'formUrl'],
    description: 'Reminder email for clients to complete the dog behaviour questionnaire'
  },
  // ... more templates
];
```

### 3. Edit the Template

Modify the `subject` and `body` fields as needed:

```typescript
{
  id: 'questionnaire-reminder-dog',
  subject: 'Your Custom Subject Here',
  body: `Your custom email body here...`,
}
```

### 4. Save and Restart

After making changes:
1. Save the file
2. The changes will take effect immediately in development
3. For production, rebuild the app: `npm run tauri build`

## Template Variables

You can use these variables in your templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{clientFirstName}}` | Client's first name | "Sarah" |
| `{{clientLastName}}` | Client's last name | "Johnson" |
| `{{clientEmail}}` | Client's email | "sarah@example.com" |
| `{{petName}}` | Pet's name | "Max" |
| `{{petSpecies}}` | Pet's species | "Dog" or "Cat" |
| `{{consultationDate}}` | Consultation date | "Saturday, 16 November 2025" |
| `{{formUrl}}` | Jotform questionnaire URL | "https://form.jotform.com/..." |
| `{{formType}}` | Form type | "Dog" or "Cat" |
| `{{currentDate}}` | Today's date | "14/11/2025" |

## Example: Customizing the Questionnaire Reminder

### Original Template:
```
Dear {{clientFirstName}},

Thank you for booking your consultation with Pet Behaviour Services on {{consultationDate}}.

To help us provide the best possible service for {{petName}}, please complete our Dog Behaviour Questionnaire before your consultation:

{{formUrl}}
```

### Customized Version:
```
Hi {{clientFirstName}}!

Just a friendly reminder that your consultation is coming up on {{consultationDate}}.

Before we meet, please take a moment to complete our questionnaire about {{petName}}:

{{formUrl}}

This helps me understand {{petName}} better and make the most of our time together.

Looking forward to meeting you both!

Warm regards,
[Your Name]
Pet Behaviour Services
```

## Using the Email Draft Feature

1. **Open a questionnaire task** from the Dashboard
2. **Click "Send Reminder"** button
3. **Review the draft** in the preview dialog
4. **Edit if needed** - You can modify the To, Subject, and Body fields
5. **Click "Send Email"** when ready
6. Your email client will open with the final message

## Tips

- Keep templates professional but friendly
- Use variables to personalize messages
- Test templates with different scenarios
- Consider different pet species when writing
- Include clear calls to action
- Keep messages concise

## Future Enhancements

The template system is designed to be extensible:
- Templates could be stored in a database
- User interface for template editing
- Template history and versioning
- Multiple template variations
- Custom variables per template

## Support

For technical questions about the template system, refer to:
- Template file: `src/lib/emailTemplates.ts`
- Draft dialog: `src/components/ui/email-draft-dialog.tsx`
- Integration: `src/components/Dashboard/TasksOverview.tsx`