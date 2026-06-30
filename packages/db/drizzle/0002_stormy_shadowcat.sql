CREATE TABLE "portfolio_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"net_liquidation" double precision NOT NULL,
	"cash" double precision NOT NULL,
	"positions_value" double precision NOT NULL,
	"unrealized_pnl" double precision NOT NULL,
	"unrealized_pnl_pct" double precision NOT NULL,
	"positions" jsonb NOT NULL,
	"source" text NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_snapshot" ADD CONSTRAINT "portfolio_snapshot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portfolio_snapshot_user_asof_idx" ON "portfolio_snapshot" USING btree ("user_id","as_of");