import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { getSupabaseClient, supabaseStorageConfig } from '../config/supabase';
import { getSellerProfile, SellerCompanyProfile } from '../config/seller.config';
import { AppError } from '../middleware/errorHandler';
import { QuotationStatus } from '@prisma/client';

export interface PdfGenerationResult {
  pdfId: string;
  quotationId: string;
  quoteNumber: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: Date;
  downloadUrl?: string;
  isExisting: boolean;
}

export class QuotationPdfService {
  /**
   * Helper currency formatter for INR
   */
  private formatInr(value: number | string | null | undefined): string {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return 'Rs. 0.00';
    }
    const num = Number(value);
    return `Rs. ${num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Generate PDF Buffer using PDFKit with clean industrial formatting
   */
  public async renderQuotationPdfBuffer(
    quotation: any,
    seller: SellerCompanyProfile
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          bufferPages: true,
          info: {
            Title: `Quotation ${quotation.quoteNumber}`,
            Author: seller.companyName,
            Subject: `Quotation for RFQ ${quotation.rfq.rfqNumber}`,
            Keywords: 'Quotation, ForgeQuote, Manufacturing, Costing',
            CreationDate: new Date(),
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        const pageWidth = 595.28; // A4 width in points
        const pageHeight = 841.89; // A4 height in points
        const margin = 40;
        const contentWidth = pageWidth - margin * 2;

        // Check if page needs break
        const checkPageBreak = (neededHeight: number) => {
          if (doc.y + neededHeight > pageHeight - margin - 40) {
            doc.addPage();
            drawPageHeaderMini();
          }
        };

        const drawPageHeaderMini = () => {
          doc.save();
          doc
            .fontSize(8)
            .fillColor('#64748b')
            .text(
              `${seller.companyName} | Quotation: ${quotation.quoteNumber} (v${quotation.version})`,
              margin,
              25,
              { width: contentWidth, align: 'right' }
            );
          doc
            .strokeColor('#cbd5e1')
            .lineWidth(0.5)
            .moveTo(margin, 35)
            .lineTo(pageWidth - margin, 35)
            .stroke();
          doc.restore();
          doc.y = 45;
        };

        // --- 1. DEMO WATERMARK / NOTICE BANNER (if demo) ---
        if (seller.isDemo) {
          doc.save();
          doc.rect(margin, doc.y, contentWidth, 20).fill('#fef3c7');
          doc
            .fillColor('#92400e')
            .fontSize(8)
            .font('Helvetica-Bold')
            .text(
              'DEMO QUOTATION — GENERATED FOR EVALUATION / NOT FOR COMMERCIAL USE',
              margin,
              doc.y - 14,
              { width: contentWidth, align: 'center' }
            );
          doc.restore();
          doc.y += 10;
        }

        // --- 2. HEADER BLOCK ---
        const headerTopY = doc.y;

        // Left column: Seller Legal Identity
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .fillColor('#0f172a')
          .text(seller.companyName, margin, headerTopY, { width: 320 });

        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        if (seller.address) {
          doc.text(seller.address, margin, doc.y + 2, { width: 320 });
        }
        const contactLine = [
          seller.email ? `Email: ${seller.email}` : null,
          seller.phone ? `Phone: ${seller.phone}` : null,
        ]
          .filter(Boolean)
          .join(' | ');
        if (contactLine) {
          doc.text(contactLine, margin, doc.y + 1, { width: 320 });
        }
        if (seller.gstin) {
          doc
            .font('Helvetica-Bold')
            .text(`GSTIN: ${seller.gstin}`, margin, doc.y + 1, { width: 320 });
        }

        // Right column: QUOTATION title & metadata box
        const rightColX = pageWidth - margin - 180;
        doc
          .font('Helvetica-Bold')
          .fontSize(20)
          .fillColor('#0f172a')
          .text('QUOTATION', rightColX, headerTopY, { width: 180, align: 'right' });

        doc.y = headerTopY + 26;
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#0f172a')
          .text(`Quote No: ${quotation.quoteNumber}`, rightColX, doc.y, {
            width: 180,
            align: 'right',
          });

        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        doc.text(`Version: ${quotation.version}`, rightColX, doc.y + 2, {
          width: 180,
          align: 'right',
        });
        doc.text(
          `Date: ${new Date(quotation.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}`,
          rightColX,
          doc.y + 2,
          { width: 180, align: 'right' }
        );

        // Status badge: APPROVED
        const badgeY = doc.y + 3;
        const badgeW = 75;
        const badgeH = 14;
        const badgeX = pageWidth - margin - badgeW;
        doc.save();
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3).fill('#ecfdf5');
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3).strokeColor('#10b981').lineWidth(0.75).stroke();
        doc
          .fillColor('#047857')
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .text('APPROVED', badgeX, badgeY + 3.5, { width: badgeW, align: 'center' });
        doc.restore();

        // Divider
        doc.y = Math.max(doc.y + 24, headerTopY + 85);
        doc
          .strokeColor('#e2e8f0')
          .lineWidth(1)
          .moveTo(margin, doc.y)
          .lineTo(pageWidth - margin, doc.y)
          .stroke();
        doc.y += 10;

        // --- 3. CUSTOMER & RFQ INFORMATION BLOCK ---
        checkPageBreak(90);
        const customerBoxY = doc.y;
        const boxHeight = 75;
        const colW = (contentWidth - 16) / 2;

        // Left box: Customer Details
        doc.save();
        doc.roundedRect(margin, customerBoxY, colW, boxHeight, 4).fill('#f8fafc');
        doc.roundedRect(margin, customerBoxY, colW, boxHeight, 4).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        doc.restore();

        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor('#0f172a')
          .text('PREPARED FOR (CUSTOMER):', margin + 10, customerBoxY + 8);

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#1e293b')
          .text(quotation.rfq.customer.name, margin + 10, customerBoxY + 22);

        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        if (quotation.rfq.customer.industry) {
          doc.text(`Industry: ${quotation.rfq.customer.industry}`, margin + 10, customerBoxY + 36);
        }
        if (quotation.rfq.customer.contactEmail) {
          doc.text(`Email: ${quotation.rfq.customer.contactEmail}`, margin + 10, customerBoxY + 48);
        }

        // Right box: RFQ & Project References
        const rightBoxX = margin + colW + 16;
        doc.save();
        doc.roundedRect(rightBoxX, customerBoxY, colW, boxHeight, 4).fill('#f8fafc');
        doc.roundedRect(rightBoxX, customerBoxY, colW, boxHeight, 4).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        doc.restore();

        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor('#0f172a')
          .text('RFQ & REFERENCE DETAILS:', rightBoxX + 10, customerBoxY + 8);

        doc.font('Helvetica').fontSize(8).fillColor('#334155');
        doc.text(`RFQ Number: ${quotation.rfq.rfqNumber}`, rightBoxX + 10, customerBoxY + 22);
        doc.text(`RFQ Title: ${quotation.rfq.title}`, rightBoxX + 10, customerBoxY + 34, {
          width: colW - 20,
        });
        doc.text(
          `Received Date: ${new Date(quotation.rfq.receivedAt).toLocaleDateString('en-IN')}`,
          rightBoxX + 10,
          customerBoxY + 48
        );
        if (quotation.rfq.dueDate) {
          doc.text(
            `Due Date: ${new Date(quotation.rfq.dueDate).toLocaleDateString('en-IN')}`,
            rightBoxX + 10,
            customerBoxY + 60
          );
        }

        doc.y = customerBoxY + boxHeight + 14;

        // --- 4. QUOTED PARTS & VOLUME PRICING SCENARIOS ---
        const quoteParts = quotation.quoteParts || [];

        quoteParts.forEach((qp: any, qpIndex: number) => {
          checkPageBreak(130);

          const rfqPart = qp.rfqPart;
          const volumePrices = qp.volumePrices || [];

          // Part Section Heading
          doc.save();
          doc.roundedRect(margin, doc.y, contentWidth, 20, 3).fill('#0f172a');
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('#ffffff')
            .text(
              `ITEM ${qpIndex + 1}: ${rfqPart.partName.toUpperCase()}` +
                (rfqPart.partNumber ? ` (Part No: ${rfqPart.partNumber})` : ''),
              margin + 8,
              doc.y + 5
            );
          doc.restore();
          doc.y += 26;

          // Technical specifications box
          doc.save();
          doc.roundedRect(margin, doc.y, contentWidth, 34, 3).fill('#f8fafc');
          doc.roundedRect(margin, doc.y, contentWidth, 34, 3).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
          doc.restore();

          const specY = doc.y + 6;
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569');
          doc.text('Material Specification:', margin + 10, specY);
          doc.font('Helvetica').fillColor('#0f172a').text(rfqPart.material, margin + 10, specY + 11);

          doc.font('Helvetica-Bold').fillColor('#475569').text('Gross Weight (kg):', margin + 130, specY);
          doc
            .font('Helvetica')
            .fillColor('#0f172a')
            .text(`${Number(rfqPart.grossWeightKg).toFixed(4)} kg`, margin + 130, specY + 11);

          doc.font('Helvetica-Bold').fillColor('#475569').text('Annual Batch Target:', margin + 250, specY);
          doc
            .font('Helvetica')
            .fillColor('#0f172a')
            .text(`${Number(rfqPart.annualVolume).toLocaleString('en-IN')} units`, margin + 250, specY + 11);

          if (rfqPart.drawingNumber) {
            doc.font('Helvetica-Bold').fillColor('#475569').text('Drawing Ref:', margin + 370, specY);
            doc.font('Helvetica').fillColor('#0f172a').text(rfqPart.drawingNumber, margin + 370, specY + 11);
          }

          doc.y = specY + 36;

          // Technical Routing Process Summary (Non-sensitive operation flow)
          const routingOps = rfqPart.routingOperations || [];
          if (routingOps.length > 0) {
            checkPageBreak(50);
            doc
              .font('Helvetica-Bold')
              .fontSize(8)
              .fillColor('#1e293b')
              .text('Manufacturing Process Sequence:', margin, doc.y);
            doc.y += 4;

            // Simple sequence table
            const rTableY = doc.y;
            const rCols = [
              { label: 'Seq', width: 35, align: 'center' },
              { label: 'Operation Name', width: 170, align: 'left' },
              { label: 'Machine Type / Work Center', width: 150, align: 'left' },
              { label: 'Cycle Time', width: 80, align: 'right' },
              { label: 'Setup Time', width: 80, align: 'right' },
            ];

            // Header row
            doc.save();
            doc.rect(margin, rTableY, contentWidth, 14).fill('#e2e8f0');
            doc.restore();

            let curX = margin;
            rCols.forEach((col) => {
              doc
                .font('Helvetica-Bold')
                .fontSize(7)
                .fillColor('#334155')
                .text(col.label, curX + 2, rTableY + 3.5, {
                  width: col.width - 4,
                  align: col.align as any,
                });
              curX += col.width;
            });

            let curY = rTableY + 14;
            routingOps.forEach((op: any, idx: number) => {
              checkPageBreak(14);
              if (idx % 2 === 1) {
                doc.save();
                doc.rect(margin, curY, contentWidth, 13).fill('#f8fafc');
                doc.restore();
              }

              let colX = margin;
              const values = [
                op.sequence.toString(),
                op.operationName,
                op.machineCode,
                `${Number(op.cycleTimeMinutes).toFixed(2)} min`,
                `${Number(op.setupTimeMinutes).toFixed(2)} min`,
              ];

              values.forEach((val, cIdx) => {
                doc
                  .font('Helvetica')
                  .fontSize(7)
                  .fillColor('#1e293b')
                  .text(val, colX + 2, curY + 3, {
                    width: rCols[cIdx].width - 4,
                    align: rCols[cIdx].align as any,
                  });
                colX += rCols[cIdx].width;
              });

              curY += 13;
            });

            doc.y = curY + 8;
          }

          // Commercial Volume Pricing Table
          checkPageBreak(70);
          doc
            .font('Helvetica-Bold')
            .fontSize(8)
            .fillColor('#1e293b')
            .text('Agreed Commercial Pricing by Batch Volume Scenario:', margin, doc.y);
          doc.y += 4;

          const pCols = [
            { label: 'Batch Qty', width: 65, align: 'left' },
            { label: 'Unit Price (Pre-GST)', width: 95, align: 'right' },
            { label: 'GST Rate', width: 55, align: 'center' },
            { label: 'GST Amount', width: 80, align: 'right' },
            { label: 'Price incl. GST', width: 100, align: 'right' },
            { label: 'Annual Pre-GST Value', width: 120, align: 'right' },
          ];

          const pTableY = doc.y;
          doc.save();
          doc.rect(margin, pTableY, contentWidth, 16).fill('#0f172a');
          doc.restore();

          let pCurX = margin;
          pCols.forEach((col) => {
            doc
              .font('Helvetica-Bold')
              .fontSize(7)
              .fillColor('#ffffff')
              .text(col.label, pCurX + 2, pTableY + 4.5, {
                width: col.width - 4,
                align: col.align as any,
              });
            pCurX += col.width;
          });

          let pRowY = pTableY + 16;
          volumePrices.forEach((vp: any, vpIdx: number) => {
            checkPageBreak(16);
            if (vpIdx % 2 === 1) {
              doc.save();
              doc.rect(margin, pRowY, contentWidth, 15).fill('#f1f5f9');
              doc.restore();
            }

            const unitPreGst = Number(vp.sellingPricePerUnit);
            const gstPct = Number(vp.gstPercentage || 18);
            const gstAmount = (unitPreGst * gstPct) / 100;
            const unitWithGst = unitPreGst + gstAmount;
            const annVal = Number(vp.annualValue);

            const rowVals = [
              `${Number(vp.productionVolume).toLocaleString('en-IN')} units`,
              this.formatInr(unitPreGst),
              `${gstPct}%`,
              this.formatInr(gstAmount),
              this.formatInr(unitWithGst),
              this.formatInr(annVal),
            ];

            let rowX = margin;
            rowVals.forEach((val, cIdx) => {
              doc
                .font(cIdx === 1 || cIdx === 4 ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(7.5)
                .fillColor('#0f172a')
                .text(val, rowX + 2, pRowY + 3.5, {
                  width: pCols[cIdx].width - 4,
                  align: pCols[cIdx].align as any,
                });
              rowX += pCols[cIdx].width;
            });

            pRowY += 15;
          });

          doc.y = pRowY + 12;
        });

        // --- 5. COMMERCIAL SUMMARY & TERMS AND CONDITIONS ---
        checkPageBreak(130);

        const termsTopY = doc.y;
        const termsBoxH = 95;
        doc.save();
        doc.roundedRect(margin, termsTopY, contentWidth, termsBoxH, 4).fill('#f8fafc');
        doc.roundedRect(margin, termsTopY, contentWidth, termsBoxH, 4).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        doc.restore();

        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor('#0f172a')
          .text('COMMERCIAL TERMS & CONDITIONS:', margin + 12, termsTopY + 8);

        const termsLeftW = (contentWidth - 36) * 0.65;
        const termsRightX = margin + 12 + termsLeftW + 12;
        const termsRightW = (contentWidth - 36) * 0.35;

        let termsY = termsTopY + 22;
        const renderTerm = (title: string, val?: string) => {
          if (!val) return;
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155').text(`${title}: `, margin + 12, termsY, {
            continued: true,
          });
          doc.font('Helvetica').fillColor('#475569').text(val);
          termsY += 12;
        };

        renderTerm('Applicable Taxes', 'GST charged extra as shown in pricing schedule');
        renderTerm('Payment Terms', seller.paymentTerms || '30 Days from date of invoice');
        renderTerm('Delivery Terms', seller.deliveryTerms || 'Ex-Works manufacturing facility');
        renderTerm('Quotation Validity', seller.validityText || '30 days from date of issuance');
        renderTerm(
          'Tooling / Gauging',
          'Standard inspection included; dedicated fixtures charged at actuals if required'
        );

        // Signatory box on the right
        doc.save();
        doc.roundedRect(termsRightX, termsTopY + 8, termsRightW, termsBoxH - 16, 3).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        doc.restore();

        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor('#0f172a')
          .text('FOR AND ON BEHALF OF:', termsRightX + 8, termsTopY + 14, {
            width: termsRightW - 16,
          });

        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#475569')
          .text(seller.companyName, termsRightX + 8, termsTopY + 24, {
            width: termsRightW - 16,
          });

        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#0f172a')
          .text(seller.signatoryName || 'Authorized Signatory', termsRightX + 8, termsTopY + 58, {
            width: termsRightW - 16,
          });

        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#64748b')
          .text(seller.signatoryDesignation || 'Commercial Head', termsRightX + 8, termsTopY + 68, {
            width: termsRightW - 16,
          });

        doc.y = termsTopY + termsBoxH + 16;

        // --- 6. TWO-PASS PAGE NUMBERING & FOOTER ON ALL BUFFERED PAGES ---
        const range = doc.bufferedPageRange();
        const totalPages = range.count;

        for (let i = range.start; i < range.start + totalPages; i++) {
          doc.switchToPage(i);

          const footerY = pageHeight - margin + 10;
          doc.save();
          doc
            .strokeColor('#cbd5e1')
            .lineWidth(0.5)
            .moveTo(margin, footerY - 5)
            .lineTo(pageWidth - margin, footerY - 5)
            .stroke();

          // Left: Confidentiality notice
          doc
            .font('Helvetica')
            .fontSize(7)
            .fillColor('#64748b')
            .text(
              'CONFIDENTIAL — Prepared specifically for Customer. All technical and pricing data is proprietary.',
              margin,
              footerY,
              { width: contentWidth - 100, align: 'left' }
            );

          // Right: Page X of Y & Quotation Number
          doc
            .font('Helvetica-Bold')
            .fontSize(7)
            .fillColor('#475569')
            .text(
              `Page ${i + 1} of ${totalPages}  |  ${quotation.quoteNumber}`,
              pageWidth - margin - 120,
              footerY,
              { width: 120, align: 'right' }
            );
          doc.restore();
        }

        // Finalize document
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates or retrieves an existing PDF for an APPROVED quotation.
   * Uploads to private Supabase Storage and records metadata in PostgreSQL.
   */
  public async generateQuotationPdf(
    quotationId: string,
    userId: string
  ): Promise<PdfGenerationResult> {
    // 1. Fetch quotation with all relations
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        rfq: {
          include: {
            customer: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        approvals: {
          include: {
            reviewer: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        quoteParts: {
          include: {
            rfqPart: {
              include: {
                routingOperations: {
                  orderBy: { sequence: 'asc' },
                },
              },
            },
            volumePrices: {
              orderBy: { productionVolume: 'asc' },
            },
          },
        },
        pdf: true,
      },
    });

    if (!quotation) {
      throw new AppError('Quotation not found.', 404);
    }

    // 2. Strict Status Validation: ONLY APPROVED quotations can generate PDFs!
    if (quotation.status !== QuotationStatus.APPROVED) {
      throw new AppError(
        `Quotation PDF generation is strictly restricted to APPROVED quotations. Current quotation status is ${quotation.status}. Commercial sign-off is required before generating the customer-facing PDF.`,
        409
      );
    }

    // 3. Check for existing PDF record (Idempotency / Caching)
    if (quotation.pdf) {
      const existing = quotation.pdf;
      let downloadUrl: string | undefined;

      try {
        const supabase = getSupabaseClient();
        const bucket = supabaseStorageConfig.bucketName;
        const { data: signedData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(existing.storagePath, 60);
        downloadUrl = signedData?.signedUrl;
      } catch (err) {
        // Fall back gracefully; client can also stream directly
      }

      return {
        pdfId: existing.id,
        quotationId: quotation.id,
        quoteNumber: quotation.quoteNumber,
        fileName: existing.fileName,
        storagePath: existing.storagePath,
        mimeType: existing.mimeType,
        sizeBytes: Number(existing.sizeBytes),
        checksumSha256: existing.checksumSha256 || '',
        createdAt: existing.createdAt,
        downloadUrl,
        isExisting: true,
      };
    }

    // 4. Load configured seller company profile
    const seller = getSellerProfile();

    // 5. Render PDF Buffer using PDFKit
    const pdfBuffer = await this.renderQuotationPdfBuffer(quotation, seller);
    const checksumSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const fileName = `${quotation.quoteNumber}.pdf`;
    const storagePath = `quotations/${quotation.id}/${fileName}`;

    // 6. Upload to private Supabase Storage
    const supabase = getSupabaseClient();
    const bucket = supabaseStorageConfig.bucketName;

    // Check or ensure bucket exists
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (buckets && !buckets.some((b) => b.name === bucket)) {
        await supabase.storage.createBucket(bucket, { public: false });
      }
    } catch (bErr) {
      // Continue if listBuckets is not permitted
    }

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new AppError(`Failed to store PDF artifact in storage: ${uploadError.message}`, 500);
    }

    // 7. Persist QuotationPdf in PostgreSQL
    const pdfRecord = await prisma.quotationPdf.create({
      data: {
        quotationId: quotation.id,
        storagePath,
        fileName,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(pdfBuffer.length),
        checksumSha256,
        generatedById: userId,
      },
    });

    // 8. Create AuditLog entry
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        entityType: 'QUOTATION',
        entityId: quotation.id,
        action: 'PDF_GENERATED',
        details: {
          quoteNumber: quotation.quoteNumber,
          version: quotation.version,
          fileName,
          storagePath,
          sizeBytes: pdfBuffer.length,
          checksumSha256,
          isDemo: seller.isDemo,
        },
      },
    });

    // 9. Generate short-lived signed URL (60s)
    let downloadUrl: string | undefined;
    try {
      const { data: signedData } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60);
      downloadUrl = signedData?.signedUrl;
    } catch (sErr) {
      // Non-fatal
    }

    return {
      pdfId: pdfRecord.id,
      quotationId: quotation.id,
      quoteNumber: quotation.quoteNumber,
      fileName,
      storagePath,
      mimeType: 'application/pdf',
      sizeBytes: pdfBuffer.length,
      checksumSha256,
      createdAt: pdfRecord.createdAt,
      downloadUrl,
      isExisting: false,
    };
  }

  /**
   * Retrieves signed URL and stream for downloading an existing quotation PDF.
   */
  public async getQuotationPdf(quotationId: string) {
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        pdf: true,
      },
    });

    if (!quotation) {
      throw new AppError('Quotation not found.', 404);
    }

    if (!quotation.pdf) {
      throw new AppError(
        'PDF artifact not found for this quotation. Please generate the PDF first.',
        404
      );
    }

    const pdfRecord = quotation.pdf;
    const supabase = getSupabaseClient();
    const bucket = supabaseStorageConfig.bucketName;

    // Generate signed URL (60s expiry)
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(pdfRecord.storagePath, 60);

    if (signedError || !signedData?.signedUrl) {
      throw new AppError('Failed to generate secure download link from storage.', 500);
    }

    return {
      pdfRecord: {
        id: pdfRecord.id,
        quotationId: quotation.id,
        quoteNumber: quotation.quoteNumber,
        fileName: pdfRecord.fileName,
        storagePath: pdfRecord.storagePath,
        mimeType: pdfRecord.mimeType,
        sizeBytes: Number(pdfRecord.sizeBytes),
        checksumSha256: pdfRecord.checksumSha256,
        createdAt: pdfRecord.createdAt,
      },
      downloadUrl: signedData.signedUrl,
      expiresInSeconds: 60,
    };
  }

  /**
   * Streams the raw PDF buffer from Supabase Storage securely through the backend.
   */
  public async streamQuotationPdf(quotationId: string): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }> {
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        pdf: true,
      },
    });

    if (!quotation || !quotation.pdf) {
      throw new AppError('Quotation PDF artifact not found.', 404);
    }

    const supabase = getSupabaseClient();
    const bucket = supabaseStorageConfig.bucketName;

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(quotation.pdf.storagePath);

    if (downloadError || !fileData) {
      throw new AppError('Failed to retrieve PDF data from private storage.', 500);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      fileName: quotation.pdf.fileName,
      mimeType: quotation.pdf.mimeType,
    };
  }
}

export const quotationPdfService = new QuotationPdfService();
export default quotationPdfService;

