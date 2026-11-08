import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Factory,
  ShieldCheck,
  Activity,
  Layers,
  FileSpreadsheet,
  Settings,
  MoreVertical,
  Plus,
  Info,
} from 'lucide-react';
import { checkHealth } from '../services/api';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const HomePage: React.FC = () => {
  const [selectedProcess, setSelectedProcess] = useState('cnc_machining');

  const { data: healthData, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    retry: 1,
  });

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
        {/* Top Navigation */}
        <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                ForgeQuote
                <Badge variant="outline" className="text-[10px] uppercase font-mono py-0 text-amber-400 border-amber-400/30">
                  Platform Foundation
                </Badge>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 text-xs bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-md text-slate-300">
                  <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>
                    API Status:{' '}
                    {isLoading ? 'Connecting...' : isError ? 'Backend Offline' : healthData?.data?.status || 'Online'}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Vite proxy configured to http://localhost:5000/api</TooltipContent>
            </Tooltip>

            {/* Quick Action Sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Workspace Settings</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Platform Parameters</SheetTitle>
                  <SheetDescription>
                    Configure workspace rate tables, default margins, and currency standards.
                  </SheetDescription>
                </SheetHeader>
                <div className="py-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Default Currency</Label>
                    <Select defaultValue="USD">
                      <SelectTrigger id="currency">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
            <div>
              <div className="inline-flex items-center space-x-2 text-xs text-amber-400 uppercase tracking-wider font-semibold mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Precision Manufacturing RFQ & Cost Estimation</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Workspace Dashboard Foundation
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Foundation and component library ready. Business features will be enabled sequentially.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                    <Plus className="w-4 h-4" />
                    <span>Create Sample RFQ</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Request for Quotation</DialogTitle>
                    <DialogDescription>
                      Dialog modal rendered via shadcn/ui. RFQ intake features will be connected in later phases.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-3">
                    <div className="space-y-2">
                      <Label htmlFor="rfq-title">Project Name</Label>
                      <Input id="rfq-title" placeholder="e.g., Titanium Turbine Impeller Batch A" />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Component Tabs Preview */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-slate-900 border border-slate-800">
              <TabsTrigger value="overview">Overview & Components</TabsTrigger>
              <TabsTrigger value="materials">Process & Rate Tables</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>BOM Cost Engine</span>
                      <Layers className="w-4 h-4 text-amber-500" />
                    </CardTitle>
                    <CardDescription>Multi-process costing foundation</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-300">
                    <p>Subsystem ready for material master lookup and machine hourly rate calculations.</p>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <Badge variant="secondary">Engine Standby</Badge>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>AI Document Parser</span>
                      <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                    </CardTitle>
                    <CardDescription>Gemini multimodal pipeline</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-300">
                    <p>Designed for automated technical drawing and specification sheet parameter extraction.</p>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <Badge variant="secondary">SDK Configured</Badge>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Quotation Generator</span>
                      <ShieldCheck className="w-4 h-4 text-amber-500" />
                    </CardTitle>
                    <CardDescription>PDFKit & ExcelJS outputs</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-300">
                    <p>High precision commercial output generation with approval chain tracking.</p>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <Badge variant="secondary">Prisma PostgreSQL Ready</Badge>
                  </CardFooter>
                </Card>
              </div>

              {/* Sample Estimation Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Component Showcase: Active RFQ Manifest</CardTitle>
                    <CardDescription>Demonstration of table, badge, dropdown, and inputs</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input placeholder="Filter parts..." className="w-48 h-8 text-xs" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Part Number</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Process Type</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Est. Cost</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono font-medium">FQ-BRK-042</TableCell>
                        <TableCell>Aerospace Grade Flange Housing</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                            5-Axis CNC Milling
                          </Badge>
                        </TableCell>
                        <TableCell>250 pcs</TableCell>
                        <TableCell className="font-mono">$142.50 / unit</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem>View Specifications</DropdownMenuItem>
                              <DropdownMenuItem>Review Material Certificate</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">Archive Line</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono font-medium">FQ-SHF-019</TableCell>
                        <TableCell>Hardened Spline Drive Shaft</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-cyan-500/40 text-cyan-400">
                            Turning + Grinding
                          </Badge>
                        </TableCell>
                        <TableCell>1,200 pcs</TableCell>
                        <TableCell className="font-mono">$38.20 / unit</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem>View Specifications</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="materials">
              <Card>
                <CardHeader>
                  <CardTitle>Process Configuration Selector</CardTitle>
                  <CardDescription>Select manufacturing processes to configure tooling parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="w-72 space-y-2">
                    <Label>Primary Machine Category</Label>
                    <Select value={selectedProcess} onValueChange={setSelectedProcess}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cnc_machining">CNC Machining (3/4/5-Axis)</SelectItem>
                        <SelectItem value="sheet_metal">Sheet Metal & Laser Cutting</SelectItem>
                        <SelectItem value="injection_molding">Plastic Injection Molding</SelectItem>
                        <SelectItem value="die_casting">Aluminum Die Casting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800 bg-slate-900/50 py-4 px-6 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-3.5 h-3.5" />
            <span>ForgeQuote Core UI Foundation &bull; shadcn/ui component system loaded</span>
          </div>
          <div>&copy; {new Date().getFullYear()} ForgeQuote. All rights reserved.</div>
        </footer>
      </div>
    </TooltipProvider>
  );
};

export default HomePage;
