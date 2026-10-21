package orders

import "time"

type ItemInput struct {
	SKU string `json:"sku"`
	Qty int64  `json:"qty"`
}
type CreateInput struct {
	Customer string      `json:"customer"`
	Items    []ItemInput `json:"items"`
}
type OrderItem struct {
	ID        int64  `json:"id"`
	SKU       string `json:"sku"`
	Qty       int64  `json:"qty"`
	UnitPrice int64  `json:"unit_price"`
}
type Order struct {
	ID          int64       `json:"id"`
	Customer    string      `json:"customer"`
	Status      string      `json:"status"`
	Total       int64       `json:"total"`
	CreatedAt   time.Time   `json:"created_at"`
	CancelledAt *time.Time  `json:"cancelled_at"`
	Items       []OrderItem `json:"items"`
}

type ListParams struct {
	Search string
	Status string
	Page   int
	Limit  int
}
type OrderListItem struct {
	ID          int64      `json:"id"`
	Customer    string     `json:"customer"`
	Status      string     `json:"status"`
	Total       int64      `json:"total"`
	CreatedAt   time.Time  `json:"created_at"`
	CancelledAt *time.Time `json:"cancelled_at"`
	ItemCount   int64      `json:"item_count"`
	UnitCount   int64      `json:"unit_count"`
}
type OrderPage struct {
	Data  []OrderListItem `json:"data"`
	Page  int             `json:"page"`
	Limit int             `json:"limit"`
	Total int64           `json:"total"`
}
