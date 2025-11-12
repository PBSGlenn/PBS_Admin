// PBS Admin - Dashboard Screen
// Two-pane layout: Clients list (left) + Overview (right)

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { ClientsList } from "./ClientsList";
import { UpcomingBookings } from "./UpcomingBookings";
import { TasksOverview } from "./TasksOverview";
import { WebsiteBookingsSync } from "./WebsiteBookingsSync";
import { QuestionnaireSync } from "./QuestionnaireSync";
import { ClientForm } from "../Client/ClientForm";
import { ClientView } from "../Client/ClientView";

type View = "dashboard" | "new-client" | "view-client";

export function Dashboard() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [selectedClient, setSelectedClient] = useState<any>(null);

  const handleNewClient = () => {
    setSelectedClient(null);
    setCurrentView("new-client");
  };

  const handleEditClient = (client: any) => {
    setSelectedClient(client);
    setCurrentView("view-client");
  };

  const handleClientCreated = (client: any) => {
    // After creating a client, switch to the ClientView
    setSelectedClient(client);
    setCurrentView("view-client");
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

  // Show dashboard
  return (
    <div className="flex h-screen bg-background">
      {/* Left Pane - Clients List */}
      <div className="w-1/2 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h1 className="text-xl font-bold">PBS Admin</h1>
          <p className="text-xs text-muted-foreground">Pet Behaviour Services</p>
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
          <Card>
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
    </div>
  );
}