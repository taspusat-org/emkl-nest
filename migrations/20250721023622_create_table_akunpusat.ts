import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('akunpusat', (table) => {
    table.increments('id').primary();
    table.integer('type_id').nullable();
    table.integer('level').nullable();
    table.string('coa', 100).nullable();
    table.text('keterangancoa').nullable();
    table.string('parent', 100).nullable();
    table.integer('statusap').nullable();
    table.integer('statuslabarugi').nullable();
    table.integer('statusneraca').nullable();
    table.integer('statuslabarugiberjalan').nullable();
    table.integer('statusbiaya').nullable();
    table.integer('statushutang').nullable();
    table.integer('statuspiutang').nullable();
    table.integer('statusterimakasbank').nullable();
    table.integer('statuskeluarkasbank').nullable();
    table.integer('statusadjhutang').nullable();
    table.integer('statusadjpiutang').nullable();
    table.integer('statuspinjaman').nullable();
    table.integer('statuskagantung').nullable();
    table.integer('cabang_id').nullable();
    table.integer('statusaktif').nullable();
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
