// PBS Admin - Client View Component
// Two-pane layout for editing client and managing related data

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { EmailInput } from "../ui/email-input";
import { AddressInput } from "../ui/address-input";
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
import { toast } from "sonner";

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
    primaryCareVet: client?.primaryCareVet || "",
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
    primaryCareVet: client?.primaryCareVet || "",
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
  const [currentFolderPath, setCurrentFolderPath] = useState<string>(client?.folderPath || "");

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
      toast.error("Failed to save changes", {
        description: error instanceof Error ? error.message : String(error),
      });
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
    if (currentFolderPath) {
      // If folder path exists, open it
      try {
        await invoke("plugin:opener|open_path", { path: currentFolderPath });
      } catch (error) {
        console.error("Failed to open folder:", error);
        toast.error("Could not open folder", {
          description: error instanceof Error ? error.message : String(error),
        });
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

        // Update local state to immediately reflect the change
        setCurrentFolderPath(folderPath);

        // Refresh client data
        queryClient.invalidateQueries({ queryKey: ["clients"] });

        // Show success dialog
        setCreatedFolderPath(folderPath);
        setShowSuccessDialog(true);
      } catch (error) {
        toast.error("Failed to create folder", {
          description: error instanceof Error ? error.message : String(error),
        });
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
        <div className="p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-7 w-7"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <div>
                <h1 className="text-sm font-bold">Edit Client</h1>
                <p className="text-[10px] text-muted-foreground">Update client information</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-1.5">
            {/* Basic Information */}
            <Card>
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-[11px] font-semibold">Basic Information</CardTitle>
                <CardDescription className="text-[10px]">Required client contact details</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 px-3 pb-2">
                <div className="space-y-0.5">
                  <Label htmlFor="firstName" className="text-[10px]">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    className={`h-7 text-[11px] ${errors.firstName ? "border-destructive" : ""}`}
                  />
                  {errors.firstName && (
                    <p className="text-[10px] text-destructive">{errors.firstName}</p>
                  )}
                </div>

                <div className="space-y-0.5">
                  <Label htmlFor="lastName" className="text-[10px]">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    className={`h-7 text-[11px] ${errors.lastName ? "border-destructive" : ""}`}
                  />
                  {errors.lastName && (
                    <p className="text-[10px] text-destructive">{errors.lastName}</p>
                  )}
                </div>

                <div className="space-y-0.5">
                  <Label htmlFor="email" className="text-[10px]">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <EmailInput
                    id="email"
                    value={formData.email}
                    onChange={(value) => handleChange("email", value)}
                    className={`h-7 text-[11px] ${errors.email ? "border-destructive" : ""}`}
                    clientFirstName={formData.firstName}
                    clientLastName={formData.lastName}
                    clientFolderPath={currentFolderPath}
                  />
                  {errors.email && (
                    <p className="text-[10px] text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-0.5">
                  <Label htmlFor="mobile" className="text-[10px]">
                    Mobile <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mobile"
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => handleChange("mobile", e.target.value)}
                    className={`h-7 text-[11px] ${errors.mobile ? "border-destructive" : ""}`}
                  />
                  {errors.mobile && (
                    <p className="text-[10px] text-destructive">{errors.mobile}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card>
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-[11px] font-semibold">Address</CardTitle>
                <CardDescription className="text-[10px]">Optional address information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-2">
                <div className="space-y-0.5">
                  <Label htmlFor="streetAddress" className="text-[10px]">Street Address</Label>
                  <AddressInput
                    id="streetAddress"
                    value={formData.streetAddress}
                    onChange={(value) => handleChange("streetAddress", value)}
                    className="h-7 text-[11px]"
                    city={formData.city}
                    state={formData.state}
                    postcode={formData.postcode}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="city" className="text-[10px]">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      className="h-7 text-[11px]"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <Label htmlFor="state" className="text-[10px]">State</Label>
                    <Select
                      value={formData.state || "VIC"}
                      onValueChange={(value) => handleChange("state", value)}
                    >
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUSTRALIAN_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value} className="text-[11px]">
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-0.5">
                    <Label htmlFor="postcode" className="text-[10px]">Postcode</Label>
                    <Input
                      id="postcode"
                      value={formData.postcode}
                      onChange={(e) => handleChange("postcode", e.target.value)}
                      className="h-7 text-[11px]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Veterinary Information */}
            <Card>
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-[11px] font-semibold">Veterinary Information</CardTitle>
                <CardDescription className="text-[10px]">Primary care veterinarian details</CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <div className="space-y-0.5">
                  <Label htmlFor="primaryCareVet" className="text-[10px]">
                    Primary Care Vet
                  </Label>
                  <Input
                    id="primaryCareVet"
                    value={formData.primaryCareVet}
                    onChange={(e) => handleChange("primaryCareVet", e.target.value)}
                    placeholder="e.g., Dr. Smith at Melbourne Veterinary Clinic"
                    className="h-7 text-[11px]"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Used for veterinary reports and referrals
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-[11px] font-semibold">Notes</CardTitle>
                <CardDescription className="text-[10px]">Additional information about this client</CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={3}
                  placeholder="Any additional notes about this client..."
                  className="text-[11px] min-h-[60px]"
                />
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-between gap-2 pt-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={handleFolderButtonClick}
                size="sm"
                className="h-7 text-[11px]"
              >
                {currentFolderPath ? (
                  <>
                    <FolderOpen className="h-3 w-3 mr-1" />
                    Open Folder
                  </>
                ) : (
                  <>
                    <Folder className="h-3 w-3 mr-1" />
                    Create or Change Client Folder
                  </>
                )}
              </Button>
              <Button
                type="submit"
                disabled={!hasChanges() || saveMutation.isPending || showSaveSuccess}
                size="sm"
                className="h-7 text-[11px]"
              >
                {showSaveSuccess ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Saved!
                  </>
                ) : saveMutation.isPending ? (
                  <>
                    <Save className="h-3 w-3 mr-1" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3 mr-1" />
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
        <div className="p-3 space-y-2 overflow-auto">
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