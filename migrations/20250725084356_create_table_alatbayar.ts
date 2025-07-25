import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('alatbayar', (table) => {
    table.increments('id').primary(); // id (primary key)
    table.string('nama', 255).nullable(); // nama (nvarchar(max))
    table.text('keterangan').nullable(); // keterangan (nvarchar(max))
    table.integer('statuslangsungcair').nullable(); // statuslangsungcair (int)
    table.integer('statusdefault').nullable(); // statusdefault (int)
    table.integer('statusbank').nullable(); // statusbank (int)
    table.integer('statusaktif').nullable(); // statusaktif (int)
    table.text('info').nullable(); // info (nvarchar(max))
    table.string('modifiedby', 200).nullable(); // modifiedby (varchar(200))
    table.string('editing_by', 200).nullable(); // editing_by (varchar(200))
    table.timestamp('editing_at').nullable(); // editing_at (datetime)
    table.timestamp('created_at').defaultTo(knex.fn.now()); // created_at (datetime)
    table.timestamp('updated_at').defaultTo(knex.fn.now()); // updated_at (datetime)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('alatbayar');
}
