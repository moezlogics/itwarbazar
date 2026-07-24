import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Banner CMS: sections + natural image dimensions.
 *
 * Purely ADDITIVE and safe to run on a live database:
 *   • creates the new `banner_section` table
 *   • adds three NULLABLE columns to `banner`
 * No existing row is touched and nothing is dropped, so banners created
 * before sections existed keep working (the storefront treats
 * `section_id IS NULL` as an implicit first carousel section).
 */
export class Migration20260722100000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "banner_section" (` +
        `"id" text not null, ` +
        `"title" text null, ` +
        `"layout" integer not null default 1, ` +
        `"placement" text not null default 'home', ` +
        `"sort_order" integer not null default 0, ` +
        `"is_active" boolean not null default true, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "banner_section_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_banner_section_deleted_at" ON "banner_section" ("deleted_at") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_banner_section_sort_order" ON "banner_section" ("sort_order") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_banner_section_placement" ON "banner_section" ("placement") WHERE deleted_at IS NULL;`
    );

    this.addSql(`alter table if exists "banner" add column if not exists "section_id" text null;`);
    this.addSql(`alter table if exists "banner" add column if not exists "image_width" integer null;`);
    this.addSql(`alter table if exists "banner" add column if not exists "image_height" integer null;`);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_banner_section_id" ON "banner" ("section_id") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_banner_section_id";`);
    this.addSql(`alter table if exists "banner" drop column if exists "image_height";`);
    this.addSql(`alter table if exists "banner" drop column if exists "image_width";`);
    this.addSql(`alter table if exists "banner" drop column if exists "section_id";`);
    this.addSql(`drop table if exists "banner_section" cascade;`);
  }

}
