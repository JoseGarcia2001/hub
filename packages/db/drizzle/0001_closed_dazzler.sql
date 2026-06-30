CREATE TABLE "pendiente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"titulo" text NOT NULL,
	"detalle" text,
	"vence" timestamp with time zone,
	"hecho" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pendiente" ADD CONSTRAINT "pendiente_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;