import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('akunpusat', (table) => {
    table.increments('id').primary();
    table.bigInteger('type_id').nullable();
    table.bigInteger('level').nullable();
    table.string('coa', 100).nullable();
    table.text('keterangancoa').nullable();
    table.string('parent', 100).nullable();
    table.bigInteger('statusap').nullable();
    table.bigInteger('statuslabarugi').nullable();
    table.bigInteger('statusneraca').nullable();
    table.bigInteger('statuslabarugiberjalan').nullable();
    table.bigInteger('statusbiaya').nullable();
    table.bigInteger('statushutang').nullable();
    table.bigInteger('statuspiutang').nullable();
    table.bigInteger('statusterimakasbank').nullable();
    table.bigInteger('statuskeluarkasbank').nullable();
    table.bigInteger('statusadjhutang').nullable();
    table.bigInteger('statusadjpiutang').nullable();
    table.bigInteger('statuspinjaman').nullable();
    table.bigInteger('statuskagantung').nullable();
    table.bigInteger('cabang_id').nullable();
    table.bigInteger('statusaktif').nullable();
    table.text('info').nullable();
    table.string('modifiedby', 200).nullable();
    table.string('editing_by', 200).nullable();
    table.datetime('editing_at').nullable();
    table.datetime('created_at').nullable();
    table.datetime('updated_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('akunpusat');
}
