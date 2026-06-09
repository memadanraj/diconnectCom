import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Search, ShoppingCart, Trash2, Plus, Minus, User, Tag,
  CreditCard, Banknote, Smartphone, X, CheckCircle, Printer, RotateCcw,
  Package, ChevronRight, Monitor,
} from "lucide-react";

function apiFetch(url: string, init?: RequestInit) {
  const token = localStorage.getItem("commerce_token");
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/* ─── Types ─── */
interface Register { id: string; name: string; branchName: string | null; status: string; expectedCash: number | null; }
interface Product { id: string; name: string; sku: string; price: number; stock: number; imageUrl: string | null; categoryName: string | null; }
interface Category { id: string; name: string; }
interface Customer { id: string; firstName: string | null; lastName: string | null; email: string; phone: string | null; }
interface CartItem { product: Product; qty: number; unitPrice: number; }
interface DiscountResult { valid: boolean; message?: string; discount?: { id: string; type: string; value: number; code: string }; discountAmount: number; }
interface CompletedSale {
  id: string; total: number; subtotal: number; discount: number; tax: number;
  paymentMethod: string; changeGiven: number; createdAt: string;
  customer: Customer | null; items: CartItem[];
  discountCode: string | null; registerName: string | null;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "esewa", label: "eSewa", icon: Smartphone },
  { value: "khalti", label: "Khalti", icon: Smartphone },
];

const TAX_RATES = [
  { label: "No Tax (0%)", value: 0 },
  { label: "VAT 13%", value: 0.13 },
  { label: "5%", value: 0.05 },
];

/* ─── Register Picker ─── */
function RegisterPicker({ onSelect }: { onSelect: (r: Register) => void }) {
  const [registers, setRegisters] = useState<Register[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/pos/registers")
      .then((r) => r.json())
      .then((d) => setRegisters(d ?? []))
      .finally(() => setIsLoading(false));
  }, []);

  const open = registers.filter((r) => r.status === "open");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Monitor className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Select Register</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose an open register to start selling</p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : open.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <Monitor className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium">No open registers</p>
            <p className="mt-1 text-sm text-muted-foreground">Open a register from the POS page first.</p>
            <Link href="/pos">
              <Button variant="outline" className="mt-4 gap-2"><ArrowLeft className="h-4 w-4" />Go to POS</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {open.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelect(r)}
                className="flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary hover:bg-primary/5 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <Monitor className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.branchName ?? "No branch"} · Cash: Rs {(r.expectedCash ?? 0).toLocaleString()}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Receipt ─── */
