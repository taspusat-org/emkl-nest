import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('akuntansi', (table) => {
    table.integer('id').primary();
    table.string('nama', 100);
    table.string('keterangan', 100);
    table.integer('statusaktif');
    table.text('info');
    table.string('modifiedby', 200);
    table.string('editing_by', 200);
    table.datetime('editing_at');
    table.datetime('created_at');
    table.datetime('updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('akuntansi');
}
