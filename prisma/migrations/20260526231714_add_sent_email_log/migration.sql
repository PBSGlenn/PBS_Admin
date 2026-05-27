-- CreateTable
CREATE TABLE "SentEmail" (
    "emailId" TEXT NOT NULL PRIMARY KEY,
    "clientId" INTEGER,
    "eventId" INTEGER,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "emailType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentAt" TEXT NOT NULL,
    "deliveredAt" TEXT,
    "bouncedAt" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SentEmail_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("clientId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SentEmail_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("eventId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SentEmail_clientId_idx" ON "SentEmail"("clientId");

-- CreateIndex
CREATE INDEX "SentEmail_eventId_idx" ON "SentEmail"("eventId");

-- CreateIndex
CREATE INDEX "SentEmail_status_idx" ON "SentEmail"("status");

-- CreateIndex
CREATE INDEX "SentEmail_sentAt_idx" ON "SentEmail"("sentAt");

-- CreateIndex
CREATE INDEX "SentEmail_emailType_idx" ON "SentEmail"("emailType");
