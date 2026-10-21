package inventory

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"stockflow/internal/apperror"
)

type Service struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Service              { return &Service{pool: pool} }
func (s *Service) Ready(ctx context.Context) error { return s.pool.Ping(ctx) }
func validateProduct(in *ProductInput) error {
	in.SKU = strings.TrimSpace(in.SKU)
	in.Name = strings.TrimSpace(in.Name)
	if in.SKU == "" || in.Name == "" {
		return apperror.Invalid("SKU dan nama produk wajib diisi.")
	}
	if len(in.SKU) > 100 || len(in.Name) > 250 {
		return apperror.Invalid("SKU maksimal 100 dan nama maksimal 250 karakter.")
	}
	if in.Price < 0 || in.Price > MaxInt {
		return apperror.Invalid("Harga harus berupa integer antara 0 dan 2147483647.")
	}
	return nil
}
func (s *Service) List(ctx context.Context, p ListParams) (ProductPage, error) {
	result := ProductPage{Data: []Product{}, Page: p.Page, Limit: p.Limit}
	if p.Page < 1 || p.Limit < 1 || p.Limit > 100 || int64(p.Page) > MaxInt {
		return result, apperror.Invalid("Page harus positif dan limit antara 1–100.")
	}
	switch p.Filter {
	case "all", "active", "inactive", "low-stock":
	default:
		return result, apperror.Invalid("Filter produk tidak dikenal.")
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return result, err
	}
	defer tx.Rollback(context.Background())
	if err = tx.QueryRow(ctx, "SELECT count(*) FROM products p"+filterWhere, p.Search, p.Filter).Scan(&result.Total); err != nil {
		return result, err
	}
	rows, err := tx.Query(ctx, "SELECT "+productColumns+" FROM products p"+filterWhere+" ORDER BY p.id LIMIT $3 OFFSET $4", p.Search, p.Filter, p.Limit, int64(p.Page-1)*int64(p.Limit))
	if err != nil {
		return result, err
	}
	for rows.Next() {
		product, e := scanProduct(rows)
		if e != nil {
			rows.Close()
			return result, e
		}
		result.Data = append(result.Data, product)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}
func (s *Service) Summary(ctx context.Context) (Summary, error) {
	var r Summary
	err := s.pool.QueryRow(ctx, `SELECT count(*),count(*) FILTER(WHERE is_active),COALESCE(sum(price::bigint*stock),0)::text,count(*) FILTER(WHERE stock<=10) FROM products`).Scan(&r.TotalProducts, &r.ActiveProducts, &r.TotalStockValue, &r.LowStockCount)
	return r, err
}
func (s *Service) Create(ctx context.Context, in ProductInput) (Product, error) {
	if err := validateProduct(&in); err != nil {
		return Product{}, err
	}
	var id int64
	err := s.pool.QueryRow(ctx, "INSERT INTO products(sku,name,price,is_active) VALUES($1,$2,$3,$4) RETURNING id", in.SKU, in.Name, in.Price, in.IsActive).Scan(&id)
	if err != nil {
		return Product{}, apperror.FromDB(err)
	}
	return scanProduct(s.pool.QueryRow(ctx, "SELECT "+productColumns+" FROM products p WHERE p.id=$1", id))
}
func (s *Service) Update(ctx context.Context, id int64, in ProductInput) (Product, error) {
	if err := validateProduct(&in); err != nil {
		return Product{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Product{}, err
	}
	defer tx.Rollback(context.Background())
	p, err := lockedProduct(ctx, tx, id)
	if err != nil {
		return Product{}, err
	}
	if p.SKU != in.SKU {
		var used bool
		err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM sales_order_items WHERE sku=$1)", p.SKU).Scan(&used)
		if err != nil {
			return Product{}, err
		}
		if used {
			return Product{}, apperror.New(409, "SKU_HAS_HISTORY", "SKU yang sudah dipakai order tidak dapat diubah.")
		}
	}
	if _, err = tx.Exec(ctx, "UPDATE products SET sku=$2,name=$3,price=$4,is_active=$5 WHERE id=$1", id, in.SKU, in.Name, in.Price, in.IsActive); err != nil {
		return Product{}, apperror.FromDB(err)
	}
	p.SKU = in.SKU
	p.Name = in.Name
	p.Price = in.Price
	p.IsActive = in.IsActive
	return p, tx.Commit(ctx)
}
func (s *Service) Delete(ctx context.Context, id int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	if _, err = lockedProduct(ctx, tx, id); err != nil {
		return err
	}
	var history bool
	if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM stock_movements WHERE product_id=$1)", id).Scan(&history); err != nil {
		return err
	}
	if history {
		return apperror.New(409, "PRODUCT_HAS_HISTORY", "Produk dengan riwayat stok tidak dapat dihapus.")
	}
	if _, err = tx.Exec(ctx, "DELETE FROM products WHERE id=$1", id); err != nil {
		return apperror.FromDB(err)
	}
	return tx.Commit(ctx)
}
func (s *Service) Adjust(ctx context.Context, id int64, in StockInput) (Product, error) {
	if (in.Type != "in" && in.Type != "out") || in.Qty <= 0 || in.Qty > MaxInt {
		return Product{}, apperror.Invalid("Arah harus in/out dan qty berupa integer positif maksimal 2147483647.")
	}
	if len(in.Note) > 2000 {
		return Product{}, apperror.Invalid("Catatan maksimal 2000 karakter.")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Product{}, err
	}
	defer tx.Rollback(context.Background())
	p, err := lockedProduct(ctx, tx, id)
	if err != nil {
		return Product{}, err
	}
	next := p.Stock + in.Qty
	if in.Type == "out" {
		if in.Qty > p.Stock {
			return Product{}, apperror.Insufficient("", p.Stock)
		}
		next = p.Stock - in.Qty
	}
	if next > MaxInt {
		return Product{}, apperror.Invalid("Jumlah stok melampaui batas integer.")
	}
	if _, err = tx.Exec(ctx, "UPDATE products SET stock=$2 WHERE id=$1", id, next); err != nil {
		return Product{}, err
	}
	var at = p.CreatedAt
	if err = tx.QueryRow(ctx, "INSERT INTO stock_movements(product_id,type,qty,note) VALUES($1,$2,$3,$4) RETURNING created_at", id, in.Type, in.Qty, in.Note).Scan(&at); err != nil {
		return Product{}, err
	}
	p.Stock = next
	p.LastMovementAt = &at
	return p, tx.Commit(ctx)
}
func (s *Service) Movements(ctx context.Context, id int64) ([]Movement, error) {
	result := []Movement{}
	var exists bool
	if err := s.pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM products WHERE id=$1)", id).Scan(&exists); err != nil {
		return result, err
	}
	if !exists {
		return result, apperror.Missing()
	}
	rows, err := s.pool.Query(ctx, "SELECT id,product_id,type,qty,COALESCE(note,''),created_at FROM stock_movements WHERE product_id=$1 ORDER BY created_at DESC,id DESC", id)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var m Movement
		if err = rows.Scan(&m.ID, &m.ProductID, &m.Type, &m.Qty, &m.Note, &m.CreatedAt); err != nil {
			return result, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}
