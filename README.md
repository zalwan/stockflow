# StockFlow

Inventory and sales for a small warehouse. React + TypeScript (Vite), Go, and PostgreSQL. Stock changes, sales, and cancellations use real database transactions; the frontend calls the Go API.

## How it works

1. **Manage inventory.** Create products with a unique SKU, name, price, and active status. New products start with zero stock. Search by SKU/name and filter active, inactive, or low-stock products.
2. **Adjust stock.** Record incoming or outgoing quantities with an optional note. The stock balance and movement history are saved together. An outgoing quantity above the available stock is rejected and shown in the UI.
3. **Record sales.** Enter a customer name and select products and quantities. The backend reads current product prices, calculates the total, and deducts all items in one transaction. If any item fails validation or has insufficient stock, the entire order is rejected.
4. **Track purchases.** The order list shows customers, dates, item counts, totals, and statuses. Search by customer or order number, then open an order to view its saved unit prices and quantities. Customer names are free text rather than customer accounts.
5. **Cancel orders.** Confirm cancellation from the order detail. Stock is restored and incoming movements are recorded in the same transaction as the status change. Cancelled orders remain visible and cannot be cancelled again.

The React UI sends requests through a shared API client to the Go backend, which validates them and stores data in PostgreSQL. Inventory, order lists, movement history, and summary cards refresh after the relevant changes. Summary cards cover the entire inventory, independently of table filters and pagination.

## Run

Requirements: Docker Engine/Desktop with Docker Compose v2+, available ports 5173 and 8080. Go and Node are not needed for the container setup. Run the following commands from the repository root (the directory containing `docker-compose.yml`).

```sh
cp .env.example .env # optional: change the local ports here
docker compose up --build -d
docker compose ps
```

Open http://localhost:5173. API health: http://localhost:8080/healthz. On a fresh volume, startup applies schema migrations and seeds **14 products and 2 sample orders**. Wait for backend and frontend to become healthy. First startup time depends on image/package download speed; subsequent builds reuse the cache.

Seed order pages: http://localhost:5173/orders/1 and http://localhost:5173/orders/2. The **Order penjualan** page at `/orders` lists customer purchases, supports customer/order-number search and status filters, and opens each order detail. The detail URL can be bookmarked and reloaded. Customer names are entered text, not verified accounts; orders with the same customer name remain separate.

```sh
docker compose logs backend migrate frontend
docker compose down # keep your database volume
```

**Reset deletes local data permanently.** Only use this when you intend to discard this project's inventory and orders:

```sh
docker compose down --volumes
docker compose up --build -d
```

Ports bind to 127.0.0.1. Database ports are not published. Credentials in Compose are for local development only. Authentication and production deployment are outside this exercise's scope.

## Development

Start the database, migration, and backend in containers:

```sh
docker compose up -d --build backend
```

In another terminal, with Node 22.12+ and npm:

```sh
cd frontend
npm ci
npm run dev
```

Stop the Compose frontend first if it occupies port 5173: `docker compose stop frontend`. Vite proxies `/api` to `http://127.0.0.1:8080`; set `API_PROXY_TARGET` if the API port differs. The production frontend uses an Nginx reverse proxy instead. Both use the same browser origin, without permissive CORS.

From `backend/`, the service can also run on Go 1.25+ using `DATABASE_URL` and optionally `PORT`; `go run ./cmd/migrate` applies embedded migrations and `go run ./cmd/api` starts the API. The default Compose DB is private to its network; use the container workflow or provide a separately managed PostgreSQL URL for host development.

## Tests and checks

From the repository root:

```sh
docker compose --profile test run --rm backend-test
# runs go test -race ./... against a separate PostgreSQL service

docker compose --profile test run --rm backend-test go vet ./...

cd frontend
npm ci
npm test
npm run build
npm run lint
```

Backend tests require `TEST_DATABASE_URL`; they never fall back to the development database. Each integration fixture creates an isolated schema. The test service has a separate, temporary PostgreSQL data directory. Do not point TEST_DATABASE_URL at any database containing valuable data.

Tests cover adjustment rollback/success, all-or-nothing multi-item orders, invalid items, server prices, historical prices, overflow, 20 simultaneous orders against stock 10, reversed item ordering, concurrent/repeated cancellations, product deletion racing adjustment, filtering/pagination/global summary, and HTTP envelopes. `-race` checks Go memory races; the PostgreSQL concurrency assertions independently prove stock behavior.

Frontend tests cover form validation, pagination reset, rupiah formatting, error-envelope parsing, visible insufficient-stock errors including available=0, order-list search/debounce, and list refresh after order creation/cancellation. The latest full check passed 15 backend tests with `-race` and 38 frontend tests, plus `go vet`, the production build, and lint.

Manual checks: search a nonexistent term for empty state; reload for loading state; stop the API temporarily for error state, restart it, then use **Coba lagi**. Create a product, receive stock, place an order, cancel it, and return to inventory to verify restored stock and refreshed summary.

