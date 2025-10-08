import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { Menu, UserRoleAbilities } from 'src/common/interfaces/all.interface';
import { Users } from 'src/common/interfaces/users.interface';
import { dbMssql } from 'src/common/utils/db';
import sharp, { FormatEnum } from 'sharp';
import multer from 'multer';
import path from 'path';
import * as fs from 'fs';

const mimeToSharpFormat: { [key: string]: keyof FormatEnum } = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};
@Injectable()
export class UtilsService {
  async createTempTable(
    tableName: string,
    trx: any,
    tempError: string,
  ): Promise<string> {
    try {
      const result = await trx(tableName).columnInfo();
      // Fungsi untuk menentukan tipe kolom berdasarkan informasi kolom
      function getColumnType(columnName: string, columnInfo: any): string {
        const { type, maxLength } = columnInfo;

        if (columnName === 'filefoto') {
          return `${columnName} text`; // Kolom filefoto menjadi tipe text
        }
        if (columnName === 'fileberkas') {
          return `${columnName} text`; // Kolom filefoto menjadi tipe text
        }

        // Cek jika tipe kolom adalah nvarchar atau varchar tanpa maxLength, set panjangnya menjadi 255
        if ((type === 'nvarchar' || type === 'varchar') && maxLength === null) {
          return `${columnName} ${type}(255)`;
        }

        // Jika tipe kolom nvarchar dengan maxLength -1, set panjangnya menjadi 255
        if (type === 'nvarchar' && maxLength === -1) {
          return `${columnName} ${type}(255)`;
        }

        // Jika kolom memiliki maxLength yang valid, set panjang sesuai dengan maxLength
        if (maxLength !== null) {
          return `${columnName} ${type}(${maxLength})`;
        }

        // Jika kolom adalah tipe datetime, gunakan datetime2
        if (type === 'datetime') {
          return `${columnName} datetime2`;
        }

        return `${columnName} ${type}`; // Tipe kolom lainnya tetap sesuai dengan tipe yang ada
      }

      // Array untuk menyimpan kolom dan tipe yang akan dibuat
      const columnsToCreate: string[] = [];

      // Proses semua kolom dan tentukan tipe kolomnya
      for (const [columnName, columnInfo] of Object.entries(result)) {
        columnsToCreate.push(getColumnType(columnName, columnInfo));
      }

      // Jika tidak ada kolom created_at, tambahkan kolom tersebut
      if (!result['created_at']) {
        columnsToCreate.push('created_at DATETIME2 NULL');
      }

      // Jika tidak ada kolom updated_at, tambahkan kolom tersebut
      if (!result['updated_at']) {
        columnsToCreate.push('updated_at DATETIME2 NULL');
      }

      // Query untuk membuat temporary table dengan kolom-kolom yang telah ditentukan
      const createTableQuery = `
        CREATE TABLE ${tempError} (
          ${columnsToCreate.join(',\n')}
        )
      `;

      return createTableQuery;
    } catch (error) {
      console.error('Error creating temporary table:', error);
      throw error;
    }
  }

