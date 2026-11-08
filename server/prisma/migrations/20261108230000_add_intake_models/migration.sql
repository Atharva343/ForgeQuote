-- CreateTable
CREATE TABLE "intake_drafts" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "emailText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "extractedData" JSONB,
    "rfqId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_documents" (
    "id" TEXT NOT NULL,
    "intakeDraftId" TEXT,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "extractedText" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intake_drafts_createdById_idx" ON "intake_drafts"("createdById");

-- CreateIndex
CREATE INDEX "intake_drafts_status_idx" ON "intake_drafts"("status");

-- CreateIndex
CREATE INDEX "intake_documents_intakeDraftId_idx" ON "intake_documents"("intakeDraftId");

-- CreateIndex
CREATE INDEX "intake_documents_uploadedById_idx" ON "intake_documents"("uploadedById");

-- AddForeignKey
ALTER TABLE "intake_drafts" ADD CONSTRAINT "intake_drafts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_intakeDraftId_fkey" FOREIGN KEY ("intakeDraftId") REFERENCES "intake_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

