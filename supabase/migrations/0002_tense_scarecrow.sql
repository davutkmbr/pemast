CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "message_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."message_type";--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'voice', 'document', 'photo');--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "message_type" SET DATA TYPE "public"."message_type" USING "message_type"::"public"."message_type";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "role" "message_role" DEFAULT 'user';