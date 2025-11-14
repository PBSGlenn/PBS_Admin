// PBS Admin - Email Draft Dialog Component
// Allows preview and editing of email before sending

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
import { Mail, Send, Edit2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export interface EmailDraftDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (to: string, subject: string, body: string) => void;
  initialTo: string;
  initialSubject: string;
  initialBody: string;
  clientName?: string;
}

export function EmailDraftDialog({
  isOpen,
  onClose,
  onSend,
  initialTo,
  initialSubject,
  initialBody,
  clientName
}: EmailDraftDialogProps) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSend = () => {
    onSend(to, subject, body);
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

  const handleCancel = () => {
    // Reset to initial values
    setTo(initialTo);
    setSubject(initialSubject);
    setBody(initialBody);
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
            Review and edit the email before sending. Click "Send Email" when ready.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
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
              className="min-h-[300px] text-xs font-mono resize-none"
              placeholder="Email message"
            />
          </div>

          {/* Character Count */}
          <div className="text-xs text-muted-foreground text-right">
            {body.length} characters
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Copy to paste into Gmail or send via desktop email client
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              className="h-8 text-xs"
              disabled={!to || !subject || !body}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy Email
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              className="h-8 text-xs"
              disabled={!to || !subject || !body}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Open in Email App
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}