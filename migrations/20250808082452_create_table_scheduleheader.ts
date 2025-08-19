import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('scheduleheader', (table) => {
        table.bigIncrements('id').primary();
        table.string('nobukti', 100).notNullable(); // nobukti (nvarchar(100))
        table.date('tglbukti').nullable(); // tglbukti (date)
        table.text('keterangan').nullable(); // keterangan (nvarchar(max))
        table.text('info').nullable(); // info (nvarchar(max))
        table.string('modifiedby', 200).nullable(); // modifiedby (varchar(200))
        table.timestamp('created_at').defaultTo(knex.fn.now()); // created_at (datetime)
        table.timestamp('updated_at').defaultTo(knex.fn.now()); // updated_at (datetime)
    })
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropSchemaIfExists('scheduleheader')
}
