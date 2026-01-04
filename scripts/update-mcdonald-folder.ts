// Script to update McDonald folder path

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const folderPath = "C:\\Users\\grubb\\OneDrive\\Documents\\PBS_Admin\\Client_Records\\mcdonald_29";

  const updated = await prisma.client.update({
    where: { clientId: 29 },
    data: { folderPath }
  });

  console.log(`Updated client ${updated.firstName} ${updated.lastName} with folder path: ${updated.folderPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
