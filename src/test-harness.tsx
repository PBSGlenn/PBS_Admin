// Test Harness Page - Only loaded in development for Playwright testing
// This page renders components in isolation for automated testing

import { useState, useEffect } from "react";
import { EmailDraftDialog } from "./components/ui/email-draft-dialog";
import { Toaster } from "sonner";

interface TestConfig {
  component: string;
  props: Record<string, any>;
}

// Read test config from URL params or window
function getTestConfig(): TestConfig | null {
  const params = new URLSearchParams(window.location.search);
  const component = params.get("component");

  if (!component) return null;

  // Get props from URL or window
  const propsParam = params.get("props");
  let props: Record<string, any> = {};

  if (propsParam) {
    try {
      props = JSON.parse(decodeURIComponent(propsParam));
    } catch (e) {
      console.error("Failed to parse props:", e);
    }
  }

  // Also check window for dynamically set props
  if ((window as any).__TEST_EMAIL_DIALOG_OPTIONS__) {
    props = { ...props, ...(window as any).__TEST_EMAIL_DIALOG_OPTIONS__ };
  }

  return { component, props };
}

export function TestHarness() {
  const [config, setConfig] = useState<TestConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [emailLogs, setEmailLogs] = useState<Array<{
    method: string;
    to: string;
    subject: string;
    timestamp: string;
  }>>([]);

  useEffect(() => {
    const testConfig = getTestConfig();
    setConfig(testConfig);

    // Auto-open dialog for testing
    if (testConfig?.component === "email-draft-dialog") {
      setIsOpen(true);
    }
  }, []);

  const handleEmailSent = (method: "outlook" | "mailto" | "clipboard" | "manual") => {
    const log = {
      method,
      to: config?.props?.to || "unknown",
      subject: config?.props?.subject || "unknown",
      timestamp: new Date().toISOString(),
    };
    setEmailLogs((prev) => [...prev, log]);

    // Expose to window for test assertions
    (window as any).__EMAIL_SENT_LOGS__ = [...emailLogs, log];

    console.log("[Test Harness] Email sent:", log);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleReopen = () => {
    setIsOpen(true);
  };

  if (!config) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold mb-4">Test Harness</h1>
        <p className="text-muted-foreground mb-4">
          Use URL parameters to load a component for testing.
        </p>
        <pre className="bg-muted p-4 rounded text-sm">
          {`Available components:
- email-draft-dialog

Example URLs:
/test-harness?component=email-draft-dialog
/test-harness?component=email-draft-dialog&props=${encodeURIComponent(
            JSON.stringify({
              to: "test@example.com",
              subject: "Test Subject",
              body: "Test body",
            })
          )}`}
        </pre>
      </div>
    );
  }

  // Render the requested component
  if (config.component === "email-draft-dialog") {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold mb-4">Email Draft Dialog Test</h1>

        <div className="mb-4 flex gap-2">
          <button
            onClick={handleReopen}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            data-testid="open-dialog"
          >
            Open Dialog
          </button>
        </div>

        {/* Email send logs for test assertions */}
        <div className="mb-4" data-testid="email-logs">
          <h2 className="font-semibold mb-2">Email Send Logs:</h2>
          {emailLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No emails sent yet</p>
          ) : (
            <ul className="text-sm space-y-1">
              {emailLogs.map((log, idx) => (
                <li key={idx} data-testid={`email-log-${idx}`}>
                  <span className="font-mono bg-muted px-1 rounded">{log.method}</span>
                  {" → "}
                  {log.to} ({log.subject})
                </li>
              ))}
            </ul>
          )}
        </div>

        <EmailDraftDialog
          isOpen={isOpen}
          onClose={handleClose}
          onEmailSent={handleEmailSent}
          onMarkAsSent={(to, subject, body, method) => {
            console.log("[Test Harness] Mark as sent:", { to, subject, method });
          }}
          initialTo={config.props.to || ""}
          initialSubject={config.props.subject || ""}
          initialBody={config.props.body || ""}
          cc={config.props.cc}
          clientName={config.props.clientName}
          attachments={config.props.attachments}
        />

        <Toaster />
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold mb-4">Unknown Component</h1>
      <p>Component "{config.component}" is not available in the test harness.</p>
    </div>
  );
}
