// PBS Admin - Client Form Component
// Form for creating new client

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { createClient, updateClient } from "@/lib/services/clientService";
import { FolderCreationDialog } from "./FolderCreationDialog";
import { FolderSuccessDialog } from "./FolderSuccessDialog";
import { onClientCreated } from "@/lib/automation/engine";
import { formatAustralianMobile, getRawPhoneNumber } from "@/lib/utils/phoneUtils";
import { AUSTRALIAN_STATES } from "@/lib/constants";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, Save, X } from "lucide-react";

export interface ClientFormProps {
  onClose: () => void;
  onSave?: (client: any) => void;
}

export function ClientForm({ onClose, onSave }: ClientFormProps) {
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    streetAddress: "",
    city: "",
    state: "VIC",
    postcode: "",
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFormValid, setIsFormValid] = useState(false);

  // Folder creation dialog state
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [savedClient, setSavedClient] = useState<any>(null);
  const [defaultBasePath, setDefaultBasePath] = useState<string>("");

  // Folder success dialog state
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdFolderPath, setCreatedFolderPath] = useState<string>("");

  // Check if all required fields are valid
  const checkFormValidity = () => {
    const hasFirstName = formData.firstName.trim().length > 0;
    const hasLastName = formData.lastName.trim().length > 0;
    const hasEmail = formData.email.trim().length > 0;
    const hasValidEmail = /^\S+@\S+\.\S+$/.test(formData.email);
    const hasMobile = formData.mobile.trim().length > 0;

    return hasFirstName && hasLastName && hasEmail && hasValidEmail && hasMobile;
  };

  // Update form validity whenever form data changes
  useEffect(() => {
    setIsFormValid(checkFormValidity());
  }, [formData]);

  // Load default folder path on mount
  useEffect(() => {
    invoke<string>("get_default_client_records_path")
      .then(setDefaultBasePath)
      .catch((error) => {
        console.error("Failed to get default client records path:", error);
      });
  }, []);

  // Create mutation
  const saveMutation = useMutation({
    mutationFn: createClient,
    onSuccess: async (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });

      // Trigger automation to create Note event
      try {
        await onClientCreated(client);
        console.log(`[ClientForm] Triggered automation for client creation`);
      } catch (error) {
        console.error(`[ClientForm] Automation error:`, error);
      }

      // Show folder creation dialog
      setSavedClient(client);
      setShowFolderDialog(true);
    },
    onError: (error) => {
      alert(`Failed to save client: ${error}`);
    },
  });

  // Handle folder creation confirmation
  const handleFolderConfirm = async (createFolder: boolean, folderPath?: string) => {
    setShowFolderDialog(false);

    if (createFolder && folderPath && savedClient) {
      try {
        // Create the folder
        await invoke<string>("create_folder", { path: folderPath });

        // Update client with folder path
        await updateClient(savedClient.clientId, { folderPath });

        // Refresh client data
        queryClient.invalidateQueries({ queryKey: ["clients"] });

        // Show success dialog
        setCreatedFolderPath(folderPath);
        setShowSuccessDialog(true);
      } catch (error) {
        alert(`Failed to create folder: ${error}`);
        // If folder creation failed, still close the form
        if (onSave && savedClient) onSave(savedClient);
        onClose();
      }
    } else {
      // User skipped folder creation, close immediately
      if (onSave && savedClient) onSave(savedClient);
      onClose();
    }
  };

  // Handle folder dialog cancel
  const handleFolderCancel = () => {
    setShowFolderDialog(false);
    if (onSave && savedClient) onSave(savedClient);
    onClose();
  };

  // Handle success dialog close
  const handleSuccessClose = () => {
    setShowSuccessDialog(false);
    if (onSave && savedClient) onSave(savedClient);
    onClose();
  };

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

  // Handle field changes with real-time validation
  const handleChange = (field: string, value: string) => {
    // Auto-format mobile phone number as user types
    if (field === "mobile") {
      value = formatAustralianMobile(value);
    }

    setFormData(prev => ({ ...prev, [field]: value }));

    // Real-time validation for the field being changed
    let fieldError = "";

    if (field === "firstName" && !value.trim()) {
      fieldError = "First name is required";
    } else if (field === "lastName" && !value.trim()) {
      fieldError = "Last name is required";
    } else if (field === "email") {
      if (!value.trim()) {
        fieldError = "Email is required";
      } else if (!/^\S+@\S+\.\S+$/.test(value)) {
        fieldError = "Invalid email format";
      }
    } else if (field === "mobile" && !value.trim()) {
      fieldError = "Mobile number is required";
    }

    setErrors(prev => ({
      ...prev,
      [field]: fieldError
    }));
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-4">
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
                <h1 className="text-lg font-bold">New Client</h1>
                <p className="text-xs text-muted-foreground">Add a new client to the system</p>
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
                      value={formData.state}
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
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                size="sm"
                className="h-8"
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isFormValid || saveMutation.isPending}
                size="sm"
                className="h-8"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saveMutation.isPending ? "Creating..." : "Create Client"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Folder Creation Dialog */}
      {savedClient && (
        <FolderCreationDialog
          open={showFolderDialog}
          clientId={savedClient.clientId}
          surname={savedClient.lastName}
          defaultBasePath={defaultBasePath}
          onConfirm={handleFolderConfirm}
          onCancel={handleFolderCancel}
        />
      )}

      {/* Folder Success Dialog */}
      <FolderSuccessDialog
        open={showSuccessDialog}
        folderPath={createdFolderPath}
        onClose={handleSuccessClose}
      />
    </div>
  );
}