// Script to update McDonald client and pet from questionnaire data
// Data extracted from PDF: Bec-McDonald-0438737577.pdf

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Client ID 29 = Bec McDonald
  const clientId = 29;

  // Update client with address from questionnaire
  const updatedClient = await prisma.client.update({
    where: { clientId },
    data: {
      streetAddress: "7 Dobell Place",
      city: "Eltham",
      state: "Victoria",
      postcode: "3095",
      // Append reason for consult to notes
      notes: prisma.client.fields.notes
        ? undefined // Will handle below
        : "Imported from Calendly booking. Concern: Barking at night. Payment: $220.00 AUD paid via Stripe (Zoom consultation).\n\nQuestionnaire concern: Barking at night, especially when left alone in the backyard."
    }
  });

  // Get current notes and append questionnaire concern if not already there
  const client = await prisma.client.findUnique({
    where: { clientId },
    select: { notes: true }
  });

  if (client?.notes && !client.notes.includes("Questionnaire concern:")) {
    await prisma.client.update({
      where: { clientId },
      data: {
        notes: client.notes + "\n\nQuestionnaire concern: Barking at night, especially when left alone in the backyard."
      }
    });
  }

  console.log(`✓ Updated client address: ${updatedClient.streetAddress}, ${updatedClient.city}, ${updatedClient.state} ${updatedClient.postcode}`);

  // Find Jimmy the dog (pet for this client)
  const pet = await prisma.pet.findFirst({
    where: {
      clientId,
      name: "Jimmy"
    }
  });

  if (pet) {
    // Age "6" from questionnaire → DOB calculation
    // If age is 6 years, DOB is approximately 2018-2019
    // Using Jan 1, 2019 as approximate DOB (questionnaire was from late 2024)
    const calculatedDob = "2018-11-01"; // ~6 years before Nov 2024 consultation

    const updatedPet = await prisma.pet.update({
      where: { petId: pet.petId },
      data: {
        sex: "Neutered", // "Males Neutered" → "Neutered"
        dateOfBirth: calculatedDob,
        notes: pet.notes
          ? `${pet.notes}\n\nQuestionnaire data: Weight: 37kg, Age reported: 6 years`
          : "Concern: Barking at night\n\nQuestionnaire data: Weight: 37kg, Age reported: 6 years"
      }
    });

    console.log(`✓ Updated pet ${updatedPet.name}:`);
    console.log(`  - Sex: ${updatedPet.sex}`);
    console.log(`  - DOB: ${updatedPet.dateOfBirth}`);
    console.log(`  - Notes updated with weight (37kg)`);
  } else {
    console.log("⚠ Pet Jimmy not found");
  }

  console.log("\n✓ Done! Questionnaire data applied to client and pet records.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
