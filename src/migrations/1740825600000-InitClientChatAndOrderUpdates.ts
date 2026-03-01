import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitClientChatAndOrderUpdates1740825600000
  implements MigrationInterface
{
  name = 'InitClientChatAndOrderUpdates1740825600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create client table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "client" (
        "id" SERIAL NOT NULL,
        "telegramId" character varying NOT NULL,
        "firstName" character varying,
        "lastName" character varying,
        "username" character varying,
        "phone" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_client_telegramId" UNIQUE ("telegramId"),
        CONSTRAINT "PK_client" PRIMARY KEY ("id")
      )
    `);

    // 2. Add CLIENT value to MessageSender enum (IF NOT EXISTS — PostgreSQL 12+)
    await queryRunner.query(
      `ALTER TYPE "public"."chat_message_sendertype_enum" ADD VALUE IF NOT EXISTS 'CLIENT'`,
    );

    // 3. Make text nullable in chat_message (was NOT NULL)
    await queryRunner.query(
      `ALTER TABLE "chat_message" ALTER COLUMN "text" DROP NOT NULL`,
    );

    // 4. Add imageUrl to chat_message
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD COLUMN IF NOT EXISTS "imageUrl" text`,
    );

    // 5. Add clientId FK to chat_message
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD COLUMN IF NOT EXISTS "clientId" integer`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_chat_message_client'
        ) THEN
          ALTER TABLE "chat_message"
            ADD CONSTRAINT "FK_chat_message_client"
            FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 6. Create OrderSource enum
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_source_enum') THEN
          CREATE TYPE "public"."order_source_enum" AS ENUM('CLIENT', 'ADMIN');
        END IF;
      END $$;
    `);

    // 7. Add source column to order
    await queryRunner.query(`
      ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "source" "public"."order_source_enum" NOT NULL DEFAULT 'CLIENT'
    `);

    // 8. Add clientId FK to order
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "clientId" integer`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_order_client'
        ) THEN
          ALTER TABLE "order"
            ADD CONSTRAINT "FK_order_client"
            FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 9. Add lastLocationAt to specialist
    await queryRunner.query(
      `ALTER TABLE "specialist" ADD COLUMN IF NOT EXISTS "lastLocationAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "specialist" DROP COLUMN IF EXISTS "lastLocationAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP CONSTRAINT IF EXISTS "FK_order_client"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "clientId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "source"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."order_source_enum"`);
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP CONSTRAINT IF EXISTS "FK_chat_message_client"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP COLUMN IF EXISTS "clientId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP COLUMN IF EXISTS "imageUrl"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "client"`);
  }
}
