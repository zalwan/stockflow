package orders

import (
	"context"
	"time"

	"stockflow/internal/apperror"
)

type DailySales struct {
	Date       string `json:"date"`
	TimeZone   string `json:"time_zone"`
	OrderCount int64  `json:"order_count"`
	UnitsSold  int64  `json:"units_sold"`
	TotalSales string `json:"total_sales"`
}

func (s *Service) DailySales(ctx context.Context, date string) (DailySales, error) {
	// WIB is UTC+7 throughout the year; no container timezone database is needed.
	start, err := time.ParseInLocation("2006-01-02", date, time.FixedZone("WIB", 7*60*60))
	if err != nil || start.Year() < 1 {
		return DailySales{}, apperror.Invalid("Tanggal harus valid dalam format YYYY-MM-DD (WIB).")
	}
	report := DailySales{Date: date, TimeZone: "Asia/Jakarta"}
	err = s.pool.QueryRow(ctx, `SELECT count(*),COALESCE(sum(i.units),0)::bigint,COALESCE(sum(o.total::numeric),0)::text
 FROM sales_orders o
 LEFT JOIN LATERAL (SELECT sum(qty) AS units FROM sales_order_items WHERE order_id=o.id) i ON true
 WHERE o.status='CREATED' AND o.created_at >= $1 AND o.created_at < $2`, start, start.AddDate(0, 0, 1)).Scan(&report.OrderCount, &report.UnitsSold, &report.TotalSales)
	return report, err
}
