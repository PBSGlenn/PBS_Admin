# Prescription Template Guide

This guide explains how to create and use the prescription Word template for PBS Admin.

## Template Location

The prescription template should be placed in:
```
Documents\PBS_Admin\Templates\Prescription_Template.docx
```

## Template Variables

The following variables will be replaced when generating a prescription:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{clientName}}` | Full name of client | Sarah Johnson |
| `{{petName}}` | Name of pet | Max |
| `{{petSpecies}}` | Dog or Cat | Dog |
| `{{petWeight}}` | Weight in kg | 15.5 kg |
| `{{medicationName}}` | Generic medication name | Fluoxetine |
| `{{brandNames}}` | Brand names | Prozac, Reconcile |
| `{{doseAmount}}` | Dose in mg | 20 mg |
| `{{frequency}}` | How often | Twice daily (BID) |
| `{{repeats}}` | Number of repeats | 5 |
| `{{specialInstructions}}` | Additional instructions | Give with food |
| `{{prescriptionDate}}` | Date prescribed | 28/11/2025 |
| `{{scheduleClass}}` | Schedule classification | S4 |

## Template Structure

### Recommended Layout

```
┌─────────────────────────────────────────┐
│         VETERINARY PRESCRIPTION          │
│      Pet Behaviour Services              │
│                                          │
│  Date: {{prescriptionDate}}             │
│                                          │
│  Client: {{clientName}}                 │
│  Pet: {{petName}} ({{petSpecies}})      │
│  Weight: {{petWeight}}                  │
│                                          │
│  ℞ (Prescription Symbol)                │
│                                          │
│  {{medicationName}}                     │
│  ({{brandNames}})                       │
│                                          │
│  Dose: {{doseAmount}}                   │
│  Frequency: {{frequency}}               │
│  Repeats: {{repeats}}                   │
│                                          │
│  Schedule: {{scheduleClass}}            │
│                                          │
│  Special Instructions:                  │
│  {{specialInstructions}}                │
│                                          │
│  ───────────────────────────────────    │
│  Prescriber Signature                   │
│  Dr. [Your Name]                        │
│  Registration Number: [Your Reg #]      │
│  Date: {{prescriptionDate}}             │
└─────────────────────────────────────────┘
```

### Creating the Template in MS Word

1. **Open Microsoft Word**

2. **Set up your letterhead**:
   - Add your practice logo
   - Add practice name, address, phone
   - Add registration/license numbers

3. **Add prescription fields** using the variable names above:
   - Type the exact variable names including `{{` and `}}`
   - Format them as you'd like (font, size, bold, etc.)
   - The system will replace them with actual values

4. **Include legal requirements**:
   - Prescriber name and registration number
   - Date field
   - Schedule classification
   - Practice contact information
   - Any state-specific requirements

5. **Add signature block**:
   - Leave space for signature
   - Add prescriber details
   - Add practice stamp area if required

6. **Save the template**:
   - Save as `Prescription_Template.docx`
   - Place in `Documents\PBS_Admin\Templates\`

## Example Template Content

```markdown
═══════════════════════════════════════
    VETERINARY PRESCRIPTION
    Pet Behaviour Services

    123 Main Street, Melbourne VIC 3000
    Phone: (03) 9123 4567
    Email: info@petbehaviourservices.com.au
═══════════════════════════════════════

Date: {{prescriptionDate}}

CLIENT DETAILS
Name: {{clientName}}
Pet: {{petName}} ({{petSpecies}}, {{petWeight}})

═══════════════════════════════════════

℞ PRESCRIPTION

Medication: {{medicationName}}
Brand Names: {{brandNames}}

Dose: {{doseAmount}}
Frequency: {{frequency}}
Repeats: {{repeats}}

Schedule Classification: {{scheduleClass}}

SPECIAL INSTRUCTIONS:
{{specialInstructions}}

═══════════════════════════════════════

PRESCRIBER DETAILS

Signature: _______________________________

Dr. [Your Full Name]
Veterinary Registration #: [Your Number]
Date: {{prescriptionDate}}

═══════════════════════════════════════

IMPORTANT NOTES:
- This prescription is valid for 6 months from the date of issue
- Controlled substances (S8) require special authorization
- Follow all veterinary advice regarding this medication
- Contact the practice if any adverse effects occur

═══════════════════════════════════════
```

## Using the Template

1. **Create a Prescription Event** in PBS Admin
2. **Select a medication** from the dropdown
3. **Review the medication information** displayed
4. **Enter dosing details**:
   - Pet weight (optional, for dose calculation)
   - Dose amount (mg)
   - Frequency
   - Repeats
   - Special instructions
5. **Click "Generate Prescription (DOCX)"**
6. **Review the generated Word document**
7. **Click "Convert to PDF"** when ready
8. **Print or email the PDF** to client or pharmacy

## Variable Replacement

The system uses Pandoc to replace variables in the template. Variables are case-sensitive and must include the double curly braces `{{` and `}}`.

### Example Replacement:

**Before** (template):
```
Pet: {{petName}} ({{petSpecies}}, {{petWeight}})
Medication: {{medicationName}} ({{brandNames}})
Dose: {{doseAmount}} {{frequency}}
```

**After** (generated document):
```
Pet: Max (Dog, 15.5 kg)
Medication: Fluoxetine (Prozac, Reconcile)
Dose: 20 mg Twice daily (BID)
```

## Tips for Template Design

1. **Use tables** for structured data (client info, pet info, dosing)
2. **Use bold/formatting** to highlight important information
3. **Include your logo** for professional appearance
4. **Add practice details** in header/footer
5. **Leave white space** for signatures and stamps
6. **Test the template** with sample data first
7. **Keep legal compliance** in mind (state requirements vary)

## Troubleshooting

**Variables not replaced:**
- Check variable name spelling (case-sensitive)
- Ensure `{{` and `}}` are included
- Verify template is in correct location

**Formatting issues:**
- Try using a simpler template first
- Avoid complex Word features (macros, advanced formatting)
- Use basic formatting (bold, italics, tables)

**PDF conversion fails:**
- Ensure Microsoft Word is installed
- Check file permissions on client folder
- Verify DOCX file was created successfully

## Compliance Notes

This template should comply with:
- Australian veterinary prescribing regulations
- State-specific requirements for controlled substances
- Practice insurance requirements
- Professional registration body standards

**Always consult with your professional regulatory body and legal advisor to ensure compliance with current regulations.**

---

**Template Version:** 1.0
**Last Updated:** 2025-11-28
