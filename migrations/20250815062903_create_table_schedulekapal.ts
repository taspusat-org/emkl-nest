import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('schedulekapal', (table) => {
    table.bigIncrements('id'); // Primary key as bigint
    table.bigInteger('jenisorderan_id').nullable(); // jenisorderan_id as bigint
    table.text('keterangan').nullable(); // keterangan as nvarchar(max)
    table.bigInteger('kapal_id').nullable(); // kapal_id as bigint
    table.bigInteger('pelayaran_id').nullable(); // pelayaran_id as bigint
    table.bigInteger('tujuankapal_id').nullable(); // tujuankapal_id as bigint
    table.bigInteger('asalkapal_id').nullable(); // asalkapal_id as bigint
    table.date('tglberangkat').nullable(); // tglberangkat as date
    table.date('tgltiba').nullable(); // tgltiba as date
    table.date('tglclosing').nullable(); // tglclosing as date
    table.string('statusberangkatkapal', 100).nullable(); // statusberangkatkapal as nvarchar(100)
    table.string('statustibakapal', 100).nullable(); // statustibakapal as nvarchar(100)
    table.string('batasmuatankapal', 100).nullable(); // batasmuatankapal as nvarchar(100)
    table.boolean('statusaktif').defaultTo(true); // statusaktif as boolean with default value
    table.text('info').nullable(); // info as nvarchar(max)
    table.string('modifiedby', 200).nullable(); // modifiedby as varchar(200)
    table.datetime('created_at').defaultTo(knex.fn.now()); // created_at as datetime
    table.datetime('updated_at').defaultTo(knex.fn.now()); // updated_at as datetime
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('schedulekapal');
}
