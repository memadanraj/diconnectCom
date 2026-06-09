import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useGetReturn, useUpdateReturnStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RotateCcw, User, Package, DollarSign } from "lucide-react";
import { format } from "date-fns";

type ReturnStatus = "requested" | "approved" | "rejected" | "received" | "refunded" | "closed";

const STATUS_FLOW: ReturnStatus[] = ["requested", "approved", "received", "refunded", "closed"];

const STATUS_COLORS: Record<ReturnStatus, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  received: "bg-purple-100 text-purple-800",
  refunded: "bg-emerald-100 text-emerald-800",
  closed: "bg-gray-100 text-gray-700",
};

const REASON_LABELS: Record<string, string> = {
  defective: "Defective product",
  wrong_item: "Wrong item received",
  not_as_described: "Not as described",
  changed_mind: "Changed mind",
  duplicate_order: "Duplicate order",
  other: "Other",
};

const CONDITION_LABELS: Record<string, string> = {
  unopened: "Unopened",
  opened: "Opened",
  damaged: "Damaged",
};

export default function ReturnDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: ret, isLoading } = useGetReturn(id, { query: { enabled: !!id } } as any);
  const updateMutation = useUpdateReturnStatus();

  const [newStatus, setNewStatus] = useState<ReturnStatus | "">("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<"original_payment" | "store_credit" | "bank_transfer" | "">("");

  function handleUpdateStatus() {
    if (!newStatus) return;
    updateMutation.mutate(
      {
        id,
        data: {
          status: newStatus,
          refundAmount: refundAmount ? parseFloat(refundAmount) : undefined,
          refundMethod: (refundMethod || undefined) as any,
        },
      },
      {
        onSuccess: (updated) => {
          toast({ title: "Status updated" });
          qc.setQueryData(["/api/returns", id], updated);
          setNewStatus("");
          setRefundAmount("");
          setRefundMethod("");
        },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (!ret) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <RotateCcw className="h-10 w-10 mb-4 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold mb-2">Return not found</h2>
        <Button variant="outline" onClick={() => setLocation("/returns")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Returns
        </Button>
      </div>
    );
  }

  const currentStatus = ret.status as ReturnStatus;
  const isTerminal = currentStatus === "rejected" || currentStatus === "closed";
  const nextStatuses = STATUS_FLOW.filter(s => STATUS_FLOW.indexOf(s) > STATUS_FLOW.indexOf(currentStatus));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/returns")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Returns
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">{ret.returnNumber}</h1>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[currentStatus]}`}>
            {currentStatus.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Return Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Return Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reason</span>
              <span className="font-medium">{REASON_LABELS[ret.reason] ?? ret.reason}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order</span>
              <Link href={`/orders/${ret.orderId}`}>
                <span className="font-medium text-primary hover:underline cursor-pointer">
                  {ret.orderNumber ?? ret.orderId.slice(0, 8)}
                </span>
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(ret.createdAt), "MMM d, yyyy")}</span>
            </div>
            {ret.updatedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{format(new Date(ret.updatedAt), "MMM d, yyyy")}</span>
              </div>
            )}
            {ret.notes && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground text-xs mb-1">Notes</p>
                <p className="text-sm">{ret.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" /> Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{ret.customerName || "—"}</p>
            {ret.customerEmail && <p className="text-muted-foreground">{ret.customerEmail}</p>}
          </CardContent>
        </Card>

        {/* Refund */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Refund
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="text-xl font-bold">${ret.refundAmount.toFixed(2)}</span>
            </div>
            {ret.refundMethod && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="capitalize">{ret.refundMethod.replace("_", " ")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" /> Return Items ({ret.items?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {(ret.items ?? []).map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{item.productName}</p>
                  <div className="flex gap-3 mt-1">
                    {item.sku && <span className="text-xs text-muted-foreground font-mono">SKU: {item.sku}</span>}
                    {item.condition && (
                      <Badge variant="outline" className="text-xs">{CONDITION_LABELS[item.condition] ?? item.condition}</Badge>
                    )}
                    {item.reason && <span className="text-xs text-muted-foreground">{item.reason}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">×{item.quantity}</p>
                  <p className="text-xs text-muted-foreground">${item.unitPrice.toFixed(2)} each</p>
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="flex justify-between font-semibold text-sm">
            <span>Total Refund</span>
            <span>${ret.refundAmount.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Status Update */}
      {!isTerminal && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Update Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <Label>New Status</Label>
                <Select value={newStatus} onValueChange={(v: any) => setNewStatus(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status…" />
                  </SelectTrigger>
                  <SelectContent>
                    {nextStatuses.map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                    ))}
                    <SelectItem value="rejected" className="text-destructive">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(newStatus === "refunded" || newStatus === "approved") && (
                <>
                  <div className="space-y-1.5">
                    <Label>Refund Amount ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder={String(ret.refundAmount)}
                      value={refundAmount}
                      onChange={e => setRefundAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Refund Method</Label>
                    <Select value={refundMethod} onValueChange={(v: any) => setRefundMethod(v)}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="original_payment">Original Payment</SelectItem>
                        <SelectItem value="store_credit">Store Credit</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <Button disabled={!newStatus || updateMutation.isPending} onClick={handleUpdateStatus} className="sm:self-end">
                {updateMutation.isPending ? "Updating…" : "Update Status"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
