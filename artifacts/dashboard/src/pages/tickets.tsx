import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HeadphonesIcon, Plus, Search, MoreHorizontal, Trash2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useListCustomers } from "@workspace/api-client-react";

function apiFetch(url: string, init?: RequestInit) {
  const token = localStorage.getItem("commerce_token");
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  customerId: string | null;
  orderId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const BLANK_FORM = { subject: "", customerId: "", priority: "normal" };

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; perPage: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const { data: customersData } = useListCustomers({ perPage: 200 });
  const customers = customersData?.data ?? [];

  const load = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "20" });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiFetch(`/api/tickets?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTickets(json.data ?? []);
      setMeta(json.meta ?? null);
    } catch {
      // not logged in yet
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, statusFilter, page]);

  const handleCreate = async () => {
    if (!form.subject.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.subject.trim(),
          customerId: form.customerId || undefined,
          priority: form.priority,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Ticket created" });
      setShowCreate(false);
      setForm({ ...BLANK_FORM });
      load();
    } catch {
      toast({ title: "Failed to create ticket", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this ticket and all its messages?")) return;
    const res = await apiFetch(`/api/tickets/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      toast({ title: "Ticket deleted" });
      load();
    } else {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const totalPages = meta ? Math.ceil(meta.total / meta.perPage) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">Track and resolve customer support requests</p>
        </div>
        <Button onClick={() => { setForm({ ...BLANK_FORM }); setShowCreate(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Ticket
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by subject…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "open", "in_progress", "resolved", "closed"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              className="capitalize"
              onClick={() => { setStatusFilter(s); setPage(1); }}
            >
              {s.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center">
                    <HeadphonesIcon className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No support tickets yet.</p>
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/tickets/${t.id}`}>
                        <span className="font-medium text-sm hover:underline cursor-pointer text-primary">{t.subject}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {t.customerName ? (
                        <div>
                          <p className="text-sm font-medium">{t.customerName}</p>
                          {t.customerEmail && <p className="text-xs text-muted-foreground">{t.customerEmail}</p>}
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={`capitalize text-xs ${PRIORITY_COLORS[t.priority] ?? ""}`}>
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`capitalize text-xs ${STATUS_COLORS[t.status] ?? ""}`}>
                        {t.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(t.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/tickets/${t.id}`}>
                            <DropdownMenuItem>
                              <ExternalLink className="mr-2 h-4 w-4" /> View
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(t.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta?.total} tickets</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) setShowCreate(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                placeholder="Describe the issue…"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Customer (optional)</Label>
              <Select value={form.customerId || "_none"} onValueChange={v => setForm(f => ({ ...f, customerId: v === "_none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No customer</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.subject.trim()}>
              {saving ? "Creating…" : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
