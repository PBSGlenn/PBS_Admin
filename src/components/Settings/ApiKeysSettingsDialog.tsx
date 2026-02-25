// PBS Admin - API Keys Settings Dialog
// Configure API keys for AI services and email delivery

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Key, Brain, Mail, Mic, Eye, EyeOff, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getApiKeys,
  saveApiKeys,
  maskApiKey,
  isAnthropicConfigured,
  isResendConfigured,
  isOpenAIConfigured,
} from "@/lib/services/apiKeysService";

interface ApiKeysSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeysSettingsDialog({ isOpen, onClose }: ApiKeysSettingsDialogProps) {
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false);
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [hasResendKey, setHasResendKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load current settings
  useEffect(() => {
    if (isOpen) {
      (async () => {
        await getApiKeys();
        setHasAnthropicKey(await isAnthropicConfigured());
        setHasOpenaiKey(await isOpenAIConfigured());
        setHasResendKey(await isResendConfigured());
        // Don't populate the actual keys - show masked version
        setAnthropicKey("");
        setOpenaiKey("");
        setResendKey("");
        setShowAnthropicKey(false);
        setShowOpenaiKey(false);
        setShowResendKey(false);
      })();
    }
  }, [isOpen]);

  const handleSaveAnthropicKey = async () => {
    if (!anthropicKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    if (!anthropicKey.startsWith("sk-ant-")) {
      toast.warning("Anthropic API keys usually start with 'sk-ant-'", {
        description: "Please verify your key is correct",
      });
    }

    setIsSaving(true);
    try {
      await saveApiKeys({ anthropicApiKey: anthropicKey.trim() });
      setHasAnthropicKey(true);
      setAnthropicKey("");
      setShowAnthropicKey(false);
      toast.success("Anthropic API key saved", {
        description: "AI report generation is now available",
      });
    } catch (error) {
      toast.error("Failed to save API key");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOpenaiKey = async () => {
    if (!openaiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    if (!openaiKey.startsWith("sk-")) {
      toast.warning("OpenAI API keys usually start with 'sk-'", {
        description: "Please verify your key is correct",
      });
    }

    setIsSaving(true);
    try {
      await saveApiKeys({ openaiApiKey: openaiKey.trim() });
      setHasOpenaiKey(true);
      setOpenaiKey("");
      setShowOpenaiKey(false);
      toast.success("OpenAI API key saved", {
        description: "Audio transcription with speaker diarization is now available",
      });
    } catch (error) {
      toast.error("Failed to save API key");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearOpenaiKey = async () => {
    await saveApiKeys({ openaiApiKey: null });
    setHasOpenaiKey(false);
    setOpenaiKey("");
    toast.success("OpenAI API key removed");
  };

  const handleSaveResendKey = async () => {
    if (!resendKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    if (!resendKey.startsWith("re_")) {
      toast.warning("Resend API keys usually start with 're_'", {
        description: "Please verify your key is correct",
      });
    }

    setIsSaving(true);
    try {
      await saveApiKeys({ resendApiKey: resendKey.trim() });
      setHasResendKey(true);
      setResendKey("");
      setShowResendKey(false);
      toast.success("Resend API key saved", {
        description: "Email sending is now available",
      });
    } catch (error) {
      toast.error("Failed to save API key");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAnthropicKey = async () => {
    await saveApiKeys({ anthropicApiKey: null });
    setHasAnthropicKey(false);
    setAnthropicKey("");
    toast.success("Anthropic API key removed");
  };

  const handleClearResendKey = async () => {
    await saveApiKeys({ resendApiKey: null });
    setHasResendKey(false);
    setResendKey("");
    toast.success("Resend API key removed");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </DialogTitle>
          <DialogDescription>
            Configure API keys for AI services and email delivery. Keys are stored locally on your computer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Anthropic API Key */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              <Label className="text-sm font-medium">Anthropic API Key</Label>
              {hasAnthropicKey ? (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <Check className="h-3 w-3" />
                  Configured
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <AlertCircle className="h-3 w-3" />
                  Not configured
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Required for AI report generation (Claude API). Get your key from{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                console.anthropic.com
              </a>
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showAnthropicKey ? "text" : "password"}
                  placeholder={hasAnthropicKey ? "Enter new key to replace..." : "sk-ant-..."}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                size="sm"
                onClick={handleSaveAnthropicKey}
                disabled={!anthropicKey.trim() || isSaving}
              >
                Save
              </Button>
              {hasAnthropicKey && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearAnthropicKey}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* OpenAI API Key */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-green-500" />
              <Label className="text-sm font-medium">OpenAI API Key</Label>
              {hasOpenaiKey ? (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <Check className="h-3 w-3" />
                  Configured
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <AlertCircle className="h-3 w-3" />
                  Not configured
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Required for audio transcription with speaker diarization. Get your key from{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                platform.openai.com
              </a>
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showOpenaiKey ? "text" : "password"}
                  placeholder={hasOpenaiKey ? "Enter new key to replace..." : "sk-..."}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                size="sm"
                onClick={handleSaveOpenaiKey}
                disabled={!openaiKey.trim() || isSaving}
              >
                Save
              </Button>
              {hasOpenaiKey && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearOpenaiKey}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Resend API Key */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              <Label className="text-sm font-medium">Resend API Key</Label>
              {hasResendKey ? (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <Check className="h-3 w-3" />
                  Configured
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <AlertCircle className="h-3 w-3" />
                  Not configured
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Required for sending emails with attachments. Get your key from{" "}
              <a
                href="https://resend.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                resend.com
              </a>
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showResendKey ? "text" : "password"}
                  placeholder={hasResendKey ? "Enter new key to replace..." : "re_..."}
                  value={resendKey}
                  onChange={(e) => setResendKey(e.target.value)}
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowResendKey(!showResendKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showResendKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                size="sm"
                onClick={handleSaveResendKey}
                disabled={!resendKey.trim() || isSaving}
              >
                Save
              </Button>
              {hasResendKey && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearResendKey}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Info Section */}
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1.5">
            <p>
              <strong>Security:</strong> API keys are stored locally in your database.
              They are never sent to any server except the respective API providers.
            </p>
            <p>
              <strong>Development:</strong> Keys in your .env file will be used as fallback
              if no key is configured here.
            </p>
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
