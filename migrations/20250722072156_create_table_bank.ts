import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bank', (table) => {
    table.increments('id').primary(); // id (primary key)
    table.string('nama_bank', 255).notNullable(); // nama_bank (varchar(255))
    table.string('kode_bank', 50).notNullable().unique(); // kode_bank (varchar(50)), harus unik
    table.string('alamat', 255).nullable(); // alamat (varchar(255))
    table.string('nomor_telepon', 20).nullable(); // nomor_telepon (varchar(20))
    table.string('email', 100).nullable(); // email (varchar(100))
    table.timestamp('created_at').defaultTo(knex.fn.now()); // created_at (datetime)
    table.timestamp('updated_at').defaultTo(knex.fn.now()); // updated_at (datetime)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bank');
}
