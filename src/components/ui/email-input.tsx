// Email Input with Context Menu
import { useState } from "react";
import { Input } from "./input";
import { EmailDraftDialog } from "./email-draft-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./context-menu";
import { Copy, Clipboard, Mail } from "lucide-react";
import { getEmailTemplate, processTemplate } from "@/lib/emailTemplates";

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  clientFirstName?: string;
  clientLastName?: string;
}

export function EmailInput({
  value,
  onChange,
  className,
  id,
  placeholder,
  clientFirstName = "",
  clientLastName = ""
}: EmailInputProps) {
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text.trim());
    } catch (error) {
      console.error("Failed to paste:", error);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleCreateEmail = () => {
    if (value) {
      setShowEmailDialog(true);
    }
  };

  const handleSendEmail = (to: string, subject: string, body: string) => {
    // Copy to clipboard for pasting into Gmail
    const emailContent = `To: ${to}
Subject: ${subject}

${body}`;

    navigator.clipboard.writeText(emailContent).catch((error) => {
      console.error("Failed to copy:", error);
    });
  };

  // Get general email template
  const template = getEmailTemplate('general');
  const processedSubject = template ? processTemplate(template.subject, {
    clientFirstName,
    clientLastName
  }) : 'Pet Behaviour Services';

  const processedBody = template ? processTemplate(template.body, {
    clientFirstName,
    content: '[Type your message here]'
  }) : `Dear ${clientFirstName},

[Type your message here]

Best regards,
Pet Behaviour Services`;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Input
            id={id}
            type="email"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={className}
            placeholder={placeholder}
          />
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={handlePaste} className="text-[11px]">
            <Clipboard className="mr-2 h-3 w-3" />
            Paste
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCopy} className="text-[11px]" disabled={!value}>
            <Copy className="mr-2 h-3 w-3" />
            Copy
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCopy} className="text-[11px]" disabled={!value}>
            <Copy className="mr-2 h-3 w-3" />
            Copy email address
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCreateEmail} className="text-[11px]" disabled={!value}>
            <Mail className="mr-2 h-3 w-3" />
            Create email
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Email Draft Dialog */}
      <EmailDraftDialog
        isOpen={showEmailDialog}
        onClose={() => setShowEmailDialog(false)}
        onSend={handleSendEmail}
        initialTo={value}
        initialSubject={processedSubject}
        initialBody={processedBody}
        clientName={`${clientFirstName} ${clientLastName}`.trim()}
      />
    </>
  );
}
