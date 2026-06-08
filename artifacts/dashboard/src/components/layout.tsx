import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  Settings,
  LogOut,
  Store,
  Menu,
  Users,
  Warehouse,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_SECTIONS = [
  {
    label: "Commerce",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/orders", label: "Orders", icon: ShoppingCart },
      { href: "/products", label: "Products", icon: Package },
      { href: "/categories", label: "Categories", icon: Tags },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/inventory", label: "Inventory", icon: Warehouse },
      { href: "/shipments", label: "Shipments", icon: Truck },
    ],
  },
  {
    label: "Store",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function NavLinks() {
  const [location] = useLocation();
  return (
    <div className="flex flex-col gap-5">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {section.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <span
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe();

  const handleLogout = () => {
    localStorage.removeItem("commerce_token");
    setLocation("/login");
  };

  return (
    <div className="flex min-h-[100dvh] w-full bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 flex-col border-r bg-card md:flex">
        <div className="flex h-16 flex-shrink-0 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-primary cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </div>
            <span>Commerce OS</span>
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-5 px-3">
          <NavLinks />
        </div>
        <div className="border-t p-4">
          <div className="flex items-center gap-3 mb-4">
            <Avatar>
              <AvatarFallback className="bg-primary/20 text-primary">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-medium">{user?.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Mobile/Main Layout */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-primary">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </div>
            <span className="text-lg">Commerce OS</span>
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 flex flex-col p-0">
              <div className="flex h-16 items-center border-b px-6">
                <span className="font-bold text-primary flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Commerce OS
                </span>
              </div>
              <div className="flex-1 overflow-auto py-5 px-3">
                <NavLinks />
              </div>
              <div className="border-t p-4">
                <Button variant="outline" className="w-full justify-start gap-2" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
