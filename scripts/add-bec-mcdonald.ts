// Script to add Bec McDonald client from Calendly booking (4 Nov 2024)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create client
  const client = await prisma.client.create({
    data: {
      firstName: "Bec",
      lastName: "McDonald",
      email: "bec.mcdonald@bigpond.com",
      mobile: "0438737577",
      notes: "Imported from Calendly booking. Concern: Barking at night. Payment: $220.00 AUD paid via Stripe (Zoom consultation).",
    },
  });

  console.log(`Created client: ${client.firstName} ${client.lastName} (ID: ${client.clientId})`);

  // Create pet
  const pet = await prisma.pet.create({
    data: {
      clientId: client.clientId,
      name: "Jimmy",
      species: "Dog",
      breed: "Golden Retriever",
      notes: "Concern: Barking at night",
    },
  });

  console.log(`Created pet: ${pet.name} (ID: ${pet.petId})`);

  // Create consultation event (4 Nov 2024)
  const consultationDate = new Date("2024-11-04T10:00:00+11:00"); // Melbourne time

  const event = await prisma.event.create({
    data: {
      clientId: client.clientId,
      eventType: "Consultation",
      date: consultationDate.toISOString(),
      notes: `<h2>Zoom Consultation</h2>
<p><strong>Pet:</strong> Jimmy (Golden Retriever)</p>
<p><strong>Concern:</strong> Barking at night</p>
<p><strong>Payment:</strong> $220.00 AUD paid via Stripe</p>
<p><em>Imported from Calendly booking</em></p>`,
    },
  });

  console.log(`Created consultation event (ID: ${event.eventId}) for ${consultationDate.toLocaleDateString()}`);

  console.log("\nDone! Client added successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
