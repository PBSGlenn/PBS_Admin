-- AlterTable
ALTER TABLE "Event" ADD COLUMN "bookingReference" TEXT;
ALTER TABLE "Event" ADD COLUMN "trainingPackageId" TEXT;

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN "dateOfBirthIsApproximate" INTEGER;
ALTER TABLE "Pet" ADD COLUMN "desexed" TEXT;
ALTER TABLE "Pet" ADD COLUMN "desexedDate" TEXT;
ALTER TABLE "Pet" ADD COLUMN "reportedAge" TEXT;
ALTER TABLE "Pet" ADD COLUMN "weightKg" REAL;

-- CreateTable
CREATE TABLE "QuestionnaireLog" (
    "submissionId" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "firstAttemptAt" TEXT NOT NULL,
    "lastAttemptAt" TEXT NOT NULL,
    "errorMessage" TEXT
);

-- CreateIndex
CREATE INDEX "QuestionnaireLog_status_idx" ON "QuestionnaireLog"("status");

-- CreateIndex
CREATE INDEX "Event_bookingReference_idx" ON "Event"("bookingReference");
