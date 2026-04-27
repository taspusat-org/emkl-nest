import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('logtrail', (table) => {
    table.increments('id').primary(); // id (primary key)
    table.text('users').notNullable(); // title (nvarchar)
    table.text('postingdari').notNullable(); // title (nvarchar)
    table.text('idtrans').unsigned().nullable(); // aco_id (integer)
    table.integer('nobuktitrans').unsigned().nullable(); // aco_id (integer)c
    table.string('aksi', 255).nullable(); // icon (nvarchar)
    table.text('datajson').unsigned().nullable(); // aco_id (integer)c
    table.text('info').unsigned().nullable(); // aco_id (integer)
    table.timestamp('created_at').defaultTo(knex.fn.now()); // created_at (datetime2)
    table.timestamp('updated_at').defaultTo(knex.fn.now()); // updated_at (datetime2)
    table.string('modifiedby', 255).nullable(); // modifiedby (varchar)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('logtrail');
}
