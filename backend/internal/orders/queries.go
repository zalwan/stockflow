package orders

import (
	"context"

	"github.com/jackc/pgx/v5"

	"stockflow/internal/apperror"
)

type locked struct {
	ID, Price, Stock int64
	SKU              string
}

func lockProducts(ctx context.Context, tx pgx.Tx, skus []string) (map[string]locked, error) {
	rows, err := tx.Query(ctx, "SELECT id,sku,price,stock FROM products WHERE sku=ANY($1) ORDER BY id FOR UPDATE", skus)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]locked, len(skus))
	for rows.Next() {
		var p locked
		if err = rows.Scan(&p.ID, &p.SKU, &p.Price, &p.Stock); err != nil {
			return nil, err
		}
		result[p.SKU] = p
	}
	return result, rows.Err()
}
func readOrder(ctx context.Context, tx pgx.Tx, id int64, lock bool) (Order, error) {
	o := Order{Items: []OrderItem{}}
	query := "SELECT id,customer,status,total,created_at,cancelled_at FROM sales_orders WHERE id=$1"
	if lock {
		query += " FOR UPDATE"
	}
	if err := tx.QueryRow(ctx, query, id).Scan(&o.ID, &o.Customer, &o.Status, &o.Total, &o.CreatedAt, &o.CancelledAt); err != nil {
		return o, apperror.FromDB(err)
	}
	rows, err := tx.Query(ctx, "SELECT id,sku,qty,unit_price FROM sales_order_items WHERE order_id=$1 ORDER BY id", id)
	if err != nil {
		return o, err
	}
	defer rows.Close()
	for rows.Next() {
		var item OrderItem
		if err = rows.Scan(&item.ID, &item.SKU, &item.Qty, &item.UnitPrice); err != nil {
			return o, err
		}
		o.Items = append(o.Items, item)
	}
	return o, rows.Err()
}
