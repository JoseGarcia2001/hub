CREATE TABLE "obligacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"proveedor_key" text NOT NULL,
	"nombre" text NOT NULL,
	"proveedor" text NOT NULL,
	"categoria" text NOT NULL,
	"cadencia" text NOT NULL,
	"cuenta_contrato" text,
	"fuente_vencimiento" text NOT NULL,
	"match_strategy" text NOT NULL,
	"match_keywords" text[],
	"monto_esperado" bigint,
	"dia_vencimiento" integer,
	"mes_vencimiento" integer,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obligacion_instancia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"obligacion_id" uuid NOT NULL,
	"periodo" text NOT NULL,
	"monto_esperado" bigint NOT NULL,
	"fecha_emision" date,
	"fecha_vencimiento" date NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"caja_tx_id" uuid,
	"pagado_manual" boolean DEFAULT false NOT NULL,
	"factura_msg_id" text,
	"notificado_en" date,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "obligacion" ADD CONSTRAINT "obligacion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligacion_instancia" ADD CONSTRAINT "obligacion_instancia_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligacion_instancia" ADD CONSTRAINT "obligacion_instancia_obligacion_id_obligacion_id_fk" FOREIGN KEY ("obligacion_id") REFERENCES "public"."obligacion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "obligacion_user_proveedor_idx" ON "obligacion" USING btree ("user_id","proveedor_key");--> statement-breakpoint
CREATE UNIQUE INDEX "obligacion_instancia_periodo_idx" ON "obligacion_instancia" USING btree ("obligacion_id","periodo");--> statement-breakpoint
CREATE INDEX "obligacion_instancia_user_venc_idx" ON "obligacion_instancia" USING btree ("user_id","fecha_vencimiento");