  async tempPivotStatusPendukung(trx: any, tablename: string, fieldTempHasil:any) {
    try {
      const tempStatusPendukung = `##temp_${Math.random().toString(36).substring(2, 15)}`;
      const tempData = `##temp_data${Math.random().toString(36).substring(2, 15)}`;
      const tempHasil = `##temp_hasil${Math.random().toString(36).substring(2, 15)}`;      

      // Create tempStatusPendukung table
      await trx.schema.createTable(tempStatusPendukung, (t) => {
        t.bigInteger('id').nullable();
        t.bigInteger('statusdatapendukung').nullable();
        t.bigInteger('transaksi_id').nullable();
        t.string('statuspendukung').nullable();
        t.text('keterangan').nullable();
        t.string('modifiedby').nullable();
        t.string('updated_at').nullable();
        t.string('created_at').nullable();
      });

      // Create tempData table
      await trx.schema.createTable(tempData, (t) => {
        t.bigInteger('id').nullable();
        t.string('nobukti').nullable();
        t.text('keterangan').nullable();
        t.string('judul').nullable();
      });

      // Create tempHasil table
      await trx.schema.createTable(tempHasil, (t) => {
        t.bigInteger('id').nullable();
        t.string('nobukti').nullable();
        fieldTempHasil
          .forEach((col) => {
            t.text(col).nullable();
          });
      });

      // Insert into tempStatusPendukung
      await trx(tempStatusPendukung).insert(
        trx
          .select(
            'a.id',
            'a.statusdatapendukung',
            'a.transaksi_id',
            'a.statuspendukung',
            'a.keterangan',
            'a.modifiedby',
            'a.updated_at',
            'a.created_at',
          )
          .from('statuspendukung as a')
          .innerJoin('parameter as b', 'a.statusdatapendukung', 'b.id')
          .where('b.subgrp', tablename),
      );

      const hasNobukti = await trx.schema.hasColumn(tablename, 'nobukti');
      await trx(tempData).insert(
        trx
          .select(
            'a.id',
            // 'a.nobukti',
            trx.raw(hasNobukti ? "COALESCE(a.nobukti, '') as nobukti" : "'' as nobukti"),
            trx.raw(
              `CONCAT(
                '{"statusdatapendukung":"',
                CASE 
                  WHEN ISJSON(CAST(c.memo AS NVARCHAR(MAX))) = 1 
                    THEN JSON_VALUE(CAST(c.memo AS NVARCHAR(MAX)), '$.MEMO') 
                  ELSE '' 
                END,
                '","transaksi_id":',
                TRIM(STR(ISNULL(b.transaksi_id, 0))),
                ',"statuspendukung":"',
                CASE 
                  WHEN ISJSON(CAST(d.memo AS NVARCHAR(MAX))) = 1 
                    THEN JSON_VALUE(CAST(d.memo AS NVARCHAR(MAX)), '$.MEMO') 
                  ELSE '' 
                END,
                '","keterangan":"',
                TRIM(ISNULL(b.keterangan, '')),
                '","updated_at":"',
                FORMAT(CAST(b.updated_at AS DATETIME), 'yyyy-MM-dd HH:mm:ss'),
                '","statuspendukung_id":"',
                TRIM(STR(ISNULL(d.id, 0))),
                '","statuspendukung_memo":',
               TRIM(CAST(d.memo AS NVARCHAR(MAX))),
                '}'
              ) AS keterangan`,
            ),
            trx.raw(
              `CASE 
                WHEN ISJSON(CAST(c.memo AS NVARCHAR(MAX))) = 1 
                  THEN JSON_VALUE(CAST(c.memo AS NVARCHAR(MAX)), '$.MEMO') 
                ELSE '' 
              END AS judul`,
            ),
          )
          .from(`${tablename} as a`)
          .innerJoin(`${tempStatusPendukung} as b`, 'a.id', 'b.transaksi_id')
          .innerJoin('parameter as c', 'b.statusdatapendukung', 'c.id')
          .innerJoin('parameter as d', 'b.statuspendukung', 'd.id'),
      );

      const getTempData = await trx(tempData).select('*')
      const uniqueJudul = [...new Set(getTempData.map((d: any) => d.judul))];

      // Generate dynamic columns for PIVOT
      const columnsResult = await trx
        .select('judul')
        .from(tempData)
        .groupBy('judul');

      let columns = '';
      columnsResult.forEach((row, index) => {
        if (index === 0) {
          if (row.judul === 'TOP' || row.judul === 'OPEN') {
            columns = `[${row.judul}_FIELD]`;
          } else {
            columns = `[${row.judul}]`;
          }
        } else {
          if (row.judul === 'TOP' || row.judul === 'OPEN') {
            columns += `, [${row.judul}_FIELD]`;
          } else {
            columns += `, [${row.judul}]`;
          }
        }
      });

      if (!columns) {
        throw new Error('No columns generated for PIVOT');
      }
      const pivotSubqueryRaw = `
        (
          SELECT id, nobukti, ${columns}
          FROM (
            SELECT id, nobukti, judul, keterangan 
            FROM ${tempData}
          ) AS SourceTable
          PIVOT (
            MAX(keterangan)
            FOR judul IN (${columns})
          ) AS PivotTable
        ) AS A
      `;

      const jsonColumns = uniqueJudul.flatMap((judul: any) => {
        const alias = (judul === 'TOP' || judul === 'OPEN') ? `${judul.toLowerCase().replace(/\s+/g, '')}_FIELD` : judul.toLowerCase().replace(/\s+/g, '');
        const fixJudul = (judul === 'TOP' || judul === 'OPEN') ? `${judul}_FIELD` : judul;
        
        return [ 
          trx.raw(`JSON_VALUE(A.[${fixJudul}], '$.statuspendukung_id') as ${alias}`),
          trx.raw(`JSON_VALUE(A.[${fixJudul}], '$.statuspendukung') as ${alias}_nama`),
          trx.raw(`JSON_QUERY(A.[${fixJudul}], '$.statuspendukung_memo') as ${alias}_memo`)
          // trx.raw(`JSON_VALUE(A.[${judul}], '$.statuspendukung') as ${alias}_nama`),
          // trx.raw(`JSON_QUERY(A.[${judul}], '$.statuspendukung_memo') as ${alias}_memo`)
        ];
      }); 
      // console.log('get', await trx(tempData).select('*'));

      await trx(tempHasil).insert(
        trx
        .select([
          'A.id',
          'A.nobukti',
          ...jsonColumns
        ])
        .from(trx.raw(pivotSubqueryRaw)),
      )
      console.log('hasil', await trx(tempHasil).select('*'));

      return tempHasil;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw new Error('Failed to fetch data');
    }
  }

