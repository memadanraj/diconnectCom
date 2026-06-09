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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Megaphone, Plus, MoreHorizontal, Play, Pause, Trash2, Pencil } from "lucide-react";

const CAMPAIGN_TYPES = [
  { value: "flash_sale", label: "Flash Sale" },
  { value: "bundle_discount", label: "Bundle Discount" },
  { value: "free_shipping", label: "Free Shipping" },
  { value: "loyalty_reward", label: "Loyalty Reward" },
  { value: "referral", label: "Referral" },
  { value: "win_back", label: "Win-back" },
  { value: "birthday", label: "Birthday" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  ended: "bg-red-100 text-red-700",
};

function apiFetch(url: string, init?: RequestInit) {
  const token = localStorage.getItem("commerce_token");
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  segmentName: string | null;
  discountCode: string | null;
  audienceCount: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

interface Segment { id: string; name: string }
interface Discount { id: string; code: string }

const BLANK_FORM = { name: "", description: "", type: "flash_sale", targetSegmentId: "", discountId: "", startsAt: "", endsAt: "" };

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [cRes, sRes, dRes] = await Promise.all([
        apiFetch("/api/campaigns?perPage=50"),
        apiFetch("/api/segments?perPage=100"),
        apiFetch("/api/discounts?perPage=100&isActive=true"),
      ]);
      const [cJson, sJson, dJson] = await Promise.all([cRes.json(), sRes.json(), dRes.json()]);
      setCampaigns(cJson.data ?? []);
      setSegments(sJson.data ?? []);
      setDiscounts(dJson.data ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const filtered = statusFilter === "all" ? campaigns : campaigns.filter((c) => c.status === statusFilter);

  const handleSave = async () => {
    if (!form.name.trim() || !form.type) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description || undefined,
        type: form.type,
        targetSegmentId: form.targetSegmentId || undefined,
        discountId: form.discountId || undefined,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
      };
      const url = editCampaign ? `/api/campaigns/${editCampaign.id}` : "/api/campaigns";
      const method = editCampaign ? "PATCH" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast({ title: editCampaign ? "Campaign updated" : "Campaign created" });
      setShowDialog(false);
      setEditCampaign(null);
      setForm({ ...BLANK_FORM });
      loadAll();
    } catch {
      toast({ title: "Failed to save campaign", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (id: string, action: "launch" | "pause" | "delete") => {
    if (action === "delete" && !confirm("Delete this campaign?")) return;
    const url = action === "delete" ? `/api/campaigns/${id}` : `/api/campaigns/${id}/${action}`;
    const method = action === "delete" ? "DELETE" : "POST";
    const res = await apiFetch(url, { method });
    if (res.ok || res.status === 204) {
      toast({ title: action === "delete" ? "Campaign deleted" : action === "launch" ? "Campaign launched!" : "Campaign paused" });
      loadAll();
    } else {
      const json = await res.json().catch(() => ({}));
      toast({ title: json.error ?? "Action failed", variant: "destructive" });
    }
  };

  const openEdit = (c: Campaign) => {
    setEditCampaign(c);
    setForm({
      name: c.name,
      description: c.description ?? "",
      type: c.type,
      targetSegmentId: "",
      discountId: "",
      startsAt: c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 16) : "",
      endsAt: c.endsAt ? new Date(c.endsAt).toISOString().slice(0, 16) : "",
    });
    setShowDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Create and manage marketing campaigns</p>
        </div>
        <Button onClick={() => { setForm({ ...BLANK_FORM }); setEditCampaign(null); setShowDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Campaign
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "draft", "active", "paused", "ended"].map((s) => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" className="capitalize" onClick={() => setStatusFilter(s)}>
            {s}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead className="text-right">Audience</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-14 text-center">
                    <Megaphone className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No campaigns{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""} yet.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        {c.description && <p className="text-xs text-muted-foreground truncate max-w-48">{c.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground capitalize">{c.type.replace(/_/g, " ")}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[c.status] ?? ""}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{c.segmentName ?? <span className="text-muted-foreground text-xs">All customers</span>}</TableCell>
                    <TableCell>
                      {c.discountCode ? (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{c.discountCode}</code>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm">{c.audienceCount.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {c.startsAt ? new Date(c.startsAt).toLocaleDateString() : "—"}
                      {c.endsAt ? ` → ${new Date(c.endsAt).toLocaleDateString()}` : ""}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {c.status !== "active" && c.status !== "ended" && (
                            <DropdownMenuItem onClick={() => handleAction(c.id, "launch")}>
                              <Play className="mr-2 h-4 w-4 text-green-600" /> Launch
                            </DropdownMenuItem>
                          )}
                          {c.status === "active" && (
                            <DropdownMenuItem onClick={() => handleAction(c.id, "pause")}>
                              <Pause className="mr-2 h-4 w-4 text-yellow-600" /> Pause
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleAction(c.id, "delete")}>
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

      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); setEditCampaign(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editCampaign ? "Edit Campaign" : "New Campaign"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input placeholder="e.g. Summer Flash Sale" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Internal notes about this campaign…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Target Segment</Label>
                <Select value={form.targetSegmentId || "_all"} onValueChange={(v) => setForm((f) => ({ ...f, targetSegmentId: v === "_all" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="All customers" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All customers</SelectItem>
                    {segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Code</Label>
                <Select value={form.discountId || "_none"} onValueChange={(v) => setForm((f) => ({ ...f, discountId: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {discounts.map((d) => <SelectItem key={d.id} value={d.id}>{d.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Starts At</Label>
                <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Ends At</Label>
                <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditCampaign(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : editCampaign ? "Save Changes" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
