import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, CreditCard, FileText, Zap, TrendingUp, Building, Infinity } from "lucide-react";

function apiFetch(url: string, init?: RequestInit) {
  const token = localStorage.getItem("commerce_token");
  return fetch(url, { ...init, headers: { ...(init?.headers ?? {}), "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

interface Plan { id: string; name: string; displayName: string; priceMonthly: number; txnFeePct: number; limits: Record<string, unknown>; }
interface Subscription { id: string; planId: string; status: string; currentPeriodStart: string; currentPeriodEnd: string; plan: Plan | null; }
interface Invoice { id: string; total: number; status: string; periodStart: string; periodEnd: string; dueDate: string; paidAt: string | null; createdAt: string; }

const PLAN_ICONS: Record<string, typeof Zap> = { starter: Zap, growth: TrendingUp, business: Building, enterprise: Infinity };
const PLAN_COLORS: Record<string, string> = { starter: "border-slate-200", growth: "border-blue-300 ring-1 ring-blue-200", business: "border-purple-300 ring-1 ring-purple-200", enterprise: "border-yellow-300 ring-1 ring-yellow-200" };
const STATUS_COLORS: Record<string, string> = { active: "bg-green-100 text-green-800", trialing: "bg-blue-100 text-blue-800", past_due: "bg-red-100 text-red-800", cancelled: "bg-gray-100 text-gray-600" };
const INV_STATUS_COLORS: Record<string, string> = { paid: "bg-green-100 text-green-800", pending: "bg-yellow-100 text-yellow-800", overdue: "bg-red-100 text-red-800", void: "bg-gray-100 text-gray-600" };

function formatLimit(key: string, val: unknown): string {
  if (val === null || val === undefined || val === 0) return "Unlimited";
  return String(val);
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setIsLoading(true);
    try {
      const [pl, sub, inv] = await Promise.all([
        apiFetch("/api/billing/plans").then((r) => r.json()),
        apiFetch("/api/billing/subscription").then((r) => r.json()),
        apiFetch("/api/billing/invoices").then((r) => r.json()),
      ]);
      setPlans(pl ?? []);
      setSubscription(sub);
      setInvoices(inv.data ?? []);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const selectPlan = async (planId: string) => {
    setUpgrading(planId);
    try {
      const res = await apiFetch("/api/billing/subscription", { method: "POST", body: JSON.stringify({ planId }) });
      if (!res.ok) throw new Error();
      toast({ title: "Plan updated successfully" });
      load();
    } catch { toast({ title: "Failed to update plan", variant: "destructive" }); }
    finally { setUpgrading(null); }
  };

  const cancelSub = async () => {
    if (!confirm("Cancel your subscription? You will lose access at the end of the current period.")) return;
    try {
      const res = await apiFetch("/api/billing/subscription/cancel", { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "Subscription cancelled" });
      load();
    } catch { toast({ title: "Failed to cancel subscription", variant: "destructive" }); }
  };

  const currentPlanId = subscription?.planId;

  const PLAN_FEATURES: Record<string, { products: string; orders: string; staff: string; branches: string; api: string }> = {
    starter:    { products: "100",       orders: "500/mo",      staff: "2",   branches: "1",  api: "100 req/min" },
    growth:     { products: "1,000",     orders: "5,000/mo",    staff: "5",   branches: "3",  api: "500 req/min" },
    business:   { products: "Unlimited", orders: "Unlimited",   staff: "20",  branches: "10", api: "2,000 req/min" },
    enterprise: { products: "Unlimited", orders: "Unlimited",   staff: "∞",   branches: "∞",  api: "Unlimited" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-sm text-muted-foreground">Manage your plan, view invoices, and track usage</p>
      </div>

      {/* Current Subscription Banner */}
      {subscription && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2"><CreditCard className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-sm font-medium">Current Plan: <span className="font-bold capitalize">{subscription.plan?.displayName ?? subscription.plan?.name}</span></p>
                  <p className="text-xs text-muted-foreground">
                    Period: {new Date(subscription.currentPeriodStart).toLocaleDateString()} — {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={STATUS_COLORS[subscription.status] ?? ""}>{subscription.status.replace("_", " ")}</Badge>
                {subscription.status === "active" && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={cancelSub}>Cancel</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="animate-pulse"><CardContent className="pt-6 h-64 bg-muted/20 rounded" /></Card>
              ))
            ) : plans.map((plan) => {
              const isCurrentPlan = plan.id === currentPlanId;
              const Icon = PLAN_ICONS[plan.name] ?? Zap;
              const features = PLAN_FEATURES[plan.name];
              return (
                <Card key={plan.id} className={`relative flex flex-col ${PLAN_COLORS[plan.name] ?? ""} ${isCurrentPlan ? "bg-primary/5" : ""}`}>
                  {isCurrentPlan && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-0.5 rounded-full">Current Plan</span>
                    </div>
                  )}
                  <CardHeader className="pb-2 pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="rounded-md bg-muted p-1.5"><Icon className="h-4 w-4" /></div>
                      <CardTitle className="text-base capitalize">{plan.displayName}</CardTitle>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">
                        {plan.priceMonthly === 0 ? "Free" : `Rs ${plan.priceMonthly.toLocaleString()}`}
                      </span>
                      {plan.priceMonthly > 0 && <span className="text-xs text-muted-foreground">/mo</span>}
                    </div>
                    <CardDescription className="text-xs">{plan.txnFeePct > 0 ? `${(plan.txnFeePct * 100).toFixed(1)}% transaction fee` : "No transaction fees"}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-4">
                    {features && (
                      <ul className="space-y-1.5 text-sm">
                        {[
                          { label: "Products", value: features.products },
                          { label: "Orders", value: features.orders },
                          { label: "Staff", value: features.staff },
                          { label: "Branches", value: features.branches },
                          { label: "API Rate", value: features.api },
                        ].map((f) => (
                          <li key={f.label} className="flex items-center gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                            <span className="text-muted-foreground">{f.label}:</span>
                            <span className="font-medium">{f.value}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-auto pt-2">
                      <Button
                        className="w-full"
                        variant={isCurrentPlan ? "secondary" : "default"}
                        disabled={isCurrentPlan || upgrading !== null}
                        onClick={() => !isCurrentPlan && selectPlan(plan.id)}
                      >
                        {upgrading === plan.id ? "Switching…" : isCurrentPlan ? "Current Plan" : plan.name === "enterprise" ? "Contact Sales" : "Switch to This"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {plans.length === 0 && !isLoading && (
            <div className="py-14 text-center text-muted-foreground text-sm">
              No plans available. Seed the database with billing plans.
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-14 text-center">
                        <FileText className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground text-sm">No invoices yet.</p>
                      </TableCell>
                    </TableRow>
                  ) : invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{inv.id.slice(-8).toUpperCase()}</TableCell>
                      <TableCell className="text-sm">{new Date(inv.periodStart).toLocaleDateString()} — {new Date(inv.periodEnd).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm">{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right font-semibold">Rs {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge className={INV_STATUS_COLORS[inv.status] ?? ""}>{inv.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
