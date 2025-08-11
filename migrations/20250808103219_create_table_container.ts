import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('container', (table) => {
    table.bigIncrements('id').primary();
    table.string('nama', 100);
    table.string('keterangan', 100);
    table.bigInteger('statusaktif');
    table.text('info');
    table.string('modifiedby', 200);
    table.datetime('created_at');
    table.datetime('updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('container');
}
