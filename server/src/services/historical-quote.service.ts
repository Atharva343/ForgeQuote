import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  HistoricalQuoteQueryParams,
  ColumnMapping,
  SimilarPartQueryParams,
} from '../validators/historical-quote.validator';
import { Prisma } from '@prisma/client';

export interface ParsedRowData {
  sourceRow: number;
  sourceSheet: string;
  sourceFileName: string;
  quoteReference: string;
  customerName: string;
  partNumber?: string | null;
  partDescription?: string | null;
  material?: string | null;
  grossWeightKg?: number | null;
  quantity?: number | null;
  unitPrice?: number | null;
  currency: string;
  quoteDate?: Date | null;
  processDescription?: string | null;
}

export interface RowValidationError {
  row: number;
  sheet: string;
  column?: string;
  value?: any;
  message: string;
}

export interface ValidationSummaryResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  errors: RowValidationError[];
  validRows: ParsedRowData[];
}

export class HistoricalQuoteService {
  /**
   * Helper to clean & parse numbers from strings or Excel cells
   */
  public parseNumber(val: any): number | null {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    if (typeof val === 'object' && 'result' in val) {
      return this.parseNumber(val.result);
    }
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? null : num;
  }

  /**
   * Helper to parse dates from Excel cells or strings
   */
  public parseDate(val: any): Date | null {
    if (val === null || val === undefined || val === '') return null;
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val;
    }
    if (typeof val === 'number') {
      // Excel serial date (days since 1899-12-30)
      const date = new Date((val - (25567 + 2)) * 86400 * 1000);
      return isNaN(date.getTime()) ? null : date;
    }
    const str = String(val).trim();
    // Try standard ISO or YYYY-MM-DD
    const isoDate = new Date(str);
    if (!isNaN(isoDate.getTime())) return isoDate;

