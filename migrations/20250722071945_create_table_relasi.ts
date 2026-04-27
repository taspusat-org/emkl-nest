import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('relasi', (table) => {
    table.increments('id').primary(); // id (primary key)
    table.integer('statusrelasi').unsigned().nullable(); // statusrelasi (int) - group status relasi
    table.text('nama').nullable(); // nama (nvarchar(max))
    table.string('coagiro', 100).nullable(); // coagiro (nvarchar(100)) - from coa table akunpusat
    table.string('coapiutang', 100).nullable(); // coapiutang (nvarchar(100)) - from coa table akunpusat
    table.string('coahutang', 100).nullable(); // coahutang (nvarchar(100)) - from coa table akunpusat
    table.integer('statustitip').unsigned().nullable(); // statustitip (int) - group status nilai
    table.integer('titipcabang_id').unsigned().nullable(); // titipcabang_id (int) - from cabang table
    table.text('alamat').nullable(); // alamat (nvarchar(max))
    table.string('npwp', 30).nullable(); // npwp (nvarchar(30))
    table.text('namapajak').nullable(); // namapajak (nvarchar(max))
    table.text('alamatpajak').nullable(); // alamatpajak (nvarchar(max))
    table.integer('statusaktif').unsigned().nullable(); // statusaktif (int) - group status aktif
    table.text('info').nullable(); // info (nvarchar(max))
    table.string('modifiedby', 200).nullable(); // modifiedby (varchar(200))
    table.string('editing_by', 200).nullable(); // editing_by (varchar(200))
    table.timestamp('editing_at').nullable(); // editing_at (datetime)
    table.timestamp('created_at').defaultTo(knex.fn.now()); // created_at (datetime)
    table.timestamp('updated_at').defaultTo(knex.fn.now()); // updated_at (datetime)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('relasi');
}
