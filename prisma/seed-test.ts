// Test Database Seeder for E2E Tests
// Creates dog and cat clients with questionnaire tasks for template ID testing

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedTestData() {
  console.log("🌱 Seeding test database...");

  // Clean up existing test data
  await prisma.task.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.pet.deleteMany({});
  await prisma.client.deleteMany({});

  // Create Dog Client
  const dogClient = await prisma.client.create({
    data: {
      firstName: "Dog",
      lastName: "Client",
      email: "dogclient@test.com",
      mobile: "0412345678",
      city: "Melbourne",
      state: "VIC",
      folderPath: "C:/Test/DogClient",
    },
  });

  // Create dog pet
  const dogPet = await prisma.pet.create({
    data: {
      clientId: dogClient.clientId,
      name: "Buddy",
      species: "Dog",
      breed: "Labrador",
      sex: "Male",
    },
  });

  // Create booking event for dog client
  const dogBooking = await prisma.event.create({
    data: {
      clientId: dogClient.clientId,
      eventType: "Booking",
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      notes: "<p>Dog consultation booking</p>",
    },
  });

  // Create questionnaire task for dog client
  await prisma.task.create({
    data: {
      clientId: dogClient.clientId,
      eventId: dogBooking.eventId,
      description: "Check questionnaire returned ≥ 48 hours before consultation",
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      priority: 1,
      status: "Pending",
      triggeredBy: "Event:Booking",
      automatedAction: "CheckQuestionnaireReturned",
    },
  });

  console.log("✅ Dog Client created with questionnaire task");

  // Create Cat Client
  const catClient = await prisma.client.create({
    data: {
      firstName: "Cat",
      lastName: "Client",
      email: "catclient@test.com",
      mobile: "0423456789",
      city: "Melbourne",
      state: "VIC",
      folderPath: "C:/Test/CatClient",
    },
  });

  // Create cat pet
  const catPet = await prisma.pet.create({
    data: {
      clientId: catClient.clientId,
      name: "Whiskers",
      species: "Cat",
      breed: "Domestic Shorthair",
      sex: "Female",
    },
  });

  // Create booking event for cat client
  const catBooking = await prisma.event.create({
    data: {
      clientId: catClient.clientId,
      eventType: "Booking",
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      notes: "<p>Cat consultation booking</p>",
    },
  });

  // Create questionnaire task for cat client
  await prisma.task.create({
    data: {
      clientId: catClient.clientId,
      eventId: catBooking.eventId,
      description: "Check questionnaire returned ≥ 48 hours before consultation",
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      priority: 1,
      status: "Pending",
      triggeredBy: "Event:Booking",
      automatedAction: "CheckQuestionnaireReturned",
    },
  });

  console.log("✅ Cat Client created with questionnaire task");

  console.log("\n🎉 Test database seeded successfully!");
  console.log(`   - Dog Client (ID: ${dogClient.clientId})`);
  console.log(`   - Cat Client (ID: ${catClient.clientId})`);
}

seedTestData()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
