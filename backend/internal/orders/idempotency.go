package orders

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sort"

	"stockflow/internal/apperror"

	"github.com/jackc/pgx/v5"
)

func validateKey(key string) error {
	if key == "" {
		return nil
	}
	if len(key) > 128 {
		return apperror.Invalid("Idempotency-Key maksimal 128 karakter.")
	}
	for _, c := range key {
		if c < 33 || c > 126 {
			return apperror.Invalid("Idempotency-Key harus berisi karakter ASCII tanpa spasi.")
		}
	}
	return nil
}

func requestHash(in CreateInput) string {
	// Validation has already trimmed customer/SKUs and rejected duplicates.
	in.Items = append([]ItemInput(nil), in.Items...)
	sort.Slice(in.Items, func(i, j int) bool { return in.Items[i].SKU < in.Items[j].SKU })
	data, _ := json.Marshal(in)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

func replayRequest(ctx context.Context, tx pgx.Tx, key, hash string) (Order, bool, error) {
	// The transaction lock also serializes requests across API processes. Hash
	// collisions only serialize unrelated keys; records still use the full key.
	lock := sha256.Sum256([]byte("stockflow:create-order:" + key))
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock($1)", int64(binary.BigEndian.Uint64(lock[:8]))); err != nil {
		return Order{}, false, err
	}
	var storedHash string
	var response []byte
	err := tx.QueryRow(ctx, "SELECT request_hash,response FROM order_requests WHERE key=$1", key).Scan(&storedHash, &response)
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, false, nil
	}
	if err != nil {
		return Order{}, false, err
	}
	if storedHash != hash {
		return Order{}, false, apperror.New(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key sudah digunakan untuk isi order yang berbeda.")
	}
	var order Order
	if err = json.Unmarshal(response, &order); err != nil {
		return Order{}, false, err
	}
	return order, true, nil
}

func saveRequest(ctx context.Context, tx pgx.Tx, key, hash string, order Order) error {
	response, err := json.Marshal(order)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, "INSERT INTO order_requests(key,request_hash,order_id,response) VALUES($1,$2,$3,$4)", key, hash, order.ID, response)
	return err
}
