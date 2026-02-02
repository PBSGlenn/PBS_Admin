// PBS Admin - Vet Clinics Service
// Directory of veterinary clinics for quick email and contact lookup

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
 * Get all vet clinics from localStorage
 */
export function getVetClinics(): VetClinic[] {
  try {
    const stored = localStorage.getItem(VET_CLINICS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load vet clinics from localStorage:', error);
  }
  return [];
}

/**
 * Save all vet clinics to localStorage
 */
export function saveVetClinics(clinics: VetClinic[]): void {
  try {
    localStorage.setItem(VET_CLINICS_STORAGE_KEY, JSON.stringify(clinics));
  } catch (error) {
    console.error('Failed to save vet clinics to localStorage:', error);
    throw new Error('Failed to save vet clinics');
  }
}

/**
 * Add a new vet clinic
 */
export function addVetClinic(clinic: Omit<VetClinic, 'id'>): VetClinic {
  const clinics = getVetClinics();
  const newClinic: VetClinic = {
    ...clinic,
    id: `vet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  clinics.push(newClinic);
  saveVetClinics(clinics);
  return newClinic;
}

/**
 * Update an existing vet clinic
 */
export function updateVetClinic(id: string, updates: Partial<Omit<VetClinic, 'id'>>): VetClinic | null {
  const clinics = getVetClinics();
  const index = clinics.findIndex(c => c.id === id);
  if (index === -1) return null;

  clinics[index] = { ...clinics[index], ...updates };
  saveVetClinics(clinics);
  return clinics[index];
}

/**
 * Delete a vet clinic
 */
export function deleteVetClinic(id: string): boolean {
  const clinics = getVetClinics();
  const filtered = clinics.filter(c => c.id !== id);
  if (filtered.length === clinics.length) return false;

  saveVetClinics(filtered);
  return true;
}

/**
 * Find a vet clinic by name (case-insensitive partial match)
 */
export function findVetClinicByName(name: string): VetClinic | undefined {
  const clinics = getVetClinics();
  const lowerName = name.toLowerCase();
  return clinics.find(c => c.name.toLowerCase().includes(lowerName));
}

/**
 * Get a vet clinic by ID
 */
export function getVetClinicById(id: string): VetClinic | undefined {
  const clinics = getVetClinics();
  return clinics.find(c => c.id === id);
}
