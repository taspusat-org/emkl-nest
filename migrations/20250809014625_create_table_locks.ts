import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('locks', (table) => {
    table.bigIncrements('id').primary(); // bigint auto increment & primary key
    table.bigInteger('table').notNullable();
    table.bigInteger('tableid').notNullable();
    table.string('editing_by', 200);
    table.dateTime('editing_at');
    table.text('info'); // nvarchar(max) biasanya pakai text
    table.string('modifiedby', 200);
    table.dateTime('created_at');
    table.dateTime('updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('locks');
}
