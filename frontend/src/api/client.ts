import type {
  Product,
  ProductInput,
  ProductPage,
  ProductParams,
  Summary,
  Movement,
  StockInput,
  CreateOrderInput,
  Order,
  ErrorBody,
  OrderListParams,
  OrderPage,
} from "./types";
export class ApiError extends Error {
  status: number;
  code: string;
  sku?: string;
  available?: number;
  fields?: Record<string, string>;
  constructor(status: number, body: ErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.sku = body.sku;
    this.available = body.available;
    this.fields = body.fields;
  }
}
function errorBody(value: unknown): ErrorBody | undefined {
  if (typeof value !== "object" || value === null || !("error" in value))
    return;
  const e = value.error;
  if (
    typeof e !== "object" ||
    e === null ||
    !("code" in e) ||
    typeof e.code !== "string" ||
    !("message" in e) ||
    typeof e.message !== "string"
  )
    return;
  return {
    fields:
      "fields" in e &&
      typeof e.fields === "object" &&
      e.fields !== null &&
      Object.values(e.fields).every((value) => typeof value === "string")
        ? (e.fields as Record<string, string>)
        : undefined,
    code: e.code,
    message: e.message,
    sku: "sku" in e && typeof e.sku === "string" ? e.sku : undefined,
    available:
      "available" in e && typeof e.available === "number"
        ? e.available
        : undefined,
  };
}
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, {
      code: "NETWORK_ERROR",
      message:
        "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.",
    });
  }
  if (response.status === 204) return undefined as T;
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(response.status, {
      code: "INVALID_RESPONSE",
      message: "Respons server tidak dapat dibaca. Silakan coba lagi.",
    });
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      errorBody(data) ?? {
        code: "REQUEST_FAILED",
        message: "Permintaan gagal. Silakan coba lagi.",
      },
    );
  return data as T;
}
export const api = {
  listOrders: (params: OrderListParams) =>
    request<OrderPage>(
      `/orders?${new URLSearchParams({ search: params.search, status: params.status, page: String(params.page), limit: String(params.limit) })}`,
    ),
  listProducts: (params: ProductParams) =>
    request<ProductPage>(
      `/products?${new URLSearchParams({ search: params.search, page: String(params.page), limit: String(params.limit), filter: params.filter })}`,
    ),
  summary: () => request<Summary>("/products/summary"),
  createProduct: (input: ProductInput) =>
    request<Product>("/products", "POST", input),
  updateProduct: (id: number, input: ProductInput) =>
    request<Product>(`/products/${id}`, "PUT", input),
  deleteProduct: (id: number) => request<void>(`/products/${id}`, "DELETE"),
  adjustStock: (id: number, input: StockInput) =>
    request<Product>(`/products/${id}/stock`, "POST", input),
  movements: (id: number) =>
    request<{ data: Movement[] }>(`/products/${id}/movements`),
  createOrder: (input: CreateOrderInput, key?: string) =>
    request<Order>(
      "/orders",
      "POST",
      input,
      key ? { "Idempotency-Key": key } : undefined,
    ),
  getOrder: (id: number) => request<Order>(`/orders/${id}`),
  cancelOrder: (id: number) => request<Order>(`/orders/${id}/cancel`, "POST"),
};
