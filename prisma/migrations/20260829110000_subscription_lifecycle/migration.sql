-- Add explicit subscription period metadata so tenant activation and expiry
-- are derived from one backend-owned lifecycle.
CREATE TYPE "SubscriptionBillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

ALTER TABLE "Tenant"
  ADD COLUMN "subscriptionStartedAt" TIMESTAMP(3),
  ADD COLUMN "subscriptionBillingCycle" "SubscriptionBillingCycle";
