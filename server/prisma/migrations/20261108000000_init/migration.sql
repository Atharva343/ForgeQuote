-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ESTIMATOR', 'SALES_HEAD');

-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('ESTIMATING', 'SENT', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT');

-- CreateEnum
CREATE TYPE "QuoteApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfqs" (
    "id" TEXT NOT NULL,
    "rfqNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "status" "RfqStatus" NOT NULL DEFAULT 'ESTIMATING',
    "ownerId" TEXT,
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_parts" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "partNumber" TEXT,
    "partName" TEXT NOT NULL,
    "drawingNumber" TEXT,
    "material" TEXT NOT NULL,
    "grossWeightKg" DECIMAL(10,4) NOT NULL,
    "annualVolume" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfq_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_documents" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_rates" (
    "id" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "ratePerKg" DECIMAL(12,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_rates" (
    "id" TEXT NOT NULL,
    "operationCode" TEXT NOT NULL,
    "operationName" TEXT NOT NULL,
    "machineName" TEXT NOT NULL,
    "hourlyRate" DECIMAL(12,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_operations" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "operationName" TEXT NOT NULL,
    "machineCode" TEXT NOT NULL,
    "setupTimeMinutes" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "cycleTimeMinutes" DECIMAL(8,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routing_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "isHistoricalImport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_parts" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "rfqPartId" TEXT NOT NULL,
    "rateSnapshot" JSONB NOT NULL,
    "costBreakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_volume_prices" (
    "id" TEXT NOT NULL,
    "quotePartId" TEXT NOT NULL,
    "productionVolume" INTEGER NOT NULL,
    "materialCost" DECIMAL(14,4) NOT NULL,
    "processCost" DECIMAL(14,4) NOT NULL,
    "scrapCost" DECIMAL(14,4) NOT NULL,
    "overheadCost" DECIMAL(14,4) NOT NULL,
    "freightCost" DECIMAL(14,4) NOT NULL,
    "totalCost" DECIMAL(14,4) NOT NULL,
    "marginPercentage" DECIMAL(6,2) NOT NULL,
    "sellingPricePerUnit" DECIMAL(14,4) NOT NULL,
    "annualValue" DECIMAL(16,4) NOT NULL,
    "gstPercentage" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_volume_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_approvals" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "QuoteApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_rfqNumber_key" ON "rfqs"("rfqNumber");

-- CreateIndex
CREATE INDEX "rfqs_customerId_idx" ON "rfqs"("customerId");

-- CreateIndex
CREATE INDEX "rfqs_ownerId_idx" ON "rfqs"("ownerId");

-- CreateIndex
CREATE INDEX "rfqs_status_idx" ON "rfqs"("status");

-- CreateIndex
CREATE INDEX "rfq_parts_rfqId_idx" ON "rfq_parts"("rfqId");

-- CreateIndex
CREATE INDEX "rfq_documents_rfqId_idx" ON "rfq_documents"("rfqId");

-- CreateIndex
CREATE INDEX "rfq_documents_uploadedById_idx" ON "rfq_documents"("uploadedById");

-- CreateIndex
CREATE INDEX "material_rates_materialCode_idx" ON "material_rates"("materialCode");

-- CreateIndex
CREATE INDEX "material_rates_validFrom_validTo_idx" ON "material_rates"("validFrom", "validTo");

-- CreateIndex
CREATE INDEX "machine_rates_operationCode_idx" ON "machine_rates"("operationCode");

-- CreateIndex
CREATE INDEX "machine_rates_validFrom_validTo_idx" ON "machine_rates"("validFrom", "validTo");

-- CreateIndex
CREATE INDEX "routing_operations_partId_idx" ON "routing_operations"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quoteNumber_key" ON "quotations"("quoteNumber");

-- CreateIndex
CREATE INDEX "quotations_rfqId_idx" ON "quotations"("rfqId");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE INDEX "quotations_createdById_idx" ON "quotations"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_rfqId_version_key" ON "quotations"("rfqId", "version");

-- CreateIndex
CREATE INDEX "quote_parts_quotationId_idx" ON "quote_parts"("quotationId");

-- CreateIndex
CREATE INDEX "quote_parts_rfqPartId_idx" ON "quote_parts"("rfqPartId");

-- CreateIndex
CREATE INDEX "quote_volume_prices_quotePartId_idx" ON "quote_volume_prices"("quotePartId");

-- CreateIndex
CREATE INDEX "quote_approvals_quotationId_idx" ON "quote_approvals"("quotationId");

-- CreateIndex
CREATE INDEX "quote_approvals_reviewerId_idx" ON "quote_approvals"("reviewerId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_parts" ADD CONSTRAINT "rfq_parts_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_documents" ADD CONSTRAINT "rfq_documents_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_documents" ADD CONSTRAINT "rfq_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_operations" ADD CONSTRAINT "routing_operations_partId_fkey" FOREIGN KEY ("partId") REFERENCES "rfq_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_parts" ADD CONSTRAINT "quote_parts_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_parts" ADD CONSTRAINT "quote_parts_rfqPartId_fkey" FOREIGN KEY ("rfqPartId") REFERENCES "rfq_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_volume_prices" ADD CONSTRAINT "quote_volume_prices_quotePartId_fkey" FOREIGN KEY ("quotePartId") REFERENCES "quote_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_approvals" ADD CONSTRAINT "quote_approvals_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_approvals" ADD CONSTRAINT "quote_approvals_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