  getTime() {
    return DateTime.now()
      .setZone('Asia/Jakarta') // Use the timezone you need
      .toFormat('yyyy-MM-dd HH:mm:ss'); // Ensure proper SQL-compatible format
  }

  hasChanges(newData: any, existingData: any) {
    for (const key in newData) {
      if (key === 'created_at' || key === 'updated_at') {
        continue;
      }

      if (newData[key] != existingData[key]) {
        return true;
      }
    }
    return false;
  }

  async lockAndDestroy(identifier: any, table: string, field: any = 'id', trx) {
    try {
      // Cek dulu apakah data ada
      const record = await trx(table)
        .where(field, identifier)
        .forUpdate()
        .first();

      // Jika data tidak ada, tidak perlu return error, cukup keluar dari fungsi
      if (!record) {
        return true;
      }

      const isDeleted = await trx(table).where(field, identifier).delete();

      if (!isDeleted) {
        throw new InternalServerErrorException(
          `Gagal menghapus '${field}' = '${identifier}' di tabel '${table}'`,
        );
      }

      return record;
    } catch (error) {
      console.error('Error di lockAndDestroy:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<Users | null> {
    try {
      const user = await dbMssql('users').where({ username }).first();
      return user || null;
    } catch (error) {
      console.error('Error fetching user by username:', error);
      throw new Error('Database query failed');
    }
  }

  async fetchKaryawanByUserId(userId: number): Promise<any> {
    try {
      const karyawan = await dbMssql('karyawan')
        .select('karyawan.*', 'c.nama as cabang_nama')
        .leftJoin('users', 'users.karyawan_id', 'karyawan.id')
        .leftJoin('cabang as c', 'c.id', 'karyawan.cabang_id')
        .where('users.id', userId)
        .first();

      return karyawan || null;
    } catch (error) {
      console.error('Error fetching karyawan by user ID:', error);
      throw new Error('Database query failed');
    }
  }
  async fetchUserRolesAndAbilities(
    userId: number,
    trx,
  ): Promise<UserRoleAbilities> {
    const roles = await trx('userrole')
      .where({ user_id: userId })
      .pluck('role_id');

    if (roles.length === 0) {
      return { roles: [], abilities: [] };
    }

    const userAbilities = await trx('useracl')
      .join('acos', 'useracl.aco_id', 'acos.id')
      .where('useracl.user_id', userId)
      .select({
        id: 'acos.id',
        method: 'acos.method',
        class: 'acos.class',
      })
      .distinct('acos.id');
    console.log('userAbilities', userAbilities);
    const roleAbilities = await trx('acl')
      .join('acos', 'acl.aco_id', 'acos.id')
      .whereIn('acl.role_id', roles)
      .select({
        id: 'acos.id',
        method: 'acos.method',
        class: 'acos.class',
      })
      .distinct('acos.id');

    // Gabungkan kedua array dan pastikan id yang dihasilkan berupa nilai tunggal.
    const allAbilities = [
      ...userAbilities.map((ability) => ({
        id: Array.isArray(ability.id) ? ability.id[0] : ability.id,
        action: ability.method,
        subject: ability.class,
      })),
      ...roleAbilities.map((ability) => ({
        id: Array.isArray(ability.id) ? ability.id[0] : ability.id,
        action: ability.method,
        subject: ability.class,
      })),
    ];

    // Gunakan Map untuk menghilangkan duplikat berdasarkan id.
    const uniqueAbilities = [
      ...new Map(allAbilities.map((ability) => [ability.id, ability])).values(),
    ];

    return {
      roles,
      abilities: uniqueAbilities,
    };
  }
  async fetchUserRolesAndUserAcl(
    userId: number,
    trx: any,
  ): Promise<UserRoleAbilities> {
    const roles = await trx('userrole')
      .where({ user_id: userId })
      .pluck('role_id');

    if (roles.length === 0) {
      return { roles: [], abilities: [] };
    }

    const userAbilities = await trx('useracl')
      .join('acos', 'useracl.aco_id', 'acos.id')
      .where('useracl.user_id', userId)
      .select({
        id: 'acos.id',
        method: 'acos.method',
        class: 'acos.class',
      })
      .distinct('acos.id');

    // Gabungkan kedua array dan pastikan id yang dihasilkan berupa nilai tunggal.
    const allAbilities = [
      ...userAbilities.map((ability) => ({
        id: Array.isArray(ability.id) ? ability.id[0] : ability.id,
        action: ability.method,
        subject: ability.class,
      })),
    ];

    // Gunakan Map untuk menghilangkan duplikat berdasarkan id.
    const uniqueAbilities = [
      ...new Map(allAbilities.map((ability) => [ability.id, ability])).values(),
    ];

    return {
      roles,
      abilities: uniqueAbilities,
    };
  }

  checkAccessRecursively = (item: any, abilities: any[]): boolean => {
    return abilities.some((ability: any) => {
      const subject = ability.subject?.toLowerCase() || '';
      const url = item.url?.toLowerCase() || '';
      const title = item.title?.toLowerCase() || '';

      const isSubjectMatching = subject === title || subject === url;
      const isActionMatching = ability.action === 'GET';

      if (isSubjectMatching && isActionMatching) {
        return true;
      }

      if (item.items && item.items.length > 0) {
        return item.items.some((subItem: any) =>
          this.checkAccessRecursively(subItem, abilities),
        );
      }

      return false;
    });
  };

  buildMenuString = (menuItems: any[], abilities: any[]): string => {
    let menuHtml = '';
    const processMenuItem = (item: any): string => {
      if (this.checkAccessRecursively(item, abilities)) {
        let itemHtml = '';
        const uniqueTitle = `${item.title}-${item.id}`;

        if (item.items && item.items.length > 0) {
          itemHtml += `<Collapsible asChild defaultOpen={true} open={isMenuOpen('${uniqueTitle}')} className="group/collapsible text-sm my-1"><SidebarMenuItem><CollapsibleTrigger asChild><SidebarMenuButton className="text-sm" tooltip="${uniqueTitle}" onClick={()=>handleToggle('${uniqueTitle}')}><Icons name="${item.icon}" className="icon-white" /><p className="break-words text-sm">${item.title}</p><ChevronRight className={\`ml-auto transform transition-transform duration-300 ease-in-out \${isMenuOpen('${uniqueTitle}') ? 'rotate-90' : ''}\`} /></SidebarMenuButton></CollapsibleTrigger><CollapsibleContent><SidebarMenuSub>${this.buildMenuString(item.items, abilities)}</SidebarMenuSub></CollapsibleContent></SidebarMenuItem></Collapsible>`;
        } else {
          itemHtml += `<SidebarMenuSubItem onMouseEnter={() => setHoveredItemId('${uniqueTitle}')} onMouseLeave={() => setHoveredItemId(null)}><SidebarMenuSubButton asChild isActive={activePath==="/dashboard/${item.url}"}><Link prefetch={true} href="/dashboard/${item.url}" className="py-4"><Icons name="${item.icon}" className={ hoveredItemId === '${uniqueTitle}' || activePath === "/dashboard/${item.url}" ? 'icon-white text-white' : 'icon-white text-white'}/><p className="break-words text-sm">${item.title}</p></Link></SidebarMenuSubButton></SidebarMenuSubItem>`;
        }
        return itemHtml.trim();
      }
      return '';
    };

    menuItems.forEach((item) => {
      menuHtml += processMenuItem(item);
    });
    return menuHtml.replace(/\s+/g, ' ').trim();
  };

  async getDataMenuSidebar(trx: any) {
    try {
      const result = await trx
        .select(
          'menus.id',
          'menus.title',
          trx.raw(
            `CASE WHEN acos.method = 'GET' THEN LOWER(acos.class) ELSE NULL END AS url`,
          ),
          'menus.icon',
          'menus.isActive',
          'menus.parentId',
          'menus.[order]',
        )
        .from('menus')
        .leftJoin('acos', 'menus.aco_id', 'acos.id')
        .orderBy('menus.parentId')
        .orderBy('menus.[order]');

      const formattedMenus = this.formatMenus(result);
      return formattedMenus;
    } catch (error) {
      console.error('Error fetching menu sidebar data:', error);
      throw new Error('Failed to fetch menu sidebar data');
    }
  }

  formatMenus(rawData: any[]): Menu[] {
    const map: { [key: number]: Menu } = {};
    const roots: Menu[] = [];

    rawData.forEach((menu: any) => {
      map[menu.id] = {
        id: menu.id,
        title: menu.title,
        url: menu.url || '',
        icon: menu.icon || '',
        isActive: menu.isActive === true,
        order: menu.order || 0,
        parentId: menu.parentId || 0,
        items: [],
      };
    });

    rawData.forEach((menu: any) => {
      if (menu.parentId === 0 || menu.parentId === null) {
        roots.push(map[menu.id]);
      } else if (map[menu.parentId]) {
        map[menu.parentId].items.push(map[menu.id]);
      }
    });

    const sortItems = (items: Menu[]): Menu[] => {
      return items
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          ...item,
          items: sortItems(item.items),
        }));
    };

