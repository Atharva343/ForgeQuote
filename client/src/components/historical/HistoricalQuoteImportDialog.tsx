import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { historicalQuoteService } from '../../services/historical-quote.service';
import {
  UploadPreviewData,
  ColumnMapping,
  ValidationResult,
  ImportBatchSummary,
} from '../../types/historical-quote.types';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldAlert,
} from 'lucide-react';

interface HistoricalQuoteImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export const HistoricalQuoteImportDialog: React.FC<HistoricalQuoteImportDialogProps> = ({
  open,
  onOpenChange,
  onImportComplete,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stepper: 1 = Upload, 2 = Map Columns, 3 = Validate & Review, 4 = Success Summary
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<UploadPreviewData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    quoteReference: '',
    customerName: '',
  });
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importSummary, setImportSummary] = useState<ImportBatchSummary | null>(null);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Step 1: Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => historicalQuoteService.uploadPreview(file),
    onSuccess: (data) => {
      setPreviewData(data);
      // Initialize column mapping with auto-suggestions or first headers
      setColumnMapping({
        quoteReference: data.suggestedMapping.quoteReference || data.headers[0] || '',
        customerName: data.suggestedMapping.customerName || data.headers[1] || '',
        partNumber: data.suggestedMapping.partNumber || '',
        partDescription: data.suggestedMapping.partDescription || '',
        material: data.suggestedMapping.material || '',
        grossWeightKg: data.suggestedMapping.grossWeightKg || '',
        quantity: data.suggestedMapping.quantity || '',
        unitPrice: data.suggestedMapping.unitPrice || '',
        currency: data.suggestedMapping.currency || '',
        quoteDate: data.suggestedMapping.quoteDate || '',
        processDescription: data.suggestedMapping.processDescription || '',
      });
      setStep(2);
      setGeneralError(null);
    },
    onError: (err: any) => {
      setGeneralError(err.response?.data?.message || err.message || 'Failed to parse file.');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    uploadMutation.mutate(file);
  };

  // Step 2: Validate Mutation
  const validateMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error('No file selected');
      if (!columnMapping.quoteReference) throw new Error('Quote Reference column is required');
      if (!columnMapping.customerName) throw new Error('Customer Name column is required');
      return historicalQuoteService.validateImport(
        selectedFile,
        columnMapping,
        previewData?.selectedSheet,
        allowDuplicates
      );
    },
    onSuccess: (data) => {
      setValidationResult(data);
      setStep(3);
      setGeneralError(null);
    },
    onError: (err: any) => {
      setGeneralError(err.response?.data?.message || err.message || 'Validation failed.');
    },
  });

  // Step 3: Confirm Import Mutation
  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile || !validationResult) throw new Error('Missing validation data');
      return historicalQuoteService.confirmImport({
        fileName: selectedFile.name,
        validRows: validationResult.validRows,
        errorSummary: validationResult.errors,
      });
    },
    onSuccess: (summary) => {
      setImportSummary(summary);
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ['historical-quotes'] });
      if (onImportComplete) {
        onImportComplete();
      }
    },
    onError: (err: any) => {
      setGeneralError(err.response?.data?.message || err.message || 'Failed to commit import.');
    },
  });

  const resetState = () => {
    setStep(1);
    setSelectedFile(null);
    setPreviewData(null);
    setValidationResult(null);
    setImportSummary(null);
    setGeneralError(null);
    setAllowDuplicates(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Import Historical Quotations</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Batch import historical quotations from Excel (.xlsx) or CSV (.csv) files
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Stepper Header */}
        <div className="flex items-center justify-between border-y py-2 text-xs font-medium">
          <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-amber-600 font-bold' : 'text-muted-foreground'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step > 1 ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'}`}>
              {step > 1 ? <Check className="w-3 h-3" /> : '1'}
            </span>
            <span>Upload</span>
          </div>
          <div className="h-0.5 w-10 bg-muted" />
          <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-amber-600 font-bold' : 'text-muted-foreground'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step > 2 ? 'bg-green-600 text-white' : step === 2 ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              {step > 2 ? <Check className="w-3 h-3" /> : '2'}
            </span>
            <span>Map Columns</span>
          </div>
          <div className="h-0.5 w-10 bg-muted" />
          <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-amber-600 font-bold' : 'text-muted-foreground'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step > 3 ? 'bg-green-600 text-white' : step === 3 ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              {step > 3 ? <Check className="w-3 h-3" /> : '3'}
            </span>
            <span>Validate</span>
          </div>
          <div className="h-0.5 w-10 bg-muted" />
          <div className={`flex items-center gap-1.5 ${step === 4 ? 'text-green-600 font-bold' : 'text-muted-foreground'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === 4 ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              4
            </span>
            <span>Complete</span>
          </div>
        </div>

        {generalError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Error</div>
              <div>{generalError}</div>
            </div>
          </div>
        )}

        {/* STEP 1: UPLOAD */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-slate-50 transition border-muted-foreground/30"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <Upload className="w-8 h-8 text-amber-600" />
                <span className="text-sm font-semibold">Select Excel or CSV Spreadsheet</span>
                <span className="text-xs text-muted-foreground">
                  Supports up to 20 MB files and 1,500+ rows (.xlsx, .csv)
                </span>
              </div>
            </div>

            {uploadMutation.isPending && (
              <div className="flex items-center justify-center gap-2 text-xs text-amber-700 py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Parsing headers and inspecting worksheet rows...</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: MAP COLUMNS */}
        {step === 2 && previewData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs p-2 bg-slate-50 border rounded">
              <span className="text-muted-foreground">
                File: <strong>{selectedFile?.name}</strong> &bull; Total Rows:{' '}
                <strong>{previewData.totalRows.toLocaleString()}</strong>
              </span>
              <span className="text-[11px] text-muted-foreground">
                Matches auto-suggested based on header keywords
              </span>
            </div>

            {/* Column Mapping Fields */}
            <Card className="p-4 space-y-3">
              <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Target Column Mappings
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Quote Ref */}
                <div className="space-y-1">
                  <Label className="text-xs">Quotation Reference *</Label>
                  <select
                    className="w-full text-xs h-8 px-2 border rounded-md bg-background"
                    value={columnMapping.quoteReference}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, quoteReference: e.target.value }))
                    }
                  >
                    <option value="">-- Select Column --</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Customer */}
                <div className="space-y-1">
                  <Label className="text-xs">Customer Name *</Label>
                  <select
                    className="w-full text-xs h-8 px-2 border rounded-md bg-background"
                    value={columnMapping.customerName}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, customerName: e.target.value }))
                    }
                  >
                    <option value="">-- Select Column --</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Part Number */}
                <div className="space-y-1">
                  <Label className="text-xs">Part Number</Label>
                  <select
                    className="w-full text-xs h-8 px-2 border rounded-md bg-background"
                    value={columnMapping.partNumber || ''}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, partNumber: e.target.value || undefined }))
                    }
                  >
                    <option value="">-- None / Skip --</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Part Description */}
                <div className="space-y-1">
                  <Label className="text-xs">Part Description</Label>
                  <select
                    className="w-full text-xs h-8 px-2 border rounded-md bg-background"
                    value={columnMapping.partDescription || ''}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, partDescription: e.target.value || undefined }))
                    }
                  >
                    <option value="">-- None / Skip --</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Material */}
                <div className="space-y-1">
                  <Label className="text-xs">Material Specification</Label>
                  <select
                    className="w-full text-xs h-8 px-2 border rounded-md bg-background"
                    value={columnMapping.material || ''}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, material: e.target.value || undefined }))
                    }
                  >
                    <option value="">-- None / Skip --</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Gross Weight */}
                <div className="space-y-1">
                  <Label className="text-xs">Gross Weight (kg)</Label>
                  <select
                    className="w-full text-xs h-8 px-2 border rounded-md bg-background"
                    value={columnMapping.grossWeightKg || ''}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, grossWeightKg: e.target.value || undefined }))
                    }
                  >
                    <option value="">-- None / Skip --</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="space-y-1">
                  <Label className="text-xs">Order Volume / Quantity</Label>
                  <select
                    className="w-full text-xs h-8 px-2 border rounded-md bg-background"
                    value={columnMapping.quantity || ''}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, quantity: e.target.value || undefined }))
                    }
                  >
                    <option value="">-- None / Skip --</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Unit Price */}
                <div className="space-y-1">
                  <Label className="text-xs">Historical Unit Price</Label>
                  <select
                    className="w-full text-xs h-8 px-2 border rounded-md bg-background"
                    value={columnMapping.unitPrice || ''}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, unitPrice: e.target.value || undefined }))
                    }
                  >
                    <option value="">-- None / Skip --</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Currency */}
                <div className="space-y-1">
                  <Label className="text-xs">Currency</Label>
                  <select
                    className="w-full text-xs h-8 px-2 border rounded-md bg-background"
                    value={columnMapping.currency || ''}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, currency: e.target.value || undefined }))
                    }
                  >
                    <option value="">-- None (Default: INR) --</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Quote Date */}
                <div className="space-y-1">
                  <Label className="text-xs">Quotation Date</Label>
                  <select
                    className="w-full text-xs h-8 px-2 border rounded-md bg-background"
                    value={columnMapping.quoteDate || ''}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, quoteDate: e.target.value || undefined }))
                    }
                  >
                    <option value="">-- None / Skip --</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Process / Routing */}
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Process / Routing Description</Label>
                  <select
                    className="w-full text-xs h-8 px-2 border rounded-md bg-background"
                    value={columnMapping.processDescription || ''}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, processDescription: e.target.value || undefined }))
                    }
                  >
                    <option value="">-- None / Skip --</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Change File
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={!columnMapping.quoteReference || !columnMapping.customerName || validateMutation.isPending}
                onClick={() => validateMutation.mutate()}
              >
                {validateMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Validating Rows...
                  </>
                ) : (
                  <>
                    Validate Rows
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3: VALIDATE & REVIEW */}
        {step === 3 && validationResult && (
          <div className="space-y-4">
            {/* Validation Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-xl font-bold text-green-700">
                  {validationResult.validCount.toLocaleString()}
                </div>
                <div className="text-xs text-green-800">Valid Rows Ready to Import</div>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-xl font-bold text-red-700">
                  {validationResult.invalidCount.toLocaleString()}
                </div>
                <div className="text-xs text-red-800">Invalid Rows with Errors</div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-xl font-bold text-amber-700">
                  {validationResult.duplicateCount.toLocaleString()}
                </div>
                <div className="text-xs text-amber-800">Duplicates Detected</div>
              </div>
            </div>

            {/* Error Report if invalid rows exist */}
            {validationResult.errors.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Validation Error Report ({validationResult.errors.length} issues)</span>
                </div>
                <div className="max-h-40 overflow-y-auto border rounded text-xs divide-y bg-slate-50">
                  {validationResult.errors.slice(0, 50).map((err, idx) => (
                    <div key={idx} className="p-2 text-slate-700 flex items-start gap-2">
                      <span className="font-mono text-red-600 shrink-0 font-bold">
                        Row #{err.row}:
                      </span>
                      <span>
                        {err.column ? <strong className="text-foreground">{err.column}: </strong> : null}
                        {err.message}
                      </span>
                    </div>
                  ))}
                  {validationResult.errors.length > 50 && (
                    <div className="p-2 text-center text-muted-foreground text-[11px]">
                      Showing first 50 errors of {validationResult.errors.length}...
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="p-2.5 bg-slate-50 border rounded text-[11px] text-muted-foreground">
              Only valid rows ({validationResult.validCount.toLocaleString()}) will be inserted into the database. Records will be tagged as <strong>HISTORICAL / IMPORTED</strong> and isolated from Rate Masters and live quotations.
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Edit Mapping
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={validationResult.validCount === 0 || confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Importing Records in Batches...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Commit Import ({validationResult.validCount.toLocaleString()} Rows)
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 4: SUCCESS SUMMARY */}
        {step === 4 && importSummary && (
          <div className="space-y-4 py-4 text-center">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-bold text-foreground">Import Completed Successfully</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Batch ID: <span className="font-mono">{importSummary.batchId}</span>
              </p>
            </div>

            <div className="p-4 bg-slate-50 border rounded-lg text-xs max-w-md mx-auto grid grid-cols-2 gap-3 text-left">
              <div>
                <span className="text-muted-foreground block text-[11px]">Imported Records:</span>
                <span className="font-bold text-green-700 text-sm">
                  {importSummary.importedRows.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Invalid Rows Skipped:</span>
                <span className="font-semibold text-slate-700 text-sm">
                  {importSummary.invalidRows.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Source File:</span>
                <span className="font-medium text-foreground truncate block">
                  {selectedFile?.name}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Status:</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  COMPLETED
                </Badge>
              </div>
            </div>

            <DialogFooter className="justify-center sm:justify-center pt-2">
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => handleClose(false)}
              >
                Close & View Historical Quotes
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
