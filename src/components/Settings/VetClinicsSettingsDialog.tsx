// PBS Admin - Vet Clinics Settings Dialog
// Directory of veterinary clinics for quick contact lookup

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
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import {
  getVetClinics,
  addVetClinic,
  updateVetClinic,
  deleteVetClinic,
  type VetClinic,
} from "@/lib/services/vetClinicsService";

interface VetClinicsSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VetClinicsSettingsDialog({ isOpen, onClose }: VetClinicsSettingsDialogProps) {
  const [clinics, setClinics] = useState<VetClinic[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Load clinics when dialog opens
  useEffect(() => {
    if (isOpen) {
      setClinics(getVetClinics());
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormAddress("");
    setFormNotes("");
    setEditingId(null);
    setIsAdding(false);
  };

  const handleAddNew = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleEdit = (clinic: VetClinic) => {
    setFormName(clinic.name);
    setFormEmail(clinic.email);
    setFormPhone(clinic.phone || "");
    setFormAddress(clinic.address || "");
    setFormNotes(clinic.notes || "");
    setEditingId(clinic.id);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      toast.error("Clinic name is required");
      return;
    }
    if (!formEmail.trim()) {
      toast.error("Email address is required");
      return;
    }

    const clinicData = {
      name: formName.trim(),
      email: formEmail.trim(),
      phone: formPhone.trim() || undefined,
      address: formAddress.trim() || undefined,
      notes: formNotes.trim() || undefined,
    };

    if (editingId) {
      // Update existing
      updateVetClinic(editingId, clinicData);
      toast.success("Clinic updated");
    } else {
      // Add new
      addVetClinic(clinicData);
      toast.success("Clinic added");
    }

    setClinics(getVetClinics());
    resetForm();
  };

  const handleDelete = (id: string) => {
    deleteVetClinic(id);
    setClinics(getVetClinics());
    if (editingId === id) {
      resetForm();
    }
    toast.success("Clinic deleted");
  };

  const handleCancel = () => {
    resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Vet Clinic Directory
          </DialogTitle>
          <DialogDescription>
            Manage veterinary clinic contacts for quick email lookup when sending vet reports.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
          {/* Clinic List */}
          <div className="flex-1 overflow-auto border rounded-md">
            {clinics.length === 0 && !isAdding ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No vet clinics added yet. Click "Add Clinic" to get started.
              </div>
            ) : (
              <div className="divide-y">
                {clinics.map((clinic) => (
                  <div
                    key={clinic.id}
                    className={`p-3 hover:bg-muted/50 ${editingId === clinic.id ? 'bg-blue-50' : ''}`}
                  >
                    {editingId === clinic.id ? (
                      // Edit form inline
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Clinic Name *</Label>
                            <Input
                              value={formName}
                              onChange={(e) => setFormName(e.target.value)}
                              placeholder="Clinic name..."
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Email *</Label>
                            <Input
                              type="email"
                              value={formEmail}
                              onChange={(e) => setFormEmail(e.target.value)}
                              placeholder="clinic@example.com"
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Phone</Label>
                            <Input
                              value={formPhone}
                              onChange={(e) => setFormPhone(e.target.value)}
                              placeholder="Phone number..."
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Address</Label>
                            <Input
                              value={formAddress}
                              onChange={(e) => setFormAddress(e.target.value)}
                              placeholder="Address..."
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[10px]">Notes</Label>
                          <Textarea
                            value={formNotes}
                            onChange={(e) => setFormNotes(e.target.value)}
                            placeholder="Any additional notes..."
                            className="h-14 text-xs resize-none"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancel}
                            className="h-7 text-xs"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSave}
                            className="h-7 text-xs"
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Display view
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{clinic.name}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {clinic.email}
                            </span>
                            {clinic.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {clinic.phone}
                              </span>
                            )}
                            {clinic.address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {clinic.address}
                              </span>
                            )}
                          </div>
                          {clinic.notes && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">
                              {clinic.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(clinic)}
                            className="h-7 w-7 p-0"
                            title="Edit clinic"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(clinic.id)}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                            title="Delete clinic"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Form */}
          {isAdding && (
            <div className="border rounded-md p-3 bg-green-50 space-y-2">
              <p className="text-xs font-medium text-green-800">Add New Clinic</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Clinic Name *</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Clinic name..."
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Email *</Label>
                  <Input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="clinic@example.com"
                    className="h-7 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Phone</Label>
                  <Input
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Phone number..."
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Address</Label>
                  <Input
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Address..."
                    className="h-7 text-xs"
                  />
                </div>
              </div>
              <div>
                <Label className="text-[10px]">Notes</Label>
                <Textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  className="h-14 text-xs resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="h-7 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="h-7 text-xs"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-2 border-t">
            {!isAdding && !editingId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddNew}
                className="h-8 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Clinic
              </Button>
            ) : (
              <div />
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
