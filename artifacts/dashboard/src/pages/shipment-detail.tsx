import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetShipment, useUpdateShipment, useAddShipmentEvent } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Truck, MapPin, Plus, CheckCircle2, Circle, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  picked_up: { label: "Picked Up", color: "bg-blue-100 text-blue-800", icon: Circle },
  in_transit: { label: "In Transit", color: "bg-indigo-100 text-indigo-800", icon: Truck },
  out_for_delivery: { label: "Out for Delivery", color: "bg-purple-100 text-purple-800", icon: Truck },
  delivered: { label: "Delivered", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-red-100 text-red-800", icon: Circle },
  returned: { label: "Returned", color: "bg-orange-100 text-orange-800", icon: Circle },
};

export default function ShipmentDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { data: shipment, isLoading } = useGetShipment(id);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [eventForm, setEventForm] = useState({ status: "", description: "", location: "" });
  const [editForm, setEditForm] = useState({ trackingNumber: "", carrier: "", estimatedDelivery: "", notes: "" });

  const updateMutation = useUpdateShipment({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/shipments/${id}`] }); setShowEdit(false); toast({ title: "Shipment updated" }); },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    },
  });

  const addEventMutation = useAddShipmentEvent({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/shipments/${id}`] }); setShowAddEvent(false); setEventForm({ status: "", description: "", location: "" }); toast({ title: "Event added" }); },
      onError: () => toast({ title: "Failed to add event", variant: "destructive" }),
    },
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-48" /><div className="h-40 bg-muted rounded" /></div>;
  if (!shipment) return <div className="text-center py-16 text-muted-foreground">Shipment not found</div>;

  const statusCfg = STATUS_CONFIG[shipment.status] ?? { label: shipment.status, color: "bg-gray-100 text-gray-700", icon: Circle };
  const StatusIcon = statusCfg.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/shipments")} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Shipment</h1>
            {shipment.trackingNumber && (
              <span className="font-mono text-lg text-muted-foreground">{shipment.trackingNumber}</span>
            )}
          </div>
          <Link href={`/orders/${shipment.orderId}`}>
            <span className="text-sm text-primary hover:underline cursor-pointer">
              Order {shipment.orderNumber ?? shipment.orderId.slice(0, 8)}
            </span>
          </Link>
          {shipment.customerName && <span className="text-sm text-muted-foreground"> · {shipment.customerName}</span>}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => { setEditForm({ trackingNumber: shipment.trackingNumber ?? "", carrier: shipment.carrier ?? "", estimatedDelivery: shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toISOString().slice(0, 10) : "", notes: shipment.notes ?? "" }); setShowEdit(true); }}>
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Shipment Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
              </div>
              {shipment.carrier && (
                <div className="flex justify-between"><span className="text-muted-foreground">Carrier</span><span className="font-medium">{shipment.carrier}</span></div>
              )}
              {shipment.trackingNumber && (
                <div className="flex justify-between"><span className="text-muted-foreground">Tracking #</span><span className="font-mono">{shipment.trackingNumber}</span></div>
              )}
              {shipment.estimatedDelivery && (
                <div className="flex justify-between"><span className="text-muted-foreground">Est. Delivery</span><span>{new Date(shipment.estimatedDelivery).toLocaleDateString()}</span></div>
              )}
              {shipment.deliveredAt && (
                <div className="flex justify-between"><span className="text-muted-foreground">Delivered</span><span className="text-green-600 font-medium">{new Date(shipment.deliveredAt).toLocaleDateString()}</span></div>
              )}
              {shipment.notes && <p className="text-muted-foreground border-t pt-2">{shipment.notes}</p>}
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground">Update Status</Label>
                <Select value={shipment.status} onValueChange={v => updateMutation.mutate({ id, data: { status: v as "pending" } })}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Tracking Timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Tracking Timeline
              </CardTitle>
              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setShowAddEvent(true)}>
                <Plus className="h-3 w-3" /> Add Event
              </Button>
            </CardHeader>
            <CardContent>
              {(shipment as any).events?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No tracking events yet</p>
              ) : (
                <div className="relative space-y-0">
                  {((shipment as any).events ?? []).map((event: any, idx: number) => {
                    const cfg = STATUS_CONFIG[event.status] ?? { label: event.status, color: "bg-gray-100 text-gray-700", icon: Circle };
                    const EventIcon = cfg.icon;
                    const isLast = idx === ((shipment as any).events.length - 1);
                    return (
                      <div key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${idx === 0 ? "bg-primary" : "bg-muted"}`}>
                            <EventIcon className="h-4 w-4 text-primary-foreground" />
                          </div>
                          {!isLast && <div className="w-px flex-1 bg-border my-1" />}
                        </div>
                        <div className="pb-6 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                              {event.description && <p className="text-sm mt-1">{event.description}</p>}
                              {event.location && (
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />{event.location}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(event.occurredAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Tracking Event</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Status *</Label>
              <Select value={eventForm.status} onValueChange={v => setEventForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input className="mt-1" placeholder="e.g. Package arrived at sorting facility" value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Location</Label><Input className="mt-1" placeholder="e.g. Kathmandu Hub" value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEvent(false)}>Cancel</Button>
            <Button disabled={!eventForm.status || addEventMutation.isPending}
              onClick={() => addEventMutation.mutate({ id, data: { status: eventForm.status, description: eventForm.description || undefined, location: eventForm.location || undefined } })}>
              {addEventMutation.isPending ? "Adding…" : "Add Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Shipment</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Carrier</Label><Input className="mt-1" value={editForm.carrier} onChange={e => setEditForm(f => ({ ...f, carrier: e.target.value }))} /></div>
              <div><Label>Tracking Number</Label><Input className="mt-1" value={editForm.trackingNumber} onChange={e => setEditForm(f => ({ ...f, trackingNumber: e.target.value }))} /></div>
            </div>
            <div><Label>Estimated Delivery</Label><Input type="date" className="mt-1" value={editForm.estimatedDelivery} onChange={e => setEditForm(f => ({ ...f, estimatedDelivery: e.target.value }))} /></div>
            <div><Label>Notes</Label><Input className="mt-1" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id, data: { carrier: editForm.carrier || undefined, trackingNumber: editForm.trackingNumber || undefined, estimatedDelivery: editForm.estimatedDelivery || undefined, notes: editForm.notes || undefined } })}>
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
