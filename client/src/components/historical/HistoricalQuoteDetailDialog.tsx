import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { HistoricalQuoteRecord } from '../../types/historical-quote.types';
import {
  FileText,
  Calendar,
  Building2,
  Database,
  AlertTriangle,
} from 'lucide-react';

interface HistoricalQuoteDetailDialogProps {
  record: HistoricalQuoteRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HistoricalQuoteDetailDialog: React.FC<HistoricalQuoteDetailDialogProps> = ({
  record,
  open,
  onOpenChange,
}) => {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg flex items-center gap-2">
                  <span>{record.quoteReference}</span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
                    HISTORICAL / IMPORTED
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Original reference from historical quotation archives
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Disclaimer Banner */}
        <div className="p-3 bg-amber-50/80 border border-amber-200 text-amber-800 rounded-md text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Reference Record Only</div>
            <div>
              Historical prices are reference records from past quotes and must not be used as current rate master prices or approved quotations.
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Customer & Part Info Card */}
          <Card className="p-3.5 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Quotation & Part Information
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Customer Organization:</span>
                <span className="font-semibold flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  {record.customerName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Quotation Date:</span>
                <span className="font-semibold flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {record.quoteDate
                    ? new Date(record.quoteDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Part Number:</span>
                <span className="font-mono font-medium mt-0.5 block">
                  {record.partNumber || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Material Specification:</span>
                <span className="font-medium mt-0.5 block">{record.material || 'N/A'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground block text-[11px]">Part Description:</span>
                <span className="font-medium mt-0.5 block">{record.partDescription || 'N/A'}</span>
              </div>
            </div>
          </Card>

          {/* Pricing & Physical Specs */}
          <Card className="p-3.5 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Quantity & Commercials
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Gross Weight:</span>
                <span className="font-semibold text-base mt-0.5 block">
                  {record.grossWeightKg !== null && record.grossWeightKg !== undefined
                    ? `${Number(record.grossWeightKg).toFixed(3)} kg`
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Production Volume:</span>
                <span className="font-semibold text-base mt-0.5 block">
                  {record.quantity !== null && record.quantity !== undefined
                    ? `${Number(record.quantity).toLocaleString()} pcs`
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Historical Unit Price:</span>
                <span className="font-bold text-base text-emerald-700 mt-0.5 block">
                  {record.unitPrice !== null && record.unitPrice !== undefined
                    ? `${record.currency} ${Number(record.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {record.processDescription && (
              <div className="pt-2 border-t text-xs">
                <span className="text-muted-foreground block text-[11px]">Manufacturing Process / Scope:</span>
                <span className="font-normal text-foreground mt-0.5 block bg-slate-50 p-2 rounded border">
                  {record.processDescription}
                </span>
              </div>
            )}
          </Card>

          {/* Provenance & Batch Information */}
          <Card className="p-3.5 space-y-2 bg-slate-50/50">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Import Provenance & Source Metadata</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span>Source File: </span>
                <span className="font-medium text-foreground">{record.sourceFileName}</span>
              </div>
              <div>
                <span>Sheet & Row: </span>
                <span className="font-medium text-foreground">
                  {record.sourceSheet || 'Sheet 1'}, Row #{record.sourceRow}
                </span>
              </div>
              <div>
                <span>Batch ID: </span>
                <span className="font-mono text-[11px] text-foreground">{record.batchId}</span>
              </div>
              <div>
                <span>Imported On: </span>
                <span className="text-foreground">
                  {new Date(record.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
