import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, Plus, MoreHorizontal, Trash2, Pencil, UserPlus } from "lucide-react";
import { useListCustomers } from "@workspace/api-client-react";

function apiFetch(url: string, init?: RequestInit) {
  const token = localStorage.getItem("commerce_token");
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

interface Segment {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editSegment, setEditSegment] = useState<Segment | null>(null);
  const [showAddMembers, setShowAddMembers] = useState<Segment | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: customersData } = useListCustomers({ perPage: 100 });
  const customers = customersData?.data ?? [];

  const loadSegments = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/segments?perPage=50");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSegments(json.data ?? []);
    } catch {
      // silently ignore — user may not be logged in yet
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadSegments(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url = editSegment ? `/api/segments/${editSegment.id}` : "/api/segments";
      const method = editSegment ? "PATCH" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), description: form.description || undefined, type: "static" }),
      });
      if (!res.ok) throw new Error();
      toast({ title: editSegment ? "Segment updated" : "Segment created" });
      setShowCreate(false);
      setEditSegment(null);
      setForm({ name: "", description: "" });
      loadSegments();
    } catch {
      toast({ title: "Failed to save segment", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this segment and remove all its members?")) return;
    const res = await apiFetch(`/api/segments/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) { toast({ title: "Segment deleted" }); loadSegments(); }
    else toast({ title: "Failed to delete", variant: "destructive" });
  };

  const handleAddMembers = async () => {
    if (!showAddMembers || selectedCustomers.size === 0) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/segments/${showAddMembers.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: Array.from(selectedCustomers) }),
      });
      const json = await res.json();
      toast({ title: `Added ${json.added} member(s)${json.skipped ? `, ${json.skipped} already in segment` : ""}` });
      setShowAddMembers(null);
      setSelectedCustomers(new Set());
      loadSegments();
    } catch {
      toast({ title: "Failed to add members", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer Segments</h1>
          <p className="text-sm text-muted-foreground">Group customers for targeted campaigns</p>
        </div>
        <Button onClick={() => { setForm({ name: "", description: "" }); setEditSegment(null); setShowCreate(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Segment
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : segments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-14 text-center">
                    <Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No segments yet. Create one to group customers.</p>
                  </TableCell>
                </TableRow>
              ) : (
                segments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        {s.description && <p className="text-xs text-muted-foreground truncate max-w-56">{s.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{s.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{s.memberCount}</TableCell>
                    <TableCell>
                      <Badge className={s.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setShowAddMembers(s); setSelectedCustomers(new Set()); }}>
                            <UserPlus className="mr-2 h-4 w-4" /> Add Members
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditSegment(s); setForm({ name: s.name, description: s.description ?? "" }); setShowCreate(true); }}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(s.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreate || !!editSegment} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditSegment(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editSegment ? "Edit Segment" : "New Segment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input placeholder="e.g. VIP Customers" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Describe who belongs in this segment…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditSegment(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : editSegment ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showAddMembers} onOpenChange={(open) => { if (!open) setShowAddMembers(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Members — {showAddMembers?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {customers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No customers found</p>
            ) : (
              customers.map((c) => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
                const checked = selectedCustomers.has(c.id);
                return (
                  <label key={c.id} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(selectedCustomers);
                        if (e.target.checked) next.add(c.id); else next.delete(c.id);
                        setSelectedCustomers(next);
                      }}
                      className="h-4 w-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMembers(null)}>Cancel</Button>
            <Button onClick={handleAddMembers} disabled={saving || selectedCustomers.size === 0}>
              {saving ? "Adding…" : `Add ${selectedCustomers.size} Member${selectedCustomers.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
