import { useState } from "react";
import { Link } from "wouter";
import { useListReturns } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, ExternalLink, RotateCcw } from "lucide-react";
import { format } from "date-fns";

type ReturnStatus = "requested" | "approved" | "rejected" | "received" | "refunded" | "closed";

const STATUS_COLORS: Record<ReturnStatus, string> = {
  requested: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  received: "bg-purple-100 text-purple-800 border-purple-200",
  refunded: "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed: "bg-gray-100 text-gray-700 border-gray-200",
};

const REASON_LABELS: Record<string, string> = {
  defective: "Defective",
  wrong_item: "Wrong Item",
  not_as_described: "Not as Described",
  changed_mind: "Changed Mind",
  duplicate_order: "Duplicate Order",
  other: "Other",
};

function StatusBadge({ status }: { status: ReturnStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function ReturnsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReturnStatus | "all">("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListReturns({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    page,
    perPage: 20,
  });

  const returns = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.perPage) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Returns</h1>
          <p className="text-muted-foreground text-sm">Manage return requests and refunds</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by RET#, order, customer…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v: any) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return #</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Refund</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : returns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                  <RotateCcw className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No returns yet</p>
                </TableCell>
              </TableRow>
            ) : returns.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono font-medium text-sm">{r.returnNumber}</TableCell>
                <TableCell className="text-sm">
                  {r.orderNumber ? (
                    <Link href={`/orders/${r.orderId}`}>
                      <span className="hover:underline cursor-pointer text-primary">{r.orderNumber}</span>
                    </Link>
                  ) : r.orderId.slice(0, 8)}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{r.customerName || "—"}</p>
                    {r.customerEmail && <p className="text-xs text-muted-foreground">{r.customerEmail}</p>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{REASON_LABELS[r.reason] ?? r.reason}</Badge>
                </TableCell>
                <TableCell className="text-sm">{r.itemCount ?? 0} item{(r.itemCount ?? 0) !== 1 ? "s" : ""}</TableCell>
                <TableCell className="text-right font-medium text-sm">
                  ${r.refundAmount.toFixed(2)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status as ReturnStatus} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(r.createdAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <Link href={`/returns/${r.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
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
          <span>{meta?.total} returns</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
