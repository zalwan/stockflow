package orders

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"stockflow/internal/apperror"
	"stockflow/internal/inventory"
)

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }
func (s *Service) Create(ctx context.Context, in CreateInput) (Order, error) {
	return s.CreateWithKey(ctx, in, "")
}
func (s *Service) CreateWithKey(ctx context.Context, in CreateInput, key string) (Order, error) {
	if err := validateKey(key); err != nil {
		return Order{}, err
	}
	// Do not mutate the caller's slice, which may be shared by concurrent retries.
	in.Items = append([]ItemInput(nil), in.Items...)

	in.Customer = strings.TrimSpace(in.Customer)
	if in.Customer == "" || len(in.Customer) > 250 {
		return Order{}, apperror.Invalid("Nama pelanggan wajib diisi, maksimal 250 karakter.")
	}
	if len(in.Items) == 0 || len(in.Items) > 100 {
		return Order{}, apperror.Invalid("Order harus berisi 1–100 item.")
	}
	seen := map[string]bool{}
	skus := make([]string, 0, len(in.Items))
	for i := range in.Items {
		item := &in.Items[i]
		item.SKU = strings.TrimSpace(item.SKU)
		if item.SKU == "" || len(item.SKU) > 100 || item.Qty <= 0 || item.Qty > inventory.MaxInt {
			return Order{}, apperror.Invalid("Setiap item membutuhkan SKU dan qty integer positif maksimal 2147483647.")
		}
		if seen[item.SKU] {
			return Order{}, apperror.Invalid("SKU duplikat dalam satu order: " + item.SKU)
		}
		seen[item.SKU] = true
		skus = append(skus, item.SKU)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Order{}, err
	}
	defer tx.Rollback(context.Background())
	hash := ""
	if key != "" {
		hash = requestHash(in)
		order, found, e := replayRequest(ctx, tx, key, hash)
		if e != nil {
			return Order{}, e
		}
		if found {
			return order, tx.Commit(ctx)
		}
	}
	products, err := lockProducts(ctx, tx, skus)
	if err != nil {
		return Order{}, err
	}
	// Complete all validation before writing any order, stock, or movement row.
	for _, item := range in.Items {
		if _, ok := products[item.SKU]; !ok {
			return Order{}, apperror.Invalid("SKU tidak dikenal: " + item.SKU)
		}
	}
	var total int64
	for _, item := range in.Items {
		p := products[item.SKU]
		if item.Qty > p.Stock {
			return Order{}, apperror.Insufficient(item.SKU, p.Stock)
		}
		subtotal := p.Price * item.Qty // Both inputs are <= MaxInt; multiplication fits int64.
		if subtotal > inventory.MaxInt || total > inventory.MaxInt-subtotal {
			return Order{}, apperror.Invalid("Total order melebihi batas 2147483647 rupiah.")
		}
		total += subtotal
	}
	var id int64
	if err = tx.QueryRow(ctx, "INSERT INTO sales_orders(customer,total) VALUES($1,$2) RETURNING id", in.Customer, total).Scan(&id); err != nil {
		return Order{}, err
	}
	for _, item := range in.Items {
		p := products[item.SKU]
		if _, err = tx.Exec(ctx, "INSERT INTO sales_order_items(order_id,sku,qty,unit_price) VALUES($1,$2,$3,$4)", id, item.SKU, item.Qty, p.Price); err != nil {
			return Order{}, err
		}
		if _, err = tx.Exec(ctx, "UPDATE products SET stock=stock-$2 WHERE id=$1", p.ID, item.Qty); err != nil {
			return Order{}, err
		}
		if _, err = tx.Exec(ctx, "INSERT INTO stock_movements(product_id,type,qty,note) VALUES($1,'out',$2,$3)", p.ID, item.Qty, fmt.Sprintf("Order #%d", id)); err != nil {
			return Order{}, err
		}
	}
	o, err := readOrder(ctx, tx, id, false)
	if err != nil {
		return o, err
	}
	if key != "" {
		if err = saveRequest(ctx, tx, key, hash, o); err != nil {
			return Order{}, err
		}
	}
	return o, tx.Commit(ctx)
}
func (s *Service) Get(ctx context.Context, id int64) (Order, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return Order{}, err
	}
	defer tx.Rollback(context.Background())
	o, err := readOrder(ctx, tx, id, false)
	if err != nil {
		return o, err
	}
	return o, tx.Commit(ctx)
}
func (s *Service) Cancel(ctx context.Context, id int64) (Order, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Order{}, err
	}
	defer tx.Rollback(context.Background())
	o, err := readOrder(ctx, tx, id, true)
	if err != nil {
		return o, err
	}
	if o.Status != "CREATED" {
		return Order{}, apperror.New(409, "ORDER_ALREADY_CANCELLED", "Order sudah dibatalkan.")
	}
	skus := make([]string, 0, len(o.Items))
	for _, item := range o.Items {
		skus = append(skus, item.SKU)
	}
	products, err := lockProducts(ctx, tx, skus)
	if err != nil {
		return Order{}, err
	}
	for _, item := range o.Items {
		p, ok := products[item.SKU]
		if !ok {
			return Order{}, fmt.Errorf("order %d references a missing product", id)
		}
		if p.Stock > inventory.MaxInt-item.Qty {
			return Order{}, apperror.New(409, "STOCK_LIMIT_EXCEEDED", "Pembatalan akan melampaui batas stok. Kurangi stok terlebih dahulu.")
		}
	}
	for _, item := range o.Items {
		p := products[item.SKU]
		if _, err = tx.Exec(ctx, "UPDATE products SET stock=stock+$2 WHERE id=$1", p.ID, item.Qty); err != nil {
			return Order{}, err
		}
		if _, err = tx.Exec(ctx, "INSERT INTO stock_movements(product_id,type,qty,note) VALUES($1,'in',$2,$3)", p.ID, item.Qty, fmt.Sprintf("Pembatalan order #%d", id)); err != nil {
			return Order{}, err
		}
	}
	if _, err = tx.Exec(ctx, "UPDATE sales_orders SET status='CANCELLED',cancelled_at=now() WHERE id=$1", id); err != nil {
		return Order{}, err
	}
	o, err = readOrder(ctx, tx, id, false)
	if err != nil {
		return o, err
	}
	return o, tx.Commit(ctx)
}
