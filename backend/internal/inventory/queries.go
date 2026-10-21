package inventory

import (
	"context"

	"github.com/jackc/pgx/v5"

	"stockflow/internal/apperror"
)

const productColumns = `p.id,p.sku,p.name,p.price,p.stock,p.is_active,p.created_at,(SELECT max(created_at) FROM stock_movements WHERE product_id=p.id)`

func scanProduct(row pgx.Row) (Product, error) {
	var p Product
	err := row.Scan(&p.ID, &p.SKU, &p.Name, &p.Price, &p.Stock, &p.IsActive, &p.CreatedAt, &p.LastMovementAt)
	return p, apperror.FromDB(err)
}
func lockedProduct(ctx context.Context, tx pgx.Tx, id int64) (Product, error) {
	return scanProduct(tx.QueryRow(ctx, "SELECT "+productColumns+" FROM products p WHERE p.id=$1 FOR UPDATE OF p", id))
}

const filterWhere = ` WHERE (strpos(lower(p.sku),lower($1))>0 OR strpos(lower(p.name),lower($1))>0) AND ($2='all' OR ($2='active' AND p.is_active) OR ($2='inactive' AND NOT p.is_active) OR ($2='low-stock' AND p.stock<=10))`
