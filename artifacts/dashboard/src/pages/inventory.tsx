import { useState } from "react";
import {
  useListWarehouses, useCreateWarehouse, useListInventory, useCreateInventory,
  useUpdateInventory, useCreateInventoryTransaction,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Warehouse, Plus, AlertTriangle, ArrowUpDown, Package } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useListProducts } from "@workspace/api-client-react";

export default function InventoryPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [invPage, setInvPage] = useState(1);

  const [showCreateWarehouse, setShowCreateWarehouse] = useState(false);
  const [whForm, setWhForm] = useState({ name: "", address: "", city: "", country: "", isDefault: false });

  const [showAddStock, setShowAddStock] = useState(false);
  const [stockForm, setStockForm] = useState({ productId: "", warehouseId: "", available: 0, reorderPoint: 0 });

  const [showAdjust, setShowAdjust] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: "adjustment" as string, quantityDelta: 0, note: "" });

  const { data: warehouses = [], refetch: refetchWarehouses } = useListWarehouses();
  const { data: productsData } = useListProducts({ perPage: 100 });
  const products = productsData?.data ?? [];

  const { data: invData, isLoading: invLoading } = useListInventory({
    warehouseId: selectedWarehouse !== "all" ? selectedWarehouse : undefined,
    lowStock: lowStockOnly || undefined,
    page: invPage, perPage: 20,
  });
  const inventory = invData?.data ?? [];
  const invMeta = invData?.meta;

  const createWarehouseMutation = useCreateWarehouse({
    mutation: {
      onSuccess: () => { refetchWarehouses(); setShowCreateWarehouse(false); setWhForm({ name: "", address: "", city: "", country: "", isDefault: false }); toast({ title: "Warehouse created" }); },
      onError: () => toast({ title: "Failed to create warehouse", variant: "destructive" }),
    },
  });

  const createInventoryMutation = useCreateInventory({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/inventory"] }); setShowAddStock(false); setStockForm({ productId: "", warehouseId: "", available: 0, reorderPoint: 0 }); toast({ title: "Inventory record created" }); },
      onError: () => toast({ title: "Failed to create inventory", variant: "destructive" }),
    },
  });

  const createTxMutation = useCreateInventoryTransaction({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/inventory"] }); setShowAdjust(null); toast({ title: "Stock adjusted" }); },
      onError: () => toast({ title: "Failed to adjust stock", variant: "destructive" }),
    },
  });

  const lowStockCount = inventory.filter(i => i.isLowStock).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">Track stock levels across warehouses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddStock(true)} className="gap-2">
            <Package className="h-4 w-4" /> Add Stock
          </Button>
          <Button onClick={() => setShowCreateWarehouse(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Warehouse
          </Button>
        </div>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock Levels</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses ({warehouses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4 pt-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedWarehouse} onValueChange={v => { setSelectedWarehouse(v); setInvPage(1); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={lowStockOnly ? "default" : "outline"} size="sm" className="gap-2"
              onClick={() => { setLowStockOnly(!lowStockOnly); setInvPage(1); }}>
              <AlertTriangle className="h-3.5 w-3.5" />
              Low Stock {lowStockCount > 0 && <Badge variant="secondary" className="ml-1 h-4 text-xs">{lowStockCount}</Badge>}
            </Button>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reorder At</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>)}</TableRow>
                  ))
                ) : inventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                      <Warehouse className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>No inventory records</p>
                    </TableCell>
                  </TableRow>
                ) : inventory.map((item) => (
                  <TableRow key={item.id} className={item.isLowStock ? "bg-red-50/40" : ""}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.productName ?? item.productId.slice(0, 8)}</p>
                        {item.productSku && <p className="text-xs text-muted-foreground font-mono">{item.productSku}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.warehouseName}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono text-sm ${item.isLowStock ? "text-red-600 font-semibold" : ""}`}>{item.available}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{item.reserved}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{item.damaged}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{item.onHand}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{item.reorderPoint}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Adjust Stock"
                        onClick={() => { setShowAdjust(item.id); setAdjustForm({ type: "adjustment", quantityDelta: 0, note: "" }); }}>
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {invMeta && invMeta.total > invMeta.perPage && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{invMeta.total} records</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={invPage <= 1} onClick={() => setInvPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={invPage >= Math.ceil(invMeta.total / invMeta.perPage)} onClick={() => setInvPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="warehouses" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {warehouses.map((w) => (
              <Card key={w.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{w.name}</CardTitle>
                    <div className="flex gap-1">
                      {w.isDefault && <Badge className="text-xs">Default</Badge>}
                      {!w.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  {w.address && <p>{w.address}</p>}
                  {(w.city || w.country) && <p>{[w.city, w.country].filter(Boolean).join(", ")}</p>}
                  <p className="font-medium text-foreground pt-1">{w.inventoryCount ?? 0} products tracked</p>
                </CardContent>
              </Card>
            ))}
            {warehouses.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Warehouse className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No warehouses yet</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Warehouse Dialog */}
      <Dialog open={showCreateWarehouse} onOpenChange={setShowCreateWarehouse}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Warehouse</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Name *</Label><Input className="mt-1" value={whForm.name} onChange={e => setWhForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Address</Label><Input className="mt-1" value={whForm.address} onChange={e => setWhForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>City</Label><Input className="mt-1" value={whForm.city} onChange={e => setWhForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>Country</Label><Input className="mt-1" value={whForm.country} onChange={e => setWhForm(f => ({ ...f, country: e.target.value }))} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={whForm.isDefault} onChange={e => setWhForm(f => ({ ...f, isDefault: e.target.checked }))} />
              Set as default warehouse
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateWarehouse(false)}>Cancel</Button>
            <Button disabled={!whForm.name || createWarehouseMutation.isPending}
              onClick={() => createWarehouseMutation.mutate({ data: { name: whForm.name, address: whForm.address || undefined, city: whForm.city || undefined, country: whForm.country || undefined, isDefault: whForm.isDefault } })}>
              {createWarehouseMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Stock Dialog */}
      <Dialog open={showAddStock} onOpenChange={setShowAddStock}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Inventory Record</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Product *</Label>
              <Select value={stockForm.productId} onValueChange={v => setStockForm(f => ({ ...f, productId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Warehouse *</Label>
              <Select value={stockForm.warehouseId} onValueChange={v => setStockForm(f => ({ ...f, warehouseId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Initial Stock</Label><Input type="number" min={0} className="mt-1" value={stockForm.available} onChange={e => setStockForm(f => ({ ...f, available: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Reorder Point</Label><Input type="number" min={0} className="mt-1" value={stockForm.reorderPoint} onChange={e => setStockForm(f => ({ ...f, reorderPoint: parseInt(e.target.value) || 0 }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStock(false)}>Cancel</Button>
            <Button disabled={!stockForm.productId || !stockForm.warehouseId || createInventoryMutation.isPending}
              onClick={() => createInventoryMutation.mutate({ data: { productId: stockForm.productId, warehouseId: stockForm.warehouseId, available: stockForm.available, reorderPoint: stockForm.reorderPoint } })}>
              {createInventoryMutation.isPending ? "Creating…" : "Add Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={!!showAdjust} onOpenChange={open => { if (!open) setShowAdjust(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Transaction Type</Label>
              <Select value={adjustForm.type} onValueChange={v => setAdjustForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase (stock in)</SelectItem>
                  <SelectItem value="sale">Sale (stock out)</SelectItem>
                  <SelectItem value="adjustment">Manual Adjustment</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="transfer_in">Transfer In</SelectItem>
                  <SelectItem value="transfer_out">Transfer Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity Change (use negative to reduce)</Label>
              <Input type="number" className="mt-1" value={adjustForm.quantityDelta} onChange={e => setAdjustForm(f => ({ ...f, quantityDelta: parseInt(e.target.value) || 0 }))} />
            </div>
            <div><Label>Note</Label><Input className="mt-1" placeholder="Optional reason…" value={adjustForm.note} onChange={e => setAdjustForm(f => ({ ...f, note: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjust(null)}>Cancel</Button>
            <Button disabled={adjustForm.quantityDelta === 0 || createTxMutation.isPending}
              onClick={() => createTxMutation.mutate({ id: showAdjust!, data: { type: adjustForm.type as "adjustment", quantityDelta: adjustForm.quantityDelta, note: adjustForm.note || undefined } })}>
              {createTxMutation.isPending ? "Saving…" : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
