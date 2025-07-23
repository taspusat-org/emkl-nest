import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('kasgantungdetail', (table) => {
    table.increments('id').primary(); // id (primary key)
    table.integer('kasgantung_id').unsigned().nullable(); // kasgantung_id (integer)
    table.string('nobukti', 100).notNullable(); // nobukti (nvarchar(100))
    table.text('keterangan').nullable(); // keterangan (nvarchar(max))
    table.specificType('nominal', 'money').nullable(); // nominal (money)
    table.text('info').nullable(); // info (nvarchar(max))
    table.string('modifiedby', 200).nullable(); // modifiedby (varchar(200))
    table.string('editing_by', 200).nullable(); // editing_by (varchar(200))
    table.timestamp('editing_at').nullable(); // editing_at (datetime)
    table.timestamp('created_at').defaultTo(knex.fn.now()); // created_at (datetime)
    table.timestamp('updated_at').defaultTo(knex.fn.now()); // updated_at (datetime)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('kasgantungdetail');
}
