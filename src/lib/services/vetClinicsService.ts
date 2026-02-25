// PBS Admin - Vet Clinics Service
// Directory of veterinary clinics for quick email and contact lookup

import { getSettingJson, setSettingJson } from "./settingsService";

const VET_CLINICS_STORAGE_KEY = 'pbs_admin_vet_clinics';

export interface VetClinic {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
}

/**
 * Get all vet clinics from Settings table
 */
export async function getVetClinics(): Promise<VetClinic[]> {
  return getSettingJson<VetClinic[]>(VET_CLINICS_STORAGE_KEY, []);
}

/**
 * Save all vet clinics to Settings table
 */
export async function saveVetClinics(clinics: VetClinic[]): Promise<void> {
  await setSettingJson(VET_CLINICS_STORAGE_KEY, clinics);
}

/**
 * Add a new vet clinic
 */
export async function addVetClinic(clinic: Omit<VetClinic, 'id'>): Promise<VetClinic> {
  const clinics = await getVetClinics();
  const newClinic: VetClinic = {
    ...clinic,
    id: `vet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  clinics.push(newClinic);
  await saveVetClinics(clinics);
  return newClinic;
}

/**
 * Update an existing vet clinic
 */
export async function updateVetClinic(id: string, updates: Partial<Omit<VetClinic, 'id'>>): Promise<VetClinic | null> {
  const clinics = await getVetClinics();
  const index = clinics.findIndex(c => c.id === id);
  if (index === -1) return null;

  clinics[index] = { ...clinics[index], ...updates };
  await saveVetClinics(clinics);
  return clinics[index];
}

/**
 * Delete a vet clinic
 */
export async function deleteVetClinic(id: string): Promise<boolean> {
  const clinics = await getVetClinics();
  const filtered = clinics.filter(c => c.id !== id);
  if (filtered.length === clinics.length) return false;

  await saveVetClinics(filtered);
  return true;
}

/**
 * Find a vet clinic by name (case-insensitive partial match)
 */
export async function findVetClinicByName(name: string): Promise<VetClinic | undefined> {
  const clinics = await getVetClinics();
  const lowerName = name.toLowerCase();
  return clinics.find(c => c.name.toLowerCase().includes(lowerName));
}

/**
 * Get a vet clinic by ID
 */
export async function getVetClinicById(id: string): Promise<VetClinic | undefined> {
  const clinics = await getVetClinics();
  return clinics.find(c => c.id === id);
}
