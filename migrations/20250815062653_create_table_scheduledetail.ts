import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('scheduledetail', (table) => {
    table.bigIncrements('id'); // Primary key as bigint
    table.bigInteger('schedule_id').notNullable(); // schedule_id as bigint
    table.string('nobukti', 100).notNullable(); // nobukti as nvarchar(100)
    table.bigInteger('pelayaran_id').notNullable(); // pelayaran_id as bigint
    table.bigInteger('kapal_id').notNullable(); // kapal_id as bigint
    table.bigInteger('tujuankapal_id').notNullable(); // tujuankapal_id as bigint
    table.bigInteger('schedulekapal_id').notNullable(); // schedulekapal_id as bigint
    table.date('tglberangkat').nullable(); // tglberangkat as date
    table.date('tgltiba').nullable(); // tgltiba as date
    table.date('etb').nullable(); // etb as date
    table.date('eta').nullable(); // eta as date
    table.date('etd').nullable(); // etd as date
    table.string('voyberangkat', 100).nullable(); // voyberangkat as nvarchar(100)
    table.string('voytiba', 100).nullable(); // voytiba as nvarchar(100)
    table.datetime('closing').nullable(); // closing as datetime
    table.datetime('etatujuan').nullable(); // etatujuan as datetime
    table.datetime('etdtujuan').nullable(); // etdtujuan as datetime
    table.text('keterangan').nullable(); // keterangan as nvarchar(max)
    table.text('info').nullable(); // info as nvarchar(max)
    table.string('modifiedby', 200).nullable(); // modifiedby as varchar(200)
    table.datetime('created_at').defaultTo(knex.fn.now()); // created_at as datetime
    table.datetime('updated_at').defaultTo(knex.fn.now()); // updated_at as datetime
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('scheduledetail');
}
