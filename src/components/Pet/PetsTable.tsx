// PBS Admin - Pets Table Component
// Displays pets for a client with add/edit/delete functionality

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { PetForm } from "./PetForm";
import { getPetsByClientId, deletePet } from "@/lib/services/petService";
import type { Pet } from "@/lib/types";
import { calculateAge } from "@/lib/utils/ageUtils";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface PetsTableProps {
  clientId: number;
}

export function PetsTable({ clientId }: PetsTableProps) {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [deletingPet, setDeletingPet] = useState<Pet | null>(null);

  // Fetch pets for this client
  const { data: pets = [], isLoading } = useQuery({
    queryKey: ["pets", clientId],
    queryFn: () => getPetsByClientId(clientId),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deletePet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error) => {
      toast.error("Failed to delete pet", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const handleDelete = (pet: Pet) => {
    setDeletingPet(pet);
  };

  const confirmDelete = () => {
    if (deletingPet) {
      deleteMutation.mutate(deletingPet.petId);
      setDeletingPet(null);
    }
  };

  const handleEdit = (pet: Pet) => {
    setEditingPet(pet);
  };

  const handleCloseEditDialog = () => {
    setEditingPet(null);
  };

  const displayAge = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return "—";
    try {
      return calculateAge(dateOfBirth);
    } catch {
      return "—";
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="py-2 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Pets</CardTitle>
              <CardDescription className="text-xs">
                {pets.length} {pets.length === 1 ? "pet" : "pets"} registered
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
              className="h-7"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Pet
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {isLoading ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              Loading pets...
            </div>
          ) : pets.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              No pets registered yet. Click "Add Pet" to get started.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] h-8 py-1.5">Name</TableHead>
                    <TableHead className="text-[11px] h-8 py-1.5">Species</TableHead>
                    <TableHead className="text-[11px] h-8 py-1.5">Breed</TableHead>
                    <TableHead className="text-[11px] h-8 py-1.5">Sex</TableHead>
                    <TableHead className="text-[11px] h-8 py-1.5">Age</TableHead>
                    <TableHead className="text-[11px] h-8 py-1.5 w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pets.map((pet) => (
                    <TableRow key={pet.petId} className="h-10">
                      <TableCell className="text-[11px] font-medium py-1.5">
                        {pet.name}
                      </TableCell>
                      <TableCell className="text-[11px] py-1.5">{pet.species}</TableCell>
                      <TableCell className="text-[11px] py-1.5">{pet.breed || "—"}</TableCell>
                      <TableCell className="text-[11px] py-1.5">{pet.sex || "—"}</TableCell>
                      <TableCell className="text-[11px] py-1.5">{displayAge(pet.dateOfBirth)}</TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(pet)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(pet)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Pet Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Pet</DialogTitle>
            <DialogDescription>
              Enter the details for the new pet below.
            </DialogDescription>
          </DialogHeader>
          <PetForm
            clientId={clientId}
            onClose={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Pet Dialog */}
      <Dialog open={!!editingPet} onOpenChange={(open) => !open && handleCloseEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pet</DialogTitle>
            <DialogDescription>
              Update the details for {editingPet?.name}.
            </DialogDescription>
          </DialogHeader>
          {editingPet && (
            <PetForm
              clientId={clientId}
              pet={editingPet}
              onClose={handleCloseEditDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deletingPet}
        onOpenChange={(open) => !open && setDeletingPet(null)}
        title="Delete Pet"
        description={`Are you sure you want to delete ${deletingPet?.name}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </>
  );
}
