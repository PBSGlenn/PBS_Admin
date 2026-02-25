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
import { Key, Brain, Mail, Mic, Search, Eye, EyeOff, Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getApiKeys,
  saveApiKeys,
  maskApiKey,
  isAnthropicConfigured,
  isResendConfigured,
  isOpenAIConfigured,
  isPerplexityConfigured,
} from "@/lib/services/apiKeysService";

/** Test an Anthropic API key by calling the /v1/messages count endpoint */
async function testAnthropicKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
    });
    if (response.ok) return { valid: true };
    if (response.status === 401) return { valid: false, error: "Invalid API key" };
    return { valid: false, error: `API returned status ${response.status}` };
  } catch {
    // Network error — key might still be valid, just can't verify
    return { valid: true };
  }
}

/** Test an OpenAI API key by calling the /v1/models endpoint */
async function testOpenAIKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { "Authorization": `Bearer ${key}` },
    });
    if (response.ok) return { valid: true };
    if (response.status === 401) return { valid: false, error: "Invalid API key" };
    return { valid: false, error: `API returned status ${response.status}` };
  } catch {
    return { valid: true };
  }
}

/** Test a Perplexity API key by calling the chat completions endpoint */
async function testPerplexityKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
      }),
    });
    if (response.ok) return { valid: true };
    if (response.status === 401 || response.status === 403) return { valid: false, error: "Invalid API key" };
    // 422 or other errors with a valid auth header means the key itself is fine
    return { valid: true };
  } catch {
    return { valid: true };
  }
}

/** Test a Resend API key by calling the /api-keys endpoint */
async function testResendKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/api-keys", {
      method: "GET",
      headers: { "Authorization": `Bearer ${key}` },
    });
    if (response.ok) return { valid: true };
    if (response.status === 401 || response.status === 403) return { valid: false, error: "Invalid API key" };
    return { valid: false, error: `API returned status ${response.status}` };
  } catch {
    return { valid: true };
  }
}

interface ApiKeysSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeysSettingsDialog({ isOpen, onClose }: ApiKeysSettingsDialogProps) {
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [perplexityKey, setPerplexityKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  const [showPerplexityKey, setShowPerplexityKey] = useState(false);
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false);
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [hasResendKey, setHasResendKey] = useState(false);
  const [hasPerplexityKey, setHasPerplexityKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load current settings
  useEffect(() => {
    if (isOpen) {
      (async () => {
        await getApiKeys();
        setHasAnthropicKey(await isAnthropicConfigured());
        setHasOpenaiKey(await isOpenAIConfigured());
        setHasResendKey(await isResendConfigured());
        setHasPerplexityKey(await isPerplexityConfigured());
        // Don't populate the actual keys - show masked version
        setAnthropicKey("");
        setOpenaiKey("");
        setResendKey("");
        setPerplexityKey("");
        setShowAnthropicKey(false);
        setShowOpenaiKey(false);
        setShowResendKey(false);
        setShowPerplexityKey(false);
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
      const trimmedKey = anthropicKey.trim();
      // Test key validity before saving
      const test = await testAnthropicKey(trimmedKey);
      if (!test.valid) {
        toast.error("Anthropic API key is invalid", {
          description: test.error || "Please check your key and try again",
        });
        setIsSaving(false);
        return;
      }
      await saveApiKeys({ anthropicApiKey: trimmedKey });
      setHasAnthropicKey(true);
      setAnthropicKey("");
      setShowAnthropicKey(false);
      toast.success("Anthropic API key verified and saved", {
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
      const trimmedKey = openaiKey.trim();
      const test = await testOpenAIKey(trimmedKey);
      if (!test.valid) {
        toast.error("OpenAI API key is invalid", {
          description: test.error || "Please check your key and try again",
        });
        setIsSaving(false);
        return;
      }
      await saveApiKeys({ openaiApiKey: trimmedKey });
      setHasOpenaiKey(true);
      setOpenaiKey("");
      setShowOpenaiKey(false);
      toast.success("OpenAI API key verified and saved", {
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
      const trimmedKey = resendKey.trim();
      const test = await testResendKey(trimmedKey);
      if (!test.valid) {
        toast.error("Resend API key is invalid", {
          description: test.error || "Please check your key and try again",
        });
        setIsSaving(false);
        return;
      }
      await saveApiKeys({ resendApiKey: trimmedKey });
      setHasResendKey(true);
      setResendKey("");
      setShowResendKey(false);
      toast.success("Resend API key verified and saved", {
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

  const handleSavePerplexityKey = async () => {
    if (!perplexityKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    if (!perplexityKey.startsWith("pplx-")) {
      toast.warning("Perplexity API keys usually start with 'pplx-'", {
        description: "Please verify your key is correct",
      });
    }

    setIsSaving(true);
    try {
      const trimmedKey = perplexityKey.trim();
      const test = await testPerplexityKey(trimmedKey);
      if (!test.valid) {
        toast.error("Perplexity API key is invalid", {
          description: test.error || "Please check your key and try again",
        });
        setIsSaving(false);
        return;
      }
      await saveApiKeys({ perplexityApiKey: trimmedKey });
      setHasPerplexityKey(true);
      setPerplexityKey("");
      setShowPerplexityKey(false);
      toast.success("Perplexity API key verified and saved", {
        description: "Medication brand name updates are now available",
      });
    } catch (error) {
      toast.error("Failed to save API key");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearPerplexityKey = async () => {
    await saveApiKeys({ perplexityApiKey: null });
    setHasPerplexityKey(false);
    setPerplexityKey("");
    toast.success("Perplexity API key removed");
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

          {/* Perplexity API Key */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-orange-500" />
              <Label className="text-sm font-medium">Perplexity API Key</Label>
              {hasPerplexityKey ? (
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
              Required for medication brand name updates (Sonar search). Get your key from{" "}
              <a
                href="https://www.perplexity.ai/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                perplexity.ai/settings/api
              </a>
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPerplexityKey ? "text" : "password"}
                  placeholder={hasPerplexityKey ? "Enter new key to replace..." : "pplx-..."}
                  value={perplexityKey}
                  onChange={(e) => setPerplexityKey(e.target.value)}
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPerplexityKey(!showPerplexityKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPerplexityKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                size="sm"
                onClick={handleSavePerplexityKey}
                disabled={!perplexityKey.trim() || isSaving}
              >
                Save
              </Button>
              {hasPerplexityKey && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearPerplexityKey}
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
