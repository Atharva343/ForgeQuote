import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { historicalQuoteService } from '../../services/historical-quote.service';
import {
  AlertTriangle,
  History,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building2,
} from 'lucide-react';

interface SimilarHistoricalPartsProps {
  rfqPartId?: string;
  partNumber?: string;
  partName?: string;
  material?: string;
  grossWeightKg?: number;
  annualVolume?: number;
}

export const SimilarHistoricalParts: React.FC<SimilarHistoricalPartsProps> = ({
  rfqPartId,
  partNumber,
  partName,
  material,
  grossWeightKg,
  annualVolume,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: [
      'similar-parts',
      { rfqPartId, partNumber, partName, material, grossWeightKg, annualVolume },
    ],
    queryFn: () =>
      historicalQuoteService.getSimilarParts({
        rfqPartId,
        partNumber: partNumber || undefined,
        partName: partName || undefined,
        material: material || undefined,
        grossWeightKg: grossWeightKg || undefined,
        annualVolume: annualVolume || undefined,
        limit: 4,
      }),
    enabled: Boolean(rfqPartId || partNumber || partName || material),
  });

  const results = data?.results || [];

  return (
    <Card className="p-4 border-amber-200/60 bg-amber-50/20 space-y-3">
      {/* Header */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-amber-700" />
          <span className="font-semibold text-xs text-foreground">
            Similar Historical Parts Reference ({results.length})
          </span>
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
            Reference Only
          </Badge>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="space-y-3 pt-1">
          {/* Mandatory Safety Disclaimer Banner */}
          <div className="p-2.5 bg-amber-100/70 border border-amber-300/80 rounded text-[11px] text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Historical Reference Policy:</strong> Historical prices are reference information only. They are not current approved material rates or a substitute for the deterministic costing engine.
            </div>
          </div>

          {isLoading ? (
            <div className="text-xs text-muted-foreground py-3 text-center">
              Scanning historical quote database for matching parts...
            </div>
          ) : results.length === 0 ? (
            <div className="text-xs text-muted-foreground py-3 text-center bg-white border rounded">
              No matching historical quotations found for the specified part or material.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {results.map((part) => (
                <div
                  key={part.id}
                  className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between pb-1 border-b">
                    <span className="font-mono font-bold text-foreground">
                      {part.quoteReference}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-slate-50">
                      Score: {part.score}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="font-semibold text-slate-800">
                      {part.partDescription || part.partNumber || 'Historical Part'}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="w-3 h-3" />
                      <span>{part.customerName}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[11px] bg-slate-50 p-2 rounded">
                    <div>
                      <span className="text-muted-foreground">Material: </span>
                      <span className="font-medium">{part.material || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gross Weight: </span>
                      <span className="font-medium">
                        {part.grossWeightKg ? `${part.grossWeightKg.toFixed(3)} kg` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Quantity: </span>
                      <span className="font-medium">
                        {part.quantity ? `${part.quantity.toLocaleString()} pcs` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Unit Price: </span>
                      <span className="font-bold text-emerald-700">
                        {part.unitPrice !== null && part.unitPrice !== undefined
                          ? `${part.currency} ${part.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {part.quoteDate && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        Quoted on:{' '}
                        {new Date(part.quoteDate).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}

                  {/* Explainable Matching Reasons */}
                  <div className="space-y-0.5 pt-1">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Matching Reasons:
                    </div>
                    {part.matchingReasons.map((reason, rIdx) => (
                      <div key={rIdx} className="text-[10px] text-slate-600 pl-2">
                        &bull; {reason}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