    return sortItems(roots);
  }
  async compressImageKaryawan(file: Express.Multer.File): Promise<string> {
    const outputDir = path.join(process.cwd(), 'uploads/compress');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const extname = path.extname(file.originalname);
    const timestamp = Date.now();
    const combinedName = `${timestamp}${extname}`;
    // Nama file untuk medium (disimpan dengan nama medium_)
    const mediumName = `medium_${timestamp}${extname}`;
    const mediumPath = path.join(outputDir, mediumName);

    // Nama file untuk thumbnail (disimpan dengan nama small_)
    const thumbnailName = `small_${timestamp}${extname}`;
    const thumbnailPath = path.join(outputDir, thumbnailName);

    const format = mimeToSharpFormat[file.mimetype]; // Pastikan mimeToSharpFormat didefinisikan dengan benar

    // Menyimpan gambar medium dengan ukuran asli (tanpa resize)
    fs.writeFileSync(mediumPath, file.buffer);

    // Resize gambar untuk thumbnail (100px lebar)
    const thumbnailBuffer = await sharp(file.buffer)
      .resize(100) // Resize image to 100px width for thumbnail
      .toFormat(format) // Convert image to appropriate format
      .toBuffer();
    fs.writeFileSync(thumbnailPath, thumbnailBuffer); // Menyimpan gambar thumbnail

    return combinedName; // Return nama file asli, bukan nama medium atau small
  }

  async compressImage(file: Express.Multer.File): Promise<string> {
    const outputDir = path.join(process.cwd(), 'uploads/compress');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const extname = path.extname(file.originalname);
    const fileName = `medium_${Date.now()}${extname}`; // Menambahkan 'medium_' sebelum nama file
    const filePath = path.join(outputDir, fileName);

    const format = mimeToSharpFormat[file.mimetype]; // Pastikan mimeToSharpFormat didefinisikan dengan benar
    const compressedImageBuffer = await sharp(file.buffer)
      .resize(1200) // Resize image to 1200px width
      .toFormat(format) // Convert image to appropriate format
      .toBuffer();

    fs.writeFileSync(filePath, compressedImageBuffer);
    return fileName; // Return the name of the compressed file
  }
}

