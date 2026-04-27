import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('jenisprosesfee', (table) => {
    table.bigIncrements('id').primary();
    table.text('nama').nullable(); // nama (nvarchar(max))
    table.text('keterangan').nullable(); // keterangan (nvarchar(max))
    table.bigInteger('statusaktif').nullable(); // statusaktif (int)
    table.text('info').nullable(); // info as nvarchar(max)
    table.string('modifiedby', 200).nullable(); // modifiedby as varchar(200)
    table.specificType('created_at', 'datetime').defaultTo(knex.fn.now()); // closing (datetime)
    table.specificType('updated_at', 'datetime').defaultTo(knex.fn.now()); // closing (datetime)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropSchemaIfExists('jenisprosesfee');
}
