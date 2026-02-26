// PBS Admin - Dashboard Screen
// Two-pane layout: Clients list (left) + Overview (right)

import { useState, useEffect, useCallback, useMemo } from "react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { ClientsList } from "./ClientsList";
import { UpcomingBookings } from "./UpcomingBookings";
import { TasksOverview } from "./TasksOverview";
import { WebsiteBookingsSync } from "./WebsiteBookingsSync";
import { QuestionnaireSync } from "./QuestionnaireSync";
import { ClientForm } from "../Client/ClientForm";
import { ClientView } from "../Client/ClientView";
import { EmailTemplateManager } from "../EmailTemplateManager/EmailTemplateManager";
import { PromptTemplateManager } from "../PromptTemplateManager/PromptTemplateManager";
import { TranscriptionTool } from "../TranscriptionTool/TranscriptionTool";
import { MedicationUpdateChecker } from "../MedicationUpdateChecker/MedicationUpdateChecker";
import { BackupManager } from "../BackupManager/BackupManager";
import { AboutDialog } from "../About/AboutDialog";
import { StartupSettingsDialog } from "../Settings/StartupSettingsDialog";
import { ApiKeysSettingsDialog } from "../Settings/ApiKeysSettingsDialog";
import { VetClinicsSettingsDialog } from "../Settings/VetClinicsSettingsDialog";
import { CommandPalette, CommandAction } from "../CommandPalette/CommandPalette";
import { useTaskNotifications } from "../../hooks/useTaskNotifications";
import { isMonthlyUpdateDue } from "@/lib/services/medicationUpdateService";
import { startScheduledBackups, stopScheduledBackups } from "@/lib/services/backupService";
import { toast } from "sonner";
import { Bell, Settings, Mail, FileText, FileAudio, Pill, Database, Info, Power, User, UserPlus, Key, Building2, Search } from "lucide-react";
import { useWindow, createWindowId, WINDOW_CONFIGS } from "@/hooks/useWindow";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type View = "dashboard" | "new-client" | "view-client" | "email-templates" | "ai-prompts" | "audio-transcription";

