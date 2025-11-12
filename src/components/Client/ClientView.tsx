// PBS Admin - Client View Component
// Two-pane layout for editing client and managing related data

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { updateClient } from "@/lib/services/clientService";
import { PetsTable } from "../Pet/PetsTable";
import { EventsTable } from "../Event/EventsTable";
import { TasksTable } from "../Task/TasksTable";
import { FolderCreationDialog } from "./FolderCreationDialog";
import { FolderSuccessDialog } from "./FolderSuccessDialog";
import { formatAustralianMobile, getRawPhoneNumber } from "@/lib/utils/phoneUtils";
import { AUSTRALIAN_STATES } from "@/lib/constants";
import { ArrowLeft, Save, Folder, FolderOpen, CheckCircle2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export interface ClientViewProps {
  client: any;
  onClose: () => void;
}

export function ClientView({ client, onClose }: ClientViewProps) {
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    firstName: client?.firstName || "",
    lastName: client?.lastName || "",
    email: client?.email || "",
    mobile: formatAustralianMobile(client?.mobile || ""),
    streetAddress: client?.streetAddress || "",
    city: client?.city || "",
    state: client?.state || "VIC",
    postcode: client?.postcode || "",
    notes: client?.notes || "",
  });

  // Track original data to detect changes
  const [originalData, setOriginalData] = useState({
    firstName: client?.firstName || "",
    lastName: client?.lastName || "",
    email: client?.email || "",
    mobile: formatAustralianMobile(client?.mobile || ""),
    streetAddress: client?.streetAddress || "",
    city: client?.city || "",
    state: client?.state || "VIC",
    postcode: client?.postcode || "",
    notes: client?.notes || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Check if form has changes
  const hasChanges = () => {
    return Object.keys(formData).some(
      (key) => formData[key as keyof typeof formData] !== originalData[key as keyof typeof originalData]
    );
  };

  // Folder management state
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdFolderPath, setCreatedFolderPath] = useState<string>("");
  const [defaultBasePath, setDefaultBasePath] = useState<string>("");

  // Load default folder path on mount
  useEffect(() => {
    invoke<string>("get_default_client_records_path")
      .then(setDefaultBasePath)
      .catch((error) => {
        console.error("Failed to get default client records path:", error);
      });
  }, []);

  // Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return updateClient(client.clientId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });

      // Update originalData to match the saved formData
      setOriginalData({ ...formData });

      // Show success message
      setShowSaveSuccess(true);

      // Hide success message after 2 seconds
      setTimeout(() => {
        setShowSaveSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      console.error("Failed to save client:", error);
      alert(`Failed to save changes: ${error}`);
    },
  });

  // Form validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.mobile.trim()) {
      newErrors.mobile = "Mobile number is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Convert formatted mobile number to raw digits before saving
      const dataToSave = {
        ...formData,
        mobile: getRawPhoneNumber(formData.mobile),
      };
      saveMutation.mutate(dataToSave);
    }
  };

  // Handle field changes
  const handleChange = (field: string, value: string) => {
    // Auto-format mobile phone number as user types
    if (field === "mobile") {
      value = formatAustralianMobile(value);
    }

    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  // Handle folder button click - either open existing folder or show creation dialog
  const handleFolderButtonClick = async () => {
    if (client.folderPath) {
      // If folder path exists, open it
      try {
        await invoke("plugin:opener|open_path", { path: client.folderPath });
      } catch (error) {
        console.error("Failed to open folder:", error);
        alert(`Could not open folder: ${error}`);
      }
    } else {
      // If no folder path, show creation dialog
      setShowFolderDialog(true);
    }
  };

  // Handle folder creation confirmation
  const handleFolderConfirm = async (createFolder: boolean, folderPath?: string) => {
    setShowFolderDialog(false);

    if (createFolder && folderPath) {
      try {
        // Create the folder
        await invoke<string>("create_folder", { path: folderPath });

        // Update client with folder path
        await updateClient(client.clientId, { folderPath });

        // Refresh client data
        queryClient.invalidateQueries({ queryKey: ["clients"] });

        // Show success dialog
        setCreatedFolderPath(folderPath);
        setShowSuccessDialog(true);
      } catch (error) {
        alert(`Failed to create folder: ${error}`);
      }
    }
  };

  // Handle folder dialog cancel
  const handleFolderCancel = () => {
    setShowFolderDialog(false);
  };

  // Handle success dialog close
  const handleSuccessClose = () => {
    setShowSuccessDialog(false);
  };


  return (
    <div className="flex h-screen bg-background">
      {/* Left Pane - Client Form */}
      <div className="w-1/2 border-r border-border flex flex-col overflow-auto">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">Edit Client</h1>
                <p className="text-xs text-muted-foreground">Update client information</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Basic Information */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Basic Information</CardTitle>
                <CardDescription className="text-xs">Required client contact details</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 px-4 pb-4">
                <div className="space-y-1">
                  <Label htmlFor="firstName" className="text-xs">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    className={`h-8 text-sm ${errors.firstName ? "border-destructive" : ""}`}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-destructive">{errors.firstName}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="lastName" className="text-xs">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    className={`h-8 text-sm ${errors.lastName ? "border-destructive" : ""}`}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-destructive">{errors.lastName}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className={`h-8 text-sm ${errors.email ? "border-destructive" : ""}`}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="mobile" className="text-xs">
                    Mobile <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mobile"
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => handleChange("mobile", e.target.value)}
                    className={`h-8 text-sm ${errors.mobile ? "border-destructive" : ""}`}
                  />
                  {errors.mobile && (
                    <p className="text-xs text-destructive">{errors.mobile}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Address</CardTitle>
                <CardDescription className="text-xs">Optional address information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                <div className="space-y-1">
                  <Label htmlFor="streetAddress" className="text-xs">Street Address</Label>
                  <Input
                    id="streetAddress"
                    value={formData.streetAddress}
                    onChange={(e) => handleChange("streetAddress", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="city" className="text-xs">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="state" className="text-xs">State</Label>
                    <Select
                      value={formData.state || "VIC"}
                      onValueChange={(value) => handleChange("state", value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUSTRALIAN_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="postcode" className="text-xs">Postcode</Label>
                    <Input
                      id="postcode"
                      value={formData.postcode}
                      onChange={(e) => handleChange("postcode", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Notes</CardTitle>
                <CardDescription className="text-xs">Additional information about this client</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={3}
                  placeholder="Any additional notes about this client..."
                  className="text-sm min-h-[60px]"
                />
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleFolderButtonClick}
                size="sm"
                className="h-8"
              >
                {client.folderPath ? (
                  <>
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                    Open Folder
                  </>
                ) : (
                  <>
                    <Folder className="h-3.5 w-3.5 mr-1.5" />
                    Create or Change Client Folder
                  </>
                )}
              </Button>
              <Button
                type="submit"
                disabled={!hasChanges() || saveMutation.isPending || showSaveSuccess}
                size="sm"
                className="h-8"
              >
                {showSaveSuccess ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Saved!
                  </>
                ) : saveMutation.isPending ? (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Pane - Related Data */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        <div className="p-4 space-y-4 overflow-auto">
          {/* Pets Table */}
          <PetsTable clientId={client.clientId} />

          {/* Events Table */}
          <EventsTable clientId={client.clientId} />

          {/* Tasks Table */}
          <TasksTable clientId={client.clientId} />
        </div>
      </div>

      {/* Folder Creation Dialog */}
      <FolderCreationDialog
        open={showFolderDialog}
        clientId={client.clientId}
        surname={client.lastName}
        defaultBasePath={defaultBasePath}
        onConfirm={handleFolderConfirm}
        onCancel={handleFolderCancel}
      />

      {/* Folder Success Dialog */}
      <FolderSuccessDialog
        open={showSuccessDialog}
        folderPath={createdFolderPath}
        onClose={handleSuccessClose}
      />
    </div>
  );
}