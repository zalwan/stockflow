package database

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMigrationsAndSeed(t *testing.T) {
	ctx := context.Background()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Fatal("TEST_DATABASE_URL is required; never use a development database")
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err = Run(ctx, pool); err != nil {
		t.Fatal(err)
	}
	var products, orders, movements int
	if err = pool.QueryRow(ctx, "SELECT (SELECT count(*) FROM products),(SELECT count(*) FROM sales_orders),(SELECT count(*) FROM stock_movements)").Scan(&products, &orders, &movements); err != nil {
		t.Fatal(err)
	}
	if products < 12 || orders < 2 {
		t.Fatalf("seed too small: products=%d orders=%d", products, orders)
	}
	var inconsistent int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM products p WHERE stock <> COALESCE((SELECT sum(CASE WHEN type='in' THEN qty ELSE -qty END) FROM stock_movements WHERE product_id=p.id),0)`).Scan(&inconsistent); err != nil {
		t.Fatal(err)
	}
	if inconsistent != 0 {
		t.Fatal("seed stock differs from movement ledger")
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM sales_orders o WHERE total <> (SELECT sum(qty*unit_price) FROM sales_order_items WHERE order_id=o.id)`).Scan(&inconsistent); err != nil {
		t.Fatal(err)
	}
	if inconsistent != 0 {
		t.Fatal("seed totals differ from items")
	}
	if err = Run(ctx, pool); err != nil {
		t.Fatal(err)
	}
	var p2, o2, m2 int
	if err := pool.QueryRow(ctx, "SELECT (SELECT count(*) FROM products),(SELECT count(*) FROM sales_orders),(SELECT count(*) FROM stock_movements)").Scan(&p2, &o2, &m2); err != nil {
		t.Fatal(err)
	}
	if products != p2 || orders != o2 || movements != m2 {
		t.Fatal("migration rerun duplicated seed")
	}
}
