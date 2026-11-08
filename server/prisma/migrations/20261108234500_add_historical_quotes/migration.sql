-- CreateTable
CREATE TABLE "historical_import_batches" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "importedRows" INTEGER NOT NULL,
    "invalidRows" INTEGER NOT NULL,
    "duplicateRows" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errorSummary" JSONB,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_quote_records" (
    "id" TEXT NOT NULL,
    "quoteReference" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "partNumber" TEXT,
    "partDescription" TEXT,
    "material" TEXT,
    "grossWeightKg" DECIMAL(12,4),
    "quantity" INTEGER,
    "unitPrice" DECIMAL(14,4),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "quoteDate" TIMESTAMP(3),
    "processDescription" TEXT,
    "sourceFileName" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL,
    "importStatus" TEXT NOT NULL DEFAULT 'IMPORTED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_quote_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historical_import_batches_importedById_idx" ON "historical_import_batches"("importedById");
CREATE INDEX "historical_import_batches_createdAt_idx" ON "historical_import_batches"("createdAt");

-- CreateIndex
CREATE INDEX "historical_quote_records_quoteReference_idx" ON "historical_quote_records"("quoteReference");
CREATE INDEX "historical_quote_records_customerName_idx" ON "historical_quote_records"("customerName");
CREATE INDEX "historical_quote_records_partNumber_idx" ON "historical_quote_records"("partNumber");
CREATE INDEX "historical_quote_records_material_idx" ON "historical_quote_records"("material");
CREATE INDEX "historical_quote_records_quoteDate_idx" ON "historical_quote_records"("quoteDate");
CREATE INDEX "historical_quote_records_batchId_idx" ON "historical_quote_records"("batchId");
CREATE INDEX "historical_quote_records_createdById_idx" ON "historical_quote_records"("createdById");

-- AddForeignKey
ALTER TABLE "historical_import_batches" ADD CONSTRAINT "historical_import_batches_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_quote_records" ADD CONSTRAINT "historical_quote_records_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "historical_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_quote_records" ADD CONSTRAINT "historical_quote_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

