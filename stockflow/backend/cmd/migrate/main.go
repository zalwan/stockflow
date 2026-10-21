package main

import (
	"context"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"

	"stockflow/internal/database"
)

func main() {
	ctx := context.Background()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		log.Fatal("DATABASE_URL required")
	}
	p, e := pgxpool.New(ctx, url)
	if e != nil {
		log.Fatal(e)
	}
	defer p.Close()
	if e = database.Run(ctx, p); e != nil {
		log.Fatal(e)
	}
	log.Print("migrations applied")
}
