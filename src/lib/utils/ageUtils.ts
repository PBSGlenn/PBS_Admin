// PBS Admin - Age Utility Functions
// Parse age strings like "2 years", "18 months", "12 weeks" into date of birth

/**
 * Parse an age string and calculate approximate date of birth
 * Handles formats like:
 * - "2" or "2 years" or "2 year"
 * - "18 months" or "18 month"
 * - "12 weeks" or "12 week"
 * - "one and a half years"
 * - "1.5 years"
 *
 * Returns ISO date string (YYYY-MM-DD) or null if parsing fails
 */
export function parseAgeToDateOfBirth(ageString: string): string | null {
  if (!ageString || !ageString.trim()) {
    return null;
  }

  const input = ageString.toLowerCase().trim();
  const today = new Date();

  // Map word numbers to digits
  const wordToNumber: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'a': 1, 'an': 1
  };

  // Replace word numbers with digits
  let processed = input;
  for (const [word, num] of Object.entries(wordToNumber)) {
    processed = processed.replace(new RegExp(`\\b${word}\\b`, 'g'), num.toString());
  }

  // Handle "and a half" or "1/2"
  processed = processed.replace(/and\s+(1\/2|half)/g, '.5');
  processed = processed.replace(/\b(1\/2|half)\b/g, '.5');

  // Try to extract number and unit
  // Patterns: "2", "2.5", "2 years", "2.5 months", etc.
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(year|yr|y)/i,
    /(\d+(?:\.\d+)?)\s*(month|mon|mo|m)/i,
    /(\d+(?:\.\d+)?)\s*(week|wk|w)/i,
    /(\d+(?:\.\d+)?)\s*(day|d)/i,
    /^(\d+(?:\.\d+)?)$/  // Just a number, assume years
  ];

  for (const pattern of patterns) {
    const match = processed.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2] ? match[2].toLowerCase() : 'year';

      const dob = new Date(today);

      // Calculate DOB by subtracting the age
      if (unit.startsWith('y')) {
        // Years
        dob.setFullYear(today.getFullYear() - Math.floor(value));
        const remainingMonths = Math.round((value % 1) * 12);
        dob.setMonth(today.getMonth() - remainingMonths);
      } else if (unit.startsWith('m')) {
        // Months
        dob.setMonth(today.getMonth() - Math.floor(value));
      } else if (unit.startsWith('w')) {
        // Weeks
        dob.setDate(today.getDate() - (value * 7));
      } else if (unit.startsWith('d')) {
        // Days
        dob.setDate(today.getDate() - value);
      }

      // Format as YYYY-MM-DD
      return dob.toISOString().split('T')[0];
    }
  }

  return null;
}

/**
 * Calculate current age from date of birth
 * Returns formatted string like "2 years, 3 months" or "6 months" or "8 weeks"
 */
export function calculateAge(dateOfBirth: string): string {
  if (!dateOfBirth) return '';

  const dob = new Date(dateOfBirth);
  const today = new Date();

  // Calculate difference
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();
  let days = today.getDate() - dob.getDate();

  // Adjust for negative months or days
  if (days < 0) {
    months--;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  // Format output
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  }

  if (months > 0 && years < 3) {
    parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  }

  // If less than 2 months, show weeks
  if (years === 0 && months < 2) {
    const totalDays = Math.floor((today.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(totalDays / 7);
    if (weeks > 0) {
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
    }
    return `${totalDays} ${totalDays === 1 ? 'day' : 'days'}`;
  }

  return parts.join(', ') || 'Unknown';
}

/**
 * Validate if a string can be parsed as an age
 */
export function isValidAgeString(ageString: string): boolean {
  return parseAgeToDateOfBirth(ageString) !== null;
}
