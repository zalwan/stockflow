export interface Product {
  id: number;
  sku: string;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
  created_at: string;
  last_movement_at: string | null;
}
export interface ProductInput {
  sku: string;
  name: string;
  price: number;
  is_active: boolean;
}
export interface StockInput {
  type: "in" | "out";
  qty: number;
  note: string;
}
export interface ProductParams {
  search: string;
  page: number;
  limit: number;
  filter: string;
}
export interface ProductPage {
  data: Product[];
  page: number;
  limit: number;
  total: number;
}
export interface Summary {
  total_products: number;
  active_products: number;
  total_stock_value: string;
  low_stock_count: number;
}
export interface Movement {
  id: number;
  product_id: number;
  type: "in" | "out";
  qty: number;
  note: string;
  created_at: string;
}
export interface CreateOrderInput {
  customer: string;
  items: { sku: string; qty: number }[];
}
export interface OrderItem {
  id: number;
  sku: string;
  qty: number;
  unit_price: number;
}
export interface Order {
  id: number;
  customer: string;
  status: "CREATED" | "CANCELLED";
  total: number;
  created_at: string;
  cancelled_at: string | null;
  items: OrderItem[];
}
export interface ErrorBody {
  code: string;
  message: string;
  sku?: string;
  available?: number;
  fields?: Record<string, string>;
}
export interface OrderListItem {
  id: number;
  customer: string;
  status: Order["status"];
  total: number;
  created_at: string;
  cancelled_at: string | null;
  item_count: number;
  unit_count: number;
}
export interface OrderPage {
  data: OrderListItem[];
  page: number;
  limit: number;
  total: number;
}
export interface OrderListParams {
  search: string;
  status: "" | "CREATED" | "CANCELLED";
  page: number;
  limit: number;
}

export interface DailySales {
  date: string;
  time_zone: "Asia/Jakarta";
  order_count: number;
  units_sold: number;
  total_sales: string;
}