export function parseDDMMYYYY(dateString: string): Date | null {
  const [day, month, year] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? null : date;
}
// Fungsi validasi dinamis untuk cek apakah data sudah ada berdasarkan kolom tertentu
export async function isRecordExist(
  column: string,
  value: string | number,
  table: string,
  excludeId?: number | string,
): Promise<boolean> {
  const existingRecordQuery = dbMssql(table) // Ganti dengan query builder yang Anda pakai, misalnya knex.js
    .select('*')
    .where(column, value); // Cek jika ada username dengan value yang diberikan

  // Jika ada excludeId, kita exclude pengecekan pada record dengan id tersebut
  if (excludeId) {
    existingRecordQuery.whereNot('id', excludeId);
  }

  const existingRecord = await existingRecordQuery.first(); // Mendapatkan satu data saja
  return existingRecord !== undefined; // Jika ada, return true
}
export function convertToDateFormat(dateString) {
  const [day, month, year] = dateString.split('-');
  return `${year}/${month}/${day}`;
}
export function formatEmailDate(input: string | Date): string {
  let date: Date;

  if (typeof input === 'string') {
    // Cek apakah formatnya DD-MM-YYYY (ada dua strip dan panjang tiap segmen 2–4 digit)
    const parts = input.split('-');
    if (
      parts.length === 3 &&
      parts[0].length === 2 &&
      parts[1].length === 2 &&
      parts[2].length === 4
    ) {
      // parts = [DD, MM, YYYY]
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JavaScript bulan: 0–11
      const year = parseInt(parts[2], 10);
      date = new Date(year, month, day);
    } else {
      // fallback ke parser bawaan (misalnya ISO 2025-06-03)
      date = new Date(input);
    }
  } else {
    date = input;
  }

  if (isNaN(date.getTime())) {
    // Kalau tetap invalid, kembalikan string kosong atau pesan error sederhana
    return '–– INVALID DATE ––';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('id-ID', { month: 'short' }).toUpperCase();
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}
export function addcslashes(str: string, chars: string): string {
  const escapedChars = chars
    .split('')
    .map((char) => `\\${char}`)
    .join('');
  const regex = new RegExp(`[${escapedChars}]`, 'g');
  return str.replace(regex, '\\$&');
}

export async function getLastNumber(
  trx: any,
  table: string,
  year: number,
  month: number,
  type: string,
  statusformat: string,
) {
  if (type === 'RESET BULAN') {
    return trx(table)
      .forUpdate()
      .where('tglbukti', '>=', `${year}-${month}-01`)
      .andWhere('tglbukti', '<', `${year}-${month + 1}-01`)
      .andWhere('statusformat', statusformat)
      .orderBy('nobukti', 'desc')
      .first();
  }

  if (type === 'RESET TAHUN') {
    return trx(table)
      .forUpdate()
      .where('tglbukti', '>=', `${year}-01-01`)
      .andWhere('tglbukti', '<', `${year + 1}-01-01`)
      .andWhere('statusformat', statusformat)
      .orderBy('nobukti', 'desc')
      .first();
  }

  const query = await trx(table)
    .forUpdate()
    .select('nobukti')
    .where('statusformat', statusformat)
    .orderBy('nobukti', 'desc')
    .first();

  return query;
}
// Pakai ini, ganti fungsi lama
export const formatDateToSQL = (input?: string | null | any): string | null => {
  const s = String(input ?? '').trim();
  if (!s || s === 'undefined' || s === 'null') return null;
  // Handle Date object
  if (input instanceof Date) {
    const year = input.getFullYear();
    const month = String(input.getMonth() + 1).padStart(2, '0');
    const day = String(input.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Handle ISO 8601 dan variants
  // Matches: 2025-09-10T00:00:00.000Z, 2025-09-10T00:00:00, etc.
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(T|$)/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return isValid(y, m, d) ? `${y}-${m}-${d}` : null;
  }

  // DD-MM-YYYY → konversi ke YYYY-MM-DD
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return isValid(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
  }

  // DD/MM/YYYY → konversi ke YYYY-MM-DD (optional: handle slash separator)
  const dmySlash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (dmySlash) {
    const [, d, m, y] = dmySlash;
    return isValid(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
  }

  // Format lain tidak didukung
  return null;

  function isValid(y: string, m: string, d: string): boolean {
    const yy = Number(y),
      mm = Number(m),
      dd = Number(d);
    if (yy < 1000 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
    const dt = new Date(yy, mm - 1, dd);
    return (
      dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd
    );
  }

  function pad(n: string | number): string {
    const v = Number(n);
    return v < 10 ? `0${v}` : String(v);
  }
};

export const formatDateTimeToSQL = (val: string) => {
  const raw = String(val).trim().replace('T', ' ');
  const [d, t = '00:00'] = raw.split(' ');
  const [hh = '00', mm = '00', ss = '00'] = t.split(':');
  return `${d} ${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}.000`;
};
export const tandatanya = 'CHAR(63)';
// Helper functions (diperbaiki untuk format US input, output Indonesia)
export function parseNumberWithSeparators(str: string): number {
  if (!str || typeof str !== 'string') return NaN;

  // Hapus spasi dan koma (pemisah ribuan US style)
  const cleaned = str.trim().replace(/,/g, '');

  // parseFloat akan handle titik sebagai desimal
  return parseFloat(cleaned);
}

export function formatIndonesianNumber(
  num: number,
  includeDecimals: boolean = false,
): string {
  if (isNaN(num) || num < 0) return '0'; // Hanya untuk positif

  // Gunakan locale 'id-ID' untuk titik ribuan dan koma desimal
  const options: Intl.NumberFormatOptions = {
    style: 'decimal',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  };

  let formatted = num.toLocaleString('id-ID', options);

  // Jika desimal adalah ',00', hapus untuk clean (opsional, sesuaikan kebutuhan)
  if (!includeDecimals && formatted.endsWith(',00')) {
    formatted = formatted.slice(0, -4); // Hapus ',00'
  }

  return formatted;
}

// Fungsi helper untuk format negatif (untuk log nominalValue)
export function formatIndonesianNegative(num: number): string {
  if (isNaN(num)) return '0';
  const absNum = Math.abs(num);
  const formattedAbs = formatIndonesianNumber(absNum);
  return num < 0 ? `-${formattedAbs}` : formattedAbs;
}
