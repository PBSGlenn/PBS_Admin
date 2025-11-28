// Behavior Medications Database
// Common veterinary behavior medications with dosing information

export interface Medication {
  id: string;
  genericName: string;
  brandNames: string[];
  category: 'SSRI' | 'TCA' | 'Benzodiazepine' | 'Alpha-2 Agonist' | 'Gabapentinoid' | 'Azapirone' | 'Other';
  species: ('Dog' | 'Cat' | 'Both')[];

  // Dosing information
  doseRange: {
    min: number;
    max: number;
    unit: 'mg/kg' | 'mg/dog' | 'mg/cat';
  };

  // Frequency
  frequencyOptions: string[]; // e.g., ["Once daily", "Twice daily", "Three times daily"]
  defaultFrequency: string;

  // Additional information
  description: string;
  indications: string[];
  sideEffects: string[];
  contraindications: string[];
  notes: string;

  // Prescription details
  scheduleClass?: string; // e.g., "S4", "S8"
  requiresAuthority?: boolean;
}

export const BEHAVIOR_MEDICATIONS: Medication[] = [
  {
    id: 'fluoxetine',
    genericName: 'Fluoxetine',
    brandNames: ['Prozac', 'Reconcile'],
    category: 'SSRI',
    species: ['Both'],
    doseRange: {
      min: 0.5,
      max: 2,
      unit: 'mg/kg',
    },
    frequencyOptions: ['Once daily', 'Twice daily'],
    defaultFrequency: 'Once daily',
    description: 'Selective serotonin reuptake inhibitor (SSRI) used for anxiety, aggression, and compulsive disorders.',
    indications: [
      'Separation anxiety',
      'Generalized anxiety',
      'Fear-based aggression',
      'Compulsive disorders (tail chasing, fly biting)',
      'Noise phobias (long-term management)'
    ],
    sideEffects: [
      'Gastrointestinal upset (nausea, vomiting, diarrhea)',
      'Decreased appetite',
      'Sedation or restlessness',
      'Rare: Serotonin syndrome'
    ],
    contraindications: [
      'Use with MAOIs',
      'Severe liver disease',
      'Seizure disorders (use with caution)'
    ],
    notes: 'Full effect may take 4-6 weeks. Start at lower dose and titrate up. Do not discontinue abruptly.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'sertraline',
    genericName: 'Sertraline',
    brandNames: ['Zoloft'],
    category: 'SSRI',
    species: ['Both'],
    doseRange: {
      min: 1,
      max: 5,
      unit: 'mg/kg',
    },
    frequencyOptions: ['Once daily', 'Twice daily'],
    defaultFrequency: 'Once daily',
    description: 'Selective serotonin reuptake inhibitor (SSRI) with anxiolytic and anti-compulsive properties.',
    indications: [
      'Separation anxiety',
      'Generalized anxiety',
      'Aggression',
      'Compulsive disorders',
      'Urine marking (cats)'
    ],
    sideEffects: [
      'Gastrointestinal upset',
      'Decreased appetite',
      'Sedation',
      'Activation (paradoxical anxiety)'
    ],
    contraindications: [
      'Use with MAOIs',
      'Severe liver or kidney disease'
    ],
    notes: 'May have faster onset than fluoxetine (2-4 weeks). Better tolerated than some SSRIs in cats.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'clomipramine',
    genericName: 'Clomipramine',
    brandNames: ['Clomicalm', 'Anafranil'],
    category: 'TCA',
    species: ['Both'],
    doseRange: {
      min: 1,
      max: 3,
      unit: 'mg/kg',
    },
    frequencyOptions: ['Once daily', 'Twice daily'],
    defaultFrequency: 'Once daily',
    description: 'Tricyclic antidepressant (TCA) with serotonergic and noradrenergic effects.',
    indications: [
      'Separation anxiety (FDA approved for dogs)',
      'Compulsive disorders',
      'Aggression',
      'Noise phobias'
    ],
    sideEffects: [
      'Anticholinergic effects (dry mouth, constipation)',
      'Sedation',
      'Cardiac arrhythmias (rare)',
      'Urinary retention'
    ],
    contraindications: [
      'Cardiac disease',
      'Glaucoma',
      'Prostatic hypertrophy',
      'Use with MAOIs or SSRIs (serotonin syndrome risk)'
    ],
    notes: 'Baseline ECG recommended in dogs with cardiac disease. Full effect 4-6 weeks. Do not combine with SSRIs.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'alprazolam',
    genericName: 'Alprazolam',
    brandNames: ['Xanax', 'Kalma'],
    category: 'Benzodiazepine',
    species: ['Both'],
    doseRange: {
      min: 0.01,
      max: 0.1,
      unit: 'mg/kg',
    },
    frequencyOptions: ['As needed', 'Twice daily', 'Three times daily'],
    defaultFrequency: 'As needed',
    description: 'Short-acting benzodiazepine for acute anxiety and panic.',
    indications: [
      'Acute anxiety episodes',
      'Noise phobias (storm, fireworks)',
      'Panic attacks',
      'Situational anxiety (vet visits, car travel)'
    ],
    sideEffects: [
      'Sedation',
      'Ataxia',
      'Paradoxical excitation (rare)',
      'Tolerance with chronic use',
      'Dependence with long-term use'
    ],
    contraindications: [
      'Severe respiratory disease',
      'Liver disease',
      'Myasthenia gravis'
    ],
    notes: 'Give 30-60 minutes before trigger event. Use sparingly to avoid tolerance. Onset: 30-60 min, Duration: 4-6 hours.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'diazepam',
    genericName: 'Diazepam',
    brandNames: ['Valium', 'Ducene'],
    category: 'Benzodiazepine',
    species: ['Both'],
    doseRange: {
      min: 0.5,
      max: 2,
      unit: 'mg/kg',
    },
    frequencyOptions: ['As needed', 'Twice daily', 'Three times daily'],
    defaultFrequency: 'As needed',
    description: 'Benzodiazepine with anxiolytic, muscle relaxant, and anticonvulsant properties.',
    indications: [
      'Acute anxiety',
      'Situational anxiety',
      'Appetite stimulation (cats)',
      'Urine marking (cats)'
    ],
    sideEffects: [
      'Sedation',
      'Ataxia',
      'Increased appetite',
      'Rare: Hepatic necrosis in cats (oral route)'
    ],
    contraindications: [
      'Severe liver disease',
      'Glaucoma',
      'Myasthenia gravis'
    ],
    notes: 'WARNING: Oral diazepam linked to hepatic necrosis in cats - use transmucosal route if possible. Onset: 30-60 min.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'trazodone',
    genericName: 'Trazodone',
    brandNames: ['Trazorel', 'Molipaxin'],
    category: 'Other',
    species: ['Dog'],
    doseRange: {
      min: 2,
      max: 10,
      unit: 'mg/kg',
    },
    frequencyOptions: ['As needed', 'Once daily', 'Twice daily', 'Three times daily'],
    defaultFrequency: 'As needed',
    description: 'Serotonin antagonist/reuptake inhibitor (SARI) with anxiolytic and sedative properties.',
    indications: [
      'Situational anxiety (vet visits, grooming, travel)',
      'Noise phobias',
      'Adjunct to SSRIs for anxiety',
      'Post-operative sedation',
      'Hospitalization anxiety'
    ],
    sideEffects: [
      'Sedation (dose-dependent)',
      'Ataxia',
      'Gastrointestinal upset',
      'Priapism (very rare)'
    ],
    contraindications: [
      'Severe cardiac disease',
      'Use with MAOIs'
    ],
    notes: 'Give 1-2 hours before trigger event. Can be used daily or as needed. Well tolerated. Lower doses for situational use, higher for daily use.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'gabapentin',
    genericName: 'Gabapentin',
    brandNames: ['Neurontin', 'Gralise'],
    category: 'Gabapentinoid',
    species: ['Both'],
    doseRange: {
      min: 5,
      max: 20,
      unit: 'mg/kg',
    },
    frequencyOptions: ['As needed', 'Twice daily', 'Three times daily'],
    defaultFrequency: 'Twice daily',
    description: 'Gabapentinoid with anxiolytic, analgesic, and anticonvulsant properties.',
    indications: [
      'Situational anxiety (vet visits, travel)',
      'Chronic pain with anxiety component',
      'Noise phobias',
      'Hyperesthesia syndrome (cats)',
      'Adjunct to behavior modification'
    ],
    sideEffects: [
      'Sedation (especially at higher doses)',
      'Ataxia',
      'Rare: Vomiting, diarrhea'
    ],
    contraindications: [
      'Severe renal disease (dose adjustment needed)'
    ],
    notes: 'Very safe medication. Give 2 hours before trigger event for situational use. Well-tolerated in cats. Liquid formulation contains xylitol - toxic to dogs.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'dexmedetomidine-gel',
    genericName: 'Dexmedetomidine Oromucosal Gel',
    brandNames: ['Sileo'],
    category: 'Alpha-2 Agonist',
    species: ['Dog'],
    doseRange: {
      min: 125,
      max: 250,
      unit: 'mg/dog',
    },
    frequencyOptions: ['As needed'],
    defaultFrequency: 'As needed',
    description: 'Alpha-2 adrenergic agonist oromucosal gel specifically for noise aversion.',
    indications: [
      'Noise aversion (fireworks, thunder)',
      'Acute fear events'
    ],
    sideEffects: [
      'Sedation',
      'Bradycardia',
      'Hypotension',
      'Vomiting (transient)'
    ],
    contraindications: [
      'Cardiac disease',
      'Respiratory disease',
      'Hepatic or renal disease',
      'Shock or severe debilitation'
    ],
    notes: 'FDA/APVMA approved for noise aversion. Apply to gums 30-60 min before noise event. Dose based on body surface area (m²). Use gel applicator.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'buspirone',
    genericName: 'Buspirone',
    brandNames: ['Buspar'],
    category: 'Azapirone',
    species: ['Cat'],
    doseRange: {
      min: 2.5,
      max: 7.5,
      unit: 'mg/cat',
    },
    frequencyOptions: ['Once daily', 'Twice daily', 'Three times daily'],
    defaultFrequency: 'Twice daily',
    description: 'Azapirone anxiolytic with serotonergic effects, particularly useful in cats.',
    indications: [
      'Urine spraying/marking (cats)',
      'Generalized anxiety (cats)',
      'Fear-based behaviors',
      'Inter-cat aggression'
    ],
    sideEffects: [
      'Increased affection (in cats)',
      'Rare: Gastrointestinal upset',
      'Mild sedation'
    ],
    contraindications: [
      'Use with MAOIs'
    ],
    notes: 'Particularly effective in cats. Full effect may take 2-4 weeks. Generally well-tolerated. Does not cause sedation or dependence.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'acepromazine',
    genericName: 'Acepromazine',
    brandNames: ['ACP', 'Acetylpromazine'],
    category: 'Other',
    species: ['Both'],
    doseRange: {
      min: 0.01,
      max: 0.05,
      unit: 'mg/kg',
    },
    frequencyOptions: ['As needed'],
    defaultFrequency: 'As needed',
    description: 'Phenothiazine tranquilizer with sedative and antiemetic effects.',
    indications: [
      'Pre-anesthetic sedation',
      'Short-term sedation (grooming, travel)',
      'Motion sickness'
    ],
    sideEffects: [
      'Sedation (dose-dependent)',
      'Hypotension',
      'Hypothermia',
      'Paradoxical excitement (rare)',
      'Penile prolapse (dogs)'
    ],
    contraindications: [
      'Seizure disorders (lowers seizure threshold)',
      'Cardiac disease',
      'MDR1 mutation (use very low doses)',
      'Behavior modification (can increase noise sensitivity)'
    ],
    notes: 'NOT recommended for noise phobias - can worsen fear learning. Use lowest effective dose. Duration: 6-8 hours. Avoid in fearful/anxious patients.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
];

// Helper functions
export function getMedicationById(id: string): Medication | undefined {
  return BEHAVIOR_MEDICATIONS.find(med => med.id === id);
}

export function getMedicationsBySpecies(species: 'Dog' | 'Cat'): Medication[] {
  return BEHAVIOR_MEDICATIONS.filter(med =>
    med.species.includes(species) || med.species.includes('Both')
  );
}

export function getMedicationsByCategory(category: Medication['category']): Medication[] {
  return BEHAVIOR_MEDICATIONS.filter(med => med.category === category);
}

// Dose calculation helper
export function calculateDose(medication: Medication, weight: number, dosePerKg: number): number {
  if (medication.doseRange.unit === 'mg/kg') {
    return weight * dosePerKg;
  }
  // For mg/dog or mg/cat, return the dose directly
  return dosePerKg;
}

// Frequency display
export const FREQUENCY_OPTIONS = [
  { value: 'once_daily', label: 'Once daily', abbreviation: 'OD', latinAbbr: 'SID' },
  { value: 'twice_daily', label: 'Twice daily', abbreviation: 'BD', latinAbbr: 'BID' },
  { value: 'three_times_daily', label: 'Three times daily', abbreviation: 'TDS', latinAbbr: 'TID' },
  { value: 'four_times_daily', label: 'Four times daily', abbreviation: 'QID', latinAbbr: 'QID' },
  { value: 'as_needed', label: 'As needed', abbreviation: 'PRN', latinAbbr: 'PRN' },
] as const;
