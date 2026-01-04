// Script to add Keegan Thomas and pet Kobie from questionnaire
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Simple age parser for "1yr 8mths" format
function parseAge(ageString: string): string {
  const today = new Date();
  const yearMatch = ageString.match(/(\d+)\s*yr/);
  const monthMatch = ageString.match(/(\d+)\s*mth/);

  const years = yearMatch ? parseInt(yearMatch[1]) : 0;
  const months = monthMatch ? parseInt(monthMatch[1]) : 0;

  const dob = new Date(today);
  dob.setFullYear(today.getFullYear() - years);
  dob.setMonth(today.getMonth() - months);

  return dob.toISOString().split('T')[0];
}

async function addKeeganThomas() {
  try {
    console.log("Creating client record for Keegan Thomas...");

    // Create client using Prisma
    const client = await prisma.client.create({
      data: {
        firstName: "Keegan",
        lastName: "Thomas",
        email: "keeganthomas66@gmail.com",
        mobile: "0425059755",
        streetAddress: "63 Authentic Avenue",
        city: "Cranbourne South",
        state: "VIC",
        postcode: "3977",
        notes: `Imported from Dog Behaviour Questionnaire (31 Oct 2024)

HOUSEHOLD:
- Tahlia Henderson (29, female)
- Keegan Thomas (28, male)
- Janita Henderson (68, female, occasionally)
- House with small yard
- Dog minded at family home 3+ days/week (larger property)

VET CLINIC: Dromana Veterinary Clinic

PROBLEM DESCRIPTION:
*Reactivity problems:
- Reactive to seeing people and dogs
- Inability to walk on leash due to reactivity to all surrounds, pulling, no control/focus on owner
- Reactivity in car: Reacts to cars and people/dogs on streets (calm at 100km on freeway)
- Reactive to sounds: motors, lawn mower, vacuum cleaner, fireworks

*General commands:
- When in reactive state has no focus on commands
- Pound advised he was very good with dogs there, but in home environment proven otherwise

*Additional observations:
- Seeing dogs/people from bedroom window causes crying, barking, howling, stress
- Car rides 60-80km: barking, crying, howling; 100km: calm
- Drawn towards men more than females
- Escaped twice at family home
- Two brief dog interaction meets with family dogs: very reactive, showed aggression, removed from situation
- First 6 weeks: chewed belongings (stress-related), now calmer, can be left alone up to 2 hours

WHO HAVE YOU SEEN: Private trainer

ACQUISITION:
- Adopted from Shelter/Pound at 1yr 5mths (3 months ago)
- In pound for 2 months prior, reason for surrender unknown
- Previous home: with litter of dogs, no one adopted him
- First incident: 2nd week after adoption
- Problem consistent since adoption`,
      },
    });

    console.log(`✓ Client created with ID: ${client.clientId}`);

    // Parse age to get date of birth
    const dateOfBirth = parseAge("1yr 8mths");
    console.log(`Calculated DOB from age "1yr 8mths": ${dateOfBirth}`);

    // Create pet using Prisma
    const pet = await prisma.pet.create({
      data: {
        clientId: client.clientId,
        name: "Kobie",
        species: "Dog",
        breed: "American Staffordshire Terrier Cross",
        sex: "Male Neutered",
        dateOfBirth: dateOfBirth,
        notes: `Weight: 26kg

DIET: Homemade - Kangaroo meat, Chicken, Fish & fresh vegetables with grain-free biscuits
- Fed twice daily (Breakfast 7-8:30am, Dinner 5:30-7pm)
- Dietary restriction: grain-free biscuits

HEALTH:
- Skin condition due to grass allergy
- Medications: Apoquel (skin medicine), Simparica Trio
- Last vet exam: 4 weeks ago (as of Oct 31, 2024)

TRAINING:
- Self-trained by owner + Private trainer
- Bad behavior correction: Verbal (No, Scold, etc), Noise (clap hands, rattle can), Pull on leash
- Good behavior reinforcement: Verbal praise, Petting, Toys/play, Treats/food

FAVORITE TOYS: Chew toys, food games, lick mats, hidden treats, anything cardboard
FAVORITE TREATS: Anything food

SCHEDULE:
- Minimal walking due to reactivity problems
- When at family house: walked on lead multiple times (has escaped twice, not able to roam freely)
- Sleeps: On his bed, couch, or owner's bed (must sleep in his bed initially)
- Left alone: 1-2 hours (building up slowly)

PERSONALITY: Inquisitive, stubborn, happy, energetic, affectionate, playful, very excitable to point of no control

ACQUISITION INFO:
- Adopted at 1yr 5mths from Shelter/Pound
- In pound 2 months, reason for surrender unknown
- Previous home: with litter of dogs
- 1 previous owner (to best of knowledge)
- Chosen for appearance and gentle nature (at time); family grew up with staffy breeds`,
      },
    });

    console.log(`✓ Pet created with ID: ${pet.petId}`);

    // Create "Questionnaire Received" event using Prisma
    const event = await prisma.event.create({
      data: {
        clientId: client.clientId,
        eventType: "Note",
        date: new Date("2024-10-31").toISOString(),
        notes: `<h2>Dog Behaviour Questionnaire Received</h2>
<p><strong>Submission Date:</strong> Thursday, October 31, 2024</p>
<p><strong>Pet:</strong> Kobie (Dog)</p>
<p><strong>Breed:</strong> American Staffordshire Terrier Cross</p>
<p><strong>Age:</strong> 1yr 8mths</p>
<p><strong>Sex:</strong> Male Neutered</p>
<p><strong>Weight:</strong> 26Kg</p>

<p><em>Full questionnaire details saved to client notes and pet notes.</em></p>

<h3>Primary Concerns</h3>
<ul>
  <li>Reactivity to people and dogs on walks</li>
  <li>Inability to walk on leash (pulling, no focus)</li>
  <li>Reactivity in car (60-80km speeds)</li>
  <li>Reactivity to sounds (motors, vacuum, fireworks)</li>
  <li>No focus on commands when reactive</li>
</ul>

<p><strong>Status:</strong> Seen private trainer, problem consistent since adoption (3 months ago)</p>`,
      },
    });

    console.log(`✓ Note event created with ID: ${event.eventId}`);

    console.log("\n✅ Successfully added Keegan Thomas and pet Kobie!");
    console.log(`   Client ID: ${client.clientId}`);
    console.log(`   Pet ID: ${pet.petId}`);
    console.log(`   Event ID: ${event.eventId}`);
    console.log("\nNext steps:");
    console.log("1. Open PBS Admin and navigate to this client");
    console.log("2. Click 'Create or Change Client Folder' to create folder");
    console.log("3. Copy the questionnaire PDF to the client folder");
  } catch (error) {
    console.error("Error adding client and pet:", error);
    throw error;
  }
}

// Run the script
addKeeganThomas()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
