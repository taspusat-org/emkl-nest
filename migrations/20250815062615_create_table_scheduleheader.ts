import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('scheduleheader', (table) => {
    table.bigIncrements('id'); // Primary key as bigint
    table.string('nobukti', 100).notNullable(); // nobukti as nvarchar(100)
    table.date('tglbukti').nullable(); // tglbukti as date
    table.text('keterangan').nullable(); // keterangan as nvarchar(max)
    table.text('info').nullable(); // info as nvarchar(max)
    table.string('modifiedby', 200).nullable(); // modifiedby as varchar(200)
    table.timestamp('created_at').defaultTo(knex.fn.now()); // created_at as datetime
    table.timestamp('updated_at').defaultTo(knex.fn.now()); // updated_at as datetime
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('scheduleheader');
}
