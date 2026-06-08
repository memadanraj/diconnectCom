import { useMemo } from "react";
import { 
  useGetDashboardStats, 
  useGetRecentOrders, 
  useGetRevenueChart, 
  useGetOrdersByStatus, 
  useGetTopProducts 
} from "@workspace/api-client-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Area, 
  AreaChart, 
  Bar, 
  BarChart, 
  CartesianGrid, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  XAxis, 
  YAxis, 
  PieChart, 
  Pie, 
  Cell
} from "recharts";
import { DollarSign, ShoppingBag, ShoppingCart, Users, ArrowUpRight, ArrowDownRight, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(var(--chart-3))",
  confirmed: "hsl(var(--chart-2))",
  packed: "hsl(var(--chart-4))",
  shipped: "hsl(var(--primary))",
  delivered: "hsl(var(--primary))",
  cancelled: "hsl(var(--destructive))",
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentOrders, isLoading: ordersLoading } = useGetRecentOrders({ limit: 5 });
  const { data: revenueData, isLoading: revenueLoading } = useGetRevenueChart();
  const { data: statusData, isLoading: statusLoading } = useGetOrdersByStatus();
  const { data: topProducts, isLoading: productsLoading } = useGetTopProducts({ limit: 5 });

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const formatPercent = (val: number) => {
    const isPositive = val >= 0;
    return (
      <span className={`flex items-center text-xs font-medium ${isPositive ? 'text-primary' : 'text-destructive'}`}>
        {isPositive ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
        {Math.abs(val)}%
      </span>
    );
  };

  const chartData = useMemo(() => {
    if (!revenueData) return [];
    return revenueData.map(d => ({
      ...d,
      dateFormatted: format(new Date(d.date), 'MMM dd')
    }));
  }, [revenueData]);

  if (statsLoading || ordersLoading || revenueLoading || statusLoading || productsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[120px] w-full rounded-xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-7">
          <Skeleton className="col-span-4 h-[400px] rounded-xl" />
          <Skeleton className="col-span-3 h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <div className="mt-1 flex items-center">
              {formatPercent(stats?.revenueGrowth || 0)}
              <span className="text-xs text-muted-foreground ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
            <div className="mt-1 flex items-center">
              {formatPercent(stats?.ordersGrowth || 0)}
              <span className="text-xs text-muted-foreground ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
            <div className="mt-1 flex items-center">
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{stats?.activeProducts || 0}</span> active products
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
            <div className="mt-1 flex items-center">
              <span className="text-xs text-muted-foreground">All time</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {/* Revenue Chart */}
        <Card className="col-span-7 lg:col-span-4">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Daily revenue for the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="dateFormatted" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Order Status Breakdown */}
        <Card className="col-span-7 lg:col-span-3">
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
            <CardDescription>Distribution of active orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex items-center justify-center">
              {statusData && statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="status"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || "hsl(var(--muted))"} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number, name: string) => [value, name.replace('_', ' ').charAt(0).toUpperCase() + name.replace('_', ' ').slice(1)]}
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <ShoppingBag className="h-10 w-10 mb-2 opacity-20" />
                  <p>No order data available</p>
                </div>
              )}
            </div>
            {/* Status Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {statusData?.map((item) => (
                <div key={item.status} className="flex items-center gap-1.5 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[item.status] || "hsl(var(--muted))" }} />
                  <span className="capitalize text-muted-foreground">{item.status.replace('_', ' ')}</span>
                  <span className="font-medium">({item.count})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest transactions in your store</CardDescription>
            </div>
            <Link href="/orders">
              <span className="text-sm text-primary hover:underline cursor-pointer">View all</span>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders?.map(order => (
                <div key={order.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <Link href={`/orders/${order.id}`}>
                      <span className="text-sm font-medium hover:underline cursor-pointer">{order.orderNumber}</span>
                    </Link>
                    <p className="text-xs text-muted-foreground">{order.customerName || "Guest"}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="capitalize">
                      {order.status.replace('_', ' ')}
                    </Badge>
                    <div className="font-medium text-sm">{formatCurrency(order.total)}</div>
                  </div>
                </div>
              ))}
              {(!recentOrders || recentOrders.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent orders found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Top Products</CardTitle>
              <CardDescription>Best selling items by volume</CardDescription>
            </div>
            <Link href="/products">
              <span className="text-sm text-primary hover:underline cursor-pointer">View all</span>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts?.map(product => (
                <div key={product.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground opacity-50" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Link href={`/products/${product.id}`}>
                        <span className="text-sm font-medium hover:underline cursor-pointer line-clamp-1">{product.name}</span>
                      </Link>
                      <p className="text-xs text-muted-foreground">{product.totalSold} sold</p>
                    </div>
                  </div>
                  <div className="font-medium text-sm">{formatCurrency(product.totalRevenue)}</div>
                </div>
              ))}
              {(!topProducts || topProducts.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No product data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}