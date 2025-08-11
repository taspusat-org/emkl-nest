import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('typeakuntansi', (table) => {
        table.increments('id').primary();
        table.string('nama', 100).nullable(); // nama (nvarchar(100))
        table.integer('order').nullable(); // order (integer)
        table.string('keterangan', 100).nullable(); // keterangan (nvarchar(100))
        table.integer('akuntansi_id').nullable(); // akuntansi_id (integer)
        table.integer('statusaktif').nullable(); // statusaktif (integer)
        table.text('info').nullable(); // info (nvarchar(max))
        table.string('modifiedby', 200).nullable(); // modifiedby (nvarchar(200))
        table.string('editing_by', 200).nullable(); // editing_by (nvarchar(200))
        table.timestamp('editing_at').nullable(); // editing_at (datetime)knex migrate:make create_table_scheduleheader
        table.timestamp('created_at').defaultTo(knex.fn.now()); // created_at (datetime)
        table.timestamp('updated_at').defaultTo(knex.fn.now()); // updated_at (datetime)
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropSchemaIfExists('typeakuntansi')
}

