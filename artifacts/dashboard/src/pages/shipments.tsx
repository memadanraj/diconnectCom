import { useState } from "react";
import { Link } from "wouter";
import {
  useListShipments, useCreateShipment, useUpdateShipment,
} from "@workspace/api-client-react";
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
import { useToast } from "@/hooks/use-toast";
import { Truck, Plus, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useListOrders } from "@workspace/api-client-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  picked_up: { label: "Picked Up", color: "bg-blue-100 text-blue-800" },
  in_transit: { label: "In Transit", color: "bg-indigo-100 text-indigo-800" },
  out_for_delivery: { label: "Out for Delivery", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Delivered", color: "bg-green-100 text-green-800" },
  failed: { label: "Failed", color: "bg-red-100 text-red-800" },
  returned: { label: "Returned", color: "bg-orange-100 text-orange-800" },
};

export default function ShipmentsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ orderId: "", trackingNumber: "", carrier: "", status: "pending", estimatedDelivery: "", notes: "" });

  const { data, isLoading } = useListShipments({
    status: filterStatus !== "all" ? (filterStatus as "pending") : undefined,
    page, perPage: 20,
  });
  const { data: ordersData } = useListOrders({ perPage: 100 });
  const orders = ordersData?.data ?? [];

  const createMutation = useCreateShipment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/shipments"] });
        setShowCreate(false);
        setForm({ orderId: "", trackingNumber: "", carrier: "", status: "pending", estimatedDelivery: "", notes: "" });
        toast({ title: "Shipment created" });
      },
      onError: () => toast({ title: "Failed to create shipment", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateShipment({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/shipments"] }); toast({ title: "Status updated" }); },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    },
  });

  const shipments = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.perPage) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shipments</h1>
          <p className="text-muted-foreground text-sm">Track deliveries and manage carrier information</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Shipment
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        {[["all", "All"], ...Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])].map(([key, label]) => (
          <Button key={key} variant={filterStatus === key ? "default" : "outline"} size="sm"
            onClick={() => { setFilterStatus(key); setPage(1); }}>
            {label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Est. Delivery</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>)}</TableRow>
              ))
            ) : shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                  <Truck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No shipments yet</p>
                </TableCell>
              </TableRow>
            ) : shipments.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link href={`/orders/${s.orderId}`}>
                    <span className="font-mono text-sm font-medium text-primary hover:underline cursor-pointer">
                      {s.orderNumber ?? s.orderId.slice(0, 8)}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{(s as any).customerName ?? "—"}</TableCell>
                <TableCell>
                  {s.trackingNumber ? (
                    <span className="font-mono text-sm">{s.trackingNumber}</span>
                  ) : <span className="text-muted-foreground text-sm">—</span>}
                </TableCell>
                <TableCell className="text-sm">{s.carrier ?? "—"}</TableCell>
                <TableCell>
                  <Select value={s.status} onValueChange={(val) => updateMutation.mutate({ id: s.id, data: { status: val as "pending" } })}>
                    <SelectTrigger className="h-7 w-36 border-0 bg-transparent p-0 focus:ring-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[s.status]?.color ?? "bg-gray-100 text-gray-700"}`}>
                        {STATUS_CONFIG[s.status]?.label ?? s.status}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.estimatedDelivery ? new Date(s.estimatedDelivery).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(s.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Link href={`/shipments/${s.id}`}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta?.total} shipments</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Shipment</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Order *</Label>
              <Select value={form.orderId} onValueChange={v => setForm(f => ({ ...f, orderId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select order" /></SelectTrigger>
                <SelectContent>
                  {orders.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.orderNumber} — {o.customerName ?? o.customerEmail ?? "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Carrier</Label><Input className="mt-1" placeholder="e.g. DHL, FedEx" value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} /></div>
              <div><Label>Tracking Number</Label><Input className="mt-1" value={form.trackingNumber} onChange={e => setForm(f => ({ ...f, trackingNumber: e.target.value }))} /></div>
            </div>
            <div><Label>Estimated Delivery</Label><Input type="date" className="mt-1" value={form.estimatedDelivery} onChange={e => setForm(f => ({ ...f, estimatedDelivery: e.target.value }))} /></div>
            <div><Label>Notes</Label><Input className="mt-1" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={!form.orderId || createMutation.isPending}
              onClick={() => createMutation.mutate({ data: { orderId: form.orderId, carrier: form.carrier || undefined, trackingNumber: form.trackingNumber || undefined, status: form.status as "pending", estimatedDelivery: form.estimatedDelivery || undefined, notes: form.notes || undefined } })}>
              {createMutation.isPending ? "Creating…" : "Create Shipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