export function Dashboard() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isTranscriptionToolOpen, setIsTranscriptionToolOpen] = useState(false);
  const [isMedicationUpdateCheckerOpen, setIsMedicationUpdateCheckerOpen] = useState(false);
  const [isBackupManagerOpen, setIsBackupManagerOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isStartupSettingsOpen, setIsStartupSettingsOpen] = useState(false);
  const [isApiKeysSettingsOpen, setIsApiKeysSettingsOpen] = useState(false);
  const [isVetClinicsSettingsOpen, setIsVetClinicsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tasks");
  const { notificationCount } = useTaskNotifications();
  const { openWindow, closeWindow } = useWindow();

  // Global Ctrl+K keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Start scheduled backups on mount
  useEffect(() => {
    startScheduledBackups();
    return () => stopScheduledBackups();
  }, []);

  // Check for monthly medication updates on mount
  useEffect(() => {
    // Only check when on dashboard view
    if (currentView === "dashboard") {
      (async () => {
        const isUpdateDue = await isMonthlyUpdateDue();

        if (isUpdateDue) {
          // Show notification with action button
          toast.info('Medication database update check is due', {
            description: 'Check for brand name updates from Australian pharmaceutical databases',
            duration: 10000, // 10 seconds
            action: {
              label: 'Check Now',
              onClick: () => setIsMedicationUpdateCheckerOpen(true),
            },
          });
        }
      })();
    }
  }, [currentView]);

  const handleNewClient = useCallback(() => {
    setSelectedClient(null);
    setCurrentView("new-client");
  }, []);

  const handleEditClient = useCallback((client: any) => {
    const windowId = createWindowId("client", client.clientId);
    openWindow({
      id: windowId,
      title: `${client.firstName} ${client.lastName}`,
      icon: <User className="h-4 w-4" />,
      component: (
        <ClientView
          client={client}
          onClose={() => closeWindow(windowId)}
          windowId={windowId}
        />
      ),
      defaultSize: WINDOW_CONFIGS.client.defaultSize,
      minSize: WINDOW_CONFIGS.client.minSize,
      data: { clientId: client.clientId },
    });
  }, [openWindow, closeWindow]);

  const handleClientCreated = useCallback((client: any) => {
    // After creating a client, close the form and open in a window
    setCurrentView("dashboard");
    setSelectedClient(null);

    // Open the new client in a window
    const windowId = createWindowId("client", client.clientId);
    openWindow({
      id: windowId,
      title: `${client.firstName} ${client.lastName}`,
      icon: <User className="h-4 w-4" />,
      component: (
        <ClientView
          client={client}
          onClose={() => closeWindow(windowId)}
          windowId={windowId}
        />
      ),
      defaultSize: WINDOW_CONFIGS.client.defaultSize,
      minSize: WINDOW_CONFIGS.client.minSize,
      data: { clientId: client.clientId },
    });
  }, [openWindow, closeWindow]);

  const handleCloseForm = useCallback(() => {
    setCurrentView("dashboard");
    setSelectedClient(null);
  }, []);

  // Command palette actions
  const commandActions: CommandAction[] = useMemo(() => [
    // Navigation actions
    {
      id: "new-client",
      label: "New Client",
      category: "navigation" as const,
      icon: <UserPlus className="h-3.5 w-3.5" />,
      keywords: "create add client",
      onSelect: () => handleNewClient(),
    },
    {
      id: "email-templates",
      label: "Email Templates",
      category: "settings" as const,
      icon: <Mail className="h-3.5 w-3.5" />,
      keywords: "email template customize",
      onSelect: () => setCurrentView("email-templates"),
    },
    {
      id: "ai-prompts",
      label: "AI Prompts",
      category: "settings" as const,
      icon: <FileText className="h-3.5 w-3.5" />,
      keywords: "ai prompt template claude report",
      onSelect: () => setCurrentView("ai-prompts"),
    },
    {
      id: "medication-updates",
      label: "Medication Updates",
      category: "settings" as const,
      icon: <Pill className="h-3.5 w-3.5" />,
      keywords: "medication drug brand update pharmacy",
      onSelect: () => setIsMedicationUpdateCheckerOpen(true),
    },
    {
      id: "audio-transcription",
      label: "Audio Transcription Tool",
      category: "navigation" as const,
      icon: <FileAudio className="h-3.5 w-3.5" />,
      keywords: "transcribe audio recording whisper openai",
      onSelect: () => setIsTranscriptionToolOpen(true),
    },
    {
      id: "backup-restore",
      label: "Backup & Restore",
      category: "settings" as const,
      icon: <Database className="h-3.5 w-3.5" />,
      keywords: "backup restore database export",
      onSelect: () => setIsBackupManagerOpen(true),
    },
    {
      id: "startup-settings",
      label: "Startup Settings",
      category: "settings" as const,
      icon: <Power className="h-3.5 w-3.5" />,
      keywords: "startup autostart tray minimize launch",
      onSelect: () => setIsStartupSettingsOpen(true),
    },
    {
      id: "api-keys",
      label: "API Keys",
      category: "settings" as const,
      icon: <Key className="h-3.5 w-3.5" />,
      keywords: "api key anthropic openai resend configure",
      onSelect: () => setIsApiKeysSettingsOpen(true),
    },
    {
      id: "vet-clinics",
      label: "Vet Clinics Directory",
      category: "settings" as const,
      icon: <Building2 className="h-3.5 w-3.5" />,
      keywords: "vet clinic veterinary directory",
      onSelect: () => setIsVetClinicsSettingsOpen(true),
    },
    {
      id: "about",
      label: "About PBS Admin",
      category: "settings" as const,
      icon: <Info className="h-3.5 w-3.5" />,
      keywords: "about version update",
      onSelect: () => setIsAboutDialogOpen(true),
    },
  ], [handleNewClient]);

  // Show new client form
  if (currentView === "new-client") {
    return (
      <ClientForm
        onClose={handleCloseForm}
        onSave={handleClientCreated}
      />
    );
  }

  // Show client view/edit form
  if (currentView === "view-client" && selectedClient) {
    return (
      <ClientView
        client={selectedClient}
        onClose={handleCloseForm}
      />
    );
  }

  // Show email template manager
  if (currentView === "email-templates") {
    return (
      <div className="h-screen flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView("dashboard")}
              className="h-8 text-xs"
            >
              ← Back to Dashboard
            </Button>
            <div>
              <h1 className="text-xl font-bold">Email Template Manager</h1>
              <p className="text-xs text-muted-foreground">Customize your email templates</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <EmailTemplateManager />
        </div>
      </div>
    );
  }

  // Show AI prompt template manager
  if (currentView === "ai-prompts") {
    return (
      <div className="h-screen flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView("dashboard")}
              className="h-8 text-xs"
            >
              ← Back to Dashboard
            </Button>
            <div>
              <h1 className="text-xl font-bold">AI Prompt Template Manager</h1>
              <p className="text-xs text-muted-foreground">Customize system prompts for AI report generation</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          <PromptTemplateManager
            isOpen={true}
            onClose={() => setCurrentView("dashboard")}
          />
        </div>
      </div>
    );
  }

  // Show dashboard
  return (
    <div className="h-screen bg-background">
      <PanelGroup orientation="horizontal">
        {/* Left Pane - Clients List */}
        <Panel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col border-r border-border">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">PBS Admin</h1>
                <p className="text-xs text-muted-foreground">Pet Behaviour Services</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Command Palette Trigger */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground"
                  onClick={() => setIsCommandPaletteOpen(true)}
                >
                  <Search className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Search</span>
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
                    Ctrl K
                  </kbd>
                </Button>
                {/* Notification Bell */}
                {notificationCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative h-8 w-8 p-0"
                    onClick={() => setActiveTab("tasks")}
                    title={`${notificationCount} task${notificationCount > 1 ? 's' : ''} due or overdue`}
                  >
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
                    >
                      {notificationCount}
                    </Badge>
                  </Button>
                )}
                {/* Settings Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs">Settings</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      onClick={() => setCurrentView("email-templates")}
                    >
                      <Mail className="h-3.5 w-3.5 mr-2" />
                      Email Templates
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      onClick={() => setCurrentView("ai-prompts")}
                    >
                      <FileText className="h-3.5 w-3.5 mr-2" />
                      AI Prompts
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      onClick={() => setIsMedicationUpdateCheckerOpen(true)}
                    >
                      <Pill className="h-3.5 w-3.5 mr-2" />
                      Medication Updates
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      onClick={() => setIsTranscriptionToolOpen(true)}
                    >
                      <FileAudio className="h-3.5 w-3.5 mr-2" />
                      Audio Transcription Tool
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      onClick={() => setIsBackupManagerOpen(true)}
                    >
                      <Database className="h-3.5 w-3.5 mr-2" />
                      Backup & Restore
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      onClick={() => setIsStartupSettingsOpen(true)}
                    >
                      <Power className="h-3.5 w-3.5 mr-2" />
                      Startup Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      onClick={() => setIsApiKeysSettingsOpen(true)}
                    >
                      <Key className="h-3.5 w-3.5 mr-2" />
                      API Keys
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      onClick={() => setIsVetClinicsSettingsOpen(true)}
                    >
                      <Building2 className="h-3.5 w-3.5 mr-2" />
                      Vet Clinics Directory
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      onClick={() => setIsAboutDialogOpen(true)}
                    >
                      <Info className="h-3.5 w-3.5 mr-2" />
                      About
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <ClientsList onNewClient={handleNewClient} onEditClient={handleEditClient} />
          </div>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/20 transition-colors cursor-col-resize" />

        {/* Right Pane - Tabbed Overview */}
        <Panel defaultSize={50} minSize={25}>
          <div className="h-full flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <div className="px-3 pt-3 pb-0">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="tasks" className="text-xs">Tasks</TabsTrigger>
                  <TabsTrigger value="upcoming" className="text-xs">Upcoming</TabsTrigger>
                  <TabsTrigger value="bookings" className="text-xs">Bookings</TabsTrigger>
                  <TabsTrigger value="questionnaires" className="text-xs">Questionnaires</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="tasks" className="flex-1 overflow-auto p-3 mt-0">
                <TasksOverview />
              </TabsContent>
              <TabsContent value="upcoming" className="flex-1 overflow-auto p-3 mt-0">
                <UpcomingBookings />
              </TabsContent>
              <TabsContent value="bookings" className="flex-1 overflow-auto p-3 mt-0">
                <WebsiteBookingsSync />
              </TabsContent>
              <TabsContent value="questionnaires" className="flex-1 overflow-auto p-3 mt-0">
                <QuestionnaireSync />
              </TabsContent>
            </Tabs>
          </div>
        </Panel>
      </PanelGroup>

      {/* Audio Transcription Tool Dialog */}
      <TranscriptionTool
        isOpen={isTranscriptionToolOpen}
        onClose={() => setIsTranscriptionToolOpen(false)}
      />

      {/* Medication Update Checker Dialog */}
      <MedicationUpdateChecker
        isOpen={isMedicationUpdateCheckerOpen}
        onClose={() => setIsMedicationUpdateCheckerOpen(false)}
      />

      {/* Backup Manager Dialog */}
      <BackupManager
        isOpen={isBackupManagerOpen}
        onClose={() => setIsBackupManagerOpen(false)}
      />

      {/* About Dialog */}
      <AboutDialog
        isOpen={isAboutDialogOpen}
        onClose={() => setIsAboutDialogOpen(false)}
      />

      {/* Startup Settings Dialog */}
      <StartupSettingsDialog
        isOpen={isStartupSettingsOpen}
        onClose={() => setIsStartupSettingsOpen(false)}
      />

      {/* API Keys Settings Dialog */}
      <ApiKeysSettingsDialog
        isOpen={isApiKeysSettingsOpen}
        onClose={() => setIsApiKeysSettingsOpen(false)}
      />

      {/* Vet Clinics Settings Dialog */}
      <VetClinicsSettingsDialog
        isOpen={isVetClinicsSettingsOpen}
        onClose={() => setIsVetClinicsSettingsOpen(false)}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        actions={commandActions}
        onOpenClient={handleEditClient}
      />
    </div>
  );
}