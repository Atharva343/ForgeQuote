-- CreateTable
CREATE TABLE "quotation_pdfs" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" TEXT,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_pdfs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotation_pdfs_quotationId_key" ON "quotation_pdfs"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_pdfs_quotationId_idx" ON "quotation_pdfs"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_pdfs_generatedById_idx" ON "quotation_pdfs"("generatedById");

-- AddForeignKey
ALTER TABLE "quotation_pdfs" ADD CONSTRAINT "quotation_pdfs_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_pdfs" ADD CONSTRAINT "quotation_pdfs_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

