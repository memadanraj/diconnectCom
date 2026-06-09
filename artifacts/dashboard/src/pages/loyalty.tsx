import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Star, Trophy, Award, Gift, ExternalLink } from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-orange-100 text-orange-800",
  silver: "bg-gray-100 text-gray-800",
  gold: "bg-yellow-100 text-yellow-800",
  platinum: "bg-blue-100 text-blue-800",
};

const TIER_ICONS: Record<string, typeof Star> = {
  bronze: Award,
  silver: Star,
  gold: Trophy,
  platinum: Gift,
};

interface LoyaltyAccount {
  id: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  points: number;
  lifetimePoints: number;
  tier: string;
}

function apiFetch(url: string, init?: RequestInit) {
  const token = localStorage.getItem("commerce_token");
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

export default function LoyaltyPage() {
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [meta, setMeta] = useState<{ total: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<LoyaltyAccount | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: "earn", points: "", note: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/loyalty?page=1&perPage=50");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAccounts(json.data ?? []);
      setMeta(json.meta ?? null);
    } catch {
      // silently ignore — user may not be logged in yet
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadAccounts(); }, []);

  const totalPoints = accounts.reduce((s, a) => s + a.points, 0);
  const totalMembers = meta?.total ?? 0;
  const goldPlus = accounts.filter((a) => a.tier === "gold" || a.tier === "platinum").length;

  const handleAdjust = async () => {
    if (!selectedAccount || !adjustForm.points) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/loyalty/${selectedAccount.customerId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: adjustForm.type, points: parseInt(adjustForm.points), note: adjustForm.note || undefined }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Points adjusted successfully" });
      setShowAdjust(false);
      setAdjustForm({ type: "earn", points: "", note: "" });
      loadAccounts();
    } catch {
      toast({ title: "Failed to adjust points", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loyalty Program</h1>
          <p className="text-sm text-muted-foreground">Manage customer points and tiers</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-100 p-2"><Trophy className="h-5 w-5 text-yellow-700" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{totalMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2"><Star className="h-5 w-5 text-blue-700" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Points in Circulation</p>
                <p className="text-2xl font-bold">{totalPoints.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2"><Award className="h-5 w-5 text-orange-700" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Gold+ Members</p>
                <p className="text-2xl font-bold">{goldPlus}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tier Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 text-center text-sm">
            {[
              { tier: "Bronze", points: "0+", color: "bg-orange-50 border-orange-200" },
              { tier: "Silver", points: "1,000+", color: "bg-gray-50 border-gray-200" },
              { tier: "Gold", points: "5,000+", color: "bg-yellow-50 border-yellow-200" },
              { tier: "Platinum", points: "20,000+", color: "bg-blue-50 border-blue-200" },
            ].map((t) => (
              <div key={t.tier} className={`rounded-lg border p-3 ${t.color}`}>
                <p className="font-semibold">{t.tier}</p>
                <p className="text-muted-foreground text-xs">{t.points} lifetime pts</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Lifetime</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-14 text-center">
                    <Trophy className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No loyalty accounts yet.</p>
                    <p className="text-muted-foreground text-xs mt-1">Accounts are created automatically when points are adjusted for a customer.</p>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((a) => {
                  const TierIcon = TIER_ICONS[a.tier] ?? Star;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{a.customerName}</p>
                          <p className="text-xs text-muted-foreground">{a.customerEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`gap-1 ${TIER_COLORS[a.tier] ?? ""}`}>
                          <TierIcon className="h-3 w-3" />
                          {a.tier.charAt(0).toUpperCase() + a.tier.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{a.points.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{a.lifetimePoints.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-end">
                          <Link href={`/customers/${a.customerId}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="h-3.5 w-3.5" /></Button>
                          </Link>
                          <Button variant="outline" size="sm" onClick={() => { setSelectedAccount(a); setShowAdjust(true); }}>
                            Adjust
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Points — {selectedAccount?.customerName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              Current balance: <span className="font-bold">{selectedAccount?.points?.toLocaleString()} pts</span>
              {" · "}Tier: <span className="font-medium capitalize">{selectedAccount?.tier}</span>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={adjustForm.type} onValueChange={(v) => setAdjustForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="earn">Earn (add points)</SelectItem>
                  <SelectItem value="redeem">Redeem (deduct points)</SelectItem>
                  <SelectItem value="expire">Expire (remove points)</SelectItem>
                  <SelectItem value="adjust">Manual adjust</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Points</Label>
              <Input type="number" min="1" placeholder="e.g. 100" value={adjustForm.points} onChange={(e) => setAdjustForm((f) => ({ ...f, points: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea placeholder="Reason for adjustment…" value={adjustForm.note} onChange={(e) => setAdjustForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjust(false)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={saving || !adjustForm.points}>
              {saving ? "Saving…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