    // Try DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (ddmmyyyy) {
      const d = parseInt(ddmmyyyy[1], 10);
      const m = parseInt(ddmmyyyy[2], 10) - 1;
      const y = parseInt(ddmmyyyy[3], 10);
      const parsed = new Date(y, m, d);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  /**
   * 1. Parse Excel Headers & Sample Rows for Column Mapping Preview
   */
  public async parseExcelHeadersAndPreview(
    buffer: Buffer,
    fileName: string
  ): Promise<{
    sheets: string[];
    selectedSheet: string;
    headers: string[];
    sampleRows: Record<string, string>[];
    totalRows: number;
    suggestedMapping: Partial<ColumnMapping>;
  }> {
    const workbook = new ExcelJS.Workbook();
    const isCsv = fileName.toLowerCase().endsWith('.csv');

    if (isCsv) {
      const stream = Readable.from(buffer);
      await workbook.csv.read(stream);
    } else {
      await workbook.xlsx.load(buffer as any);
    }

    if (!workbook.worksheets || workbook.worksheets.length === 0) {
      throw new AppError('The uploaded spreadsheet contains no worksheets.', 400);
    }

    const firstSheet = workbook.worksheets[0];
    const sheetNames = workbook.worksheets.map((s) => s.name);

    let headerRowNumber = 1;
    let headers: string[] = [];

    // Find first non-empty row to use as headers
    firstSheet.eachRow((row, rowNumber) => {
      if (headers.length === 0) {
        const rowValues: string[] = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
          rowValues.push(String(cell.value || '').trim());
        });
        if (rowValues.length > 0) {
          headerRowNumber = rowNumber;
          // Capture all headers by column index
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            headers[colNumber - 1] = String(cell.value || '').trim();
          });
        }
      }
    });

    if (headers.length === 0) {
      throw new AppError('No header columns found in spreadsheet.', 400);
    }

    // Filter out undefined/empty header slots
    headers = headers.map((h, i) => h || `Column ${i + 1}`);

    // Read sample preview rows (up to 5)
    const sampleRows: Record<string, string>[] = [];
    let rowCount = 0;

    firstSheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;
      rowCount++;
      if (sampleRows.length < 5) {
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          const cell = row.getCell(idx + 1);
          let val = cell.value;
          if (val !== null && typeof val === 'object' && 'text' in val) {
            val = (val as any).text;
          }
          rowObj[h] = val !== null && val !== undefined ? String(val).trim() : '';
        });
        sampleRows.push(rowObj);
      }
    });

    // Auto-suggest column mapping based on keywords
    const suggestedMapping: Partial<ColumnMapping> = {};
    headers.forEach((h) => {
      const lower = h.toLowerCase();
      if (!suggestedMapping.quoteReference && (lower.includes('quote') || lower.includes('rfq') || lower.includes('ref'))) {
        suggestedMapping.quoteReference = h;
      } else if (!suggestedMapping.customerName && (lower.includes('customer') || lower.includes('client') || lower.includes('company'))) {
        suggestedMapping.customerName = h;
      } else if (!suggestedMapping.partNumber && (lower.includes('part no') || lower.includes('part number') || lower.includes('item no') || lower.includes('part_no') || lower.includes('pn'))) {
        suggestedMapping.partNumber = h;
      } else if (!suggestedMapping.partDescription && (lower.includes('part name') || lower.includes('description') || lower.includes('desc') || lower.includes('title'))) {
        suggestedMapping.partDescription = h;
      } else if (!suggestedMapping.material && (lower.includes('material') || lower.includes('grade') || lower.includes('spec'))) {
        suggestedMapping.material = h;
      } else if (!suggestedMapping.grossWeightKg && (lower.includes('weight') || lower.includes('mass') || lower.includes('kg'))) {
        suggestedMapping.grossWeightKg = h;
      } else if (!suggestedMapping.quantity && (lower.includes('quantity') || lower.includes('qty') || lower.includes('vol') || lower.includes('volume') || lower.includes('eau'))) {
        suggestedMapping.quantity = h;
      } else if (!suggestedMapping.unitPrice && (lower.includes('unit price') || lower.includes('price') || lower.includes('rate') || lower.includes('cost'))) {
        suggestedMapping.unitPrice = h;
      } else if (!suggestedMapping.currency && (lower.includes('currency') || lower.includes('curr'))) {
        suggestedMapping.currency = h;
      } else if (!suggestedMapping.quoteDate && (lower.includes('date') || lower.includes('quoted on'))) {
        suggestedMapping.quoteDate = h;
      } else if (!suggestedMapping.processDescription && (lower.includes('process') || lower.includes('routing') || lower.includes('operations') || lower.includes('scope'))) {
        suggestedMapping.processDescription = h;
      }
    });

    return {
      sheets: sheetNames,
      selectedSheet: firstSheet.name,
      headers,
      sampleRows,
      totalRows: rowCount,
      suggestedMapping,
    };
  }

  /**
   * 2. Validate Rows according to Column Mapping
   */
  public async validateHistoricalRows(
    buffer: Buffer,
    fileName: string,
    sheetName: string | undefined,
    columnMapping: ColumnMapping,
    allowDuplicates: boolean = false
  ): Promise<ValidationSummaryResult> {
    const workbook = new ExcelJS.Workbook();
    const isCsv = fileName.toLowerCase().endsWith('.csv');

    if (isCsv) {
      const stream = Readable.from(buffer);
      await workbook.csv.read(stream);
    } else {
      await workbook.xlsx.load(buffer as any);
    }

    const worksheet = sheetName
      ? workbook.getWorksheet(sheetName) || workbook.worksheets[0]
      : workbook.worksheets[0];

    if (!worksheet) {
      throw new AppError('Worksheet not found in workbook.', 400);
    }

    // Map column names to 1-based column indices
    let headerRowNumber = 1;
    const colIndexMap: Record<string, number> = {};

    worksheet.eachRow((row, rowNumber) => {
      if (Object.keys(colIndexMap).length === 0) {
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const val = String(cell.value || '').trim();
          if (val) colIndexMap[val] = colNumber;
        });
        if (Object.keys(colIndexMap).length > 0) {
          headerRowNumber = rowNumber;
        }
      }
    });

    const getColIndex = (colName?: string): number | undefined => {
      if (!colName) return undefined;
      return colIndexMap[colName];
    };

    const quoteRefCol = getColIndex(columnMapping.quoteReference);
    const customerCol = getColIndex(columnMapping.customerName);
    const partNoCol = getColIndex(columnMapping.partNumber);
    const partDescCol = getColIndex(columnMapping.partDescription);
    const matCol = getColIndex(columnMapping.material);
    const wtCol = getColIndex(columnMapping.grossWeightKg);
    const qtyCol = getColIndex(columnMapping.quantity);
    const priceCol = getColIndex(columnMapping.unitPrice);
    const currCol = getColIndex(columnMapping.currency);
    const dateCol = getColIndex(columnMapping.quoteDate);
    const procCol = getColIndex(columnMapping.processDescription);

    if (!quoteRefCol || !customerCol) {
      throw new AppError(
        'Quote Reference and Customer Name column mappings are mandatory.',
        400
      );
    }

    const validRows: ParsedRowData[] = [];
    const errors: RowValidationError[] = [];
    const duplicateMap = new Set<string>();
    let duplicateCount = 0;
    let totalRows = 0;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;
      totalRows++;

      const getVal = (col?: number): any => {
        if (!col) return null;
        const cell = row.getCell(col);
        let val = cell.value;
        if (val !== null && typeof val === 'object' && 'text' in val) {
          val = (val as any).text;
        }
        return val !== null && val !== undefined ? val : null;
      };

      const quoteRefRaw = String(getVal(quoteRefCol) || '').trim();
      const customerRaw = String(getVal(customerCol) || '').trim();

      // Check required fields
      if (!quoteRefRaw) {
        errors.push({
          row: rowNumber,
          sheet: worksheet.name,
          column: columnMapping.quoteReference,
          message: 'Quote Reference is required but empty.',
        });
        return;
      }

      if (!customerRaw) {
        errors.push({
          row: rowNumber,
          sheet: worksheet.name,
          column: columnMapping.customerName,
          message: 'Customer Name is required but empty.',
        });
        return;
      }

      const partNumber = partNoCol ? String(getVal(partNoCol) || '').trim() || null : null;
      const partDescription = partDescCol ? String(getVal(partDescCol) || '').trim() || null : null;
      const material = matCol ? String(getVal(matCol) || '').trim() || null : null;
      const processDescription = procCol ? String(getVal(procCol) || '').trim() || null : null;

      // Numeric validations
      let grossWeightKg: number | null = null;
      if (wtCol) {
        const rawWt = getVal(wtCol);
        if (rawWt !== null && String(rawWt).trim() !== '') {
          grossWeightKg = this.parseNumber(rawWt);
          if (grossWeightKg === null || grossWeightKg < 0) {
            errors.push({
              row: rowNumber,
              sheet: worksheet.name,
              column: columnMapping.grossWeightKg,
              value: rawWt,
              message: `Invalid gross weight value '${rawWt}'. Must be a non-negative number.`,
            });
            return;
          }
        }
      }

      let quantity: number | null = null;
      if (qtyCol) {
        const rawQty = getVal(qtyCol);
        if (rawQty !== null && String(rawQty).trim() !== '') {
          quantity = this.parseNumber(rawQty);
          if (quantity === null || quantity < 0) {
            errors.push({
              row: rowNumber,
              sheet: worksheet.name,
              column: columnMapping.quantity,
              value: rawQty,
              message: `Invalid quantity '${rawQty}'. Must be a non-negative integer.`,
            });
            return;
          }
          quantity = Math.round(quantity);
        }
      }

      let unitPrice: number | null = null;
      if (priceCol) {
        const rawPrice = getVal(priceCol);
        if (rawPrice !== null && String(rawPrice).trim() !== '') {
          unitPrice = this.parseNumber(rawPrice);
          if (unitPrice === null || unitPrice < 0) {
            errors.push({
              row: rowNumber,
              sheet: worksheet.name,
              column: columnMapping.unitPrice,
              value: rawPrice,
              message: `Invalid unit price '${rawPrice}'. Must be a non-negative number.`,
            });
            return;
          }
        }
      }

      // Currency
      let currency = 'INR';
      if (currCol) {
        const rawCurr = String(getVal(currCol) || '').trim();
        if (rawCurr) {
          currency = rawCurr.toUpperCase();
        }
      }

      // Date parsing
      let quoteDate: Date | null = null;
      if (dateCol) {
        const rawDate = getVal(dateCol);
        if (rawDate !== null && String(rawDate).trim() !== '') {
          quoteDate = this.parseDate(rawDate);
          if (!quoteDate) {
            errors.push({
              row: rowNumber,
              sheet: worksheet.name,
              column: columnMapping.quoteDate,
              value: rawDate,
              message: `Invalid quotation date format '${rawDate}'. Expected YYYY-MM-DD or DD/MM/YYYY.`,
            });
            return;
          }
        }
      }

      // Duplicate detection within file
      const dedupKey = `${quoteRefRaw}:::${customerRaw}:::${partNumber || ''}:::${quantity || ''}:::${unitPrice || ''}`.toLowerCase();
      if (duplicateMap.has(dedupKey)) {
        duplicateCount++;
        if (!allowDuplicates) {
          errors.push({
            row: rowNumber,
            sheet: worksheet.name,
            column: 'Row',
            message: `Duplicate quotation record detected within spreadsheet (Ref: ${quoteRefRaw}, Part: ${partNumber || 'N/A'}).`,
          });
          return;
        }
      } else {
        duplicateMap.add(dedupKey);
      }

      validRows.push({
        sourceRow: rowNumber,
        sourceSheet: worksheet.name,
        sourceFileName: fileName,
        quoteReference: quoteRefRaw,
        customerName: customerRaw,
        partNumber,
        partDescription,
        material,
        grossWeightKg,
        quantity,
        unitPrice,
        currency,
        quoteDate,
        processDescription,
      });
    });

    return {
      totalRows,
      validCount: validRows.length,
      invalidCount: errors.length,
      duplicateCount,
      errors,
      validRows,
    };
  }

  /**
   * 3. Confirm Import into Neon PostgreSQL Database (Chunked Batch Insert)
   */
  public async confirmHistoricalImport(
    userId: string,
    fileName: string,
    validRows: ParsedRowData[],
    errorSummary: RowValidationError[] = []
  ): Promise<{
    batchId: string;
    totalRows: number;
    importedRows: number;
    invalidRows: number;
    duplicateRows: number;
    status: string;
  }> {
    if (!validRows || validRows.length === 0) {
      throw new AppError('No valid records to import.', 400);
    }

    // Check if duplicate import of exact file with exact row count happened recently
    const recentDuplicateBatch = await prisma.historicalImportBatch.findFirst({
      where: {
        fileName,
        importedRows: validRows.length,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Create batch record in PROCESSING state
    const batch = await prisma.historicalImportBatch.create({
      data: {
        fileName,
        totalRows: validRows.length + errorSummary.length,
        importedRows: 0,
        invalidRows: errorSummary.length,
        duplicateRows: 0,
        status: 'PROCESSING',
        errorSummary: errorSummary.length > 0 ? (errorSummary as any) : Prisma.JsonNull,
        importedById: userId,
      },
    });

    try {
      // Chunked insertion: Neon PostgreSQL allows multiple thousands, but 250 rows per batch
      // ensures minimal network packet latency and zero transaction memory spikes
      const CHUNK_SIZE = 250;
      for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
        const chunk = validRows.slice(i, i + CHUNK_SIZE);
        const recordsToInsert = chunk.map((r) => ({
          quoteReference: r.quoteReference,
          customerName: r.customerName,
          partNumber: r.partNumber || null,
          partDescription: r.partDescription || null,
          material: r.material || null,
          grossWeightKg: r.grossWeightKg !== null && r.grossWeightKg !== undefined
            ? new Prisma.Decimal(r.grossWeightKg.toString())
            : null,
          quantity: r.quantity !== null && r.quantity !== undefined ? r.quantity : null,
          unitPrice: r.unitPrice !== null && r.unitPrice !== undefined
            ? new Prisma.Decimal(r.unitPrice.toString())
            : null,
          currency: r.currency || 'INR',
          quoteDate: r.quoteDate || null,
          processDescription: r.processDescription || null,
          sourceFileName: r.sourceFileName,
          sourceSheet: r.sourceSheet || null,
          sourceRow: r.sourceRow,
          batchId: batch.id,
          importStatus: 'IMPORTED',
          createdById: userId,
        }));

        await prisma.historicalQuoteRecord.createMany({
          data: recordsToInsert,
        });
      }

      // Mark batch as COMPLETED
      await prisma.historicalImportBatch.update({
        where: { id: batch.id },
        data: {
          importedRows: validRows.length,
          status: 'COMPLETED',
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          entityType: 'HISTORICAL_QUOTES',
          entityId: batch.id,
          action: 'HISTORICAL_QUOTES_IMPORTED',
          details: {
            fileName,
            totalRows: batch.totalRows,
            importedRows: validRows.length,
            invalidRows: batch.invalidRows,
          },
        },
      });

      return {
        batchId: batch.id,
        totalRows: batch.totalRows,
        importedRows: validRows.length,
        invalidRows: batch.invalidRows,
        duplicateRows: batch.duplicateRows,
        status: 'COMPLETED',
      };
    } catch (insertErr: any) {
      // Rollback: delete any partially inserted records and mark batch as FAILED
      await prisma.historicalQuoteRecord.deleteMany({
        where: { batchId: batch.id },
      });
      await prisma.historicalImportBatch.update({
        where: { id: batch.id },
        data: {
          status: 'FAILED',
          errorSummary: {
            message: 'Import failed during chunked insertion. Safely rolled back.',
            error: insertErr?.message || String(insertErr),
          },
        },
      });
      throw new AppError(
        `Historical batch import failed and was cleanly rolled back: ${insertErr?.message || 'Database error'}`,
        500
      );
    }
  }

  /**
   * 4. Search Historical Quotations
   */
  public async searchHistoricalQuotes(params: HistoricalQuoteQueryParams) {
    const {
      search,
      customerName,
      material,
      currency,
      startDate,
      endDate,
      minQuantity,
      maxQuantity,
      page,
      limit,
      sortBy,
      sortOrder,
    } = params;

    const where: Prisma.HistoricalQuoteRecordWhereInput = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { quoteReference: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { partNumber: { contains: q, mode: 'insensitive' } },
        { partDescription: { contains: q, mode: 'insensitive' } },
        { material: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (customerName && customerName.trim()) {
      where.customerName = { contains: customerName.trim(), mode: 'insensitive' };
    }

    if (material && material.trim()) {
      where.material = { contains: material.trim(), mode: 'insensitive' };
    }

    if (currency && currency.trim()) {
      where.currency = { equals: currency.trim().toUpperCase() };
    }

    if (startDate || endDate) {
      where.quoteDate = {};
      if (startDate) {
        where.quoteDate.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length === 10) {
          end.setHours(23, 59, 59, 999);
        }
        where.quoteDate.lte = end;
      }
    }

    if (minQuantity !== undefined || maxQuantity !== undefined) {
      where.quantity = {};
      if (minQuantity !== undefined) where.quantity.gte = minQuantity;
      if (maxQuantity !== undefined) where.quantity.lte = maxQuantity;
    }

    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      prisma.historicalQuoteRecord.count({ where }),
      prisma.historicalQuoteRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          batch: {
            select: {
              id: true,
              fileName: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const formattedRecords = records.map((r) => ({
      ...r,
      recordType: 'HISTORICAL / IMPORTED' as const,
      disclaimer: 'Historical imported record. Not an approved ForgeQuote quotation or Rate Master.',
    }));

    return {
      records: formattedRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * 5. Get Historical Record by ID with Provenance
   */
  public async getHistoricalQuoteById(id: string) {
    const record = await prisma.historicalQuoteRecord.findUnique({
      where: { id },
      include: {
        batch: true,
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!record) {
      throw new AppError(`Historical quote record with ID '${id}' not found.`, 404);
    }

    return {
      ...record,
      recordType: 'HISTORICAL / IMPORTED' as const,
      disclaimer:
        'Historical imported record. Not an approved ForgeQuote quotation or current Rate Master.',
    };
  }

  /**
   * 6. Explainable Similar-Part Retrieval
   */
  public async findSimilarParts(params: SimilarPartQueryParams) {
    let partNumber = params.partNumber?.trim();
    let partName = params.partName?.trim();
    let material = params.material?.trim();
    let weightKg = params.grossWeightKg;
    let volume = params.annualVolume;

    // If rfqPartId provided, resolve from database
    if (params.rfqPartId) {
      const rfqPart = await prisma.rfqPart.findUnique({
        where: { id: params.rfqPartId },
      });
      if (rfqPart) {
        if (!partNumber && rfqPart.partNumber) partNumber = rfqPart.partNumber;
        if (!partName && rfqPart.partName) partName = rfqPart.partName;
        if (!material && rfqPart.material) material = rfqPart.material;
        if (weightKg === undefined && rfqPart.grossWeightKg) {
          weightKg = parseFloat(rfqPart.grossWeightKg.toString());
        }
        if (volume === undefined && rfqPart.annualVolume) {
          volume = rfqPart.annualVolume;
        }
      }
    }

    if (!partNumber && !partName && !material) {
      return {
        results: [],
        message: 'Insufficient search parameters to perform similar-part lookup. Provide part number, description, or material.',
        disclaimer:
          'Historical prices are reference information only. They are not current approved material rates or a substitute for the deterministic costing engine.',
      };
    }

    // Build candidate search conditions
    const orConditions: Prisma.HistoricalQuoteRecordWhereInput[] = [];

    if (partNumber) {
      orConditions.push({ partNumber: { equals: partNumber, mode: 'insensitive' } });
      orConditions.push({ partNumber: { contains: partNumber, mode: 'insensitive' } });
    }

    if (material) {
      orConditions.push({ material: { contains: material, mode: 'insensitive' } });
    }

    if (partName) {
      const keywords = partName
        .split(/\s+/)
        .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
        .filter((w) => w.length > 2);

      keywords.slice(0, 3).forEach((kw) => {
        orConditions.push({ partDescription: { contains: kw, mode: 'insensitive' } });
      });
    }

    if (orConditions.length === 0) {
      return {
        results: [],
        message: 'No similar historical parts found.',
        disclaimer:
          'Historical prices are reference information only. They are not current approved material rates or a substitute for the deterministic costing engine.',
      };
    }

    const candidates = await prisma.historicalQuoteRecord.findMany({
      where: { OR: orConditions },
      take: 100,
      orderBy: { quoteDate: 'desc' },
    });

    if (candidates.length === 0) {
      return {
        results: [],
        message: 'No historical quotations matched the given criteria.',
        disclaimer:
          'Historical prices are reference information only. They are not current approved material rates or a substitute for the deterministic costing engine.',
      };
    }

    // Score candidates and record explainable reasons
    const scoredList = candidates
      .map((c) => {
        let score = 0;
        const matchingReasons: string[] = [];

        // 1. Exact Part Number match
        if (
          partNumber &&
          c.partNumber &&
          c.partNumber.toLowerCase().trim() === partNumber.toLowerCase().trim()
        ) {
          score += 50;
          matchingReasons.push(`Exact part number match ('${c.partNumber}')`);
        } else if (
          partNumber &&
          c.partNumber &&
          (c.partNumber.toLowerCase().includes(partNumber.toLowerCase()) ||
            partNumber.toLowerCase().includes(c.partNumber.toLowerCase()))
        ) {
          score += 25;
          matchingReasons.push(`Partial part number match ('${c.partNumber}')`);
        }

        // 2. Exact or Partial Material match
        if (material && c.material) {
          const matA = material.toLowerCase().replace(/[^a-z0-9]/g, '');
          const matB = c.material.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (matA === matB) {
            score += 35;
            matchingReasons.push(`Exact material specification match ('${c.material}')`);
          } else if (matA.includes(matB) || matB.includes(matA)) {
            score += 20;
            matchingReasons.push(`Compatible material grade match ('${c.material}')`);
          }
        }

        // 3. Description keyword overlap
        if (partName && c.partDescription) {
          const targetWords = partName
            .toLowerCase()
            .split(/\s+/)
            .map((w) => w.replace(/[^a-z0-9]/g, ''))
            .filter((w) => w.length > 2);

          const descWords = c.partDescription
            .toLowerCase()
            .split(/\s+/)
            .map((w) => w.replace(/[^a-z0-9]/g, ''))
            .filter((w) => w.length > 2);

          const matchingWords = targetWords.filter((w) => descWords.includes(w));
          if (matchingWords.length > 0) {
            score += Math.min(25, matchingWords.length * 8);
            matchingReasons.push(
              `Description keyword overlap: ${matchingWords.map((w) => `'${w}'`).join(', ')}`
            );
          }
        }

        // 4. Weight similarity (within +/- 25%)
        if (weightKg !== undefined && weightKg > 0 && c.grossWeightKg) {
          const cWeight = parseFloat(c.grossWeightKg.toString());
          if (cWeight > 0) {
            const diffPct = Math.abs(cWeight - weightKg) / weightKg;
            if (diffPct <= 0.10) {
              score += 20;
              matchingReasons.push(
                `Very close gross weight (within 10%: ${cWeight.toFixed(3)} kg vs target ${weightKg.toFixed(3)} kg)`
              );
            } else if (diffPct <= 0.25) {
              score += 10;
              matchingReasons.push(
                `Similar gross weight (within 25%: ${cWeight.toFixed(3)} kg vs target ${weightKg.toFixed(3)} kg)`
              );
            }
          }
        }

        // 5. Quantity order of magnitude similarity
        if (volume !== undefined && volume > 0 && c.quantity) {
          const ratio = Math.max(volume, c.quantity) / Math.min(volume, c.quantity);
          if (ratio <= 2.0) {
            score += 10;
            matchingReasons.push(
              `Comparable production volume (${c.quantity.toLocaleString()} pcs vs target ${volume.toLocaleString()} pcs)`
            );
          }
        }

        return {
          id: c.id,
          quoteReference: c.quoteReference,
          customerName: c.customerName,
          partNumber: c.partNumber,
          partDescription: c.partDescription,
          material: c.material,
          grossWeightKg: c.grossWeightKg ? parseFloat(c.grossWeightKg.toString()) : null,
          quantity: c.quantity,
          unitPrice: c.unitPrice ? parseFloat(c.unitPrice.toString()) : null,
          currency: c.currency,
          quoteDate: c.quoteDate,
          processDescription: c.processDescription,
          sourceFileName: c.sourceFileName,
          sourceSheet: c.sourceSheet,
          sourceRow: c.sourceRow,
          score,
          matchingReasons,
          recordType: 'HISTORICAL / IMPORTED' as const,
        };
      })
      .filter((item) => item.score >= 20) // Filter out weak non-matches
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit);

    if (scoredList.length === 0) {
      return {
        results: [],
        message: 'No sufficiently similar historical parts met the matching threshold.',
        disclaimer:
          'Historical prices are reference information only. They are not current approved material rates or a substitute for the deterministic costing engine.',
      };
    }

    return {
      results: scoredList,
      message: `Found ${scoredList.length} relevant historical quote references.`,
      disclaimer:
        'Historical prices are reference information only. They are not current approved material rates or a substitute for the deterministic costing engine.',
    };
  }
}

export const historicalQuoteService = new HistoricalQuoteService();
