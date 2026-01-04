import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { formatISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

const TIMEZONE = "Australia/Melbourne";

function createDate(date: Date): string {
  return formatISO(toZonedTime(date, TIMEZONE));
}

async function main() {
  console.log("Adding Cleidi Bagatoli client...");

  // Check if client already exists
  const existingClient = await prisma.client.findFirst({
    where: {
      OR: [
        { email: "cleidi.bagatoli@gmail.com" },
        { mobile: "0499652220" },
      ],
    },
  });

  if (existingClient) {
    console.log("Client already exists with ID:", existingClient.clientId);
    return existingClient;
  }

  // Create the client
  const client = await prisma.client.create({
    data: {
      firstName: "Cleidi",
      lastName: "Bagatoli",
      email: "cleidi.bagatoli@gmail.com",
      mobile: "0499652220",
      streetAddress: "13 Hickman Avenue",
      city: "Aspendale Gardens",
      state: "VIC",
      postcode: "3195",
      notes: `Household: Steven (51, male), Emily (9, female)
House with large yard, no other pets
Primary vet: Aspendale Gardens Vet Hospital (last exam: June 4, 2025)

Problem: Separation anxiety - Milla does not like to be left alone
- Surrendered reason was barking/crying when left alone
- Only been left alone twice (10 min and 30 min)
- Howling, pacing between rooms when alone
- Fine when someone is present (even at grandma's)
- Owner stress may be contributing factor

Diet: Dry food, twice daily (7am, 5:30pm) with healthy snacks
Exercise: 45-50min morning walk/run, dog park alternate days, 20min afternoon walk
Sleeps: In crate in owner's bedroom`,
    },
  });

  console.log("Created client:", client.firstName, client.lastName, "- ID:", client.clientId);

  // Calculate approximate DOB from "nearly 18 months" age (questionnaire dated June 10, 2025)
  // 18 months before June 10, 2025 = December 10, 2023
  const dateOfBirth = "2023-12-10";

  // Create the pet
  const pet = await prisma.pet.create({
    data: {
      clientId: client.clientId,
      name: "Milla",
      species: "Dog",
      breed: "Cocker Spaniel Mix",
      sex: "Female Neutered",
      dateOfBirth: dateOfBirth,
      notes: `Weight: 14.8kg
Previous name: Gena
Acquired from: Foster Carer (CSRA - Cocker Spaniel Rescue Australia) at 17 months old
Had only 3 weeks with current owners as of questionnaire date (June 10, 2025)
Entered rescue in February, neutered then, stayed with foster dad 5-6 weeks

Personality: Cheeky, affectionate, playful, loves meeting new people and dogs
Can be shy/fearful of dogs without gentle approach or sudden loud noises
Coming out of shell, being mischievous (grabbing socks/slippers)

Health: Ear infection treated with Easotic Ear Suspension (5 days) - now resolved
Meds: Simparica Trio (monthly), Paragard (every 3 months)

Training: Uses noise (clap/rattle can) for correction
Rewards: Verbal praise, petting, treats (dried turkey treats)
Toys: Fetch ball, tug of war, puzzle feeders, dog park, walks/runs, obstacle jumping

Crated when foster dad went out (would chew things), sleeps in crate`,
    },
  });

  console.log("Created pet:", pet.name, "- ID:", pet.petId);

  // Create a "Note" event for client creation
  const noteEvent = await prisma.event.create({
    data: {
      clientId: client.clientId,
      eventType: "Note",
      date: createDate(new Date()),
      notes: `<p>Client created from Dog Behaviour Questionnaire (submitted June 10, 2025)</p>
<p><strong>Presenting Problem:</strong> Separation anxiety</p>
<p><strong>Primary Vet:</strong> Aspendale Gardens Vet Hospital</p>`,
    },
  });

  console.log("Created Note event - ID:", noteEvent.eventId);

  console.log("\n✅ Successfully added client Cleidi Bagatoli with pet Milla!");

  return client;
}

main()
  .catch((e) => {
    console.error("Error adding client:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
