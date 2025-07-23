import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('kasgantungheader', (table) => {
    table.increments('id').primary(); // id (primary key)
    table.string('nobukti', 100).notNullable(); // nobukti (nvarchar(100))
    table.date('tglbukti').nullable(); // tglbukti (date)
    table.integer('relasi_id').nullable(); // relasi_id (int)
    table.text('keterangan').nullable(); // keterangan (nvarchar(max))
    table.integer('bank_id').nullable(); // bank_id (int)
    table.string('pengeluaran_nobukti', 100).nullable(); // pengeluaran_nobukti (nvarchar(100))
    table.string('coakaskeluar', 100).nullable(); // coakaskeluar (nvarchar(100))
    table.text('dibayarke').nullable(); // dibayarke (nvarchar(max))
    table.integer('alatbayar_id').nullable(); // alatbayar_id (int)
    table.string('nowarkat', 100).nullable(); // nowarkat (nvarchar(100))
    table.date('tgljatuhtempo').nullable(); // tgljatuhtempo (date)
    table.string('gantungorderan_nobukti', 100).nullable(); // gantungorderan_nobukti (nvarchar(100))
    table.text('info').nullable(); // info (nvarchar(max))
    table.string('modifiedby', 200).nullable(); // modifiedby (varchar(200))
    table.string('editing_by', 200).nullable(); // editing_by (varchar(200))
    table.timestamp('editing_at').nullable(); // editing_at (datetime)
    table.timestamp('created_at').defaultTo(knex.fn.now()); // created_at (datetime)
    table.timestamp('updated_at').defaultTo(knex.fn.now()); // updated_at (datetime)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('kasgantungheader');
}
