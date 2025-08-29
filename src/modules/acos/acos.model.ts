import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { dbMssql } from 'src/common/utils/db';
import { CreateAcosDto } from './dto/create-aco.dto';

export class AcosModel {
  static async syncAcos(username: string) {
    const acosEntries: CreateAcosDto[] = [];

    // BAGIAN 1: Scanning dari file controller (kode existing)
    const controllersPath = 'src/modules/**/*.controller.ts';
    const files = glob.sync(controllersPath);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      // Regex to match HTTP methods and comments
      const regex =
        /@(Get|Post|Put|Delete|Patch)$[^)]*$[\s\S]*?\/\/@([\w\- ]+)/g;
      let match;

      // Capture all matches for HTTP methods and class names
      while ((match = regex.exec(content)) !== null) {
        const httpMethod = match[1].toUpperCase(); // Extract HTTP method type (GET, POST, etc.)
        const className = match[2]?.trim(); // Extract class name and ensure it's trimmed

        if (httpMethod && className) {
          acosEntries.push({
            class: className,
            method: httpMethod,
            nama: `${className}->${httpMethod}`,
            modifiedby: username,
          });
        }
      }
    }

    // BAGIAN 2: Generate dari tabel parameter dengan YA dan TIDAK
    try {
      // Query tabel parameter dengan filter grp = 'DATA PENDUKUNG'
      const parameterEntries = await dbMssql('parameter')
        .select('subgrp', 'text')
        .where('grp', 'DATA PENDUKUNG')
        .whereNotNull('subgrp') // Pastikan subgrp tidak null
        .whereNotNull('text') // Pastikan text tidak null
        .andWhere('subgrp', '!=', '') // Pastikan subgrp tidak kosong
        .andWhere('text', '!=', ''); // Pastikan text tidak kosong

      // Transform data parameter menjadi format ACOS dengan YA dan TIDAK
      for (const param of parameterEntries) {
        if (param.subgrp && param.text) {
          const classValue = param.subgrp.trim();
          const baseMethodValue = param.text.trim();

          // Array untuk suffix YA dan TIDAK
          const suffixes = ['YA', 'TIDAK'];

          // Buat 2 entry untuk setiap parameter (YA dan TIDAK)
          for (const suffix of suffixes) {
            const methodValue = `${baseMethodValue} -> ${suffix}`;

            acosEntries.push({
              class: classValue,
              method: methodValue,
              nama: `${classValue}->${methodValue}`,
              modifiedby: username,
            });
          }
        }
      }

      console.log(
        `Found ${parameterEntries.length} entries from parameter table, generated ${parameterEntries.length * 2} ACOS entries`,
      );
    } catch (error) {
      console.error('Error fetching parameter data:', error);
      // Lanjutkan proses meskipun ada error pada query parameter
    }

    if (acosEntries.length === 0) {
      return { success: false, message: 'No ACOS entries found.' };
    }

    // Remove duplicates based on class and method
    const uniqueAcosEntries = acosEntries.filter(
      (value, index, self) =>
        index ===
        self.findIndex(
          (t) => t.class === value.class && t.method === value.method,
        ),
    );

    console.log('Unique acosEntries:', uniqueAcosEntries);

    try {
      // Create "OR" conditions for each class-method pair
      const conditions = uniqueAcosEntries
        .map(
          (entry) =>
            `([class] = '${entry.class}' AND [method] = '${entry.method}')`,
        )
        .join(' OR ');

      // Query the database for existing entries based on the class-method pairs
      const existingEntries = await dbMssql('acos')
        .select('class', 'method')
        .whereRaw(conditions);

      // Filter out entries that already exist
      const newEntries = uniqueAcosEntries.filter(
        (entry) =>
          !existingEntries.some(
            (existing) =>
              existing.class === entry.class &&
              existing.method === entry.method,
          ),
      );

      // Insert new entries if any
      if (newEntries.length > 0) {
        const result = await dbMssql('acos').insert(newEntries).returning('*');

        // Log summary hasil sync
        const controllerCount = newEntries.filter((e) =>
          ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(e.method),
        ).length;

        // Identifikasi parameter entries berdasarkan adanya simbol arrow (→)
        const parameterCount = newEntries.filter((e) =>
          e.method.includes('->'),
        ).length;

        return {
          success: true,
          data: result,
          summary: {
            totalNewEntries: newEntries.length,
            fromControllers: controllerCount,
            fromParameters: parameterCount,
            parameterYA: newEntries.filter((e) => e.method.includes('-> YA'))
              .length,
            parameterTIDAK: newEntries.filter((e) =>
              e.method.includes('-> TIDAK'),
            ).length,
          },
        };
      } else {
        return { success: true, message: 'No new ACOS entries to sync.' };
      }
    } catch (error) {
      console.error('Error syncing ACOS:', error);
      return { success: false, message: 'Failed to sync ACOS data.', error };
    }
  }
}
