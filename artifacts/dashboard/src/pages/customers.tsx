import { useState } from "react";
import { Link } from "wouter";
import { useListCustomers, useCreateCustomer, useDeleteCustomer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Search, ExternalLink, Trash2, Mail, Phone } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function formatCurrency(v: number) {
  return `NPR ${v.toLocaleString("en-NP", { minimumFractionDigits: 2 })}`;
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", phone: "", notes: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useListCustomers({ search: search || undefined, page, perPage: 20 });
  const createMutation = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/customers"] });
        setShowCreate(false);
        setForm({ email: "", firstName: "", lastName: "", phone: "", notes: "" });
        toast({ title: "Customer created" });
      },
      onError: () => toast({ title: "Failed to create customer", variant: "destructive" }),
    },
  });
  const deleteMutation = useDeleteCustomer({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/customers"] });
        toast({ title: "Customer deleted" });
      },
      onError: () => toast({ title: "Failed to delete customer", variant: "destructive" }),
    },
  });

  const customers = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.perPage) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">Manage customer profiles and contact information</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, email, phone…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
              <TableHead className="text-right">Joined</TableHead>
              <TableHead className="w-20" />
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
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No customers yet</p>
                </TableCell>
              </TableRow>
            ) : customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      {(c.firstName?.[0] ?? c.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {c.email && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />{c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />{c.phone}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{c.totalOrders}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{formatCurrency(c.totalSpent)}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/customers/${c.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: c.id })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta?.total} customers</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={!form.email || createMutation.isPending}
              onClick={() => createMutation.mutate({ data: { email: form.email, firstName: form.firstName || undefined, lastName: form.lastName || undefined, phone: form.phone || undefined, notes: form.notes || undefined } })}>
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
