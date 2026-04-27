import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('scheduledetail', (table) => {
    table.bigIncrements('id').primary(); // id (primary key)
    table.bigInteger('schedule_id').unsigned().nullable(); // schedule_id (integer)
    table.string('nobukti', 100).notNullable(); // nobukti (nvarchar(100))
    table.bigInteger('pelayaran_id').unsigned().nullable(); // pelayaran_id (int)
    table.bigInteger('kapal_id').unsigned().nullable(); // kapal_id (int)
    table.bigInteger('tujuankapal_id').unsigned().nullable(); // tujuankapal_id (int)
    table.bigInteger('schedulekapal_id').unsigned().nullable(); // schedulekapal_id (int)
    table.date('tglberangkat').nullable(); // tglberangkat (date)
    table.date('tgltiba').nullable(); // tgltiba (date)
    table.date('etb').nullable(); // etb (date)
    table.date('eta').nullable(); // eta (date)
    table.date('etd').nullable(); // etd (date)
    table.string('voyberangkat', 100).notNullable(); // voyberangkat (nvarchar(100))
    table.string('voytiba', 100).notNullable(); // voytiba (nvarchar(100))
    table.specificType('closing', 'datetime').nullable(); // closing (datetime)
    table.date('etatujuan').nullable(); // etatujuan (datetime)
    table.date('etdtujuan').nullable(); // etdtujuan (datetime)
    table.text('keterangan').nullable(); // keterangan (nvarchar(max))
    table.text('info').nullable(); // info (nvarchar(max))
    table.string('modifiedby', 200).nullable(); // modifiedby (varchar(200))
    table.specificType('created_at', 'datetime').defaultTo(knex.fn.now()); // closing (datetime)
    table.specificType('updated_at', 'datetime').defaultTo(knex.fn.now()); // closing (datetime)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('scheduledetail');
}
