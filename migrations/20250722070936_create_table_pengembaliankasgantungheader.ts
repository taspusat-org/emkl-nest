import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('pengembaliankasgantungheader', (table) => {
    table.increments('id').primary(); // id (primary key)
    table.string('nobukti', 100).notNullable(); // nobukti (nvarchar(100))
    table.date('tglbukti').notNullable(); // tglbukti (date)
    table.text('keterangan').nullable(); // keterangan (nvarchar(max))
    table.integer('bank_id').unsigned().nullable(); // bank_id (integer)
    table.string('penerimaan_nobukti', 100).nullable(); // penerimaan_nobukti (nvarchar(100))
    table.string('coakasmasuk', 100).nullable(); // coakasmasuk (nvarchar(100))
    table.integer('relasi_id').unsigned().nullable(); // relasi_id (integer)
    table.text('info').nullable(); // info (nvarchar(max))
    table.string('modifiedby', 200).nullable(); // modifiedby (varchar(200))
    table.string('editing_by', 200).nullable(); // editing_by (varchar(200))
    table.timestamp('editing_at').nullable(); // editing_at (datetime)
    table.timestamp('created_at').defaultTo(knex.fn.now()); // created_at (datetime)
    table.timestamp('updated_at').defaultTo(knex.fn.now()); // updated_at (datetime)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pengembaliankasgantungheader');
}
