import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { customerService } from '../../services/customer.service';
import { intakeService } from '../../services/intake.service';
import {
  IntakeDocumentUploaded,
  IntakeExtractionData,
  RoutingSuggestionItem,
} from '../../types/intake.types';
import {
  Sparkles,
  Upload,
  FileText,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Layers,
  Check,
  ShieldAlert,
} from 'lucide-react';

interface RfqIntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (rfqId?: string) => void;
}

interface EditablePart {
  partName: string;
  partNameSource?: string;
  partNumber: string;
  partNumberSource?: string;
  drawingNumber: string;
  drawingNumberSource?: string;
  material: string;
  materialSource?: string;
  grossWeightKg: string;
  grossWeightKgSource?: string;
  annualVolume: string;
  annualVolumeSource?: string;
  notes: string;
  routingSuggestions: RoutingSuggestionItem[];
  acceptedRoutingIndices: Set<number>;
  confidence: number;
}

export const RfqIntakeDialog: React.FC<RfqIntakeDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stepper: 1 = Input & Upload, 2 = Review & Confirm
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Inputs
  const [emailText, setEmailText] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState<IntakeDocumentUploaded[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Step 2: Extracted & Editable Data
  const [draftId, setDraftId] = useState<string | undefined>();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [rfqTitle, setRfqTitle] = useState<string>('');
  const [rfqDescription, setRfqDescription] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [conflictWarnings, setConflictWarnings] = useState<IntakeExtractionData['conflictWarnings']>([]);
  const [overallConfidence, setOverallConfidence] = useState<number>(1.0);
  const [parts, setParts] = useState<EditablePart[]>([]);
  const [expandedRoutingParts, setExpandedRoutingParts] = useState<Set<number>>(new Set());

  // Error and Loading states
  const [extractError, setExtractError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Fetch customers for selector
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: customerService.getCustomers,
    enabled: open,
  });

  // Handle file uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingFile(true);
    setUploadError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploaded = await intakeService.uploadDocument(file);
        setUploadedDocs((prev) => [...prev, uploaded]);
      }
    } catch (err: any) {
      setUploadError(err.response?.data?.message || err.message || 'File upload failed');
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeDoc = (id: string) => {
    setUploadedDocs((prev) => prev.filter((d) => d.id !== id));
  };

  // Run Extraction Mutation
  const extractMutation = useMutation({
    mutationFn: () =>
      intakeService.extractData({
        emailText: emailText.trim() || undefined,
        documentIds: uploadedDocs.map((d) => d.id),
      }),
    onSuccess: (data) => {
      setDraftId(data.draftId);
      setOverallConfidence(data.overallConfidence);
      setConflictWarnings(data.conflictWarnings || []);

      // Auto-populate RFQ header fields
      if (data.rfqTitle?.value) {
        setRfqTitle(data.rfqTitle.value);
      } else {
        setRfqTitle('New RFQ Inquiry');
      }

      if (data.rfqDescription?.value) {
        setRfqDescription(data.rfqDescription.value);
      }

      // Match or suggest customer
      if (data.customerName?.value) {
        const extractedCustName = data.customerName.value.toLowerCase().trim();
        const matched = customers.find(
          (c) => c.name.toLowerCase().trim() === extractedCustName
        );
        if (matched) {
          setSelectedCustomerId(matched.id);
          setNewCustomerName('');
        } else {
          setSelectedCustomerId('');
          setNewCustomerName(data.customerName.value);
        }
      }

      // Populate parts
      const editableParts: EditablePart[] = data.parts.map((p) => {
        const suggestions = p.routingSuggestions || [];
        // Default accept all suggestions if confidence > 0.7
        const accepted = new Set<number>();
        suggestions.forEach((_, idx) => accepted.add(idx));

        return {
          partName: p.partName?.value || '',
          partNameSource: p.partName ? `${p.partName.source}` : undefined,
          partNumber: p.partNumber?.value || '',
          partNumberSource: p.partNumber ? `${p.partNumber.source}` : undefined,
          drawingNumber: p.drawingNumber?.value || '',
          drawingNumberSource: p.drawingNumber ? `${p.drawingNumber.source}` : undefined,
          material: p.material?.value || '',
          materialSource: p.material ? `${p.material.source}` : undefined,
          grossWeightKg: p.grossWeightKg?.value !== null && p.grossWeightKg?.value !== undefined
            ? String(p.grossWeightKg.value)
            : '',
          grossWeightKgSource: p.grossWeightKg ? `${p.grossWeightKg.source}` : undefined,
          annualVolume: p.annualVolume?.value !== null && p.annualVolume?.value !== undefined
            ? String(p.annualVolume.value)
            : '',
          annualVolumeSource: p.annualVolume ? `${p.annualVolume.source}` : undefined,
          notes: p.notes?.value || '',
          routingSuggestions: suggestions,
          acceptedRoutingIndices: accepted,
          confidence: p.partName?.confidence ?? 0.8,
        };
      });

      setParts(editableParts.length > 0 ? editableParts : [createBlankPart()]);
      setStep(2);
      setExtractError(null);
    },
    onError: (err: any) => {
      setExtractError(err.response?.data?.message || err.message || 'Extraction failed');
    },
  });

  const createBlankPart = (): EditablePart => ({
    partName: '',
    partNumber: '',
    drawingNumber: '',
    material: '',
    grossWeightKg: '',
    annualVolume: '',
    notes: '',
    routingSuggestions: [],
    acceptedRoutingIndices: new Set(),
    confidence: 1.0,
  });

  const addPart = () => {
    setParts((prev) => [...prev, createBlankPart()]);
  };

  const removePart = (index: number) => {
    setParts((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePartField = (
    index: number,
    field: keyof EditablePart,
    value: any
  ) => {
    setParts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const toggleRoutingOp = (partIndex: number, opIndex: number) => {
    setParts((prev) => {
      const copy = [...prev];
      const part = { ...copy[partIndex] };
      const currentIndices = new Set(part.acceptedRoutingIndices);
      if (currentIndices.has(opIndex)) {
        currentIndices.delete(opIndex);
      } else {
        currentIndices.add(opIndex);
      }
      part.acceptedRoutingIndices = currentIndices;
      copy[partIndex] = part;
      return copy;
    });
  };

  const toggleRoutingAccordion = (partIndex: number) => {
    setExpandedRoutingParts((prev) => {
      const copy = new Set(prev);
      if (copy.has(partIndex)) {
        copy.delete(partIndex);
      } else {
        copy.add(partIndex);
      }
      return copy;
    });
  };

  // Confirm RFQ Mutation
  const confirmMutation = useMutation({
    mutationFn: () => {
      // Validate customer
      if (!selectedCustomerId && !newCustomerName.trim()) {
        throw new Error('Please select an existing customer or specify a new customer name.');
      }

      // Validate parts
      if (parts.length === 0) {
        throw new Error('At least one part is required to create an RFQ.');
      }

      const formattedParts = parts.map((p, idx) => {
        const weight = parseFloat(p.grossWeightKg);
        const volume = parseInt(p.annualVolume, 10);

        if (!p.partName.trim()) {
          throw new Error(`Part #${idx + 1} requires a valid Part Name.`);
        }
        if (!p.material.trim()) {
          throw new Error(`Part '${p.partName || `#${idx + 1}`}' requires a valid Material.`);
        }
        if (isNaN(weight) || weight <= 0) {
          throw new Error(`Part '${p.partName || `#${idx + 1}`}' requires a positive Gross Weight (kg).`);
        }
        if (isNaN(volume) || volume < 1) {
          throw new Error(`Part '${p.partName || `#${idx + 1}`}' requires an Annual Volume of at least 1.`);
        }

        // Include only accepted routing operations
        const routingOperations = p.routingSuggestions
          .filter((_, opIdx) => p.acceptedRoutingIndices.has(opIdx))
          .map((op, seq) => ({
            sequence: seq + 1,
            operationName: op.operationName,
            machineCode: op.machineCode,
            cycleTimeMinutes: op.cycleTimeMinutes,
            setupTimeMinutes: op.setupTimeMinutes,
          }));

        return {
          partName: p.partName.trim(),
          partNumber: p.partNumber.trim() || undefined,
          drawingNumber: p.drawingNumber.trim() || undefined,
          material: p.material.trim(),
          grossWeightKg: weight,
          annualVolume: volume,
          notes: p.notes.trim() || undefined,
          routingOperations: routingOperations.length > 0 ? routingOperations : undefined,
        };
      });

      return intakeService.createRfq({
        draftId,
        customerId: selectedCustomerId || undefined,
        customerName: !selectedCustomerId ? newCustomerName.trim() : undefined,
        title: rfqTitle.trim() || 'New RFQ Intake',
        description: rfqDescription.trim() || undefined,
        dueDate: dueDate || undefined,
        parts: formattedParts,
        documentIds: uploadedDocs.map((d) => d.id),
      });
    },
    onSuccess: (createdRfq) => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      resetState();
      onOpenChange(false);
      if (onCreated) {
        onCreated(createdRfq.id);
      }
    },
    onError: (err: any) => {
      setConfirmError(err.response?.data?.message || err.message || 'Failed to create RFQ');
    },
  });

  const resetState = () => {
    setStep(1);
    setEmailText('');
    setUploadedDocs([]);
    setDraftId(undefined);
    setSelectedCustomerId('');
    setNewCustomerName('');
    setRfqTitle('');
    setRfqDescription('');
    setDueDate('');
    setConflictWarnings([]);
    setOverallConfidence(1.0);
    setParts([]);
    setExpandedRoutingParts(new Set());
    setExtractError(null);
    setConfirmError(null);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                AI-Assisted RFQ Intake & Document Extraction
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Deterministic Excel/PDF extraction + Gemini email parsing with 100% human-in-the-loop review.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Stepper Header */}
        <div className="flex items-center justify-between border-y py-2.5 my-2 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                step === 1 ? 'bg-indigo-600 text-white' : 'bg-green-600 text-white'
              }`}
            >
              {step > 1 ? <Check className="w-3 h-3" /> : '1'}
            </span>
            <span className={step === 1 ? 'text-indigo-600 font-semibold' : 'text-foreground'}>
              Input & Documents
            </span>
          </div>
          <div className="h-0.5 w-16 bg-muted mx-2" />
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                step === 2 ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              2
            </span>
            <span className={step === 2 ? 'text-indigo-600 font-semibold' : 'text-muted-foreground'}>
              Review & Confirmation
            </span>
          </div>
        </div>

        {/* STEP 1: UPLOAD & INPUT */}
        {step === 1 && (
          <div className="space-y-4">
            {extractError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Extraction Failed</div>
                  <div>{extractError}</div>
                </div>
              </div>
            )}

            {/* Email Inquiry Text */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Customer Inquiry Email (Pasted Text)</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {emailText.length} characters
                </span>
              </Label>
              <textarea
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                placeholder="Paste customer inquiry email here (e.g., 'Dear Estimator, Please quote 5,000 pcs of Aluminum Housing AL 6061-T6...')"
                className="w-full h-32 px-3 py-2 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-y"
              />
            </div>

            {/* Document Upload Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Attached Engineering Documents</Label>
                <span className="text-[11px] text-muted-foreground">
                  PDF Drawings (.pdf) & Part Lists (.xlsx, .csv) &bull; Max 15 MB
                </span>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer hover:bg-slate-50 transition border-muted-foreground/25"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs font-medium">Click to select files to attach</span>
                  <span className="text-[11px] text-muted-foreground">
                    Files are securely stored in your private bucket and text is parsed automatically
                  </span>
                </div>
              </div>

              {isUploadingFile && (
                <div className="flex items-center gap-2 text-xs text-indigo-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading and processing documents...</span>
                </div>
              )}

              {uploadError && (
                <div className="p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                  {uploadError}
                </div>
              )}

              {/* Uploaded Documents List */}
              {uploadedDocs.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Attached Files ({uploadedDocs.length})
                  </div>
                  <div className="divide-y border rounded-md">
                    {uploadedDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {doc.mimeType === 'application/pdf' ? (
                            <FileText className="w-4 h-4 text-red-500 shrink-0" />
                          ) : (
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-medium truncate max-w-[280px]">
                            {doc.fileName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({(doc.sizeBytes / 1024).toFixed(1)} KB)
                          </span>
                          {doc.hasExtractableText ? (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                              Extractable Text
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                              Raster/Table
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => removeDoc(doc.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 1 Footer */}
            <DialogFooter className="pt-3">
              <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={(!emailText.trim() && uploadedDocs.length === 0) || extractMutation.isPending || isUploadingFile}
                onClick={() => extractMutation.mutate()}
              >
                {extractMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Analyzing Documents & AI Extraction...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Extract & Review RFQ Data
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 2: REVIEW & CONFIRM */}
        {step === 2 && (
          <div className="space-y-4">
            {confirmError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Submission Error</div>
                  <div>{confirmError}</div>
                </div>
              </div>
            )}

            {/* Confidence & Conflict Warnings Banner */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-semibold">Extraction Confidence:</span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      overallConfidence >= 0.8
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {(overallConfidence * 100).toFixed(0)}% Overall Confidence
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Carefully review and edit any field before creating the RFQ.
                </div>
              </div>

              {/* Conflict Warnings */}
              {conflictWarnings && conflictWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Discrepancy Detected Across Input Sources:</span>
                  </div>
                  {conflictWarnings.map((warn, wIdx) => (
                    <div key={wIdx} className="text-xs text-amber-700 pl-5">
                      &bull; {warn.warningMessage}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RFQ Header Information */}
            <Card className="p-3.5 space-y-3">
              <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
                1. RFQ Details & Customer
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Customer Selector */}
                <div className="space-y-1">
                  <Label className="text-xs">Customer</Label>
                  <select
                    className="w-full text-xs h-8 px-2 border rounded-md bg-background"
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      if (e.target.value) setNewCustomerName('');
                    }}
                  >
                    <option value="">-- Create or Specify New Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.industry})
                      </option>
                    ))}
                  </select>
                  {!selectedCustomerId && (
                    <Input
                      placeholder="New Customer Company Name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="text-xs h-8 mt-1"
                    />
                  )}
                </div>

                {/* RFQ Title */}
                <div className="space-y-1">
                  <Label className="text-xs">RFQ Title</Label>
                  <Input
                    value={rfqTitle}
                    onChange={(e) => setRfqTitle(e.target.value)}
                    className="text-xs h-8"
                    placeholder="e.g., Annual Valve Body Machining Supply"
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <Label className="text-xs">Submission Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-xs">Description / Scope Notes</Label>
                  <Input
                    value={rfqDescription}
                    onChange={(e) => setRfqDescription(e.target.value)}
                    className="text-xs h-8"
                    placeholder="Optional project scope or terms"
                  />
                </div>
              </div>
            </Card>

            {/* Extracted Parts Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide">
                  2. Line Items / Parts ({parts.length})
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addPart}
                  className="h-7 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Manual Part
                </Button>
              </div>

              {parts.map((part, pIdx) => {
                const isWeightMissing = !part.grossWeightKg || parseFloat(part.grossWeightKg) <= 0;
                const isVolMissing = !part.annualVolume || parseInt(part.annualVolume, 10) < 1;
                const hasSuggestions = part.routingSuggestions.length > 0;
                const isAccordionOpen = expandedRoutingParts.has(pIdx);

                return (
                  <Card key={pIdx} className="p-3 space-y-2.5 border-slate-200">
                    <div className="flex items-center justify-between pb-1 border-b">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">
                          Part #{pIdx + 1}
                        </span>
                        {part.partNameSource && (
                          <Badge variant="secondary" className="text-[10px] font-normal py-0">
                            Source: {part.partNameSource}
                          </Badge>
                        )}
                        {(isWeightMissing || isVolMissing) && (
                          <Badge variant="destructive" className="text-[10px] font-normal py-0">
                            Missing Required Values
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                        onClick={() => removePart(pIdx)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {/* Part Name */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Part Name *
                        </Label>
                        <Input
                          value={part.partName}
                          onChange={(e) => updatePartField(pIdx, 'partName', e.target.value)}
                          placeholder="e.g. Flange Adapter"
                          className="h-7 text-xs"
                        />
                      </div>

                      {/* Part Number */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Part Number
                        </Label>
                        <Input
                          value={part.partNumber}
                          onChange={(e) => updatePartField(pIdx, 'partNumber', e.target.value)}
                          placeholder="e.g. PN-FLG-001"
                          className="h-7 text-xs"
                        />
                      </div>

                      {/* Drawing Number */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Drawing Number
                        </Label>
                        <Input
                          value={part.drawingNumber}
                          onChange={(e) => updatePartField(pIdx, 'drawingNumber', e.target.value)}
                          placeholder="e.g. DWG-FLG-01-A"
                          className="h-7 text-xs"
                        />
                      </div>

                      {/* Material */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Material Specification *
                        </Label>
                        <Input
                          value={part.material}
                          onChange={(e) => updatePartField(pIdx, 'material', e.target.value)}
                          placeholder="e.g. SS316L, AL 6061-T6"
                          className="h-7 text-xs"
                        />
                      </div>

                      {/* Gross Weight */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                          <span>Gross Weight (kg) *</span>
                          {isWeightMissing && (
                            <span className="text-[10px] text-amber-600 font-semibold">Required</span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={part.grossWeightKg}
                          onChange={(e) => updatePartField(pIdx, 'grossWeightKg', e.target.value)}
                          placeholder="e.g. 2.450"
                          className={`h-7 text-xs ${isWeightMissing ? 'border-amber-400 bg-amber-50/30' : ''}`}
                        />
                      </div>

                      {/* Annual Volume */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                          <span>Annual Volume (EAU) *</span>
                          {isVolMissing && (
                            <span className="text-[10px] text-amber-600 font-semibold">Required</span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          value={part.annualVolume}
                          onChange={(e) => updatePartField(pIdx, 'annualVolume', e.target.value)}
                          placeholder="e.g. 5000"
                          className={`h-7 text-xs ${isVolMissing ? 'border-amber-400 bg-amber-50/30' : ''}`}
                        />
                      </div>
                    </div>

                    {/* Historical Routing Operations Accordion */}
                    <div className="pt-1">
                      <div
                        onClick={() => toggleRoutingAccordion(pIdx)}
                        className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100/80 rounded cursor-pointer transition text-xs font-medium"
                      >
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Historical Routing Suggestions</span>
                          {hasSuggestions ? (
                            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                              {part.acceptedRoutingIndices.size} of {part.routingSuggestions.length} Selected
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-normal">
                              (No historical operations match)
                            </span>
                          )}
                        </div>
                        {isAccordionOpen ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>

                      {isAccordionOpen && (
                        <div className="p-2 border border-t-0 rounded-b bg-white space-y-2">
                          {hasSuggestions ? (
                            <div className="space-y-1.5">
                              <div className="text-[11px] text-muted-foreground">
                                These operations were retrieved from matching historical parts in your database. Select operations to import into this RFQ part:
                              </div>
                              <div className="divide-y text-xs border rounded">
                                {part.routingSuggestions.map((op, opIdx) => {
                                  const isSelected = part.acceptedRoutingIndices.has(opIdx);
                                  return (
                                    <div
                                      key={opIdx}
                                      onClick={() => toggleRoutingOp(pIdx, opIdx)}
                                      className={`flex items-center justify-between p-2 cursor-pointer transition ${
                                        isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => {}} // handled by parent div
                                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div>
                                          <div className="font-semibold text-foreground">
                                            Seq {op.sequence}: {op.operationName}
                                          </div>
                                          <div className="text-[11px] text-muted-foreground">
                                            Machine: <span className="font-mono">{op.machineCode}</span> &bull; Cycle: {op.cycleTimeMinutes}m &bull; Setup: {op.setupTimeMinutes}m
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right text-[10px] text-muted-foreground">
                                        <div>From {op.sourcePartName}</div>
                                        <div className="font-mono">({op.sourceRfqNumber})</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground py-2 text-center">
                              No prior routing operations in the database match '{part.material}' and '{part.partName}'.
                              Operations can be added manually after the RFQ is created.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Step 2 Policy Disclaimer */}
            <div className="p-2.5 bg-slate-50 border rounded text-[11px] text-muted-foreground">
              <strong>Human Verification Required:</strong> AI output never creates or mutates an RFQ silently. You have complete control to edit any field before submitting. Costing engine calculations remain 100% deterministic.
            </div>

            {/* Step 2 Footer */}
            <DialogFooter className="pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                disabled={confirmMutation.isPending}
              >
                Back to Documents
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Creating RFQ & Saving Documents...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Confirm & Create RFQ
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
