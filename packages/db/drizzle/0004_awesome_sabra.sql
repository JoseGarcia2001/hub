CREATE TABLE "caja_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"keyword" text NOT NULL,
	"flujo" text NOT NULL,
	"categoria" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caja_tx" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"msg_id" text NOT NULL,
	"fuente" text NOT NULL,
	"tipo" text NOT NULL,
	"flujo" text NOT NULL,
	"categoria" text NOT NULL,
	"monto" bigint NOT NULL,
	"comercio" text,
	"metodo" text,
	"ref" text,
	"fecha" date NOT NULL,
	"hora" text,
	"raw_subject" text,
	"flujo_manual" text,
	"categoria_manual" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "caja_rule" ADD CONSTRAINT "caja_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caja_tx" ADD CONSTRAINT "caja_tx_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "caja_rule_user_kw_idx" ON "caja_rule" USING btree ("user_id","keyword");--> statement-breakpoint
CREATE UNIQUE INDEX "caja_tx_user_msg_idx" ON "caja_tx" USING btree ("user_id","msg_id");--> statement-breakpoint
CREATE INDEX "caja_tx_user_fecha_idx" ON "caja_tx" USING btree ("user_id","fecha");