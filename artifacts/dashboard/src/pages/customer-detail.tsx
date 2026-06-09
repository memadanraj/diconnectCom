import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetCustomer, useUpdateCustomer, useCreateCustomerAddress } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Phone, MapPin, Plus, ShoppingBag, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function apiFetch(url: string, init?: RequestInit) {
  const token = localStorage.getItem("commerce_token");
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  shipped: "bg-indigo-100 text-indigo-800",
  returned: "bg-orange-100 text-orange-800",
};

function formatCurrency(v: number) {
  return `NPR ${v.toLocaleString("en-NP", { minimumFractionDigits: 2 })}`;
}

export default function CustomerDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { data: customer, isLoading } = useGetCustomer(id);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", notes: "" });
  const [newTag, setNewTag] = useState("");
  const [addressForm, setAddressForm] = useState({ label: "", firstName: "", lastName: "", line1: "", city: "", country: "", postalCode: "", phone: "", isDefault: false });
  const { toast } = useToast();
  const qc = useQueryClient();

  const updateMutation = useUpdateCustomer({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/customers/${id}`] }); setEditMode(false); toast({ title: "Customer updated" }); },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    },
  });

  const handleAddTag = async () => {
    const tag = newTag.trim().toLowerCase();
    if (!tag || !customer) return;
    const existingTags: string[] = (customer as any).tags ?? [];
    if (existingTags.includes(tag)) { setNewTag(""); return; }
    const newTags = [...existingTags, tag];
    setNewTag("");
    try {
      await apiFetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
      qc.invalidateQueries({ queryKey: [`/api/customers/${id}`] });
    } catch {
      toast({ title: "Failed to add tag", variant: "destructive" });
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!customer) return;
    const existingTags: string[] = (customer as any).tags ?? [];
    const newTags = existingTags.filter(t => t !== tag);
    try {
      await apiFetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
      qc.invalidateQueries({ queryKey: [`/api/customers/${id}`] });
    } catch {
      toast({ title: "Failed to remove tag", variant: "destructive" });
    }
  };
  const addAddressMutation = useCreateCustomerAddress({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/customers/${id}`] }); setShowAddAddress(false); toast({ title: "Address added" }); },
      onError: () => toast({ title: "Failed to add address", variant: "destructive" }),
    },
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-48" /><div className="h-40 bg-muted rounded" /></div>;
  if (!customer) return <div className="text-center py-16 text-muted-foreground">Customer not found</div>;

  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/customers")} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{fullName}</h1>
          <p className="text-muted-foreground text-sm">{customer.email}</p>
        </div>
        <div className="ml-auto">
          {editMode ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
              <Button disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ id, data: { firstName: form.firstName || undefined, lastName: form.lastName || undefined, phone: form.phone || undefined, notes: form.notes || undefined } })}>
                Save
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => { setForm({ firstName: customer.firstName ?? "", lastName: customer.lastName ?? "", phone: customer.phone ?? "", notes: customer.notes ?? "" }); setEditMode(true); }}>
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Profile + Stats */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {editMode ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">First Name</Label><Input className="mt-1 h-8 text-sm" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
                    <div><Label className="text-xs">Last Name</Label><Input className="mt-1 h-8 text-sm" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
                  </div>
                  <div><Label className="text-xs">Phone</Label><Input className="mt-1 h-8 text-sm" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  <div><Label className="text-xs">Notes</Label><Input className="mt-1 h-8 text-sm" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{customer.email}</div>
                  {customer.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{customer.phone}</div>}
                  {customer.notes && <p className="text-xs text-muted-foreground pt-2 border-t">{customer.notes}</p>}
                </div>
              )}
              {/* Tags — always visible */}
              <div className="pt-3 border-t space-y-2">
                <Label className="text-xs">Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {((customer as any).tags ?? []).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1 text-xs">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="ml-0.5 hover:text-destructive rounded-full">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Input
                    className="h-7 text-xs flex-1"
                    placeholder="Add tag (e.g. vip)"
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                  />
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleAddTag} disabled={!newTag.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Orders</span>
                <span className="font-semibold">{customer.totalOrders}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Spent</span>
                <span className="font-semibold">{formatCurrency(customer.totalSpent)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer Since</span>
                <span className="font-semibold">{new Date(customer.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Addresses + Orders */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Addresses</CardTitle>
              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setShowAddAddress(true)}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {customer.addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No addresses saved</p>
              ) : (
                <div className="space-y-3">
                  {customer.addresses.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 rounded-md border p-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{[a.firstName, a.lastName].filter(Boolean).join(" ") || "—"}</span>
                          {a.label && <Badge variant="outline" className="text-xs h-4">{a.label}</Badge>}
                          {a.isDefault && <Badge className="text-xs h-4">Default</Badge>}
                        </div>
                        <p className="text-muted-foreground">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
                        <p className="text-muted-foreground">{[a.city, a.state, a.country].filter(Boolean).join(", ")} {a.postalCode}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Recent Orders</CardTitle></CardHeader>
            <CardContent>
              {customer.recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No orders yet</p>
              ) : (
                <div className="space-y-2">
                  {customer.recentOrders.map((o) => (
                    <Link key={o.id} href={`/orders/${o.id}`}>
                      <div className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 cursor-pointer">
                        <div>
                          <p className="font-mono text-sm font-medium">{o.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-700"}`}>{o.status}</span>
                          <span className="font-mono text-sm">{formatCurrency(o.total)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Address Dialog */}
      <Dialog open={showAddAddress} onOpenChange={setShowAddAddress}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Address</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">First Name</Label><Input className="mt-1" value={addressForm.firstName} onChange={e => setAddressForm(f => ({ ...f, firstName: e.target.value }))} /></div>
              <div><Label className="text-xs">Last Name</Label><Input className="mt-1" value={addressForm.lastName} onChange={e => setAddressForm(f => ({ ...f, lastName: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Address Line 1 *</Label><Input className="mt-1" value={addressForm.line1} onChange={e => setAddressForm(f => ({ ...f, line1: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">City</Label><Input className="mt-1" value={addressForm.city} onChange={e => setAddressForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label className="text-xs">Country</Label><Input className="mt-1" value={addressForm.country} onChange={e => setAddressForm(f => ({ ...f, country: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Postal Code</Label><Input className="mt-1" value={addressForm.postalCode} onChange={e => setAddressForm(f => ({ ...f, postalCode: e.target.value }))} /></div>
              <div><Label className="text-xs">Label (e.g. Home)</Label><Input className="mt-1" value={addressForm.label} onChange={e => setAddressForm(f => ({ ...f, label: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAddress(false)}>Cancel</Button>
            <Button disabled={!addressForm.line1 || addAddressMutation.isPending}
              onClick={() => addAddressMutation.mutate({ id, data: { line1: addressForm.line1, firstName: addressForm.firstName || undefined, lastName: addressForm.lastName || undefined, city: addressForm.city || undefined, country: addressForm.country || undefined, postalCode: addressForm.postalCode || undefined, label: addressForm.label || undefined } })}>
              {addAddressMutation.isPending ? "Adding…" : "Add Address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
