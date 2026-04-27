import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('akuntansi', (table) => {
    table.bigIncrements('id').primary();
    table.string('nama', 100);
    table.string('keterangan', 100);
    table.bigInteger('statusaktif');
    table.text('info');
    table.string('modifiedby', 200);
    table.string('editing_by', 200);
    table.datetime('editing_at').defaultTo(knex.fn.now());
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('akuntansi');
}
