import { useLocation } from "wouter";
import { 
  useGetOrder, 
  useUpdateOrderStatus,
  getGetOrderQueryKey,
  OrderStatusUpdateStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Package, User, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const STATUS_FLOW: OrderStatusUpdateStatus[] = [
  "pending", "confirmed", "packed", "ready_to_ship", "shipped", "delivered"
];

export default function OrderDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useGetOrder(id, {
    query: { enabled: !!id } as any
  });

  const updateStatusMutation = useUpdateOrderStatus();

  const handleUpdateStatus = (newStatus: OrderStatusUpdateStatus) => {
    updateStatusMutation.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: (updatedOrder) => {
          toast({ title: "Order status updated", description: `Status changed to ${newStatus.replace('_', ' ')}` });
          // Update cache locally instead of invalidating
          queryClient.setQueryData(getGetOrderQueryKey(id), updatedOrder);
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Update failed", description: err.message });
        }
      }
    );
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  if (isLoading || !order) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(order.status as OrderStatusUpdateStatus);
  const nextStatus = currentIndex >= 0 && currentIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIndex + 1] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/orders")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              Order {order.orderNumber}
              <Badge variant={order.status === "delivered" ? "default" : order.status === "cancelled" ? "destructive" : "secondary"} className="capitalize">
                {order.status.replace('_', ' ')}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(order.createdAt), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {nextStatus && (
            <Button 
              onClick={() => handleUpdateStatus(nextStatus)}
              disabled={updateStatusMutation.isPending}
            >
              Mark as {nextStatus.replace('_', ' ')}
            </Button>
          )}
          {order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'refunded' && (
            <Button 
              variant="destructive" 
              onClick={() => handleUpdateStatus('cancelled')}
              disabled={updateStatusMutation.isPending}
            >
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-4">
                    <div className="h-16 w-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground opacity-50" />
                      )}
                    </div>
                    <div className="flex-1 flex justify-between">
                      <div>
                        <h4 className="font-medium text-sm">{item.productName}</h4>
                        {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                        <div className="mt-1 text-sm">
                          {formatCurrency(item.unitPrice)} x {item.quantity}
                        </div>
                      </div>
                      <div className="font-medium text-sm">
                        {formatCurrency(item.totalPrice)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <Separator />
            <CardFooter className="flex-col items-end gap-2 p-6 bg-muted/20">
              <div className="flex justify-between w-full sm:w-1/2 text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {(order.discount ?? 0) > 0 && (
                <div className="flex justify-between w-full sm:w-1/2 text-sm text-muted-foreground">
                  <span>Discount</span>
                  <span>-{formatCurrency(order.discount!)}</span>
                </div>
              )}
              <div className="flex justify-between w-full sm:w-1/2 text-sm text-muted-foreground">
                <span>Shipping</span>
                <span>{formatCurrency(order.shippingFee ?? 0)}</span>
              </div>
              <div className="flex justify-between w-full sm:w-1/2 text-sm text-muted-foreground">
                <span>Tax</span>
                <span>{formatCurrency(order.tax ?? 0)}</span>
              </div>
              <Separator className="my-2 sm:w-1/2" />
              <div className="flex justify-between w-full sm:w-1/2 font-semibold text-lg">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </CardFooter>
          </Card>

          {/* Timeline / Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Fulfillment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative border-l border-muted ml-3 space-y-6 pb-2">
                {STATUS_FLOW.map((status, index) => {
                  const isCurrent = order.status === status;
                  const isPast = STATUS_FLOW.indexOf(order.status as OrderStatusUpdateStatus) > index;
                  
                  if (order.status === 'cancelled' || order.status === 'returned' || order.status === 'refunded') {
                    if (isCurrent) {
                      return (
                        <div key={status} className="relative pl-6">
                          <div className="absolute -left-[17px] top-1 h-8 w-8 rounded-full bg-destructive flex items-center justify-center ring-4 ring-card">
                            <div className="h-2 w-2 rounded-full bg-white" />
                          </div>
                          <h4 className="font-medium text-destructive capitalize">{order.status.replace('_', ' ')}</h4>
                        </div>
                      );
                    }
                    return null;
                  }

                  return (
                    <div key={status} className={`relative pl-6 ${!isPast && !isCurrent ? 'opacity-40' : ''}`}>
                      <div className={`absolute -left-[11px] top-1 h-5 w-5 rounded-full ring-4 ring-card flex items-center justify-center ${
                        isPast ? 'bg-primary' : isCurrent ? 'bg-primary border-2 border-primary-foreground' : 'bg-muted border-2 border-muted-foreground'
                      }`}>
                        {isPast && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        {isCurrent && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                      </div>
                      <h4 className={`font-medium capitalize ${isCurrent ? 'text-primary' : ''}`}>
                        {status.replace('_', ' ')}
                      </h4>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium">{order.customerName || "Guest"}</p>
                {order.customerEmail && (
                  <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
                )}
                {order.customerPhone && (
                  <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" /> Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.shippingAddress ? (
                <p className="text-sm whitespace-pre-line leading-relaxed">{order.shippingAddress}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No shipping address provided</p>
              )}
            </CardContent>
          </Card>
          
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}