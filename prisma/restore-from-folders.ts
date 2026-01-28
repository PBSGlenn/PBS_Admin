// Restore clients and pets from client folder questionnaire data
// Run with: npx tsx prisma/restore-from-folders.ts

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const CLIENT_RECORDS_PATH = "C:/Users/grubb/OneDrive/Documents/PBS_Admin/Client_Records";

interface QuestionnaireClient {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
  };
}

interface QuestionnairePet {
  name: string;
  species: string;
  breed?: string;
  age?: string;
  sex?: string;
  weight?: string;
}

interface QuestionnaireData {
  submissionId: string;
  formType: string;
  submittedAt: string;
  client: QuestionnaireClient;
  pet: QuestionnairePet;
}

// Map sex string to database enum values
function mapSex(sex?: string): string | undefined {
  if (!sex) return undefined;
  const lower = sex.toLowerCase();
  if (lower.includes("female") && (lower.includes("neutered") || lower.includes("spayed"))) return "Female Spayed";
  if (lower.includes("female")) return "Female Intact";
  if (lower.includes("male") && lower.includes("neutered")) return "Male Neutered";
  if (lower.includes("male")) return "Male Intact";
  return sex;
}

// Normalize state to abbreviation
function normalizeState(state?: string): string {
  if (!state) return "VIC";
  const lower = state.toLowerCase();
  if (lower === "victoria" || lower === "vic") return "VIC";
  if (lower === "new south wales" || lower === "nsw") return "NSW";
  if (lower === "queensland" || lower === "qld") return "QLD";
  if (lower === "south australia" || lower === "sa") return "SA";
  if (lower === "western australia" || lower === "wa") return "WA";
  if (lower === "tasmania" || lower === "tas") return "TAS";
  if (lower === "northern territory" || lower === "nt") return "NT";
  if (lower === "australian capital territory" || lower === "act") return "ACT";
  return state.toUpperCase().slice(0, 3);
}

async function main() {
  console.log("🔄 Restoring client records from folder data...\n");

  // Clear existing data (be careful!)
  console.log("⚠️  Clearing existing data...");
  await prisma.task.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.pet.deleteMany({});
  await prisma.client.deleteMany({});
  console.log("✅ Database cleared\n");

  // Get all client folders
  const folders = fs.readdirSync(CLIENT_RECORDS_PATH).filter((f) => {
    const fullPath = path.join(CLIENT_RECORDS_PATH, f);
    return fs.statSync(fullPath).isDirectory() && f.includes("_");
  });

  console.log(`📁 Found ${folders.length} client folders\n`);

  let clientsCreated = 0;
  let petsCreated = 0;
  let eventsCreated = 0;

  for (const folder of folders) {
    const folderPath = path.join(CLIENT_RECORDS_PATH, folder);

    // Parse folder name: surname_clientId
    const parts = folder.split("_");
    const targetClientId = parseInt(parts[parts.length - 1], 10);
    const surname = parts.slice(0, -1).join("_");

    // Look for questionnaire JSON files
    const files = fs.readdirSync(folderPath);
    const questionnaireFile = files.find((f) => f.endsWith(".json") && f.startsWith("questionnaire"));

    let clientData: QuestionnaireClient;
    let petData: QuestionnairePet | null = null;
    let questionnaireFilePath: string | null = null;

    if (questionnaireFile) {
      // Read questionnaire data
      const qPath = path.join(folderPath, questionnaireFile);
      const qData: QuestionnaireData = JSON.parse(fs.readFileSync(qPath, "utf-8"));
      questionnaireFilePath = qPath;

      clientData = qData.client;
      petData = qData.pet;

      console.log(`📋 ${folder}: Found questionnaire for ${clientData.firstName} ${clientData.lastName}`);
    } else {
      // No questionnaire - create minimal record from folder name
      // Capitalize first letter of surname
      const capitalizedSurname = surname.charAt(0).toUpperCase() + surname.slice(1);

      clientData = {
        firstName: "[Unknown]",
        lastName: capitalizedSurname,
        email: `unknown_${targetClientId}@placeholder.local`,
        phone: "0400000000",
      };

      console.log(`⚠️  ${folder}: No questionnaire found - creating placeholder for ${capitalizedSurname}`);
    }

    // Create client with specific ID
    try {
      const client = await prisma.client.create({
        data: {
          clientId: targetClientId,
          firstName: clientData.firstName,
          lastName: clientData.lastName,
          email: clientData.email,
          mobile: clientData.phone,
          streetAddress: clientData.address?.street || null,
          city: clientData.address?.city || null,
          state: normalizeState(clientData.address?.state),
          postcode: clientData.address?.postcode || null,
          folderPath: folderPath,
        },
      });
      clientsCreated++;

      // Create pet if we have pet data
      if (petData) {
        await prisma.pet.create({
          data: {
            clientId: client.clientId,
            name: petData.name,
            species: petData.species || "Dog",
            breed: petData.breed || null,
            sex: mapSex(petData.sex) || null,
            notes: petData.weight ? `Weight: ${petData.weight}` : null,
          },
        });
        petsCreated++;
      }

      // Create a "Note" event recording questionnaire received (if applicable)
      if (questionnaireFilePath) {
        await prisma.event.create({
          data: {
            clientId: client.clientId,
            eventType: "Note",
            date: new Date().toISOString(),
            notes: `<p>Client record restored from questionnaire data.</p><p>Questionnaire file: ${questionnaireFile}</p>`,
            questionnaireFilePath: questionnaireFilePath,
          },
        });
        eventsCreated++;
      }
    } catch (error: any) {
      // Handle unique constraint violations (client ID already exists)
      if (error.code === "P2002") {
        console.log(`   ⏭️  Client ID ${targetClientId} already exists, skipping...`);
      } else {
        console.error(`   ❌ Error creating client ${targetClientId}:`, error.message);
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ Restoration complete!");
  console.log(`   - ${clientsCreated} clients created`);
  console.log(`   - ${petsCreated} pets created`);
  console.log(`   - ${eventsCreated} events created`);
  console.log("=".repeat(50));
}

main()
  .catch((e) => {
    console.error("❌ Restoration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
