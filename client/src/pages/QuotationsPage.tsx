import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { FileText } from 'lucide-react';

export const QuotationsPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-sky-500" />
            <span>Customer Quotation Dispatch</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Official customer-facing quotations, PDF document generation, and client dispatch tracking.
          </p>
        </div>
        <Badge variant="outline" className="border-sky-500/30 text-sky-400 bg-sky-500/10">
          Sales Head View
        </Badge>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Active Quotations</CardTitle>
          <CardDescription>
            Download formatted quotes with multi-tier pricing, terms and conditions, and expiry tracking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">
            Quotation records and customer PDF dispatch views will be enabled in the Quotation Dispatch module.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuotationsPage;

