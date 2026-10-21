package inventory

import "time"

const MaxInt int64 = 2147483647

type Product struct {
	ID             int64      `json:"id"`
	SKU            string     `json:"sku"`
	Name           string     `json:"name"`
	Price          int64      `json:"price"`
	Stock          int64      `json:"stock"`
	IsActive       bool       `json:"is_active"`
	CreatedAt      time.Time  `json:"created_at"`
	LastMovementAt *time.Time `json:"last_movement_at"`
}
type ProductInput struct {
	SKU      string `json:"sku"`
	Name     string `json:"name"`
	Price    int64  `json:"price"`
	IsActive bool   `json:"is_active"`
}
type StockInput struct {
	Type string `json:"type"`
	Qty  int64  `json:"qty"`
	Note string `json:"note"`
}
type ListParams struct {
	Search      string
	Page, Limit int
	Filter      string
}
type ProductPage struct {
	Data  []Product `json:"data"`
	Page  int       `json:"page"`
	Limit int       `json:"limit"`
	Total int64     `json:"total"`
}
type Summary struct {
	TotalProducts   int64  `json:"total_products"`
	ActiveProducts  int64  `json:"active_products"`
	TotalStockValue string `json:"total_stock_value"`
	LowStockCount   int64  `json:"low_stock_count"`
}
type Movement struct {
	ID        int64     `json:"id"`
	ProductID int64     `json:"product_id"`
	Type      string    `json:"type"`
	Qty       int64     `json:"qty"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}
