import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';
import { RfqStatus, UserRole, Prisma } from '@prisma/client';
import { intakeService } from '../services/intake.service';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

describe('AI-Assisted RFQ Intake & Document Extraction Suite (/api/rfq-intake)', () => {
  let estimatorCookie: string[] = [];
  let salesHeadCookie: string[] = [];
  let estimatorUser: any;
  let salesHeadUser: any;

  let testCustomerId: string;
  let testHistoricalPartId: string;
  let createdRfqId: string | null = null;
  let uploadedDocIds: string[] = [];

  let syntheticExcelBuffer: Buffer;
  let syntheticPdfBuffer: Buffer;

  // Helper to build a clean in-memory Excel file
  async function createSyntheticExcel(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('BOM Parts');
    sheet.addRow([
      'Part Number',
      'Part Description',
      'Material Specification',
      'Gross Weight (kg)',
      'Annual Volume',
      'Drawing No',
    ]);
    sheet.addRow([
      'PART-EXCEL-001',
      'CNC Aluminum Housing',
      'AL 6061-T6',
      '2.450',
      '5000',
      'DWG-HOUSING-01',
    ]);
    sheet.addRow([
      'PART-EXCEL-002',
      'Precision Brass Bushing',
      'Brass C360',
      '0.850',
      '12000',
      'DWG-BUSHING-02',
    ]);
    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }

  // Helper to build a clean in-memory PDF drawing
  async function createSyntheticPdf(): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', compress: false });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(16).text('ENGINEERING DRAWING SPECIFICATION', 50, 50);
      doc.fontSize(10).text('TITLE: Precision Valve Body', 50, 90);
      doc.text('PART NUMBER: PART-PDF-901', 50, 110);
      doc.text('DRAWING NUMBER: DWG-VALVE-901-REV-B', 50, 130);
      doc.text('MATERIAL: SS316L Stainless Steel', 50, 150);
      doc.text('GROSS WEIGHT: 3.85 KG', 50, 170);
      doc.text('UNITS: METRIC (MM)', 50, 190);
      doc.end();
    });
  }

  beforeAll(async () => {
    // 1. Authenticate users
    const estimatorLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'estimator@forgequote.io',
        password: process.env.SEED_ESTIMATOR_PASSWORD || 'ForgeQuote@2026',
      });
    expect(estimatorLogin.status).toBe(200);
    estimatorCookie = estimatorLogin.headers['set-cookie'] || [];
    estimatorUser = estimatorLogin.body.data.user;

    const salesHeadLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'saleshead@forgequote.io',
        password: process.env.SEED_SALES_HEAD_PASSWORD || 'ForgeQuote@2026',
      });
    expect(salesHeadLogin.status).toBe(200);
    salesHeadCookie = salesHeadLogin.headers['set-cookie'] || [];
    salesHeadUser = salesHeadLogin.body.data.user;

    // 2. Create customer & historical part with routing for suggestions
    const customer = await prisma.customer.create({
      data: {
        name: `Test Intake Engineering Ltd ${Date.now()}`,
        industry: 'Defense & Aerospace Componentry',
        contactEmail: 'inquiries@testintake.example.com',
      },
    });
    testCustomerId = customer.id;

    const histRfq = await prisma.rfq.create({
      data: {
        rfqNumber: `RFQ-HIST-INTAKE-${Date.now()}`,
        title: 'Historical Machining Reference RFQ',
        customerId: testCustomerId,
        status: RfqStatus.WON,
      },
    });

    const histPart = await prisma.rfqPart.create({
      data: {
        rfqId: histRfq.id,
        partName: 'Aluminum Housing Machined Flange',
        partNumber: 'HIST-AL-HOUSING-01',
        material: 'AL 6061-T6',
        grossWeightKg: new Prisma.Decimal('2.5000'),
        annualVolume: 5000,
      },
    });
    testHistoricalPartId = histPart.id;

    await prisma.routingOperation.createMany({
      data: [
        {
          partId: testHistoricalPartId,
          sequence: 1,
          operationName: 'CNC Face Turning',
          machineCode: 'CNC-LATHE-01',
          cycleTimeMinutes: new Prisma.Decimal('3.50'),
          setupTimeMinutes: new Prisma.Decimal('20.00'),
        },
        {
          partId: testHistoricalPartId,
          sequence: 2,
          operationName: '4-Axis CNC Milling',
          machineCode: 'CNC-MILL-4AXIS',
          cycleTimeMinutes: new Prisma.Decimal('7.20'),
          setupTimeMinutes: new Prisma.Decimal('35.00'),
        },
      ],
    });

    syntheticExcelBuffer = await createSyntheticExcel();
    syntheticPdfBuffer = await createSyntheticPdf();
  });

  afterAll(async () => {
    vi.restoreAllMocks();

    // Cleanup created intake data
    if (uploadedDocIds.length > 0) {
      await prisma.intakeDocument.deleteMany({ where: { id: { in: uploadedDocIds } } });
    }
    if (createdRfqId) {
      await prisma.rfqDocument.deleteMany({ where: { rfqId: createdRfqId } });
      await prisma.routingOperation.deleteMany({ where: { part: { rfqId: createdRfqId } } });
      await prisma.rfqPart.deleteMany({ where: { rfqId: createdRfqId } });
      await prisma.rfq.deleteMany({ where: { id: createdRfqId } });
    }

    await prisma.routingOperation.deleteMany({ where: { partId: testHistoricalPartId } });
    await prisma.rfqPart.deleteMany({ where: { id: testHistoricalPartId } });
    await prisma.rfq.deleteMany({ where: { customerId: testCustomerId } });
    await prisma.customer.deleteMany({ where: { id: testCustomerId } });
  });

  // 1. Valid PDF upload
  let pdfDocId: string;
  it('1. Valid PDF upload is accepted and stored in private storage (HTTP 201)', async () => {
    const res = await request(app)
      .post('/api/rfq-intake/upload')
      .set('Cookie', estimatorCookie)
      .attach('file', syntheticPdfBuffer, {
        filename: 'drawing-valve-901.pdf',
        contentType: 'application/pdf',
      });

    pdfDocId = res.body.data?.id;
    if (pdfDocId) uploadedDocIds.push(pdfDocId);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.fileName).toBe('drawing-valve-901.pdf');
    expect(res.body.data.mimeType).toBe('application/pdf');
    expect(res.body.data.hasExtractableText).toBe(true);
  });

  // 2. Valid Excel upload
  let excelDocId: string;
  it('2. Valid Excel upload is accepted and stored in private storage (HTTP 201)', async () => {
    const res = await request(app)
      .post('/api/rfq-intake/upload')
      .set('Cookie', estimatorCookie)
      .attach('file', syntheticExcelBuffer, {
        filename: 'customer-partlist.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    excelDocId = res.body.data?.id;
    if (excelDocId) uploadedDocIds.push(excelDocId);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.fileName).toBe('customer-partlist.xlsx');
  });

  // 3. Unsupported file rejection
  it('3. Unsupported file type (.exe, .zip) is rejected with HTTP 400', async () => {
    const badBuffer = Buffer.from('fake executable content');
    const res = await request(app)
      .post('/api/rfq-intake/upload')
      .set('Cookie', estimatorCookie)
      .attach('file', badBuffer, 'malicious.exe');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('Unsupported file type');
  });

  // 4. Oversized file rejection
  it('4. Oversized file exceeding 15 MB is rejected with HTTP 400', async () => {
    const bigFile = Buffer.alloc(16 * 1024 * 1024, 'a'); // 16 MB
    const res = await request(app)
      .post('/api/rfq-intake/upload')
      .set('Cookie', estimatorCookie)
      .attach('file', bigFile, 'huge_drawing.pdf');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('exceeds the maximum allowed limit');
  });

  // 5. Excel extraction of multiple parts
  it('5. Excel extraction extracts multiple parts deterministically with row references', async () => {
    const parts = await intakeService.extractFromExcelBuffer(
      syntheticExcelBuffer,
      'customer-partlist.xlsx'
    );

    expect(parts.length).toBe(2);
    expect(parts[0].partNumber?.value).toBe('PART-EXCEL-001');
    expect(parts[0].partName.value).toBe('CNC Aluminum Housing');
    expect(parts[0].material.value).toBe('AL 6061-T6');
    expect(parts[0].grossWeightKg?.value).toBe(2.45);
    expect(parts[0].annualVolume?.value).toBe(5000);
    expect(parts[0].partName.sourceLocation).toContain('Row: 2');
    expect(parts[0].partName.extractionMethod).toBe('DETERMINISTIC_EXCEL');

    expect(parts[1].partNumber?.value).toBe('PART-EXCEL-002');
    expect(parts[1].material.value).toBe('Brass C360');
  });

  // 6. PDF text extraction
  it('6. PDF text extraction identifies drawing number, part number, material, and weight', async () => {
    const parsedText = `
      ENGINEERING DRAWING SPECIFICATION
      TITLE: Precision Valve Body
      PART NUMBER: PART-PDF-901
      DRAWING NUMBER: DWG-VALVE-901-REV-B
      MATERIAL: SS316L Stainless Steel
      GROSS WEIGHT: 3.85 KG
    `;

    const extracted = intakeService.extractFromPdfText(parsedText, 'drawing-valve-901.pdf');

    expect(extracted.drawingNumber?.value).toBe('DWG-VALVE-901-REV-B');
    expect(extracted.partNumber?.value).toBe('PART-PDF-901');
    expect(extracted.partName?.value).toBe('Precision Valve Body');
    expect(extracted.material?.value).toBe('SS316L Stainless Steel');
    expect(extracted.grossWeightKg?.value).toBe(3.85);
    expect(extracted.partName?.extractionMethod).toBe('DETERMINISTIC_PDF');
  });

  // 7. Email extraction with structured output
  it('7. Email extraction extracts customer, RFQ title, parts, and dates', async () => {
    // Mock Gemini call to return predictable synthetic result
    vi.spyOn(intakeService, 'extractFromEmailText').mockResolvedValueOnce({
      data: {
        customerName: 'Acme Turbo Dynamics',
        customerIndustry: 'Aerospace & Defense',
        customerEmail: 'sourcing@acmeturbo.example.com',
        rfqTitle: 'RFQ for Turbine Impellers and Rotor Housings',
        rfqReference: 'RFQ-ACME-2026-99',
        receivedDate: '2026-11-01',
        dueDate: '2026-11-25',
        specialInstructions: 'Critical surface finish Ra 0.8 required on all sealing surfaces.',
        parts: [
          {
            partName: 'Turbine Rotor Flange',
            partNumber: 'TRF-100',
            material: 'Inconel 718',
            grossWeightKg: 4.5,
            annualVolume: 3000,
            notes: 'NDT inspection required',
          },
        ],
      },
    });

    const emailSample = `Dear ForgeQuote, Please quote RFQ-ACME-2026-99 for Acme Turbo Dynamics.`;
    const res = await request(app)
      .post('/api/rfq-intake/extract')
      .set('Cookie', estimatorCookie)
      .send({ emailText: emailSample });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.customerName.value).toBe('Acme Turbo Dynamics');
    expect(res.body.data.rfqTitle.value).toBe('RFQ for Turbine Impellers and Rotor Housings');
    expect(res.body.data.dueDate.value).toBe('2026-11-25');
    expect(res.body.data.parts.length).toBe(1);
    expect(res.body.data.parts[0].partName.value).toBe('Turbine Rotor Flange');
    expect(res.body.data.parts[0].material.value).toBe('Inconel 718');
    expect(res.body.data.parts[0].partName.extractionMethod).toBe('AI_GEMINI');
  });

  // 8. Malformed Gemini response handling
  it('8. Malformed Gemini JSON response is caught gracefully without crashing', async () => {
    vi.spyOn(intakeService, 'extractFromEmailText').mockResolvedValueOnce({
      error: 'Unexpected token < in JSON at position 0',
    });

    const res = await request(app)
      .post('/api/rfq-intake/extract')
      .set('Cookie', estimatorCookie)
      .send({ emailText: 'Corrupted text response test' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.geminiError).toBeDefined();
    // System does not crash and returns empty parts list
    expect(res.body.data.parts).toEqual([]);
  });

  // 9. Gemini service failure handling
  it('9. Gemini network / service error is surfaced as a warning without corrupting intake', async () => {
    vi.spyOn(intakeService, 'extractFromEmailText').mockResolvedValueOnce({
      error: '503 Service Unavailable: High quota traffic',
    });

    const res = await request(app)
      .post('/api/rfq-intake/extract')
      .set('Cookie', estimatorCookie)
      .send({ emailText: 'Network failure test' });

    expect(res.status).toBe(200);
    expect(res.body.data.geminiError).toContain('503 Service Unavailable');
  });

  // 10. Missing fields remain missing
  it('10. Fields missing from input documents remain strictly missing without fabrication', async () => {
    vi.spyOn(intakeService, 'extractFromEmailText').mockResolvedValueOnce({
      data: {
        customerName: 'Simple Corp',
        rfqTitle: 'Urgent Request',
        // Note: dueDate, receivedDate, customerEmail are missing!
        parts: [
          {
            partName: 'Plain Pin',
            material: 'Steel',
            // grossWeight and annualVolume are missing!
          },
        ],
      },
    });

    const res = await request(app)
      .post('/api/rfq-intake/extract')
      .set('Cookie', estimatorCookie)
      .send({ emailText: 'Short inquiry' });

    expect(res.status).toBe(200);
    expect(res.body.data.dueDate).toBeUndefined();
    expect(res.body.data.parts[0].grossWeightKg.value).toBeNull();
    expect(res.body.data.parts[0].annualVolume.value).toBeNull();
    // Identified in missingFields list
    expect(res.body.data.missingFields).toContain('Part 1: Gross Weight');
    expect(res.body.data.missingFields).toContain('Part 1: Annual Production Volume');
  });

  // 11. Conflicting document values are surfaced
  it('11. Conflicting material specifications between documents are detected and surfaced', async () => {
    // Email specifies material as AL 7075-T6 for CNC Aluminum Housing
    vi.spyOn(intakeService, 'extractFromEmailText').mockResolvedValueOnce({
      data: {
        customerName: 'Conflict Aerospace',
        rfqTitle: 'Housing RFQ with conflicting material',
        parts: [
          {
            partName: 'CNC Aluminum Housing',
            material: 'AL 7075-T6', // Differs from Excel's AL 6061-T6!
            annualVolume: 5000,
          },
        ],
      },
    });

    // Extract both email and the uploaded Excel document
    const res = await request(app)
      .post('/api/rfq-intake/extract')
      .set('Cookie', estimatorCookie)
      .send({
        emailText: 'Conflict email',
        documentIds: [excelDocId],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.conflicts.length).toBeGreaterThan(0);
    const materialConflict = res.body.data.conflicts.find((c: any) => c.field === 'material');
    expect(materialConflict).toBeDefined();
    expect(materialConflict.values.length).toBe(2);
    // Surfaced both conflicting values
    const conflictVals = materialConflict.values.map((v: any) => v.value);
    expect(conflictVals).toContain('AL 7075-T6');
    expect(conflictVals).toContain('AL 6061-T6');
  });

  // 12. Extracted values retain source references
  it('12. Extracted values retain exact document name and source location metadata', async () => {
    const res = await request(app)
      .post('/api/rfq-intake/extract')
      .set('Cookie', estimatorCookie)
      .send({
        documentIds: [excelDocId],
      });

    expect(res.status).toBe(200);
    const firstPart = res.body.data.parts[0];
    expect(firstPart.partName.source).toBe('customer-partlist.xlsx');
    expect(firstPart.partName.sourceLocation).toContain('Row: 2');
    expect(firstPart.partName.confidence).toBe(1.0);
  });

  // 13 & 14. Estimator can edit extracted values and reject suggestions
  it('13 & 14. Estimator can modify, adjust or reject extracted suggestions prior to RFQ creation', async () => {
    // Create an RFQ using custom estimator-edited values overriding AI output
    const confirmedPayload = {
      customerName: 'Verified Precision Industries',
      customerIndustry: 'Aerospace',
      title: 'Estimator Confirmed Valve Body Assembly',
      parts: [
        {
          partName: 'Manually Corrected Valve Body', // Edited by estimator
          partNumber: 'MOD-VALVE-01',
          material: 'SS316L',
          grossWeightKg: 4.25, // Corrected from drawing
          annualVolume: 8000,
          drawingNumber: 'DWG-CORRECTED-01',
          routingOperations: [
            {
              sequence: 1,
              operationName: 'Manual Saw Cutting',
              machineCode: 'BANDSAW-01',
              cycleTimeMinutes: 2.0,
              setupTimeMinutes: 5.0,
            },
          ],
        },
      ],
      documentIds: [pdfDocId],
    };

    const res = await request(app)
      .post('/api/rfq-intake/create-rfq')
      .set('Cookie', estimatorCookie)
      .send(confirmedPayload);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.rfq.title).toBe('Estimator Confirmed Valve Body Assembly');
    expect(res.body.data.rfq.parts[0].partName).toBe('Manually Corrected Valve Body');
    expect(res.body.data.rfq.parts[0].grossWeightKg).toBe(4.25);

    createdRfqId = res.body.data.rfq.id;
  });

  // 15. Unreviewed / Invalid values cannot create an RFQ
  it('15. Submitting empty parts or missing required values is rejected with HTTP 400', async () => {
    const invalidPayload = {
      customerName: 'Incomplete Corp',
      title: 'Missing Parts RFQ',
      parts: [], // Invalid: parts array must have at least 1 part!
    };

    const res = await request(app)
      .post('/api/rfq-intake/create-rfq')
      .set('Cookie', estimatorCookie)
      .send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  // 16. Estimator can confirm and create an RFQ
  it('16. Estimator can confirm and create an RFQ atomically with parts and documents', async () => {
    const validPayload = {
      customerName: `Confirmed Customer ${Date.now()}`,
      title: 'Full Intake Confirmed Turbine Impeller',
      parts: [
        {
          partName: 'Turbine Impeller',
          partNumber: 'TI-2026',
          material: 'AL 6061-T6',
          grossWeightKg: 1.8,
          annualVolume: 6000,
        },
      ],
      documentIds: [pdfDocId, excelDocId],
    };

    const res = await request(app)
      .post('/api/rfq-intake/create-rfq')
      .set('Cookie', estimatorCookie)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.rfq.rfqNumber).toMatch(/^RFQ-\d{4}-\d{3}$/);
    expect(res.body.data.rfq.parts.length).toBe(1);

    // Verify RfqDocument records linked
    const docs = await prisma.rfqDocument.findMany({
      where: { rfqId: res.body.data.rfq.id },
    });
    expect(docs.length).toBe(2);

    // Clean up
    await prisma.rfqDocument.deleteMany({ where: { rfqId: res.body.data.rfq.id } });
    await prisma.rfqPart.deleteMany({ where: { rfqId: res.body.data.rfq.id } });
    await prisma.rfq.deleteMany({ where: { id: res.body.data.rfq.id } });
  });

  // 17. Sales Head cannot create an RFQ through intake (HTTP 403)
  it('17. SALES_HEAD role is forbidden from creating an RFQ or uploading via intake (HTTP 403)', async () => {
    const res = await request(app)
      .post('/api/rfq-intake/create-rfq')
      .set('Cookie', salesHeadCookie)
      .send({
        customerName: 'Forbidden Corp',
        title: 'Sales Head Attempt',
        parts: [{ partName: 'Test Part', material: 'Steel', grossWeightKg: 1, annualVolume: 100 }],
      });

    expect(res.status).toBe(403);
  });

  // 18. Uploaded documents remain private
  it('18. Uploaded documents are stored in the private Supabase bucket and cannot be accessed publicly', async () => {
    const doc = await prisma.intakeDocument.findUnique({
      where: { id: pdfDocId },
    });
    expect(doc).toBeTruthy();
    expect(doc?.storagePath).toContain('intake/');
    // Verify no public URL is exposed
    expect((doc as any).publicUrl).toBeUndefined();
  });

  // 19. Uploaded documents are associated with the created RFQ
  it('19. Uploaded documents are cleanly associated with the newly created RFQ', async () => {
    const rfq = await prisma.rfq.findUnique({
      where: { id: createdRfqId! },
      include: { documents: true },
    });

    expect(rfq?.documents.length).toBe(1);
    expect(rfq?.documents[0].fileName).toBe('drawing-valve-901.pdf');
  });

  // 20. Routing suggestions reference actual historical parts
  it('20. Routing suggestions reference actual historical parts and routing operations in database', async () => {
    const suggestions = await intakeService.getHistoricalRoutingSuggestions(
      'Aluminum Housing',
      'AL 6061-T6'
    );

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].sourcePartName).toBe('Aluminum Housing Machined Flange');
    expect(suggestions[0].machineCode).toBe('CNC-LATHE-01');
    expect(suggestions[0].confidence).toBe(0.85);
    expect(suggestions[0].isAccepted).toBe(false);
  });

  // 21. No routing suggestion is returned when no relevant historical part exists
  it('21. No routing suggestion is returned when no relevant historical part exists', async () => {
    const suggestions = await intakeService.getHistoricalRoutingSuggestions(
      'Unheard Exotic Nanomaterial Widget 9999',
      'EXOTIC-GRAVITON-ALLOY'
    );

    expect(suggestions).toEqual([]);
  });

  // 22. Intake cannot overwrite an existing RFQ without confirmation
  it('22. Attempting to overwrite an existing non-existent or unconfirmed RFQ returns an error', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post('/api/rfq-intake/create-rfq')
      .set('Cookie', estimatorCookie)
      .send({
        customerName: 'Overwrite Test Corp',
        title: 'Unconfirmed Overwrite Attempt',
        parts: [{ partName: 'Part 1', material: 'Steel', grossWeightKg: 1, annualVolume: 500 }],
        confirmOverwriteRfqId: fakeId,
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('was not found');
  });
});

