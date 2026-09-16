-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentLedgerEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recipientId" UUID,
    "category" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuitEvent" (
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "QuitEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "QuitProfile" (
    "userId" UUID NOT NULL,
    "strategy" TEXT NOT NULL,
    "quitDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuitProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ProductBaseline" (
    "id" UUID NOT NULL,
    "profileUserId" UUID NOT NULL,
    "product" TEXT NOT NULL,
    "dailyQuantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProductBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "goalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "reductionProduct" TEXT,
    "reductionDailyQuantity" DOUBLE PRECISION,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("goalId")
);

-- CreateIndex
CREATE INDEX "DeviceSession_userId_idx" ON "DeviceSession"("userId");

-- CreateIndex
CREATE INDEX "DeviceSession_deviceId_idx" ON "DeviceSession"("deviceId");

-- CreateIndex
CREATE INDEX "ConsentLedgerEntry_userId_category_recipientId_recordedAt_idx" ON "ConsentLedgerEntry"("userId", "category", "recipientId", "recordedAt");

-- CreateIndex
CREATE INDEX "QuitEvent_userId_occurredAt_idx" ON "QuitEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "QuitEvent_deviceId_idx" ON "QuitEvent"("deviceId");

-- CreateIndex
CREATE INDEX "QuitEvent_eventType_idx" ON "QuitEvent"("eventType");

-- CreateIndex
CREATE INDEX "ProductBaseline_profileUserId_idx" ON "ProductBaseline"("profileUserId");

-- CreateIndex
CREATE INDEX "Goal_userId_startsAt_idx" ON "Goal"("userId", "startsAt");

-- AddForeignKey
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLedgerEntry" ADD CONSTRAINT "ConsentLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuitEvent" ADD CONSTRAINT "QuitEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuitProfile" ADD CONSTRAINT "QuitProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBaseline" ADD CONSTRAINT "ProductBaseline_profileUserId_fkey" FOREIGN KEY ("profileUserId") REFERENCES "QuitProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
