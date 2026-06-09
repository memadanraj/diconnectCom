import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Monitor, ShoppingBag, TrendingUp, DollarSign, Lock, Unlock, XCircle } from "lucide-react";

function apiFetch(url: string, init?: RequestInit) {
  const token = localStorage.getItem("commerce_token");
  return fetch(url, { ...init, headers: { ...(init?.headers ?? {}), "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

interface Register {
  id: string; name: string; branchId: string; branchName: string | null;
  status: "open" | "closed" | "suspended";
  openingCash: number | null; expectedCash: number | null; closingCash: number | null; cashVariance: number | null;
  openedAt: string | null; closedAt: string | null;
}
interface Sale {
  id: string; registerId: string; registerName: string | null; customerName: string | null;
  total: number; paymentMethod: string; status: string; createdAt: string;
  items: { name: string; qty: number; price: number }[];
}
interface Branch { id: string; name: string; }
interface Stats { totalSales: number; totalRevenue: number; openRegisters: number; }

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
  suspended: "bg-yellow-100 text-yellow-800",
};
const SALE_STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  voided: "bg-red-100 text-red-800",
  refunded: "bg-orange-100 text-orange-800",
};

export default function PosPage() {
  const [registers, setRegisters] = useState<Register[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewRegister, setShowNewRegister] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showSale, setShowSale] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState<Register | null>(null);
  const [newRegForm, setNewRegForm] = useState({ branchId: "", name: "" });
  const [openCash, setOpenCash] = useState("");
  const [closeCash, setCloseCash] = useState("");
  const [saleForm, setSaleForm] = useState({ registerId: "", total: "", paymentMethod: "cash", notes: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setIsLoading(true);
    try {
      const [regs, sl, br, st] = await Promise.all([
        apiFetch("/api/pos/registers").then((r) => r.json()),
        apiFetch("/api/pos/sales?perPage=30").then((r) => r.json()),
        apiFetch("/api/branches?perPage=100").then((r) => r.json()),
        apiFetch("/api/pos/stats").then((r) => r.json()),
      ]);
      setRegisters(regs ?? []);
      setSales(sl.data ?? []);
      setBranches(br.data ?? []);
      setStats(st);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createRegister = async () => {
    if (!newRegForm.branchId || !newRegForm.name) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/pos/registers", { method: "POST", body: JSON.stringify(newRegForm) });
      if (!res.ok) throw new Error();
      toast({ title: "Register created" });
      setShowNewRegister(false);
      setNewRegForm({ branchId: "", name: "" });
      load();
    } catch { toast({ title: "Failed to create register", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const openRegister = async () => {
    if (!selectedRegister) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/pos/registers/${selectedRegister.id}/open`, { method: "POST", body: JSON.stringify({ openingCash: parseFloat(openCash) || 0 }) });
      if (!res.ok) throw new Error();
      toast({ title: "Register opened" });
      setShowOpen(false); setOpenCash("");
      load();
    } catch { toast({ title: "Failed to open register", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const closeRegister = async () => {
    if (!selectedRegister || !closeCash) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/pos/registers/${selectedRegister.id}/close`, { method: "POST", body: JSON.stringify({ closingCash: parseFloat(closeCash) }) });
      if (!res.ok) throw new Error();
      toast({ title: "Register closed" });
      setShowClose(false); setCloseCash("");
      load();
    } catch { toast({ title: "Failed to close register", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const recordSale = async () => {
    if (!saleForm.registerId || !saleForm.total) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/pos/sales", { method: "POST", body: JSON.stringify({ ...saleForm, subtotal: parseFloat(saleForm.total), total: parseFloat(saleForm.total), items: [] }) });
      if (!res.ok) throw new Error();
      toast({ title: "Sale recorded" });
      setShowSale(false);
      setSaleForm({ registerId: "", total: "", paymentMethod: "cash", notes: "" });
      load();
    } catch { toast({ title: "Failed to record sale", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const voidSale = async (id: string) => {
    if (!confirm("Void this sale?")) return;
    await apiFetch(`/api/pos/sales/${id}/void`, { method: "POST" });
    toast({ title: "Sale voided" });
    load();
  };

  const openRegs = registers.filter((r) => r.status === "open");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Point of Sale</h1>
          <p className="text-sm text-muted-foreground">Manage registers, record sales, and track cash</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSale(true)} disabled={openRegs.length === 0}><ShoppingBag className="mr-2 h-4 w-4" />Record Sale</Button>
          <Button onClick={() => setShowNewRegister(true)}><Plus className="mr-2 h-4 w-4" />New Register</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total POS Revenue", value: `Rs ${(stats?.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "bg-green-100 text-green-700" },
          { label: "Total Sales", value: (stats?.totalSales ?? 0).toLocaleString(), icon: ShoppingBag, color: "bg-blue-100 text-blue-700" },
          { label: "Open Registers", value: (stats?.openRegisters ?? 0).toString(), icon: Monitor, color: "bg-orange-100 text-orange-700" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${s.color}`}><s.icon className="h-5 w-5" /></div>
                <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="registers">
        <TabsList>
          <TabsTrigger value="registers">Registers ({registers.length})</TabsTrigger>
          <TabsTrigger value="sales">Recent Sales ({sales.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="registers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Register</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Opening Cash</TableHead>
                    <TableHead className="text-right">Expected Cash</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : registers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-14 text-center">
                        <Monitor className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground text-sm">No registers yet. Create one to get started.</p>
                      </TableCell>
                    </TableRow>
                  ) : registers.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.branchName ?? "—"}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[r.status]}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</Badge></TableCell>
                      <TableCell className="text-right text-sm">Rs {(r.openingCash ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm">Rs {(r.expectedCash ?? 0).toLocaleString()}</TableCell>
                      <TableCell className={`text-right text-sm font-medium ${(r.cashVariance ?? 0) < 0 ? "text-red-600" : (r.cashVariance ?? 0) > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                        {r.cashVariance != null ? `Rs ${r.cashVariance.toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {r.status === "closed" ? (
                            <Button size="sm" variant="outline" onClick={() => { setSelectedRegister(r); setShowOpen(true); }}>
                              <Unlock className="mr-1.5 h-3.5 w-3.5" />Open
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => { setSelectedRegister(r); setShowClose(true); }}>
                              <Lock className="mr-1.5 h-3.5 w-3.5" />Close
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale ID</TableHead>
                    <TableHead>Register</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-14 text-center">
                        <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground text-sm">No POS sales recorded yet.</p>
                      </TableCell>
                    </TableRow>
                  ) : sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.id.slice(-8).toUpperCase()}</TableCell>
                      <TableCell className="text-sm">{s.registerName ?? "—"}</TableCell>
                      <TableCell className="text-sm">{s.customerName ?? <span className="text-muted-foreground">Guest</span>}</TableCell>
                      <TableCell className="text-sm capitalize">{s.paymentMethod}</TableCell>
                      <TableCell className="text-right font-semibold">Rs {s.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge className={SALE_STATUS_COLORS[s.status] ?? ""}>{s.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {s.status === "completed" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => voidSale(s.id)}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Register Dialog */}
      <Dialog open={showNewRegister} onOpenChange={setShowNewRegister}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Register</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Branch *</Label>
              <Select value={newRegForm.branchId || "none"} onValueChange={(v) => setNewRegForm((f) => ({ ...f, branchId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select branch…" /></SelectTrigger>
                <SelectContent>
                  {branches.length === 0 ? <SelectItem value="none" disabled>No branches yet</SelectItem> : branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Register Name *</Label>
              <Input placeholder="e.g. Counter 1, Main POS" value={newRegForm.name} onChange={(e) => setNewRegForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRegister(false)}>Cancel</Button>
            <Button onClick={createRegister} disabled={saving || !newRegForm.branchId || !newRegForm.name}>{saving ? "Creating…" : "Create Register"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Register Dialog */}
      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Open Register — {selectedRegister?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Opening Cash (Rs)</Label>
              <Input type="number" min="0" placeholder="0.00" value={openCash} onChange={(e) => setOpenCash(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpen(false)}>Cancel</Button>
            <Button onClick={openRegister} disabled={saving}>{saving ? "Opening…" : "Open Register"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Register Dialog */}
      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Close Register — {selectedRegister?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {selectedRegister && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Expected cash:</span><span className="font-medium">Rs {(selectedRegister.expectedCash ?? 0).toLocaleString()}</span></div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Actual Closing Cash (Rs) *</Label>
              <Input type="number" min="0" placeholder="0.00" value={closeCash} onChange={(e) => setCloseCash(e.target.value)} />
            </div>
            {closeCash && selectedRegister?.expectedCash != null && (
              <div className={`rounded p-2 text-sm font-medium ${parseFloat(closeCash) - selectedRegister.expectedCash < 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                Variance: Rs {(parseFloat(closeCash) - selectedRegister.expectedCash).toFixed(2)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClose(false)}>Cancel</Button>
            <Button onClick={closeRegister} disabled={saving || !closeCash}>{saving ? "Closing…" : "Close Register"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Sale Dialog */}
      <Dialog open={showSale} onOpenChange={setShowSale}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record POS Sale</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Register *</Label>
              <Select value={saleForm.registerId || "none"} onValueChange={(v) => setSaleForm((f) => ({ ...f, registerId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select register…" /></SelectTrigger>
                <SelectContent>
                  {openRegs.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({r.branchName})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Total Amount (Rs) *</Label>
              <Input type="number" min="0" placeholder="0.00" value={saleForm.total} onChange={(e) => setSaleForm((f) => ({ ...f, total: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={saleForm.paymentMethod} onValueChange={(v) => setSaleForm((f) => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["cash", "card", "esewa", "khalti", "mixed"].map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input placeholder="Any notes…" value={saleForm.notes} onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSale(false)}>Cancel</Button>
            <Button onClick={recordSale} disabled={saving || !saleForm.registerId || !saleForm.total}>{saving ? "Recording…" : "Record Sale"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
