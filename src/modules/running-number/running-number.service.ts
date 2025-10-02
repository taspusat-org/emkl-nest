import { Injectable } from '@nestjs/common';
import { dbMssql } from 'src/common/utils/db';
import { formatDateToSQL } from 'src/utils/utils.service';

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
    // Code for fetching the last number based on the date range
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

    // Reset Year logic
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
    const date = formatDateToSQL(tgl);
    if (!date) {
      throw new Error('Tanggal tidak valid!');
    }
    const dateParts = date.split('-');
    if (dateParts.length < 2 || !dateParts[0] || !dateParts[1]) {
      throw new Error('Format tanggal tidak valid!');
    }
    const year = parseInt(dateParts[0], 10); // ambil tahun, jadi 2025
    const month = parseInt(dateParts[1], 10); // ambil bulan, jadi 10
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
      }
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

    let tujuanData = '';
    if (tujuan) {
      const datatujuan = await trx('tujuankapal')
        .select('kode')
        .where('id', tujuan)
        .first();
      tujuanData = datatujuan.kode;
    }

    let marketingData = '';
    if (marketing) {
      const datamarketing = await trx('marketing')
        .select('kode')
        .where('id', marketing)
        .first();
      marketingData = datamarketing.kode;
    }

    // New logic to handle digits for '9'
    // Hitung digit '9' yang ada di format, misal '9999' berarti 4 digit
    const digitMatch = format.match(/9+/);
    let digitCount = 0;
    if (digitMatch) {
      digitCount = digitMatch[0].length;
    }

    // Buat string angka dengan padding sesuai digitCount
    let nextNumberString = nextNumber.toString();
    if (digitCount > 0) {
      nextNumberString = nextNumberString.padStart(digitCount, '0');
    }

    // Update placeholders dengan angka yang sudah dipadding
    const placeholders = {
      '9999': nextNumberString, // angka sudah dipadding
      R: this.numberToRoman(month), // Bulan dalam format Roman
      M: marketingData, // Kode Marketing
      T: tujuanData, // Kode Tujuan
      y: year.toString().slice(-2), // Tahun 2 digit
      Y: year, // Tahun 4 digit
      C: cabangData || '', // Cabang
    };

    let runningNumber = this.formatNumber(format, placeholders);

    // Hapus bagian replace angka global yang ada di bawah ini:
    // runningNumber = runningNumber.replace(/(\d+)/, nextNumberString);

    // Loop cek keunikan nomor
    let isUnique = false;
    while (!isUnique) {
      const existingNobukti = await trx(table)
        .where('nobukti', runningNumber)
        .first();

      if (!existingNobukti) {
        isUnique = true;
      } else {
        nextNumber++;
        // Update nextNumberString dengan padding
        nextNumberString = nextNumber.toString().padStart(digitCount, '0');
        placeholders['9999'] = nextNumberString;

        runningNumber = this.formatNumber(format, placeholders);
      }
    }
    console.log(runningNumber, 'runningNumber');
    return runningNumber;
  }

  formatNumber(format: string, placeholders: { [key: string]: any }): string {
    let formatted = format;
    // Mengganti placeholder yang diapit dengan '#', seperti #9999#, #R#, #Y#
    for (const [placeholder, value] of Object.entries(placeholders)) {
      const regex = new RegExp(`#${placeholder}#`, 'g');
      if (regex.test(formatted)) {
        // Gantikan hanya placeholder yang diapit dengan tanda '#'
        formatted = formatted.replace(regex, value.toString());
      }
    }

    // Mengganti placeholder tanpa tanda '#', misalnya 'T', 'M', dll
    // Gunakan word boundaries untuk menghindari penggantian di dalam kata literal seperti "BST"
    for (const [placeholder, value] of Object.entries(placeholders)) {
      if (!format.includes(`#${placeholder}#`)) {
        // Gunakan \b untuk word boundaries agar hanya ganti jika standalone
        const escapedPlaceholder = placeholder.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&',
        ); // Escape special chars jika ada
        const regex = new RegExp(`\\b${escapedPlaceholder}\\b`, 'g');
        formatted = formatted.replace(regex, value.toString());
      }
    }
    // Menghapus semua tanda '#' yang tersisa jika ada, misalnya dalam #BST

    formatted = formatted.replace(/#/g, '');
    console.log(formatted, 'formatted');
    return formatted;
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
}
