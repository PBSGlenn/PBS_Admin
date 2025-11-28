// Behavior Medications Database
// Common veterinary behavior medications with dosing information

export interface Medication {
  id: string;
  genericName: string;
  brandNames: string[];
  category: 'SSRI' | 'TCA' | 'Benzodiazepine' | 'Alpha-2 Agonist' | 'Gabapentinoid' | 'Azapirone' | 'MAO-B Inhibitor' | 'Tetracyclic Antidepressant' | 'Beta Blocker' | 'NMDA Antagonist' | 'Hormone' | 'Partial BZD Agonist' | 'Methylxanthine Derivative' | 'Other';
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
    brandNames: ['Generic Health', 'Apotex', 'Sandoz', 'AN'],
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
    brandNames: ['Zoloft', 'Generic Health', 'Sandoz', 'Apo', 'Eleva', 'Sertra', 'Setrona'],
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
    brandNames: ['Kalma', 'Alprax', 'Sandoz'],
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
    brandNames: ['Valium', 'Ducene', 'Valpam', 'Antenex', 'Propam'],
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
    brandNames: ['Trazocalm', 'Compounded formulation'],
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
    notes: 'Trazocalm veterinary product now available in Australia. Give 90-120 minutes before trigger event. Can be used daily or as needed. Well tolerated. Synergistic with gabapentin. Lower doses for situational use, higher for daily use.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'gabapentin',
    genericName: 'Gabapentin',
    brandNames: ['Neurontin', 'Nupentin', 'Gabapentin Pfizer', 'Gabapentin-GA', 'Gabaran', 'Gabatine'],
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
    brandNames: ['Compounded formulation'],
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
    notes: 'Buspar/Bustab discontinued in Australia - must be compounded. Particularly effective in cats. Full effect may take 2-4 weeks. Generally well-tolerated. Does not cause sedation or dependence.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'acepromazine',
    genericName: 'Acepromazine',
    brandNames: ['ACP', 'PromAce', 'Atravet', 'Acezine', 'Aceproject'],
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
  {
    id: 'paroxetine',
    genericName: 'Paroxetine',
    brandNames: ['Aropax', 'Paxtine', 'Oxetine'],
    category: 'SSRI',
    species: ['Both'],
    doseRange: {
      min: 0.5,
      max: 2,
      unit: 'mg/kg',
    },
    frequencyOptions: ['Once daily'],
    defaultFrequency: 'Once daily',
    description: 'Selective serotonin reuptake inhibitor (SSRI) with potent anxiolytic properties.',
    indications: [
      'Generalised anxiety',
      'Social anxiety',
      'Fear-based aggression',
      'Compulsive disorders',
      'Panic disorders'
    ],
    sideEffects: [
      'Gastrointestinal upset',
      'Decreased appetite',
      'Sedation or activation',
      'Rare: Serotonin syndrome'
    ],
    contraindications: [
      'Use with MAOIs',
      'Severe liver or kidney disease'
    ],
    notes: 'May be preferred for social anxiety. Full effect 4-6 weeks. More sedating than fluoxetine. Do not discontinue abruptly.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'amitriptyline',
    genericName: 'Amitriptyline',
    brandNames: ['Endep', 'Entrip'],
    category: 'TCA',
    species: ['Both'],
    doseRange: {
      min: 1,
      max: 4,
      unit: 'mg/kg',
    },
    frequencyOptions: ['Once daily', 'Twice daily'],
    defaultFrequency: 'Twice daily',
    description: 'Tricyclic antidepressant with anticholinergic and antihistaminic properties.',
    indications: [
      'Anxiety',
      'Urine marking (cats)',
      'Pruritus with anxiety component',
      'Fear-based behaviors',
      'Compulsive disorders'
    ],
    sideEffects: [
      'Anticholinergic effects (dry mouth, constipation, urinary retention)',
      'Sedation',
      'Cardiac arrhythmias (rare)',
      'Weight gain'
    ],
    contraindications: [
      'Cardiac disease',
      'Glaucoma',
      'Prostatic hypertrophy',
      'Use with MAOIs or SSRIs'
    ],
    notes: 'Antihistaminic properties useful for anxiety with pruritus. Lower doses in cats (0.5-2 mg/kg). Full effect 4-6 weeks. Monitor for anticholinergic effects.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'clonidine',
    genericName: 'Clonidine',
    brandNames: ['Catapres', 'Compounded formulation'],
    category: 'Alpha-2 Agonist',
    species: ['Both'],
    doseRange: {
      min: 0.01,
      max: 0.05,
      unit: 'mg/kg',
    },
    frequencyOptions: ['As needed', 'Twice daily', 'Three times daily'],
    defaultFrequency: 'As needed',
    description: 'Alpha-2 adrenergic agonist that reduces physical signs of anxiety.',
    indications: [
      'Noise phobia (storms, fireworks)',
      'Panic disorders',
      'Vet visit anxiety',
      'Situational anxiety',
      'Acute fear events'
    ],
    sideEffects: [
      'Sedation',
      'Bradycardia',
      'Hypotension',
      'Dry mouth'
    ],
    contraindications: [
      'Cardiac disease',
      'Severe hypotension',
      'Kidney disease (dose adjustment needed)'
    ],
    notes: 'Give 90 minutes before trigger event. Reduces physical signs of anxiety (trembling, panting). Synergistic with behavior modification. Duration: 4-6 hours.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'lorazepam',
    genericName: 'Lorazepam',
    brandNames: ['Ativan', 'Lorapam'],
    category: 'Benzodiazepine',
    species: ['Both'],
    doseRange: {
      min: 0.02,
      max: 0.1,
      unit: 'mg/kg',
    },
    frequencyOptions: ['As needed', 'Twice daily'],
    defaultFrequency: 'As needed',
    description: 'Intermediate-acting benzodiazepine, safer for cats than diazepam.',
    indications: [
      'Acute anxiety',
      'Panic attacks',
      'Noise phobias',
      'Situational anxiety',
      'Vet visit anxiety (cats)'
    ],
    sideEffects: [
      'Sedation',
      'Ataxia',
      'Paradoxical excitation (rare)',
      'Tolerance with chronic use'
    ],
    contraindications: [
      'Severe respiratory disease',
      'Liver disease',
      'Myasthenia gravis'
    ],
    notes: 'SAFER for cats than diazepam - no hepatic necrosis risk. Cats: 0.125-0.5 mg/cat q12-24h. Give 1-2 hours before trigger event. Onset: 30-60 min.',
    scheduleClass: 'S8',
    requiresAuthority: true,
  },
  {
    id: 'oxazepam',
    genericName: 'Oxazepam',
    brandNames: ['Serepax', 'Alepam'],
    category: 'Benzodiazepine',
    species: ['Cat'],
    doseRange: {
      min: 0.2,
      max: 0.5,
      unit: 'mg/kg',
    },
    frequencyOptions: ['Once daily', 'Twice daily'],
    defaultFrequency: 'Twice daily',
    description: 'Benzodiazepine with anxiolytic and appetite stimulation properties, safe for cats.',
    indications: [
      'Anxiety (cats)',
      'Appetite stimulation',
      'Urine spraying',
      'Inter-cat aggression'
    ],
    sideEffects: [
      'Sedation',
      'Ataxia',
      'Increased appetite',
      'Tolerance with prolonged use'
    ],
    contraindications: [
      'Severe liver disease',
      'Myasthenia gravis'
    ],
    notes: 'Particularly safe for cats - no hepatic failure reports. Dual action: anxiolytic + appetite stimulant. Cats: 0.2-0.5 mg/kg q12-24h. Onset: 1-2 hours.',
    scheduleClass: 'S8',
    requiresAuthority: true,
  },
  {
    id: 'selegiline',
    genericName: 'Selegiline',
    brandNames: ['Anipryl', 'Selgian', 'Eldepryl'],
    category: 'MAO-B Inhibitor',
    species: ['Dog'],
    doseRange: {
      min: 0.5,
      max: 1,
      unit: 'mg/kg',
    },
    frequencyOptions: ['Once daily'],
    defaultFrequency: 'Once daily',
    description: 'MAO-B inhibitor specifically indicated for canine cognitive dysfunction syndrome.',
    indications: [
      'Cognitive dysfunction syndrome (CDS)',
      'Age-related behavioral changes',
      'Disorientation',
      'Sleep-wake cycle disturbances'
    ],
    sideEffects: [
      'Gastrointestinal upset',
      'Hyperactivity',
      'Restlessness',
      'Rare: Serotonin syndrome (if combined with SSRIs)'
    ],
    contraindications: [
      'Use with SSRIs, TCAs, or other MAOIs',
      'Pheochromocytoma'
    ],
    notes: 'ONLY drug specifically for CDS. Give in the morning. Do NOT combine with SSRIs (serotonin syndrome risk). Effect seen in 2-4 weeks, maximum at 8 weeks.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'mirtazapine',
    genericName: 'Mirtazapine',
    brandNames: ['Remeron', 'Avanza', 'Mirataz'],
    category: 'Tetracyclic Antidepressant',
    species: ['Both'],
    doseRange: {
      min: 0.5,
      max: 1,
      unit: 'mg/kg',
    },
    frequencyOptions: ['Once daily', 'Every 48 hours'],
    defaultFrequency: 'Every 48 hours',
    description: 'Tetracyclic antidepressant with appetite stimulation, antiemetic, and anxiolytic properties.',
    indications: [
      'Appetite stimulation',
      'Nausea/vomiting',
      'Anxiety (emerging use)',
      'Weight loss',
      'Inappetence'
    ],
    sideEffects: [
      'Sedation',
      'Increased appetite (desired effect)',
      'Hyperactivity (rare)',
      'Serotonin syndrome (if combined with SSRIs)'
    ],
    contraindications: [
      'Use with MAOIs',
      'Severe liver disease'
    ],
    notes: 'Mirataz (transdermal) APVMA registered for cats. Cats: 1.88 mg q48h. Dogs: 0.5-1 mg/kg q24h. Triple action: appetite + antiemetic + anxiolytic. Onset: 1-2 hours.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'propranolol',
    genericName: 'Propranolol',
    brandNames: ['Inderal', 'Deralin'],
    category: 'Beta Blocker',
    species: ['Dog'],
    doseRange: {
      min: 0.5,
      max: 2,
      unit: 'mg/kg',
    },
    frequencyOptions: ['Twice daily', 'Three times daily'],
    defaultFrequency: 'Three times daily',
    description: 'Non-selective beta-blocker that reduces physical signs of anxiety.',
    indications: [
      'Physical signs of anxiety (trembling, panting)',
      'Noise phobia (adjunct)',
      'Performance anxiety',
      'Situational anxiety'
    ],
    sideEffects: [
      'Bradycardia',
      'Hypotension',
      'Bronchospasm',
      'Lethargy',
      'Exercise intolerance'
    ],
    contraindications: [
      'Asthma or bronchospastic disease',
      'Heart block',
      'Severe bradycardia',
      'Hypotension'
    ],
    notes: 'Reduces somatic symptoms WITHOUT anxiolytic effect - must combine with behavior modification. Give 1-2 hours before event. Does NOT address underlying anxiety - only physical signs.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'memantine',
    genericName: 'Memantine',
    brandNames: ['Ebixa', 'Namenda'],
    category: 'NMDA Antagonist',
    species: ['Dog'],
    doseRange: {
      min: 0.3,
      max: 1,
      unit: 'mg/kg',
    },
    frequencyOptions: ['Twice daily'],
    defaultFrequency: 'Twice daily',
    description: 'NMDA receptor antagonist for refractory compulsive disorders and cognitive dysfunction.',
    indications: [
      'Refractory compulsive disorders',
      'Cognitive dysfunction syndrome',
      'Repetitive behaviors',
      'Tail chasing (resistant to SSRIs)'
    ],
    sideEffects: [
      'Sedation',
      'Ataxia',
      'Gastrointestinal upset',
      'Hyperactivity (rare)'
    ],
    contraindications: [
      'Severe kidney disease (dose adjustment needed)',
      'Seizure disorders (use with caution)'
    ],
    notes: 'For REFRACTORY cases unresponsive to SSRIs/TCAs. May take 4-8 weeks for effect. Often combined with behavior modification. Limited evidence but promising for severe compulsive disorders.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'melatonin',
    genericName: 'Melatonin',
    brandNames: ['Circadin', 'Pharmacy compounded'],
    category: 'Hormone',
    species: ['Both'],
    doseRange: {
      min: 1,
      max: 6,
      unit: 'mg/dog',
    },
    frequencyOptions: ['Once daily', 'Twice daily', 'Three times daily'],
    defaultFrequency: 'Once daily',
    description: 'Neurohormone with anxiolytic, sedative, and chronobiotic properties.',
    indications: [
      'Noise phobia',
      'Anxiety',
      'Sleep disturbances',
      'Cognitive dysfunction (sleep-wake cycle)',
      'Separation anxiety (adjunct)'
    ],
    sideEffects: [
      'Sedation',
      'Rare: Gastrointestinal upset',
      'Generally very well tolerated'
    ],
    contraindications: [
      'Pregnancy (theoretical)',
      'Autoimmune disease (theoretical)'
    ],
    notes: 'S3 (Pharmacist Only) in Australia. Ensure NO xylitol in formulation. Dogs: 1-6 mg q8-24h; Cats: 0.5-3 mg. Give 30-90 min before bedtime or event. Very safe, well-tolerated. Can combine with other anxiolytics.',
    scheduleClass: 'S3',
    requiresAuthority: false,
  },
  {
    id: 'imepitoin',
    genericName: 'Imepitoin',
    brandNames: ['Pexion'],
    category: 'Partial BZD Agonist',
    species: ['Dog'],
    doseRange: {
      min: 10,
      max: 30,
      unit: 'mg/kg',
    },
    frequencyOptions: ['Twice daily'],
    defaultFrequency: 'Twice daily',
    description: 'Partial benzodiazepine receptor agonist APVMA registered for epilepsy, used off-label for noise aversion.',
    indications: [
      'Noise aversion (off-label)',
      'Epilepsy (registered indication)',
      'Anxiety (emerging use)'
    ],
    sideEffects: [
      'Sedation',
      'Ataxia',
      'Increased appetite',
      'Polyphagia',
      'Hyperactivity (rare)'
    ],
    contraindications: [
      'Severe liver disease',
      'Pregnancy (safety not established)'
    ],
    notes: 'APVMA registered for epilepsy. Emerging evidence for noise aversion. Less sedating than full benzodiazepine agonists. Lower abuse potential than diazepam. Start at 10 mg/kg BID, can increase to 30 mg/kg BID.',
    scheduleClass: 'S4',
    requiresAuthority: false,
  },
  {
    id: 'propentofylline',
    genericName: 'Propentofylline',
    brandNames: ['Vivitonin'],
    category: 'Methylxanthine Derivative',
    species: ['Both'],
    doseRange: {
      min: 3,
      max: 5,
      unit: 'mg/kg',
    },
    frequencyOptions: ['Twice daily'],
    defaultFrequency: 'Twice daily',
    description: 'Methylxanthine derivative that improves cerebral blood flow and metabolism, used for cognitive dysfunction.',
    indications: [
      'Cognitive dysfunction syndrome',
      'Dullness and lethargy in older dogs',
      'General demeanor improvement',
      'Age-related behavioral changes'
    ],
    sideEffects: [
      'Gastrointestinal upset',
      'Hyperactivity (rare)',
      'Restlessness',
      'Generally well tolerated'
    ],
    contraindications: [
      'Severe renal failure (reduce dose)',
      'Pregnancy',
      'Breeding animals'
    ],
    notes: 'Available in Australia (50mg and 100mg tablets). Give 30 minutes before feeding. Dose: half tablet per 5kg bodyweight BID (50mg tablets). Improves cerebral circulation. Effect seen in 2-4 weeks. Reduce dose in renal failure.',
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
