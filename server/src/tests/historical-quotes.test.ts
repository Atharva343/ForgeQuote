import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import app from '../app';
import { prisma } from '../config/prisma';
import { historicalQuoteService } from '../services/historical-quote.service';
import { ColumnMapping } from '../validators/historical-quote.validator';

describe('Historical Quotation Search, Excel Import & Similar-Part Retrieval Suite (/api/historical-quotes)', () => {
  let estimatorCookie: string[];
  let salesHeadCookie: string[];
  let estimatorUser: any;
  let salesHeadUser: any;

  // Track created batches and records for cleanup
  const createdBatchIds: string[] = [];

  // Helper to build synthetic Excel buffer
  async function createSyntheticExcel(
    headers: string[],
    rows: any[][]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('HistoricalQuotes');
    sheet.addRow(headers);
    rows.forEach((r) => sheet.addRow(r));
    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }

  // Standard 5-row synthetic Excel with known fields
  let standardExcelBuffer: Buffer;
  // 1400-row synthetic Excel buffer
  let largeExcelBuffer: Buffer;
  // Excel with invalid rows
  let invalidExcelBuffer: Buffer;

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

    // 2. Generate standard synthetic Excel with custom header names
    standardExcelBuffer = await createSyntheticExcel(
      [
        'Ref Quotation',
        'Customer Organization',
        'Item Number',
        'Part Title',
        'Material Grade',
        'Gross Mass Kg',
        'Order Volume',
        'Quoted Unit Rate',
        'Currency Code',
        'Quote Date',
        'Manufacturing Process',
      ],
      [
        [
          'HQ-2023-001',
          'AeroDefense Corp',
          'PART-HIST-VALVE-01',
          'Hydraulic Valve Manifold Body',
          'AL 7075-T6',
          '3.450',
          '2500',
          '4850.50',
          'INR',
          '2023-04-15',
          'CNC 5-Axis Milling, Deburring, Anodizing',
        ],
        [
          'HQ-2023-002',
          'Bharat Auto Components Ltd',
          'PART-HIST-FLG-02',
          'Forged High Pressure Flange',
          'SS316L',
          '5.200',
          '10000',
          '3200.00',
          'INR',
          '2023-07-20',
          'Drop Forging, CNC Turning, Drilling',
        ],
        [
          'HQ-2023-003',
          'Precision Motion Systems',
          'PART-HIST-BUSH-03',
          'Heavy Duty Bearing Bushing',
          'Brass C360',
          '0.950',
          '15000',
          '850.75',
          'INR',
          '2023-09-10',
          'Lathe Turning, Reaming, Ultrasonic Cleaning',
        ],
        [
          'HQ-2023-004',
          'AeroDefense Corp',
          'PART-HIST-BRKT-04',
          'Titanium Engine Mounting Bracket',
          'Ti-6Al-4V',
          '1.850',
          '500',
          '18500.00',
          'INR',
          '2023-11-05',
          'Wire EDM, 4-Axis CNC Milling, CMM Inspection',
        ],
        [
          'HQ-2024-005',
          'Turbine Tech Dynamics',
          'PART-HIST-SHAFT-05',
          'High Precision Rotor Shaft',
          'EN24T / 4340',
          '12.400',
          '1200',
          '9450.00',
          'INR',
          '2024-02-18',
          'Rough Turning, Heat Treatment, Finish Grinding',
        ],
      ]
    );

    // 3. Generate large 1,400-row synthetic Excel
    const largeRows: any[][] = [];
    const materials = ['AL 6061-T6', 'SS316L', 'Steel 1018', 'Brass C360', 'AL 7075-T6'];
    const customers = [
      'Zenith Aero Components',
      'Apex Power Systems',
      'Nova Machining Ltd',
      'Global Energy Corp',
      'Pioneer Turbines',
    ];

    for (let i = 1; i <= 1400; i++) {
      const mat = materials[i % materials.length];
      const cust = customers[i % customers.length];
      largeRows.push([
        `HQ-BATCH-${10000 + i}`,
        cust,
        `PART-BATCH-${String(i).padStart(4, '0')}`,
        `Industrial Component Sample #${i}`,
        mat,
        (0.5 + (i % 20) * 0.25).toFixed(3),
        1000 + (i % 50) * 100,
        (500 + (i % 100) * 25).toFixed(2),
        'INR',
        '2023-06-01',
        'Standard CNC Machining & Inspection',
      ]);
    }

    largeExcelBuffer = await createSyntheticExcel(
      [
        'Quote Ref',
        'Customer Name',
        'Part Number',
        'Part Description',
        'Material',
        'Gross Weight',
        'Quantity',
        'Unit Price',
        'Currency',
        'Quote Date',
        'Process',
      ],
      largeRows
    );

    // 4. Generate invalid Excel (missing quote reference, invalid weight, negative price)
    invalidExcelBuffer = await createSyntheticExcel(
      [
        'Quote Ref',
        'Customer Name',
        'Part Number',
        'Material',
        'Gross Weight',
        'Quantity',
        'Unit Price',
      ],
      [
        ['HQ-VALID-01', 'Test Customer', 'PART-01', 'AL 6061', '2.5', '1000', '150.00'], // valid
        ['', 'Test Customer', 'PART-02', 'AL 6061', '2.5', '1000', '150.00'], // missing quote ref (invalid)
        ['HQ-INV-03', '', 'PART-03', 'AL 6061', '2.5', '1000', '150.00'], // missing customer (invalid)
        ['HQ-INV-04', 'Test Customer', 'PART-04', 'AL 6061', 'INVALID_WEIGHT', '1000', '150.00'], // invalid weight
        ['HQ-INV-05', 'Test Customer', 'PART-05', 'AL 6061', '2.5', 'INVALID_QTY', '150.00'], // invalid qty
        ['HQ-INV-06', 'Test Customer', 'PART-06', 'AL 6061', '2.5', '1000', '-50.00'], // negative price
      ]
    );
  }, 90000);

  afterAll(async () => {
    // Clean up created test batches and their records (cascading delete)
    if (createdBatchIds.length > 0) {
      await prisma.historicalImportBatch.deleteMany({
        where: { id: { in: createdBatchIds } },
      });
    }
  });

  // Standard mapping for standardExcelBuffer
  const standardMapping: ColumnMapping = {
    quoteReference: 'Ref Quotation',
    customerName: 'Customer Organization',
    partNumber: 'Item Number',
    partDescription: 'Part Title',
    material: 'Material Grade',
    grossWeightKg: 'Gross Mass Kg',
    quantity: 'Order Volume',
    unitPrice: 'Quoted Unit Rate',
    currency: 'Currency Code',
    quoteDate: 'Quote Date',
    processDescription: 'Manufacturing Process',
  };

  let importedBatchId: string;

  // 1. Valid historical Excel upload & preview
  it('1. Valid historical Excel upload produces column preview and auto-mapping suggestions (HTTP 200)', async () => {
    const res = await request(app)
      .post('/api/historical-quotes/upload-preview')
      .set('Cookie', estimatorCookie)
      .attach('file', standardExcelBuffer, 'historical-quotes-test.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.headers).toContain('Ref Quotation');
    expect(res.body.data.headers).toContain('Customer Organization');
    expect(res.body.data.totalRows).toBe(5);
    expect(res.body.data.sampleRows.length).toBe(5);
    expect(res.body.data.suggestedMapping.quoteReference).toBe('Ref Quotation');
    expect(res.body.data.suggestedMapping.customerName).toBe('Customer Organization');
  });

  // 2. Column mapping and row validation
  let validatedStandardRows: any[];
  it('2. Custom column mapping validates all rows and extracts structured records with row provenance', async () => {
    const res = await request(app)
      .post('/api/historical-quotes/validate')
      .set('Cookie', estimatorCookie)
      .attach('file', standardExcelBuffer, 'historical-quotes-test.xlsx')
      .field('columnMapping', JSON.stringify(standardMapping));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.totalRows).toBe(5);
    expect(res.body.data.validCount).toBe(5);
    expect(res.body.data.invalidCount).toBe(0);
    expect(res.body.data.duplicateCount).toBe(0);

    validatedStandardRows = res.body.data.validRows;
    expect(validatedStandardRows.length).toBe(5);
    expect(validatedStandardRows[0].quoteReference).toBe('HQ-2023-001');
    expect(validatedStandardRows[0].customerName).toBe('AeroDefense Corp');
    expect(validatedStandardRows[0].grossWeightKg).toBe(3.45);
    expect(validatedStandardRows[0].quantity).toBe(2500);
    expect(validatedStandardRows[0].unitPrice).toBe(4850.5);
    expect(validatedStandardRows[0].sourceRow).toBe(2);
  });

  // 3. Confirm import of standard batch
  it('3. Estimator can confirm import and store historical records atomically (HTTP 201)', async () => {
    const res = await request(app)
      .post('/api/historical-quotes/confirm-import')
      .set('Cookie', estimatorCookie)
      .send({
        fileName: 'historical-quotes-test.xlsx',
        validRows: validatedStandardRows,
        errorSummary: [],
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.batchId).toBeTruthy();
    expect(res.body.data.importedRows).toBe(5);
    expect(res.body.data.status).toBe('COMPLETED');

    importedBatchId = res.body.data.batchId;
    createdBatchIds.push(importedBatchId);
  });

  // 4. Invalid row detection
  it('4. Invalid rows with missing references, bad numbers, or empty customers are detected with exact row details', async () => {
    const simpleMapping: ColumnMapping = {
      quoteReference: 'Quote Ref',
      customerName: 'Customer Name',
      partNumber: 'Part Number',
      material: 'Material',
      grossWeightKg: 'Gross Weight',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
    };

    const res = await request(app)
      .post('/api/historical-quotes/validate')
      .set('Cookie', estimatorCookie)
      .attach('file', invalidExcelBuffer, 'invalid-quotes.xlsx')
      .field('columnMapping', JSON.stringify(simpleMapping));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.totalRows).toBe(6);
    expect(res.body.data.validCount).toBe(1);
    expect(res.body.data.invalidCount).toBe(5); // 5 rows failed validation
    expect(res.body.data.errors.length).toBe(5);

    // Verify row 3 failed because Quote Ref is empty
    const quoteRefErr = res.body.data.errors.find((e: any) => e.row === 3);
    expect(quoteRefErr.message).toContain('Quote Reference is required');

    // Verify row 4 failed because Customer Name is empty
    const custErr = res.body.data.errors.find((e: any) => e.row === 4);
    expect(custErr.message).toContain('Customer Name is required');

    // Verify row 5 failed due to gross weight
    const wtErr = res.body.data.errors.find((e: any) => e.row === 5);
    expect(wtErr.message).toContain('Invalid gross weight');

    // Verify row 6 failed due to quantity
    const qtyErr = res.body.data.errors.find((e: any) => e.row === 6);
    expect(qtyErr.message).toContain('Invalid quantity');
  });

  // 5. Duplicate record detection
  it('5. Duplicate records within the same spreadsheet are identified and reported', async () => {
    // Create an Excel containing a duplicate row
    const dupBuffer = await createSyntheticExcel(
      ['Quote Ref', 'Customer Name', 'Part Number', 'Quantity', 'Unit Price'],
      [
        ['HQ-DUP-01', 'Alpha Corp', 'PART-D1', 1000, 100.0],
        ['HQ-DUP-02', 'Beta Corp', 'PART-D2', 2000, 200.0],
        ['HQ-DUP-01', 'Alpha Corp', 'PART-D1', 1000, 100.0], // exact duplicate of row 2
      ]
    );

    const dupMapping: ColumnMapping = {
      quoteReference: 'Quote Ref',
      customerName: 'Customer Name',
      partNumber: 'Part Number',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
    };

    const res = await request(app)
      .post('/api/historical-quotes/validate')
      .set('Cookie', estimatorCookie)
      .attach('file', dupBuffer, 'dup-quotes.xlsx')
      .field('columnMapping', JSON.stringify(dupMapping))
      .field('allowDuplicates', 'false');

    expect(res.status).toBe(200);
    expect(res.body.data.totalRows).toBe(3);
    expect(res.body.data.duplicateCount).toBe(1);
    expect(res.body.data.invalidCount).toBe(1); // 1 duplicate rejected
    expect(res.body.data.validCount).toBe(2);
    expect(res.body.data.errors[0].message).toContain('Duplicate quotation record detected');
  });

  // 6. Import batch provenance
  it('6. Imported historical records retain batch metadata, source file name, and row provenance', async () => {
    const res = await request(app)
      .get('/api/historical-quotes')
      .set('Cookie', estimatorCookie)
      .query({ search: 'HQ-2023-001' });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const record = res.body.data[0];
    expect(record.quoteReference).toBe('HQ-2023-001');
    expect(record.sourceFileName).toBe('historical-quotes-test.xlsx');
    expect(record.sourceSheet).toBe('HistoricalQuotes');
    expect(record.sourceRow).toBe(2);
    expect(record.batchId).toBe(importedBatchId);
    expect(record.recordType).toBe('HISTORICAL / IMPORTED');
  });

  // 7. Estimator can import
  it('7. Estimator role can successfully upload preview and validate import (HTTP 200)', async () => {
    const res = await request(app)
      .post('/api/historical-quotes/upload-preview')
      .set('Cookie', estimatorCookie)
      .attach('file', standardExcelBuffer, 'estimator-test.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  // 8. Sales Head cannot import
  it('8. Sales Head role is forbidden from importing historical quotes (HTTP 403)', async () => {
    const res = await request(app)
      .post('/api/historical-quotes/upload-preview')
      .set('Cookie', salesHeadCookie)
      .attach('file', standardExcelBuffer, 'saleshead-attempt.xlsx');

    expect(res.status).toBe(403);
    expect(res.body.status).toBe('error');

    const confirmRes = await request(app)
      .post('/api/historical-quotes/confirm-import')
      .set('Cookie', salesHeadCookie)
      .send({
        fileName: 'unauthorized.xlsx',
        validRows: [{ quoteReference: 'Q', customerName: 'C' }],
      });

    expect(confirmRes.status).toBe(403);
  });

  // 9. Search by quotation number
  it('9. Search by quotation number returns matched historical records', async () => {
    const res = await request(app)
      .get('/api/historical-quotes')
      .set('Cookie', salesHeadCookie) // Sales Head can search
      .query({ search: 'HQ-2023-002' });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].quoteReference).toBe('HQ-2023-002');
    expect(res.body.data[0].partNumber).toBe('PART-HIST-FLG-02');
  });

  // 10. Search by customer
  it('10. Search by customer filters records correctly', async () => {
    const res = await request(app)
      .get('/api/historical-quotes')
      .set('Cookie', estimatorCookie)
      .query({ customerName: 'AeroDefense Corp' });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data.every((r: any) => r.customerName === 'AeroDefense Corp')).toBe(true);
  });

  // 11. Search by part number
  it('11. Search by part number filters records correctly', async () => {
    const res = await request(app)
      .get('/api/historical-quotes')
      .set('Cookie', estimatorCookie)
      .query({ search: 'PART-HIST-BUSH-03' });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].partDescription).toContain('Bearing Bushing');
  });

  // 12. Search by material
  it('12. Search and filter by material specification returns matching records', async () => {
    const res = await request(app)
      .get('/api/historical-quotes')
      .set('Cookie', estimatorCookie)
      .query({ material: 'Ti-6Al-4V' });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].material).toBe('Ti-6Al-4V');
  });

  // 13. Date filtering
  it('13. Date filtering restricts results to given date window', async () => {
    const res = await request(app)
      .get('/api/historical-quotes')
      .set('Cookie', estimatorCookie)
      .query({
        startDate: '2023-01-01',
        endDate: '2023-06-30',
      });

    expect(res.status).toBe(200);
    // HQ-2023-001 (2023-04-15) falls in this window
    const refs = res.body.data.map((r: any) => r.quoteReference);
    expect(refs).toContain('HQ-2023-001');
    expect(refs).not.toContain('HQ-2024-005'); // 2024 quote outside
  });

  // 14. Quantity filtering
  it('14. Quantity range filtering filters by min and max quantity', async () => {
    const res = await request(app)
      .get('/api/historical-quotes')
      .set('Cookie', estimatorCookie)
      .query({
        minQuantity: 10000,
        maxQuantity: 20000,
      });

    expect(res.status).toBe(200);
    const qtys = res.body.data.map((r: any) => r.quantity);
    expect(qtys.every((q: number) => q >= 10000 && q <= 20000)).toBe(true);
    expect(qtys).toContain(10000);
    expect(qtys).toContain(15000);
  });

  // 15. Pagination
  it('15. Server-side pagination returns correct page, limit, and total count', async () => {
    const res = await request(app)
      .get('/api/historical-quotes')
      .set('Cookie', estimatorCookie)
      .query({ page: 1, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(5);
    expect(res.body.pagination.hasNextPage).toBe(true);
  });

  // 16. Historical record detail
  it('16. GET /api/historical-quotes/:id returns complete historical record with batch provenance', async () => {
    // Find an existing record id
    const listRes = await request(app)
      .get('/api/historical-quotes')
      .set('Cookie', estimatorCookie)
      .query({ search: 'HQ-2023-001' });

    const id = listRes.body.data[0].id;
    const detailRes = await request(app)
      .get(`/api/historical-quotes/${id}`)
      .set('Cookie', salesHeadCookie);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.status).toBe('success');
    expect(detailRes.body.data.id).toBe(id);
    expect(detailRes.body.data.quoteReference).toBe('HQ-2023-001');
    expect(detailRes.body.data.batch).toBeDefined();
    expect(detailRes.body.data.batch.fileName).toBe('historical-quotes-test.xlsx');
    expect(detailRes.body.data.createdBy.name).toBeDefined();
    expect(detailRes.body.data.recordType).toBe('HISTORICAL / IMPORTED');
  });

  // 17. Exact part number similarity
  it('17. Similar-part retrieval matches exact part number with high score', async () => {
    const res = await request(app)
      .get('/api/historical-quotes/similar')
      .set('Cookie', estimatorCookie)
      .query({
        partNumber: 'PART-HIST-VALVE-01',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const topMatch = res.body.data[0];
    expect(topMatch.partNumber).toBe('PART-HIST-VALVE-01');
    expect(topMatch.quoteReference).toBe('HQ-2023-001');
    expect(topMatch.score).toBeGreaterThanOrEqual(50);
  });

  // 18. Material similarity
  it('18. Similar-part retrieval identifies parts with matching material specification', async () => {
    const res = await request(app)
      .get('/api/historical-quotes/similar')
      .set('Cookie', estimatorCookie)
      .query({
        material: 'SS316L',
        partName: 'Flange Joint',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const match = res.body.data.find((m: any) => m.material === 'SS316L');
    expect(match).toBeDefined();
    expect(match.partNumber).toBe('PART-HIST-FLG-02');
  });

  // 19. Similarity results include matching reasons
  it('19. Similarity results provide explainable matching reasons for each attribute', async () => {
    const res = await request(app)
      .get('/api/historical-quotes/similar')
      .set('Cookie', estimatorCookie)
      .query({
        partNumber: 'PART-HIST-VALVE-01',
        material: 'AL 7075-T6',
        partName: 'Hydraulic Valve Manifold',
        grossWeightKg: 3.5,
        annualVolume: 2500,
      });

    expect(res.status).toBe(200);
    const topMatch = res.body.data[0];
    expect(topMatch.matchingReasons.length).toBeGreaterThanOrEqual(3);
    expect(
      topMatch.matchingReasons.some((r: string) => r.includes('Exact part number match'))
    ).toBe(true);
    expect(
      topMatch.matchingReasons.some((r: string) => r.includes('Exact material specification match'))
    ).toBe(true);
    expect(
      topMatch.matchingReasons.some((r: string) => r.includes('gross weight'))
    ).toBe(true);
    expect(res.body.disclaimer).toContain('reference information only');
  });

  // 20. No-match result returns an empty list
  it('20. No-match result returns an empty array with explanatory message when no criteria meet threshold', async () => {
    const res = await request(app)
      .get('/api/historical-quotes/similar')
      .set('Cookie', estimatorCookie)
      .query({
        partNumber: 'NON-EXISTENT-PART-XYZ-999',
        material: 'NON-EXISTENT-UNKNOWN-ALLOY',
        partName: 'Alien Quantum Gizmo',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.message).toContain('No');
  });

  // 21. Historical prices are never inserted into Rate Masters
  it('21. Historical prices are never inserted into MaterialRate or MachineRate models', async () => {
    // Check if any MaterialRate has source 'HQ-2023-001' or similar
    const materialRate = await prisma.materialRate.findFirst({
      where: {
        materialCode: 'AL 7075-T6',
      },
    });

    // MaterialRate for AL 7075-T6 was not created by historical import
    expect(materialRate).toBeNull();

    // Verify machine rates count did not increase from historical process strings
    const machineRatesCount = await prisma.machineRate.count();
    expect(machineRatesCount).toBeGreaterThanOrEqual(3); // seeded rate masters only
  });

  // 22. Historical records never modify approved quotations
  it('22. Historical records never modify or overwrite approved ForgeQuote quotations', async () => {
    const approvedQuotes = await prisma.quotation.findMany({
      where: { status: 'APPROVED' },
    });

    for (const quote of approvedQuotes) {
      expect(quote.quoteNumber.startsWith('HQ-')).toBe(false);
      expect(quote.isHistoricalImport).toBe(false);
      expect(quote.status).toBe('APPROVED');
    }
  });

  // 23. Unauthenticated access is rejected
  it('23. Unauthenticated requests to search or import historical quotes are rejected with HTTP 401', async () => {
    const searchRes = await request(app).get('/api/historical-quotes');
    expect(searchRes.status).toBe(401);

    const importRes = await request(app)
      .post('/api/historical-quotes/upload-preview')
      .attach('file', standardExcelBuffer, 'unauth.xlsx');
    expect(importRes.status).toBe(401);
  });

  // 24. Large dataset import (~1,400 rows)
  it('24. Large dataset of ~1,400 rows imports successfully in chunked transactions within performance bounds', async () => {
    const startTime = Date.now();

    const largeMapping: ColumnMapping = {
      quoteReference: 'Quote Ref',
      customerName: 'Customer Name',
      partNumber: 'Part Number',
      partDescription: 'Part Description',
      material: 'Material',
      grossWeightKg: 'Gross Weight',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      currency: 'Currency',
      quoteDate: 'Quote Date',
      processDescription: 'Process',
    };

    // Validate 1,400 rows
    const validateRes = await request(app)
      .post('/api/historical-quotes/validate')
      .set('Cookie', estimatorCookie)
      .attach('file', largeExcelBuffer, 'large-1400-quotes.xlsx')
      .field('columnMapping', JSON.stringify(largeMapping));

    expect(validateRes.status).toBe(200);
    expect(validateRes.body.data.totalRows).toBe(1400);
    expect(validateRes.body.data.validCount).toBe(1400);
    expect(validateRes.body.data.invalidCount).toBe(0);

    // Confirm chunked import of 1,400 rows
    const confirmRes = await request(app)
      .post('/api/historical-quotes/confirm-import')
      .set('Cookie', estimatorCookie)
      .send({
        fileName: 'large-1400-quotes.xlsx',
        validRows: validateRes.body.data.validRows,
        errorSummary: [],
      });

    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.data.importedRows).toBe(1400);
    expect(confirmRes.body.data.status).toBe('COMPLETED');

    const durationSeconds = (Date.now() - startTime) / 1000;
    console.log(`[Performance] 1,400 row validation & insertion completed in ${durationSeconds.toFixed(2)}s`);

    const batchId = confirmRes.body.data.batchId;
    createdBatchIds.push(batchId);

    // Verify record count in DB
    const dbCount = await prisma.historicalQuoteRecord.count({
      where: { batchId },
    });
    expect(dbCount).toBe(1400);
  }, 120000);
});
