import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('menus', (table) => {
    table.increments('id').primary(); // id (primary key)
    table.string('title', 255).notNullable(); // title (nvarchar)
    table.integer('aco_id').unsigned().nullable(); // aco_id (integer)
    table.string('icon', 255).nullable(); // icon (nvarchar)
    table.boolean('isActive').defaultTo(true); // isActive (bit)
    table.integer('parentId').unsigned().nullable(); // parentId (integer)
    table.integer('order').defaultTo(0); // order (integer)
    table.timestamp('created_at').defaultTo(knex.fn.now()); // created_at (datetime2)
    table.timestamp('updated_at').defaultTo(knex.fn.now()); // updated_at (datetime2)
    table.integer('statusaktif').defaultTo(1); // statusaktif (integer)
    table.string('modifiedby', 255).nullable(); // modifiedby (varchar)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('menus');
}
