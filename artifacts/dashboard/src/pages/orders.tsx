import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useListOrders, 
  ListOrdersStatus
} from "@workspace/api-client-react";
import { Search, Eye, Filter } from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function OrdersList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ListOrdersStatus | "all">("all");
  const [, setLocation] = useLocation();

  const { data: ordersData, isLoading } = useListOrders({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
  });

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">Manage and fulfill your customer orders.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>View all orders from your store.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order number or customer..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="packed">Packed</SelectItem>
                  <SelectItem value="ready_to_ship">Ready to Ship</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                    </TableRow>
                  ))
                ) : ordersData?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  ordersData?.data.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link href={`/orders/${order.id}`}>
                          <span className="hover:underline cursor-pointer">{order.orderNumber}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(order.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{order.customerName || "Guest"}</span>
                          <span className="text-xs text-muted-foreground">{order.customerEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            order.status === "delivered" ? "default" : 
                            order.status === "cancelled" ? "destructive" : 
                            "secondary"
                          }
                          className="capitalize"
                        >
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.itemCount} items</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(order.total)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setLocation(`/orders/${order.id}`)}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}