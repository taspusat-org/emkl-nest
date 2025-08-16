import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('hargatrucking', (table) => {
    table.increments('id').primary(); // id (primary key)
    table.integer('tarifdetail_id').nullable();
    table.integer('emkl_id').nullable(); // emkl_id (bigint)
    table.text('keterangan').nullable(); // keterangan (nvarchar(max))
    table.integer('container_id').nullable(); // container_id (bigint)
    table.integer('jenisorderan_id').nullable(); // jenisorderan_id (bigint)
    table.decimal('nominal', 15, 2).nullable(); // nominal (money)
    table.integer('statusaktif').nullable().defaultTo(1); // statusaktif (bigint) - parameter
    table.text('info').nullable(); // info (nvarchar(max))
    table.string('modifiedby', 200).nullable(); // modifiedby (varchar(200))
    table.timestamp('created_at').defaultTo(knex.fn.now()); // created_at (datetime)
    table.timestamp('updated_at').defaultTo(knex.fn.now()); // updated_at (datetime)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('hargatrucking');
}