## API examples

Examples use the seeded product ID 1 and SKU KRT-A4-80. Commands mutate local data. Set the ID returned from create when working with your own product. `price` is a required integer amount in rupiah; `is_active` defaults to true when omitted.

```sh
curl 'http://localhost:8080/api/products?search=kertas&page=1&limit=20&filter=all'

curl -X POST http://localhost:8080/api/products \
  -H 'Content-Type: application/json' \
  -d '{"sku":"PPR-A3-01","name":"Kertas A3","price":95000,"is_active":true}'

curl -X PUT http://localhost:8080/api/products/1 \
  -H 'Content-Type: application/json' \
  -d '{"sku":"KRT-A4-80","name":"Kertas A4 80 gsm","price":65000,"is_active":true}'

curl -X POST http://localhost:8080/api/products/1/stock \
  -H 'Content-Type: application/json' \
  -d '{"type":"in","qty":5,"note":"Penerimaan dari pemasok"}'

curl http://localhost:8080/api/products/1/movements

# History-bearing products return 409 PRODUCT_HAS_HISTORY, never erase history.
curl -i -X DELETE http://localhost:8080/api/products/1

curl -X POST http://localhost:8080/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customer":"Toko Contoh","items":[{"sku":"KRT-A4-80","qty":2}]}'

curl 'http://localhost:8080/api/orders?search=ruang&status=CREATED&page=1&limit=10'

curl http://localhost:8080/api/orders/1
curl -X POST http://localhost:8080/api/orders/1/cancel
curl http://localhost:8080/api/products/summary
```

List responses are `{data,page,limit,total}`; movement responses are `{data}`. Errors use `{ "error": { "code": "...", "message": "..." } }`. Stock conflicts additionally include `available`, and order stock conflicts include `sku`. An available quantity of zero is always present in the JSON and UI.

Create product/order returns 201; delete returns 204 without a body. Invalid requests return 400, missing resources 404, and conflicts 409. Cancellation returns the updated order with status 200; repeating cancellation returns 409. Unknown JSON fields, fractional integer fields, multiple JSON values, and bodies above 1 MiB are rejected.

## Decisions

- **Explicit row locks:** updates, deletions, and stock adjustments lock the existing product row. Orders lock all involved products by ascending immutable ID, validate everything, then write order/items/stock/movements in a single transaction. A rollback leaves no business rows changed; database sequences may have gaps.
- **Cancellation:** lock the order first, reject CANCELLED, then lock its products in the same product order. Stock restoration, incoming movements, and the status change commit together. No stock is restored twice.
- **Prices:** unit prices come from locked product rows; stored order item prices survive later price edits. Price, quantity, stock, and total fit PostgreSQL INTEGER (maximum 2,147,483,647). Arithmetic uses int64; values exceeding column bounds are rejected. Cancellation that would overflow stock returns a conflict without changing anything.
- **Movement history:** receipts and adjustments create movement rows; each sale creates an outgoing movement per item, each cancellation an incoming movement. Seed balances follow the same accounting. Initial stock for a newly created product is zero; use an adjustment to receive stock.
- **Last movement:** calculated as max(created_at) from movements, backed by a product/time index. There is no duplicated timestamp to keep in sync.
- **Global filters:** optional `filter=all|active|inactive|low-stock` is applied before pagination. Search matches literal SKU/name substrings case-insensitively. Low stock means stock <=10, including inactive products. Page defaults to1; limit defaults to20, maximum100; order by ID is stable.
- **Global summary:** additional GET `/api/products/summary` returns totals over all products, independently of search/page/filter. Stock value includes inactive inventory. `total_stock_value` is an exact decimal string, formatted with BigInt in the UI, so warehouse-wide aggregates cannot overflow int64 or lose JavaScript number precision. The frontend refreshes products, movements, and summary after mutations; cancellation also refreshes order detail.
- **SKU edits:** changing an SKU referenced by an order returns 409 SKU_HAS_HISTORY. Other fields remain editable. Products with history can be deactivated instead of deleted. Inactive products may still be sold because the assignment does not forbid it.
- **Order history:** additional GET `/api/orders` accepts search/status/page/limit. Search is a literal case-insensitive customer substring or an exact positive order ID (also `#0003`); oversized numbers remain text searches. Status is CREATED/CANCELLED or empty for all. Default page1/limit10, maximum100. Results sort by created_at descending then ID descending; item_count means product types and unit_count means total quantity. Filtered count and rows use one readonly repeatable-read snapshot. Create/cancel refresh the list as well as inventory.
- **Frontend:** one typed API module owns fetch and URL creation. Server totals are displayed after create; the browser never submits prices. Mutations are not automatically retried or optimistically applied. Item selection searches/pages through server products, including beyond the first page.
- **Migrations:** embedded, versioned SQL with an advisory lock. Seed is a versioned development migration; restarting with an existing volume does not duplicate data. No final UI mock data.
