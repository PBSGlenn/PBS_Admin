import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { formatISO, addDays, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

const TIMEZONE = "Australia/Melbourne";

// Helper to create a date in Australia/Melbourne timezone and convert to ISO string
function createDate(date: Date): string {
  return formatISO(toZonedTime(date, TIMEZONE));
}

async function main() {
  console.log("Starting database seed...");

  // Clear existing data
  await prisma.task.deleteMany();
  await prisma.event.deleteMany();
  await prisma.pet.deleteMany();
  await prisma.client.deleteMany();

  console.log("Cleared existing data");

  // Create sample clients
  const client1 = await prisma.client.create({
    data: {
      firstName: "Sarah",
      lastName: "Thompson",
      email: "sarah.thompson@email.com",
      mobile: "0412345678",
      streetAddress: "123 Collins Street",
      city: "Melbourne",
      state: "VIC",
      postcode: "3000",
      stripeCustomerId: "cus_sample123",
      notes: "Returning client, very engaged with training protocols",
    },
  });

  const client2 = await prisma.client.create({
    data: {
      firstName: "Michael",
      lastName: "Chen",
      email: "m.chen@email.com",
      mobile: "0423456789",
      streetAddress: "45 High Street",
      city: "Kew",
      state: "VIC",
      postcode: "3101",
      notes: "New client, referred by Sarah Thompson",
    },
  });

  const client3 = await prisma.client.create({
    data: {
      firstName: "Emma",
      lastName: "Wilson",
      email: "emma.w@email.com",
      mobile: "0434567890",
      streetAddress: "78 Park Avenue",
      city: "Brighton",
      state: "VIC",
      postcode: "3186",
      stripeCustomerId: "cus_sample456",
    },
  });

  console.log("Created 3 clients");

  // Create pets for clients
  const pet1 = await prisma.pet.create({
    data: {
      clientId: client1.clientId,
      name: "Max",
      species: "Dog",
      breed: "Golden Retriever",
      sex: "Male",
      dateOfBirth: "2020-03-15",
      notes: "Friendly, responds well to positive reinforcement. Some separation anxiety.",
    },
  });

  const pet2 = await prisma.pet.create({
    data: {
      clientId: client1.clientId,
      name: "Luna",
      species: "Dog",
      breed: "Border Collie",
      sex: "Female",
      dateOfBirth: "2021-07-22",
      notes: "High energy, needs mental stimulation. Excellent recall.",
    },
  });

  const pet3 = await prisma.pet.create({
    data: {
      clientId: client2.clientId,
      name: "Bella",
      species: "Dog",
      breed: "German Shepherd",
      sex: "Female",
      dateOfBirth: "2019-11-08",
      notes: "Reactive to other dogs on leash. Working on impulse control.",
    },
  });

  const pet4 = await prisma.pet.create({
    data: {
      clientId: client3.clientId,
      name: "Charlie",
      species: "Cat",
      breed: "Domestic Shorthair",
      sex: "Male",
      dateOfBirth: "2022-01-30",
      notes: "Indoor cat, litter box training issues.",
    },
  });

  console.log("Created 4 pets");

  // Create events
  const now = new Date();

  const event1 = await prisma.event.create({
    data: {
      clientId: client1.clientId,
      eventType: "Consultation",
      date: createDate(subDays(now, 30)),
      notes: "Initial consultation for Max's separation anxiety. Discussed crate training and departure protocols.",
      calendlyStatus: "Completed",
    },
  });

  const event2 = await prisma.event.create({
    data: {
      clientId: client1.clientId,
      eventType: "TrainingSession",
      date: createDate(subDays(now, 15)),
      notes: "Progress check on separation anxiety protocols. Max showing improvement.",
      calendlyStatus: "Completed",
      parentEventId: event1.eventId,
    },
  });

  const event3 = await prisma.event.create({
    data: {
      clientId: client2.clientId,
      eventType: "Booking",
      date: createDate(addDays(now, 3)),
      notes: "Initial consultation for Bella's leash reactivity.",
      calendlyEventUri: "https://calendly.com/sample/event123",
      calendlyStatus: "Scheduled",
    },
  });

  const event4 = await prisma.event.create({
    data: {
      clientId: client3.clientId,
      eventType: "Consultation",
      date: createDate(addDays(now, 7)),
      notes: "Consultation for Charlie's litter box issues.",
      calendlyEventUri: "https://calendly.com/sample/event456",
      calendlyStatus: "Scheduled",
    },
  });

  const event5 = await prisma.event.create({
    data: {
      clientId: client1.clientId,
      eventType: "FollowUp",
      date: createDate(addDays(now, 14)),
      notes: "Follow-up session to review progress on protocols.",
      calendlyStatus: "Scheduled",
      parentEventId: event2.eventId,
    },
  });

  console.log("Created 5 events");

  // Create tasks
  const task1 = await prisma.task.create({
    data: {
      clientId: client2.clientId,
      eventId: event3.eventId,
      description: "Check questionnaire returned ≥ 48 hours before consultation",
      dueDate: createDate(addDays(now, 1)), // 2 days before event3 (which is in 3 days)
      status: "Pending",
      priority: 1,
      automatedAction: "CheckQuestionnaireReturned",
      triggeredBy: "Event:Booking",
    },
  });

  const task2 = await prisma.task.create({
    data: {
      clientId: client3.clientId,
      eventId: event4.eventId,
      description: "Check questionnaire returned ≥ 48 hours before consultation",
      dueDate: createDate(addDays(now, 5)), // 2 days before event4 (which is in 7 days)
      status: "Pending",
      priority: 1,
      automatedAction: "CheckQuestionnaireReturned",
      triggeredBy: "Event:Booking",
    },
  });

  const task3 = await prisma.task.create({
    data: {
      clientId: client1.clientId,
      eventId: event2.eventId,
      description: "Send protocol document to Sarah Thompson",
      dueDate: createDate(subDays(now, 14)),
      status: "Done",
      priority: 2,
      automatedAction: "",
      triggeredBy: "Event:TrainingSession",
      completedOn: createDate(subDays(now, 13)),
    },
  });

  const task4 = await prisma.task.create({
    data: {
      clientId: client2.clientId,
      eventId: event3.eventId,
      description: "Prepare leash reactivity training materials",
      dueDate: createDate(addDays(now, 2)),
      status: "InProgress",
      priority: 2,
      automatedAction: "",
      triggeredBy: "Manual",
    },
  });

  const task5 = await prisma.task.create({
    data: {
      clientId: null,
      eventId: null,
      description: "Review and update website content",
      dueDate: createDate(addDays(now, 30)),
      status: "Pending",
      priority: 4,
      automatedAction: "",
      triggeredBy: "Schedule",
    },
  });

  const task6 = await prisma.task.create({
    data: {
      clientId: client1.clientId,
      eventId: null,
      description: "Follow up on payment for last month's sessions",
      dueDate: createDate(subDays(now, 2)),
      status: "Pending",
      priority: 1,
      automatedAction: "",
      triggeredBy: "Manual",
    },
  });

  console.log("Created 6 tasks");

  console.log("Database seeded successfully!");
  console.log("\nSummary:");
  console.log("- 3 Clients");
  console.log("- 4 Pets (Max, Luna, Bella, Charlie)");
  console.log("- 5 Events (various types, past and future)");
  console.log("- 6 Tasks (various statuses and priorities)");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
