// Script to find existing folder paths in database

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find clients with folder paths
  const clientsWithFolders = await prisma.client.findMany({
    where: {
      folderPath: { not: null }
    },
    select: {
      clientId: true,
      firstName: true,
      lastName: true,
      folderPath: true
    },
    take: 5
  });

  console.log("Clients with folders:");
  for (const client of clientsWithFolders) {
    console.log(`- ${client.firstName} ${client.lastName} (ID: ${client.clientId}): ${client.folderPath}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
