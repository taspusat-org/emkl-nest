import { Injectable } from '@nestjs/common';
import { dbMssql } from 'src/common/utils/db';

@Injectable()
export class RunningNumberService {
  async getLastNumber(
    trx: any,
    table: string,
    year: number,
    month: number,
    type: string,
    statusformat: string,
  ) {
    console.log('type', type == 'RESET BULAN');
    console.log('type', type);

    if (type === 'RESET BULAN') {
      // Get all the 'nobukti' values for the given month and order them
      const rows = await trx(table)
        .select('nobukti')
        .where('tglbukti', '>=', `${year}-${month}-01`)
        .andWhere('tglbukti', '<', `${year}-${month + 1}-01`)
        .orderBy('nobukti', 'asc');

      return rows;
    }

    if (type === 'RESET TAHUN') {
      return trx(table)
        .forUpdate()
        .where('tglbukti', '>=', `${year}-01-01`)
        .andWhere('tglbukti', '<', `${year + 1}-01-01`)
        .orderBy('nobukti', 'desc') // Descending order to get the latest
        .first();
    }

    return trx(table)
      .forUpdate()
      .select('nobukti')
      .orderBy('nobukti', 'desc')
      .first();
  }

  async saveRunningNumber(
    table: string,
    data: { nobukti: string; tglbukti: string; statusformat: string },
  ) {
    return dbMssql(table).insert(data);
  }

  async generateRunningNumber(
    trx: any,
    group: string,
    subGroup: string,
    table: string,
    tgl: string,
    tujuan?: string | null,
    cabang?: string | null,
    jenisbiaya?: string | null,
    marketing?: string | null,
  ): Promise<string> {
    const date = new Date(tgl);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // Fetch parameter format from the database
    const parameter = await trx('parameter')
      .select('id', 'text', 'type')
      .where('grp', group)
      .andWhere('subgrp', subGroup)
      .first();
    if (!parameter) {
      throw new Error('Parameter tidak ditemukan!');
    }

    const typeformat = await trx('parameter')
      .select('text')
      .where('id', parameter.type)
      .first();
    const format = parameter.text;
    const type = typeformat.text || '';

    // Get all 'nobukti' values for this month
    const lastRowData = await this.getLastNumber(
      trx,
      table,
      year,
      month,
      type,
      parameter.id,
    );

    // Get the used 'nobukti' numbers and extract the number part
    const usedNumbers = lastRowData
      .map((row) => {
        const match = row.nobukti.match(/(\d+)(?=\/)/);
        return match ? parseInt(match[0], 10) : null;
      })
      .filter((num) => num !== null);

    // Find the smallest unused number by checking gaps in the sequence
    let nextNumber = 1; // Start from 1

    // Check for the first available number (skip already used numbers)
    usedNumbers.sort((a, b) => a - b); // Sort numbers in ascending order
    for (let i = 0; i < usedNumbers.length; i++) {
      if (usedNumbers[i] !== nextNumber) {
        break; // Gap found
      }
      nextNumber++; // Increment to the next available number
    }

    const placeholders = {
      '9999': nextNumber,
      R: this.numberToRoman(month),
      Y: year,
    };

    // Format the new 'nobukti' based on the format
    let runningNumber = this.formatNumber(format, placeholders);

    // Now, ensure the generated 'nobukti' is unique
    let isUnique = false;
    while (!isUnique) {
      // Check if the generated 'nobukti' already exists in the database
      const existingNobukti = await trx(table)
        .where('nobukti', runningNumber)
        .first();

      if (!existingNobukti) {
        // If it doesn't exist, it's unique, and we can proceed
        isUnique = true;
      } else {
        // If it exists, increment the number and try again
        nextNumber++;
        const newPlaceholders = {
          '9999': nextNumber,
          R: this.numberToRoman(month),
          Y: year,
        };
        // Re-generate the new 'nobukti'
        runningNumber = this.formatNumber(format, newPlaceholders);
      }
    }

    // Optionally, save the new running number to the database (if needed)
    // await this.saveRunningNumber(table, {
    //   nobukti: runningNumber,
    //   tglbukti: tgl,
    //   statusformat: parameter.id,
    // });

    return runningNumber;
  }

  numberToRoman(num: number): string {
    const romanMap = [
      { value: 1000, numeral: 'M' },
      { value: 900, numeral: 'CM' },
      { value: 500, numeral: 'D' },
      { value: 400, numeral: 'CD' },
      { value: 100, numeral: 'C' },
      { value: 90, numeral: 'XC' },
      { value: 50, numeral: 'L' },
      { value: 40, numeral: 'XL' },
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 5, numeral: 'V' },
      { value: 4, numeral: 'IV' },
      { value: 1, numeral: 'I' },
    ];

    return romanMap.reduce((acc, { value, numeral }) => {
      const count = Math.floor(num / value);
      num %= value;
      return acc + numeral.repeat(count);
    }, '');
  }

  formatNumber(format: string, placeholders: { [key: string]: any }): string {
    let formatted = format;

    // Replace placeholders with the correct values
    for (const [placeholder, value] of Object.entries(placeholders)) {
      const regex = new RegExp(`${placeholder}`, 'g');
      if (placeholder === '9999') {
        formatted = formatted.replace(regex, value.toString().padStart(4, '0'));
      } else {
        formatted = formatted.replace(regex, value.toString());
      }
    }

    // Clean up any remaining '#' characters
    formatted = formatted.replace(/#/g, '');

    return formatted;
  }
}
