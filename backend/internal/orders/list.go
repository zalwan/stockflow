package orders

import (
	"context"
	"strconv"
	"strings"

	"stockflow/internal/apperror"
	"stockflow/internal/inventory"

	"github.com/jackc/pgx/v5"
)

const orderFilter = ` WHERE ($1='' OR strpos(lower(o.customer),lower($1))>0 OR o.id=$2) AND ($3='' OR o.status=$3)`

// List reads rows and their filtered count from the same database snapshot.
func (s *Service) List(ctx context.Context, params ListParams) (OrderPage, error) {
	result := OrderPage{Data: []OrderListItem{}, Page: params.Page, Limit: params.Limit}
	if params.Page < 1 || int64(params.Page) > inventory.MaxInt || params.Limit < 1 || params.Limit > 100 {
		return result, apperror.Invalid("Page harus positif dan limit antara 1–100.")
	}
	if params.Status != "" && params.Status != "CREATED" && params.Status != "CANCELLED" {
		return result, apperror.Invalid("Status harus CREATED atau CANCELLED.")
	}
	search := strings.TrimSpace(params.Search)
	var orderID int64
	candidate := strings.TrimPrefix(search, "#")
	digits := candidate != ""
	for _, char := range candidate {
		if char < '0' || char > '9' {
			digits = false
			break
		}
	}
	if digits {
		if parsed, err := strconv.ParseInt(candidate, 10, 64); err == nil && parsed > 0 && parsed <= inventory.MaxInt {
			orderID = parsed
		}
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return result, err
	}
	defer tx.Rollback(context.Background())
	if err = tx.QueryRow(ctx, "SELECT count(*) FROM sales_orders o"+orderFilter, search, orderID, params.Status).Scan(&result.Total); err != nil {
		return result, err
	}
	rows, err := tx.Query(ctx, `SELECT o.id,o.customer,o.status,o.total,o.created_at,o.cancelled_at,
  counts.item_count,counts.unit_count FROM sales_orders o
  LEFT JOIN LATERAL (SELECT count(*) AS item_count,COALESCE(sum(qty),0) AS unit_count FROM sales_order_items WHERE order_id=o.id) counts ON true`+orderFilter+` ORDER BY o.created_at DESC,o.id DESC LIMIT $4 OFFSET $5`, search, orderID, params.Status, params.Limit, int64(params.Page-1)*int64(params.Limit))
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var o OrderListItem
		if err = rows.Scan(&o.ID, &o.Customer, &o.Status, &o.Total, &o.CreatedAt, &o.CancelledAt, &o.ItemCount, &o.UnitCount); err != nil {
			return result, err
		}
		result.Data = append(result.Data, o)
	}
	if err = rows.Err(); err != nil {
		return result, err
	}
	rows.Close()
	return result, tx.Commit(ctx)
}
