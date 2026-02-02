// PBS Admin - Dashboard Screen
// Two-pane layout: Clients list (left) + Overview (right)

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
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
import { useTaskNotifications } from "../../hooks/useTaskNotifications";
import { isMonthlyUpdateDue } from "@/lib/services/medicationUpdateService";
import { startScheduledBackups, stopScheduledBackups } from "@/lib/services/backupService";
import { toast } from "sonner";
import { Bell, Settings, Mail, FileText, FileAudio, Pill, Database, Info, Power, User, Key, Building2 } from "lucide-react";
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
  const { notificationCount } = useTaskNotifications();
  const { openWindow, closeWindow } = useWindow();

  // Start scheduled backups on mount
  useEffect(() => {
    startScheduledBackups();
    return () => stopScheduledBackups();
  }, []);

  // Check for monthly medication updates on mount
  useEffect(() => {
    // Only check when on dashboard view
    if (currentView === "dashboard") {
      const isUpdateDue = isMonthlyUpdateDue();

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
    }
  }, [currentView]);

  const handleNewClient = () => {
    setSelectedClient(null);
    setCurrentView("new-client");
  };

  const handleEditClient = (client: any) => {
    const windowId = createWindowId("client", client.clientId);
    openWindow({
      id: windowId,
      title: `${client.firstName} ${client.lastName}`,
      icon: <User className="h-4 w-4" />,
      component: (
        <ClientView
          client={client}
          onClose={() => closeWindow(windowId)}
        />
      ),
      defaultSize: WINDOW_CONFIGS.client.defaultSize,
      minSize: WINDOW_CONFIGS.client.minSize,
      data: { clientId: client.clientId },
    });
  };

  const handleClientCreated = (client: any) => {
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
        />
      ),
      defaultSize: WINDOW_CONFIGS.client.defaultSize,
      minSize: WINDOW_CONFIGS.client.minSize,
      data: { clientId: client.clientId },
    });
  };

  const handleCloseForm = () => {
    setCurrentView("dashboard");
    setSelectedClient(null);
  };

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
    <div className="flex h-screen bg-background">
      {/* Left Pane - Clients List */}
      <div className="w-1/2 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">PBS Admin</h1>
            <p className="text-xs text-muted-foreground">Pet Behaviour Services</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            {notificationCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="relative h-8 w-8 p-0"
                onClick={() => {
                  // Scroll to tasks section
                  document.getElementById('tasks-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
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

      {/* Right Pane - Overview */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        <div className="p-3 space-y-3 overflow-auto">
          {/* Website Bookings Sync */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Website Bookings</CardTitle>
              <CardDescription className="text-xs">
                Import new bookings from petbehaviourservices.com.au
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <WebsiteBookingsSync />
            </CardContent>
          </Card>

          {/* Questionnaire Sync */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Questionnaires</CardTitle>
              <CardDescription className="text-xs">
                Process submitted questionnaires from Jotform
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <QuestionnaireSync />
            </CardContent>
          </Card>

          {/* Upcoming Bookings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upcoming Bookings</CardTitle>
              <CardDescription className="text-xs">
                Appointments and training sessions in the next 30 days
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <UpcomingBookings />
            </CardContent>
          </Card>

          {/* Tasks Overview */}
          <Card id="tasks-section">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tasks</CardTitle>
              <CardDescription className="text-xs">
                Pending and in-progress tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <TasksOverview />
            </CardContent>
          </Card>
        </div>
      </div>

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
    </div>
  );
}