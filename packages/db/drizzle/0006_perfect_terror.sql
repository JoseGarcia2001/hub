CREATE TABLE "crypto_price_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"asset" text NOT NULL,
	"last_price" double precision NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crypto_price_check_user_asset_uq" UNIQUE("user_id","asset")
);
--> statement-breakpoint
CREATE TABLE "investment_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"week" text NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"markdown" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investment_report_user_week_uq" UNIQUE("user_id","week")
);
--> statement-breakpoint
ALTER TABLE "crypto_price_check" ADD CONSTRAINT "crypto_price_check_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_report" ADD CONSTRAINT "investment_report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investment_report_user_generated_idx" ON "investment_report" USING btree ("user_id","generated_at");