// PBS Admin - Email Draft Dialog Component
// Allows preview and editing of email before sending
// Supports direct sending via Resend API with attachments

import { useState } from "react";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "./dialog";
import { Label } from "./label";
import { Input } from "./input";
import { Textarea } from "./textarea";
import {
  Mail,
  Send,
  Edit2,
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
  Paperclip,
  X,
  Loader2,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { sendEmail, isEmailServiceConfigured } from "@/lib/services/emailService";

export interface EmailAttachment {
  path: string;
  name: string;
}

export interface EmailDraftDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSend?: (to: string, subject: string, body: string) => void; // Legacy: opens mailto link
  onMarkAsSent?: (to: string, subject: string, body: string) => void;
  onEmailSent?: (to: string, subject: string) => void; // Callback after successful send via Resend
  initialTo: string;
  initialSubject: string;
  initialBody: string;
  clientName?: string;
  attachmentReminder?: string; // Optional reminder about file attachment (legacy)
  attachments?: EmailAttachment[]; // Actual file attachments to send
}

export function EmailDraftDialog({
  isOpen,
  onClose,
  onSend,
  onMarkAsSent,
  onEmailSent,
  initialTo,
  initialSubject,
  initialBody,
  clientName,
  attachmentReminder,
  attachments: initialAttachments = []
}: EmailDraftDialogProps) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [attachments, setAttachments] = useState<EmailAttachment[]>(initialAttachments);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const emailConfigured = isEmailServiceConfigured();

  const handleSendViaResend = async () => {
    if (!emailConfigured) {
      toast.error("Email service not configured. Please add VITE_RESEND_API_KEY to your .env file.");
      return;
    }

    setIsSending(true);
    try {
      const result = await sendEmail({
        to,
        subject,
        body,
        attachments: attachments.length > 0 ? attachments.map(a => a.path) : undefined,
        includeSignature: true,
      });

      if (result.success) {
        toast.success(`Email sent successfully to ${to}!`, {
          description: attachments.length > 0
            ? `Sent with ${attachments.length} attachment(s)`
            : undefined,
        });
        onEmailSent?.(to, subject);
        onClose();
      } else {
        toast.error("Failed to send email", {
          description: result.error,
        });
      }
    } catch (error) {
      console.error("Email send error:", error);
      toast.error("Failed to send email", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenInEmailApp = () => {
    if (onSend) {
      onSend(to, subject, body);
    }
    onClose();
  };

  const handleMarkAsSent = () => {
    if (onMarkAsSent) {
      onMarkAsSent(to, subject, body);
    }
    toast.success("Report marked as sent!");
    onClose();
  };

  const handleCopyToClipboard = async () => {
    try {
      const emailContent = `To: ${to}
Subject: ${subject}

${body}`;

      await navigator.clipboard.writeText(emailContent);
      setCopied(true);
      toast.success("Email copied to clipboard!");

      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleCancel = () => {
    // Reset to initial values
    setTo(initialTo);
    setSubject(initialSubject);
    setBody(initialBody);
    setAttachments(initialAttachments);
    setIsEditing(false);
    onClose();
  };

  // Update state when props change
  if (initialTo !== to && !isEditing) {
    setTo(initialTo);
  }
  if (initialSubject !== subject && !isEditing) {
    setSubject(initialSubject);
  }
  if (initialBody !== body && !isEditing) {
    setBody(initialBody);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Draft Preview
            {clientName && (
              <span className="text-sm font-normal text-muted-foreground">
                - {clientName}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {emailConfigured
              ? "Review and edit the email, then click 'Send Email' to send directly with attachments."
              : "Review and edit the email before sending. Email service not configured - use 'Open in Email App' instead."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Email Service Status */}
          {!emailConfigured && (
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-xs font-medium text-amber-900 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Email Service Not Configured
              </p>
              <p className="text-[10px] text-amber-700 mt-1">
                Add VITE_RESEND_API_KEY to your .env file to enable direct sending with attachments.
              </p>
            </div>
          )}

          {/* Attachments Section */}
          {attachments.length > 0 && (
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs font-medium text-blue-900 flex items-center gap-1.5 mb-2">
                <Paperclip className="h-3.5 w-3.5" />
                Attachments ({attachments.length})
              </p>
              <div className="space-y-1">
                {attachments.map((att, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white rounded px-2 py-1 text-[10px]"
                  >
                    <span className="font-mono text-blue-800 truncate max-w-[400px]">
                      {att.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAttachment(index)}
                      className="h-5 w-5 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legacy Attachment Reminder (for mailto flow) */}
          {attachmentReminder && attachments.length === 0 && (
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-xs font-medium text-amber-900 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Reminder: Attach File Manually
              </p>
              <p className="text-[10px] text-amber-700 mt-1 font-mono">
                {attachmentReminder}
              </p>
            </div>
          )}

          {/* To Field */}
          <div className="space-y-2">
            <Label htmlFor="email-to" className="text-xs font-semibold">
              To:
            </Label>
            <Input
              id="email-to"
              type="email"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setIsEditing(true);
              }}
              className="h-8 text-xs"
              placeholder="recipient@example.com"
            />
          </div>

          {/* Subject Field */}
          <div className="space-y-2">
            <Label htmlFor="email-subject" className="text-xs font-semibold">
              Subject:
            </Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setIsEditing(true);
              }}
              className="h-8 text-xs"
              placeholder="Email subject"
            />
          </div>

          {/* Body Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-body" className="text-xs font-semibold">
                Message:
              </Label>
              {isEditing && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <Edit2 className="h-3 w-3" />
                  Edited
                </span>
              )}
            </div>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setIsEditing(true);
              }}
              className="min-h-[250px] text-xs font-mono resize-none"
              placeholder="Email message"
            />
            <p className="text-[10px] text-muted-foreground">
              Your email signature with logo will be automatically added.
            </p>
          </div>

          {/* Character Count */}
          <div className="text-xs text-muted-foreground text-right">
            {body.length} characters
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between border-t pt-4">
          <div className="text-xs text-muted-foreground">
            {emailConfigured
              ? "Email will be sent via Resend with your signature"
              : "Copy to paste into Gmail or send via desktop email client"}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="h-8 text-xs"
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              className="h-8 text-xs"
              disabled={!to || !subject || !body || isSending}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy
                </>
              )}
            </Button>
            {onMarkAsSent && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAsSent}
                className="h-8 text-xs"
                disabled={!to || !subject || !body || isSending}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                Mark as Sent
              </Button>
            )}
            {onSend && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInEmailApp}
                className="h-8 text-xs"
                disabled={!to || !subject || !body || isSending}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Open in Email App
              </Button>
            )}
            {emailConfigured && (
              <Button
                size="sm"
                onClick={handleSendViaResend}
                className="h-8 text-xs bg-green-600 hover:bg-green-700"
                disabled={!to || !subject || !body || isSending}
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Send Email
                    {attachments.length > 0 && (
                      <span className="ml-1 text-[10px] opacity-80">
                        ({attachments.length} file{attachments.length > 1 ? 's' : ''})
                      </span>
                    )}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
