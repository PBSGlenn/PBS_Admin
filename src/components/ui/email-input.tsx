// Email Input with Context Menu - supports Resend API email sending with attachments
import { useState, useEffect } from "react";
import { Input } from "./input";
import { EmailDraftDialog, EmailAttachment } from "./email-draft-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "./context-menu";
import { Copy, Clipboard, Mail, Paperclip, FileText, FolderOpen } from "lucide-react";
import { getEmailTemplate, processTemplate } from "@/lib/emailTemplates";
import { invoke } from "@tauri-apps/api/core";

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientFolderPath?: string;
}

interface FolderFile {
  name: string;
  path: string;
  isReport: boolean;
}

export function EmailInput({
  value,
  onChange,
  className,
  id,
  placeholder,
  clientFirstName = "",
  clientLastName = "",
  clientFolderPath = ""
}: EmailInputProps) {
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<EmailAttachment[]>([]);
  const [folderFiles, setFolderFiles] = useState<FolderFile[]>([]);

  // Load files from client folder when it changes
  useEffect(() => {
    if (clientFolderPath) {
      loadFolderFiles();
    }
  }, [clientFolderPath]);

  const loadFolderFiles = async () => {
    if (!clientFolderPath) return;

    try {
      const entries = await invoke<Array<{ name: string; isFile: boolean }>>(
        "plugin:fs|read_dir",
        { path: clientFolderPath }
      );

      const files: FolderFile[] = entries
        .filter((entry) => entry.isFile)
        .filter((entry) => {
          const name = entry.name.toLowerCase();
          // Filter for common document types
          return (
            name.endsWith(".pdf") ||
            name.endsWith(".docx") ||
            name.endsWith(".doc") ||
            name.endsWith(".txt") ||
            name.endsWith(".json")
          );
        })
        .map((entry) => ({
          name: entry.name,
          path: `${clientFolderPath}\\${entry.name}`,
          isReport: entry.name.toLowerCase().includes("report") ||
                   entry.name.toLowerCase().includes("clinical")
        }))
        .sort((a, b) => {
          // Reports first, then alphabetically
          if (a.isReport && !b.isReport) return -1;
          if (!a.isReport && b.isReport) return 1;
          return b.name.localeCompare(a.name); // Newest first (by name)
        });

      setFolderFiles(files);
    } catch (error) {
      console.error("Failed to load folder files:", error);
      setFolderFiles([]);
    }
  };

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
      setSelectedAttachments([]);
      setShowEmailDialog(true);
    }
  };

  const handleCreateEmailWithAttachment = (file: FolderFile) => {
    if (value) {
      setSelectedAttachments([{ path: file.path, name: file.name }]);
      setShowEmailDialog(true);
    }
  };

  const handleOpenFolder = async () => {
    if (clientFolderPath) {
      try {
        await invoke("plugin:opener|open_path", { path: clientFolderPath });
      } catch (error) {
        console.error("Failed to open folder:", error);
      }
    }
  };

  // Get general email template
  const template = getEmailTemplate("general");
  const processedSubject = template
    ? processTemplate(template.subject, {
        clientFirstName,
        clientLastName,
      })
    : "Pet Behaviour Services";

  const processedBody = template
    ? processTemplate(template.body, {
        clientFirstName,
        content: "[Type your message here]",
      })
    : `Dear ${clientFirstName},

[Type your message here]

Kind regards,`;

  // Get recent reports for quick access
  const recentReports = folderFiles.filter((f) => f.isReport).slice(0, 5);
  const otherFiles = folderFiles.filter((f) => !f.isReport).slice(0, 5);

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
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={handlePaste} className="text-[11px]">
            <Clipboard className="mr-2 h-3 w-3" />
            Paste
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleCopy}
            className="text-[11px]"
            disabled={!value}
          >
            <Copy className="mr-2 h-3 w-3" />
            Copy email address
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={handleCreateEmail}
            className="text-[11px]"
            disabled={!value}
          >
            <Mail className="mr-2 h-3 w-3" />
            Compose email...
          </ContextMenuItem>

          {/* Attach and send submenu - only show if folder exists */}
          {clientFolderPath && folderFiles.length > 0 && (
            <ContextMenuSub>
              <ContextMenuSubTrigger className="text-[11px]" disabled={!value}>
                <Paperclip className="mr-2 h-3 w-3" />
                Send with attachment
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-64">
                {recentReports.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium">
                      Reports
                    </div>
                    {recentReports.map((file) => (
                      <ContextMenuItem
                        key={file.path}
                        onClick={() => handleCreateEmailWithAttachment(file)}
                        className="text-[11px]"
                      >
                        <FileText className="mr-2 h-3 w-3 text-blue-500" />
                        <span className="truncate">{file.name}</span>
                      </ContextMenuItem>
                    ))}
                  </>
                )}
                {otherFiles.length > 0 && (
                  <>
                    {recentReports.length > 0 && <ContextMenuSeparator />}
                    <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium">
                      Other Files
                    </div>
                    {otherFiles.map((file) => (
                      <ContextMenuItem
                        key={file.path}
                        onClick={() => handleCreateEmailWithAttachment(file)}
                        className="text-[11px]"
                      >
                        <FileText className="mr-2 h-3 w-3" />
                        <span className="truncate">{file.name}</span>
                      </ContextMenuItem>
                    ))}
                  </>
                )}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          {clientFolderPath && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleOpenFolder} className="text-[11px]">
                <FolderOpen className="mr-2 h-3 w-3" />
                Open client folder
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Email Draft Dialog with Resend support */}
      <EmailDraftDialog
        isOpen={showEmailDialog}
        onClose={() => {
          setShowEmailDialog(false);
          setSelectedAttachments([]);
        }}
        onSend={(to, subject, body) => {
          // Legacy: opens mailto link
          const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          window.open(mailtoLink, "_blank");
        }}
        onEmailSent={() => {
          // Email sent via Resend - close dialog
          setShowEmailDialog(false);
          setSelectedAttachments([]);
        }}
        initialTo={value}
        initialSubject={processedSubject}
        initialBody={processedBody}
        clientName={`${clientFirstName} ${clientLastName}`.trim()}
        attachments={selectedAttachments}
      />
    </>
  );
}
