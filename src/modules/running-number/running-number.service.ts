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
    if (type === 'RESET BULAN') {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);
      const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);

      const rows = await trx(table)
        .select('nobukti')
        .where('tglbukti', '>=', startDateStr)
        .andWhere('tglbukti', '<', endDateStr)
        .orderBy('nobukti', 'asc');

      return rows;
    }

    if (type === 'RESET TAHUN') {
      const startDate = `${year}-01-01`;
      const endDate = `${year + 1}-01-01`;

      return trx(table)
        .forUpdate()
        .where('tglbukti', '>=', startDate)
        .andWhere('tglbukti', '<', endDate)
        .orderBy('nobukti', 'desc')
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
    cabang?: string | null,
    tujuan?: string | null,
    jenisbiaya?: string | null,
    marketing?: string | null,
  ): Promise<string> {
    const date = new Date(tgl);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

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

    const lastRowData = await this.getLastNumber(
      trx,
      table,
      year,
      month,
      type,
      parameter.id,
    );

    const usedNumbers = lastRowData
      .map((row) => {
        const match = row.nobukti.match(/(\d+)(?=\/)/);
        return match ? parseInt(match[0], 10) : null;
      })
      .filter((num) => num !== null);

    let nextNumber = 1;
    usedNumbers.sort((a, b) => a - b);

    for (let i = 0; i < usedNumbers.length; i++) {
      if (usedNumbers[i] !== nextNumber) {
        break;
        break;
      }
      nextNumber++;
      nextNumber++;
    }

    let cabangData = '';
    if (cabang) {
      const datacabang = await trx('cabang')
        .select('kodecabang')
        .where('id', cabang)
        .first();
      cabangData = datacabang.kodecabang;
    }
    const placeholders = {
      '9999': nextNumber,
      R: this.numberToRoman(month), // Bulan dalam format Roman
      Y: year, // Tahun dalam format string (untuk memastikan diubah dengan benar)
      C: cabangData || '', // Cabang
    };

    let runningNumber = this.formatNumber(format, placeholders);

    let isUnique = false;
    while (!isUnique) {
      const existingNobukti = await trx(table)
        .where('nobukti', runningNumber)
        .first();

      if (!existingNobukti) {
        isUnique = true;
      } else {
        nextNumber++;
        const newPlaceholders = {
          '9999': nextNumber,
          R: this.numberToRoman(month),
          Y: year, // Tahun dalam format string
          C: cabangData || '',
        };
        runningNumber = this.formatNumber(format, newPlaceholders);
      }
    }

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

    for (const [placeholder, value] of Object.entries(placeholders)) {
      console.log('placeholder', placeholder); // Debugging output
      console.log('value', value); // Debugging output

      if (placeholder === '9999') {
        // For '9999', make sure it is padded to 4 digits
        formatted = formatted.replace(
          new RegExp(`#${placeholder}#`, 'g'),
          value.toString().padStart(4, '0'),
        );
      } else if (formatted.includes(`#${placeholder}#`)) {
        // For placeholders like #R#, #Y#, #C# etc.
        formatted = formatted.replace(
          new RegExp(`#${placeholder}#`, 'g'),
          value.toString(),
        );
      } else if (formatted.includes(placeholder)) {
        // For placeholders like R, Y, C directly embedded
        formatted = formatted.replace(
          new RegExp(placeholder, 'g'),
          value.toString(),
        );
      }
    }

    // Remove any remaining '#' characters
    formatted = formatted.replace(/#/g, '');
    return formatted;
  }
}