function Receipt({ sale, onNew }: { sale: CompletedSale; onNew: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = () => window.print();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold">Sale Complete</h2>
          <p className="text-sm text-muted-foreground">Rs {sale.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>

        <div ref={printRef} className="rounded-xl border bg-card p-5 font-mono text-sm print:shadow-none">
          <div className="mb-3 border-b pb-3 text-center">
            <p className="text-base font-bold">Commerce OS</p>
            <p className="text-xs text-muted-foreground">{sale.registerName ?? "POS"}</p>
            <p className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">#{sale.id.slice(-8).toUpperCase()}</p>
          </div>

          {sale.customer && (
            <p className="mb-2 text-xs text-muted-foreground">
              Customer: {[sale.customer.firstName, sale.customer.lastName].filter(Boolean).join(" ") || sale.customer.email}
            </p>
          )}

          <div className="space-y-1 border-b pb-3">
            {sale.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="truncate pr-2">{item.product.name} × {item.qty}</span>
                <span>Rs {(item.unitPrice * item.qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>Rs {sale.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount {sale.discountCode ? `(${sale.discountCode})` : ""}</span>
                <span>−Rs {sale.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {sale.tax > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>Rs {sale.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
            <div className="flex justify-between border-t pt-1 font-bold text-sm"><span>TOTAL</span><span>Rs {sale.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Paid ({sale.paymentMethod})</span><span>Rs {(sale.total + sale.changeGiven).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            {sale.changeGiven > 0 && <div className="flex justify-between text-muted-foreground"><span>Change</span><span>Rs {sale.changeGiven.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
          </div>

          <p className="mt-4 border-t pt-3 text-center text-xs text-muted-foreground">Thank you for your purchase!</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint}><Printer className="h-4 w-4" />Print</Button>
          <Button className="flex-1 gap-2" onClick={onNew}><RotateCcw className="h-4 w-4" />New Sale</Button>
        </div>
        <Link href="/pos">
          <Button variant="ghost" className="w-full gap-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" />Back to POS</Button>
        </Link>
      </div>
    </div>
  );
}

/* ─── Main Terminal ─── */
export default function PosTerminalPage() {
  const [register, setRegister] = useState<Register | null>(null);

  /* Products */
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  /* Cart */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [taxRate, setTaxRate] = useState(0.13);

  /* Customer */
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  /* Discount */
  const [discountCode, setDiscountCode] = useState("");
  const [discountResult, setDiscountResult] = useState<DiscountResult | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);

  /* Payment */
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashTendered, setCashTendered] = useState("");
  const [processing, setProcessing] = useState(false);

  /* Receipt */
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);

  const { toast } = useToast();

  /* Load products + categories */
  useEffect(() => {
    Promise.all([
      apiFetch("/api/products?perPage=100&status=active").then((r) => r.json()),
      apiFetch("/api/categories?perPage=100").then((r) => r.json()),
    ]).then(([prods, cats]) => {
      setProducts(prods.data ?? []);
      setCategories(cats.data ?? []);
    });
  }, []);

  /* Customer search debounce */
  useEffect(() => {
    if (!customerSearch || customerSearch.length < 2) { setCustomerResults([]); return; }
    const t = setTimeout(() => {
      apiFetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&perPage=8`)
        .then((r) => r.json())
        .then((d) => setCustomerResults(d.data ?? []));
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  /* Filtered products */
  const filteredProducts = products.filter((p) => {
    const matchesSearch = !productSearch ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCat = activeCat === "all" || p.categoryName === activeCat;
    return matchesSearch && matchesCat;
  });

  /* Cart helpers */
  const addToCart = (product: Product) => {
    if (product.stock <= 0) { toast({ title: "Out of stock", variant: "destructive" }); return; }
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) { toast({ title: "Not enough stock", variant: "destructive" }); return prev; }
        return prev.map((i) => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { product, qty: 1, unitPrice: product.price }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.product.id !== productId) return i;
      const newQty = i.qty + delta;
      return newQty <= 0 ? null : { ...i, qty: Math.min(newQty, i.product.stock) };
    }).filter(Boolean) as CartItem[]);
  };

  const removeItem = (productId: string) => setCart((prev) => prev.filter((i) => i.product.id !== productId));

  const clearCart = () => { setCart([]); setDiscountResult(null); setDiscountCode(""); setSelectedCustomer(null); };

  /* Totals */
  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const discountAmount = discountResult?.valid ? (discountResult.discountAmount ?? 0) : 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round(taxableAmount * taxRate * 100) / 100;
  const total = taxableAmount + taxAmount;
  const changeDue = paymentMethod === "cash" && cashTendered ? Math.max(0, parseFloat(cashTendered) - total) : 0;

  /* Discount validation */
  const validateDiscount = async () => {
    if (!discountCode.trim()) return;
    setCheckingDiscount(true);
    try {
      const res = await apiFetch("/api/discounts/validate", {
        method: "POST",
        body: JSON.stringify({ code: discountCode.trim().toUpperCase(), orderAmount: subtotal }),
      });
      const data: DiscountResult = await res.json();
      setDiscountResult(data);
      if (!data.valid) toast({ title: data.message ?? "Invalid discount code", variant: "destructive" });
    } catch { toast({ title: "Could not validate code", variant: "destructive" }); }
    finally { setCheckingDiscount(false); }
  };

  /* Process payment */
  const processPayment = async () => {
    if (!register || cart.length === 0) return;
    if (paymentMethod === "cash" && cashTendered && parseFloat(cashTendered) < total) {
      toast({ title: "Cash tendered is less than total", variant: "destructive" }); return;
    }
    setProcessing(true);
    try {
      const items = cart.map((i) => ({ id: i.product.id, name: i.product.name, sku: i.product.sku, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.unitPrice * i.qty }));
      const res = await apiFetch("/api/pos/sales", {
        method: "POST",
        body: JSON.stringify({
          registerId: register.id,
          customerId: selectedCustomer?.id ?? null,
          items,
          subtotal,
          discount: discountAmount,
          tax: taxAmount,
          total,
          paymentMethod,
          payments: [{ method: paymentMethod, amount: paymentMethod === "cash" ? parseFloat(cashTendered || String(total)) : total }],
          changeGiven: changeDue,
          notes: discountResult?.valid ? `Discount: ${discountCode}` : null,
        }),
      });
      if (!res.ok) throw new Error();
      const sale = await res.json();
      setCompletedSale({
        ...sale,
        customer: selectedCustomer,
        items: cart,
        discountCode: discountResult?.valid ? discountCode.toUpperCase() : null,
        registerName: register.name,
      });
      setShowPayment(false);
    } catch { toast({ title: "Failed to process sale", variant: "destructive" }); }
    finally { setProcessing(false); }
  };

  /* Post-sale: new sale */
  const startNew = () => {
    setCompletedSale(null);
    clearCart();
    setPaymentMethod("cash");
    setCashTendered("");
  };

  /* ── States ── */
  if (!register) return <RegisterPicker onSelect={setRegister} />;
  if (completedSale) return <Receipt sale={completedSale} onNew={startNew} />;

  const uniqueCats = ["all", ...Array.from(new Set(products.map((p) => p.categoryName).filter(Boolean) as string[]))];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/30">
      {/* Top bar */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b bg-card px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/pos">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-100 text-green-700">
              <Monitor className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">{register.name}</p>
              <p className="text-xs text-muted-foreground leading-none mt-0.5">POS Terminal</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800 gap-1"><div className="h-1.5 w-1.5 rounded-full bg-green-600" />Open</Badge>
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5 text-xs" onClick={() => setRegister(null)}>
            <RotateCcw className="h-3.5 w-3.5" />Switch Register
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ──────── LEFT: Product Panel ──────── */}
        <div className="flex w-0 flex-1 flex-col overflow-hidden border-r bg-card">
          {/* Search bar */}
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products or scan barcode…"
                className="pl-9"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto border-b px-3 py-2 scrollbar-none">
            {uniqueCats.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeCat === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredProducts.map((p) => {
                  const inCart = cart.find((i) => i.product.id === p.id);
                  const outOfStock = p.stock <= 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      disabled={outOfStock}
                      className={`relative flex flex-col overflow-hidden rounded-xl border text-left transition-all ${
                        outOfStock
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer hover:border-primary hover:shadow-md active:scale-[0.98]"
                      } ${inCart ? "border-primary/60 bg-primary/5" : "bg-card"}`}
                    >
                      {/* Product image */}
                      <div className="aspect-square w-full overflow-hidden bg-muted">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-2">
                        <p className="truncate text-xs font-semibold leading-tight">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                        <p className="mt-1 text-sm font-bold text-primary">Rs {p.price.toLocaleString()}</p>
                        {outOfStock ? (
                          <p className="text-[10px] text-red-500 font-medium">Out of stock</p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">Stock: {p.stock}</p>
                        )}
                      </div>
                      {/* Cart badge */}
                      {inCart && (
                        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {inCart.qty}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ──────── RIGHT: Cart Panel ──────── */}
        <div className="flex w-80 flex-shrink-0 flex-col bg-card xl:w-96">
          {/* Cart header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Cart</span>
              {cart.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {cart.reduce((s, i) => s + i.qty, 0)}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={clearCart}>
                <Trash2 className="h-3.5 w-3.5" />Clear
              </Button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <ShoppingCart className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Cart is empty</p>
                <p className="text-xs text-muted-foreground mt-1">Click a product to add it</p>
              </div>
            ) : (
              <div className="divide-y">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">Rs {item.unitPrice.toLocaleString()} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.product.id, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.product.id, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="w-20 text-right text-sm font-semibold">
                      Rs {(item.unitPrice * item.qty).toLocaleString()}
                    </span>
                    <button onClick={() => removeItem(item.product.id)} className="text-muted-foreground/50 hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom: Customer, Discount, Totals, Checkout */}
          <div className="border-t">
            {/* Customer */}
            <div className="border-b px-4 py-2.5">
              {selectedCustomer ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{[selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(" ") || selectedCustomer.email}</p>
                      <p className="text-[10px] text-muted-foreground">{selectedCustomer.email}</p>
                    </div>
                  </div>
                  <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); }} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search customer (optional)…"
                    className="h-8 pl-8 text-xs"
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerSearch(true); }}
                    onFocus={() => setShowCustomerSearch(true)}
                  />
                  {showCustomerSearch && customerResults.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-40 overflow-y-auto rounded-lg border bg-card shadow-lg">
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setShowCustomerSearch(false); setCustomerResults([]); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                        >
                          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}</span>
                          <span className="text-muted-foreground">{c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Discount code */}
            <div className="border-b px-4 py-2.5">
              {discountResult?.valid ? (
                <div className="flex items-center justify-between rounded-md bg-green-50 px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-xs font-semibold text-green-800">{discountCode.toUpperCase()}</span>
                    <span className="text-xs text-green-700">−Rs {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <button onClick={() => { setDiscountResult(null); setDiscountCode(""); }} className="text-green-600 hover:text-green-800">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Discount code…"
                      className="h-8 pl-8 text-xs uppercase"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && validateDiscount()}
                    />
                  </div>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={validateDiscount} disabled={checkingDiscount || !discountCode.trim()}>
                    {checkingDiscount ? "…" : "Apply"}
                  </Button>
                </div>
              )}
            </div>

            {/* Tax rate */}
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-xs text-muted-foreground">Tax</span>
              <Select value={String(taxRate)} onValueChange={(v) => setTaxRate(parseFloat(v))}>
                <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_RATES.map((t) => <SelectItem key={t.value} value={String(t.value)} className="text-xs">{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Totals */}
            <div className="space-y-1 px-4 py-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>Rs {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount</span>
                  <span>−Rs {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({(taxRate * 100).toFixed(0)}%)</span>
                  <span>Rs {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="text-primary">Rs {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Checkout button */}
            <div className="px-4 pb-4">
              <Button
                className="w-full h-11 text-base font-semibold gap-2"
                disabled={cart.length === 0}
                onClick={() => { setPaymentMethod("cash"); setCashTendered(""); setShowPayment(true); }}
              >
                <CreditCard className="h-5 w-5" />
                Charge Rs {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ──────── Payment Dialog ──────── */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Amount due */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-center">
              <p className="text-xs text-muted-foreground">Amount Due</p>
              <p className="text-3xl font-bold text-primary">Rs {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            {/* Payment method selector */}
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                      paymentMethod === m.value ? "border-primary bg-primary/5 text-primary" : "hover:border-muted-foreground/30 hover:bg-muted/50"
                    }`}
                  >
                    <m.icon className="h-4 w-4" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash tendered */}
            {paymentMethod === "cash" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Cash Tendered (Rs)</Label>
                <Input
                  type="number"
                  min={total}
                  step="0.01"
                  placeholder={total.toFixed(2)}
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="text-lg font-semibold"
                  autoFocus
                />
                {/* Quick cash buttons */}
                <div className="flex gap-2 flex-wrap">
                  {[Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000]
                    .filter((v, i, a) => a.indexOf(v) === i && v >= total)
                    .slice(0, 4)
                    .map((v) => (
                      <button
                        key={v}
                        onClick={() => setCashTendered(String(v))}
                        className="rounded border px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
                      >
                        Rs {v.toLocaleString()}
                      </button>
                    ))}
                </div>
                {cashTendered && parseFloat(cashTendered) >= total && (
                  <div className="flex justify-between rounded-md bg-green-50 px-3 py-2 text-sm">
                    <span className="text-green-700 font-medium">Change Due</span>
                    <span className="font-bold text-green-800">Rs {changeDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button
              className="gap-2"
              onClick={processPayment}
              disabled={processing || (paymentMethod === "cash" && !!cashTendered && parseFloat(cashTendered) < total)}
            >
              {processing ? "Processing…" : <><CheckCircle className="h-4 w-4" />Confirm Payment</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
