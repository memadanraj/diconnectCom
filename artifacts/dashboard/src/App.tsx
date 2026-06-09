import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthGuard } from "@/components/auth-guard";
import { Layout } from "@/components/layout";

import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import ProductsList from "@/pages/products";
import ProductForm from "@/pages/product-form";
import Categories from "@/pages/categories";
import OrdersList from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Settings from "@/pages/settings";
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customer-detail";
import InventoryPage from "@/pages/inventory";
import ShipmentsPage from "@/pages/shipments";
import ShipmentDetailPage from "@/pages/shipment-detail";
import DiscountsPage from "@/pages/discounts";
import ReturnsPage from "@/pages/returns";
import ReturnDetailPage from "@/pages/return-detail";
import LoyaltyPage from "@/pages/loyalty";
import SegmentsPage from "@/pages/segments";
import CampaignsPage from "@/pages/campaigns";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoutes() {
  return (
    <AuthGuard>
      <Layout>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/products" component={ProductsList} />
          <Route path="/products/new" component={() => <ProductForm />} />
          <Route path="/products/:id" component={({ params }) => <ProductForm id={params.id} />} />
          <Route path="/categories" component={Categories} />
          <Route path="/orders" component={OrdersList} />
          <Route path="/orders/:id" component={({ params }) => <OrderDetail id={params.id} />} />
          <Route path="/customers" component={CustomersPage} />
          <Route path="/customers/:id" component={({ params }) => <CustomerDetailPage id={params.id} />} />
          <Route path="/inventory" component={InventoryPage} />
          <Route path="/shipments" component={ShipmentsPage} />
          <Route path="/shipments/:id" component={({ params }) => <ShipmentDetailPage id={params.id} />} />
          <Route path="/discounts" component={DiscountsPage} />
          <Route path="/returns" component={ReturnsPage} />
          <Route path="/returns/:id" component={({ params }) => <ReturnDetailPage id={params.id} />} />
          <Route path="/loyalty" component={LoyaltyPage} />
          <Route path="/segments" component={SegmentsPage} />
          <Route path="/campaigns" component={CampaignsPage} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGuard>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/">
        {() => {
          window.location.href = "/dashboard";
          return null;
        }}
      </Route>
      <Route path="/*" component={ProtectedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
