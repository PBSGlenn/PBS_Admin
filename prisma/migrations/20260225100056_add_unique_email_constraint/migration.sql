-- AddUniqueConstraint
-- Add unique constraint to Client.email to prevent duplicate email addresses.
-- The previous @@index([email]) is replaced by this unique index.

-- Drop the old non-unique index
DROP INDEX IF EXISTS "Client_email_idx";

-- Create a unique index on email
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");
