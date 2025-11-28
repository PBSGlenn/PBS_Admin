// PBS Admin - Output Selector Component
// Checkboxes for selecting which reports to generate

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, FileEdit, Stethoscope, Pill, Clipboard } from "lucide-react";

export type OutputType = 'clinicalNotes' | 'clientReport' | 'practitionerReport' | 'vetReport' | 'prescription';

export interface OutputSelectorProps {
  selectedOutputs: OutputType[];
  onSelectionChange: (outputs: OutputType[]) => void;
}

const OUTPUT_OPTIONS: Array<{
  type: OutputType;
  label: string;
  description: string;
  icon: React.ElementType;
  defaultChecked: boolean;
}> = [
  {
    type: 'clinicalNotes',
    label: 'Clinical Notes (HTML)',
    description: 'Comprehensive report saved to Event.notes (for in-app viewing)',
    icon: FileEdit,
    defaultChecked: true
  },
  {
    type: 'clientReport',
    label: 'Client Report (PDF)',
    description: 'Client-facing report with positive reframe (DOCX/PDF)',
    icon: FileText,
    defaultChecked: true
  },
  {
    type: 'practitionerReport',
    label: 'Practitioner Report (PDF)',
    description: 'Detailed clinical record for client folder (DOCX/PDF)',
    icon: Clipboard,
    defaultChecked: true
  },
  {
    type: 'vetReport',
    label: 'Vet Report (PDF)',
    description: 'Professional vet-to-vet report (DOCX)',
    icon: Stethoscope,
    defaultChecked: false
  },
  {
    type: 'prescription',
    label: 'Prescription',
    description: 'Medication prescription (DOCX and PDF)',
    icon: Pill,
    defaultChecked: false
  }
];

export function OutputSelector({
  selectedOutputs,
  onSelectionChange
}: OutputSelectorProps) {

  const handleToggle = (type: OutputType, checked: boolean) => {
    if (checked) {
      // Add to selection
      onSelectionChange([...selectedOutputs, type]);
    } else {
      // Remove from selection
      onSelectionChange(selectedOutputs.filter(t => t !== type));
    }
  };

  return (
    <div className="space-y-3">
      {OUTPUT_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isChecked = selectedOutputs.includes(option.type);

        return (
          <div key={option.type} className="flex items-start space-x-2">
            <Checkbox
              id={`output-${option.type}`}
              checked={isChecked}
              onCheckedChange={(checked) => handleToggle(option.type, checked as boolean)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label
                htmlFor={`output-${option.type}`}
                className="text-xs font-medium cursor-pointer flex items-center gap-1.5"
              >
                <Icon className="h-3 w-3" />
                {option.label}
              </Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {option.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
