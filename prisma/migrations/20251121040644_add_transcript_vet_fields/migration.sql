-- AlterTable
ALTER TABLE "Client" ADD COLUMN "primaryCareVet" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "questionnaireFilePath" TEXT;
ALTER TABLE "Event" ADD COLUMN "transcriptFilePath" TEXT;
