CREATE TABLE "endpoints" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "endpoints_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider_id" integer,
	"handle" varchar NOT NULL,
	"url" varchar NOT NULL,
	"events" varchar[] NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "providers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secrets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "secrets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"endpoint_id" integer,
	"secret" varchar NOT NULL
);
--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_endpoint_id_endpoints_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "endpoints"("id") ON DELETE CASCADE;