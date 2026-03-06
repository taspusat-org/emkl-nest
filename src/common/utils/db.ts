import knex from 'knex';
import knexConfig from 'knexfile';
const dbMssql = knex(knexConfig.development);
const dbMdnEmkl = knex(knexConfig.medanEmkl);
const dbMdnTruck = knex(knexConfig.medanTrucking);
const dbjktEmkl = knex(knexConfig.jktEmkl);
const dbjktTrucking = knex(knexConfig.jktTrucking);
const dbsbyEmkl = knex(knexConfig.sbyEmkl);
const dbsbyTrucking = knex(knexConfig.sbyTrucking);
const dbsmgEmkl = knex(knexConfig.smgEmkl);
const dbmksEmkl = knex(knexConfig.mksEmkl);
const dbmksTrucking = knex(knexConfig.mksTrucking);
const dbbtgEmkl = knex(knexConfig.btgEmkl);
const dbMysqlTes = knex(knexConfig.mysqltest);
const dbBunga = knex(knexConfig.dbBunga);
const dbHr = knex(knexConfig.dbHr);

/**
 * Helper untuk create transaction dengan retry mechanism
 * Mengatasi race condition "SentClientRequest state" error
 */
export async function createTransaction(
  db: any,
  retries = 3,
  delayMs = 50,
): Promise<any> {
  while (retries > 0) {
    try {
      return await db.transaction();
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error(
          '[TRANSACTION ERROR] Failed after all retries:',
          error.message,
        );
        throw error;
      }
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export {
  dbMssql,
  dbMdnEmkl,
  dbMdnTruck,
  dbjktEmkl,
  dbjktTrucking,
  dbsbyEmkl,
  dbsbyTrucking,
  dbsmgEmkl,
  dbmksEmkl,
  dbmksTrucking,
  dbbtgEmkl,
  dbMysqlTes,
  dbBunga,
  dbHr,
};
