// Script to add Bridget Kennedy and pet Poppy from questionnaire
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Simple age parser for "1 year" format
function parseAge(ageString: string): string {
  const today = new Date();
  const yearMatch = ageString.match(/(\d+)\s*year/);
  const monthMatch = ageString.match(/(\d+)\s*month/);

  const years = yearMatch ? parseInt(yearMatch[1]) : 0;
  const months = monthMatch ? parseInt(monthMatch[1]) : 0;

  const dob = new Date(today);
  dob.setFullYear(today.getFullYear() - years);
  dob.setMonth(today.getMonth() - months);

  return dob.toISOString().split('T')[0];
}

async function addBridgetKennedy() {
  try {
    console.log("Creating client record for Bridget Kennedy...");

    // Create client using Prisma
    const client = await prisma.client.create({
      data: {
        firstName: "Bridget",
        lastName: "Kennedy",
        email: "kennedybridge33@hotmail.com",
        mobile: "0476376988",
        streetAddress: "2/13 King Georges Ave",
        city: "Mornington",
        state: "VIC",
        postcode: "3931",
        notes: `Imported from Dog Behaviour Questionnaire (12 Jul 2025)

HOUSEHOLD:
- Bridget (24, female)
- Matt (25, male)
- Lives in unit
- No moves since adoption
- Change in family schedule (work hours, working from home, etc.)

VET CLINIC: Mt Eliza Village Vet
- Last exam: 3 months ago (as of Jul 12, 2025)

PROBLEM DESCRIPTION:
*Fear and anxiety:
- Overwhelmed and fearful of cars, busy roads, sounds like vacuum and moving large objects, wind etc.
- Hates travelling in car over 60km (will try and hide under seat)
- Nervousness around strangers: hyperfixating/staring at someone in distance on walk or backing away when someone tries to pat her (fine at home with visitors)
- Fear of traffic and sounds has been since adoption
- On walks: tail tucked, ears back, trembling if too busy, walks behind owner, tries to spin around in U-turn
- At beach (first visit): petrified, didn't want to explore, wanted to be in their lap whole time

*Dog reactivity and behavior:
- Over-excitability with other dogs and not knowing how to play respectfully
- Doesn't seem to know how to navigate play/respect other dogs' boundaries
- Pulling on the lead
- Running away when trying to put collar/lead on
- Recent incident at beach: saw dog in distance, laid down staring, started to chase (playfully), body language changed to anxious, tumbled owner over

*First incident:
- Few weeks after adoption on the esplanade
- Motor bikes drove past
- Whole way home: darting left to right, trying to walk into driveways to get away from road

WHO HAVE YOU SEEN: Private trainer, dog training school (Alpha Canine Training Group)
- Taught to "mark no" and walk in circle when doing something bad
- Problem becoming MORE frequent

ACQUISITION:
- Adopted from Shelter/Pound at 4 months old (8 months ago)
- Surrendered with 3 litter mates from backyard breeder (couldn't sell litter)
- Suspect lack of proper early socialisation, litter came in very scared
- In foster care for 2 weeks before adoption to build confidence (with 3 adult staffies and cats)
- No previous owners`,
      },
    });

    console.log(`✓ Client created with ID: ${client.clientId}`);

    // Parse age to get date of birth
    const dateOfBirth = parseAge("1 year");
    console.log(`Calculated DOB from age "1 year": ${dateOfBirth}`);

    // Create pet using Prisma
    const pet = await prisma.pet.create({
      data: {
        clientId: client.clientId,
        name: "Poppy",
        species: "Dog",
        breed: "Staffy cross (Jack Russell, English Bulldog, Poodle)",
        sex: "Female Neutered",
        dateOfBirth: dateOfBirth,
        notes: `Weight: 23kg

DIET: Dry food - SPD sausage lamb or salmon
- Fed twice daily (morning after walk, evening after exercise)
- Dietary restriction: Don't usually feed chicken (can get skin allergies)

HEALTH:
- No current illnesses or injuries
- Medications: Simparica Trio monthly

TRAINING:
- Private trainer + Dog training school (Alpha Canine Training Group)
- Bad behavior correction: Verbal (No, Scold, etc), mark no and walk in circle
- Good behavior reinforcement: Verbal praise, Petting, Toys/play, Treats/food

FAVORITE TOYS: Fetch, tug of war
FAVORITE TREATS: Beef liver, pigs ear, stuffed Kong

SCHEDULE:
- Exercise: Morning and evening, 20-30 minutes each
- Regular exercise: Walks, runs/jogs, swimming, fetch/catch
- Sleeps: Living room on her bed (occasionally on owner's bed)
- Left alone: Yes, 6-8 hours

PERSONALITY: Very goofy and energetic. Very cuddly and playful (typical staffy mouthy behaviour). Finds it hard to relax when not in routine environment. Very overexcitable with other dogs and doesn't seem to know how to navigate play/respect other dogs' boundaries. Very sensitive to random sounds and doesn't like traffic/cars. Can sometimes get nervous around strangers.

ACQUISITION INFO:
- Adopted at 4 months old from Shelter/Pound
- Surrendered with 3 litter mates from backyard breeder
- Suspect lack of proper early socialisation
- 2 weeks in foster care before adoption (with 3 adult staffies and cats)
- No previous owners
- Wanted to rescue puppy from shelter, partner wanted staffy for "good tradie dog"`,
      },
    });

    console.log(`✓ Pet created with ID: ${pet.petId}`);

    // Create "Questionnaire Received" event using Prisma
    const event = await prisma.event.create({
      data: {
        clientId: client.clientId,
        eventType: "Note",
        date: new Date("2025-07-12").toISOString(),
        notes: `<h2>Dog Behaviour Questionnaire Received</h2>
<p><strong>Submission Date:</strong> Saturday, July 12, 2025</p>
<p><strong>Pet:</strong> Poppy (Dog)</p>
<p><strong>Breed:</strong> Staffy cross (Jack Russell, English Bulldog, Poodle)</p>
<p><strong>Age:</strong> 1 year</p>
<p><strong>Sex:</strong> Female Neutered</p>
<p><strong>Weight:</strong> 23kg</p>

<p><em>Full questionnaire details saved to client notes and pet notes.</em></p>

<h3>Primary Concerns</h3>
<ul>
  <li>Fear of cars, busy roads, traffic sounds, vacuum, wind</li>
  <li>Over-excitability with other dogs, doesn't know how to play respectfully</li>
  <li>Pulling on the lead</li>
  <li>Hates traveling in car over 60km (hides under seat)</li>
  <li>Nervousness around strangers (staring, backing away)</li>
  <li>Runs away when trying to put collar/lead on</li>
</ul>

<p><strong>Status:</strong> Seen private trainer + dog training school (Alpha Canine), problem becoming MORE frequent, everyday occurrence</p>

<p><strong>Video uploaded:</strong> IMG_8020.mov (backyard behavior)</p>`,
      },
    });

    console.log(`✓ Note event created with ID: ${event.eventId}`);

    console.log("\n✅ Successfully added Bridget Kennedy and pet Poppy!");
    console.log(`   Client ID: ${client.clientId}`);
    console.log(`   Pet ID: ${pet.petId}`);
    console.log(`   Event ID: ${event.eventId}`);
    console.log("\nNext steps:");
    console.log("1. Open PBS Admin and navigate to this client");
    console.log("2. Click 'Create or Change Client Folder' to create folder");
    console.log("3. Copy the questionnaire PDF and video (IMG_8020.mov) to the client folder");
  } catch (error) {
    console.error("Error adding client and pet:", error);
    throw error;
  }
}

// Run the script
addBridgetKennedy()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
