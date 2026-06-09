import { useState } from "react";
import {
  useListDiscounts,
  useCreateDiscount,
  useUpdateDiscount,
  useDeleteDiscount,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Tag, Copy, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

type DiscountType = "percentage" | "fixed" | "free_shipping";

const TYPE_LABELS: Record<DiscountType, string> = {
  percentage: "% Off",
  fixed: "Fixed $",
  free_shipping: "Free Shipping",
};

const defaultForm = {
  code: "",
  description: "",
  type: "percentage" as DiscountType,
  value: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  usageLimit: "",
  isActive: true,
  startsAt: "",
  expiresAt: "",
};

export default function DiscountsPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useListDiscounts({ search: search || undefined, page: 1, perPage: 50 });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/discounts"] });

  const createMutation = useCreateDiscount({ mutation: { onSuccess: () => { invalidate(); closeForm(); toast({ title: "Discount created" }); }, onError: (e: any) => toast({ title: e?.message || "Failed", variant: "destructive" }) } });
  const updateMutation = useUpdateDiscount({ mutation: { onSuccess: () => { invalidate(); closeForm(); toast({ title: "Discount updated" }); }, onError: (e: any) => toast({ title: e?.message || "Failed", variant: "destructive" }) } });
  const deleteMutation = useDeleteDiscount({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Discount deleted" }); }, onError: () => toast({ title: "Failed to delete", variant: "destructive" }) } });

  const discounts = data?.data ?? [];

  function openCreate() {
    setEditId(null);
    setForm(defaultForm);
    setShowForm(true);
  }

  function openEdit(d: (typeof discounts)[0]) {
    setEditId(d.id);
    setForm({
      code: d.code,
      description: d.description ?? "",
      type: d.type as DiscountType,
      value: String(d.value),
      minOrderAmount: d.minOrderAmount != null ? String(d.minOrderAmount) : "",
      maxDiscountAmount: d.maxDiscountAmount != null ? String(d.maxDiscountAmount) : "",
      usageLimit: d.usageLimit != null ? String(d.usageLimit) : "",
      isActive: d.isActive,
      startsAt: d.startsAt ? format(new Date(d.startsAt), "yyyy-MM-dd") : "",
      expiresAt: d.expiresAt ? format(new Date(d.expiresAt), "yyyy-MM-dd") : "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(defaultForm);
  }

  function buildPayload() {
    return {
      code: form.code,
      description: form.description || undefined,
      type: form.type,
      value: parseFloat(form.value),
      minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : undefined,
      maxDiscountAmount: form.maxDiscountAmount ? parseFloat(form.maxDiscountAmount) : undefined,
      usageLimit: form.usageLimit ? parseInt(form.usageLimit) : undefined,
      isActive: form.isActive,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
    };
  }

  function handleSubmit() {
    if (!form.code || !form.value) return;
    const payload = buildPayload();
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload as any });
    } else {
      createMutation.mutate({ data: payload as any });
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: code });
  }

  const isExpired = (d: (typeof discounts)[0]) => d.expiresAt ? new Date(d.expiresAt) < new Date() : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Discounts</h1>
          <p className="text-muted-foreground text-sm">Manage coupon codes and promotions</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Create Discount
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by code…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : discounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                  <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No discounts yet</p>
                </TableCell>
              </TableRow>
            ) : discounts.map((d) => (
              <TableRow key={d.id} className={isExpired(d) ? "opacity-60" : ""}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold tracking-wide">{d.code}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(d.code)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  {d.description && <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{TYPE_LABELS[d.type as DiscountType]}</Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {d.type === "percentage" ? `${d.value}%` : d.type === "fixed" ? `$${d.value}` : "Free"}
                  {d.minOrderAmount && (
                    <p className="text-xs text-muted-foreground">Min ${d.minOrderAmount}</p>
                  )}
                </TableCell>
                <TableCell>
                  <span className={d.usageLimit && d.usageCount >= d.usageLimit ? "text-destructive font-medium" : ""}>
                    {d.usageCount}{d.usageLimit ? ` / ${d.usageLimit}` : ""}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d.expiresAt ? (
                    <span className={isExpired(d) ? "text-destructive" : ""}>
                      {format(new Date(d.expiresAt), "MMM d, yyyy")}
                      {isExpired(d) && " (expired)"}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {d.isActive && !isExpired(d) ? (
                    <span className="flex items-center gap-1 text-sm text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <XCircle className="h-3.5 w-3.5" /> Inactive
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(d)}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => {
                        if (confirm(`Delete discount "${d.code}"?`)) deleteMutation.mutate({ id: d.id });
                      }}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Discount" : "Create Discount"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Code *</Label>
                <Input
                  className="font-mono uppercase"
                  placeholder="SAVE20"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Description</Label>
                <Input placeholder="20% off all orders" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as DiscountType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                    <SelectItem value="free_shipping">Free Shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Value {form.type === "percentage" ? "(%)" : form.type === "fixed" ? "($)" : "(N/A)"}</Label>
                <Input
                  type="number"
                  min="0"
                  disabled={form.type === "free_shipping"}
                  placeholder={form.type === "percentage" ? "20" : "10"}
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Min Order Amount ($)</Label>
                <Input type="number" min="0" placeholder="Optional" value={form.minOrderAmount} onChange={e => setForm(f => ({ ...f, minOrderAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Usage Limit</Label>
                <Input type="number" min="1" placeholder="Unlimited" value={form.usageLimit} onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
              </div>
              <div className="col-span-2 flex items-center gap-3 pt-1">
                <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))} />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              disabled={!form.code || (!form.value && form.type !== "free_shipping") || createMutation.isPending || updateMutation.isPending}
              onClick={handleSubmit}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving…" : editId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
