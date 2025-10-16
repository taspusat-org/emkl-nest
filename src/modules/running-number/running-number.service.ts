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

  // Fungsi untuk mengekstrak prefix dari format
  extractPrefixFromFormat(format: string): string {
    // Ekstrak bagian sebelum #9999# atau placeholder angka lainnya
    // Misal: "PPL #9999#/R/Y" -> "PPL"
    // Misal: "PUT #9999#/R/Y" -> "PUT"

    // Coba ekstrak text sebelum #
    let match = format.match(/^([A-Z]+)\s*#/);
    if (match) {
      return match[1].trim();
    }

    // Jika tidak ada #, coba ekstrak text sebelum angka
    match = format.match(/^([A-Z]+)\s*\d/);
    if (match) {
      return match[1].trim();
    }

    // Jika tidak ada angka, ambil semua huruf kapital di awal
    match = format.match(/^([A-Z]+)/);
    return match ? match[1].trim() : '';
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
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);

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

    // Ekstrak prefix dari format (misal: "PPL", "EPL", "PEL")
    const formatPrefix = this.extractPrefixFromFormat(format);

    const lastRowData = await this.getLastNumber(
      trx,
      table,
      year,
      month,
      type,
      parameter.id,
    );

    console.log(lastRowData, 'lastRowData');
    console.log(format, 'format');
    console.log(formatPrefix, 'formatPrefix');

    // Filter hanya nobukti yang memiliki prefix yang sama
    const filteredRows = formatPrefix
      ? lastRowData.filter((row) => row.nobukti.startsWith(formatPrefix))
      : [];

    console.log(filteredRows, 'filteredRows with matching prefix');

    const usedNumbers = filteredRows
      .map((row) => {
        const match = row.nobukti.match(/(\d+)(?=\/)/);
        return match ? parseInt(match[0], 10) : null;
      })
      .filter((num) => num !== null);

    console.log(usedNumbers, 'usedNumbers from filtered rows');

    let nextNumber = 1;

    if (usedNumbers.length > 0) {
      usedNumbers.sort((a, b) => a - b);

      for (let i = 0; i < usedNumbers.length; i++) {
        if (usedNumbers[i] !== nextNumber) {
          break;
        }
        nextNumber++;
      }
    }

    console.log(nextNumber, 'nextNumber');

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

    // Hitung digit '9' yang ada di format (bisa #9#, #99#, #999#, #9999#, atau 9# tanpa # di awal)
    const digitMatch = format.match(/#?(9+)#/);
    let digitCount = 0;
    if (digitMatch) {
      digitCount = digitMatch[1].length; // Ambil panjang dari '9' yang ditemukan
    }

    // Buat string angka dengan padding sesuai digitCount
    let nextNumberString = nextNumber.toString();
    if (digitCount > 0) {
      nextNumberString = nextNumberString.padStart(digitCount, '0');
    }

    // Update placeholders dengan angka yang sudah dipadding
    const placeholders = {
      R: this.numberToRoman(month),
      M: marketingData,
      T: tujuanData,
      y: year.toString().slice(-2),
      Y: year.toString(),
      C: cabangData || '',
    };

    let runningNumber = this.formatNumber(
      format,
      placeholders,
      nextNumberString,
    );

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
        nextNumberString = nextNumber.toString().padStart(digitCount, '0');
        runningNumber = this.formatNumber(
          format,
          placeholders,
          nextNumberString,
        );
      }
    }

    return runningNumber;
  }

  formatNumber(
    format: string,
    placeholders: { [key: string]: any },
    nextNumberString: string,
  ): string {
    let formatted = format;

    // Step 1: Replace semua pola 9 (baik #9#, #99#, #999#, #9999#, atau 9# tanpa # di awal)
    // Pattern: #9+# atau ^9+# (9 di awal tanpa # sebelumnya)
    formatted = formatted.replace(/#(9+)#/g, nextNumberString);
    formatted = formatted.replace(/^(9+)#/g, nextNumberString);

    // Step 2: Replace placeholder yang diapit dengan '#', seperti #R#, #Y#, #M#, #T#, #C#, #y#
    for (const [placeholder, value] of Object.entries(placeholders)) {
      const regex = new RegExp(`#${placeholder}#`, 'g');
      formatted = formatted.replace(regex, value.toString());
    }

    // Step 3: Replace placeholder tanpa tanda '#' (untuk backward compatibility)
    // Hanya jika belum ada di format dengan #
    for (const [placeholder, value] of Object.entries(placeholders)) {
      if (!format.includes(`#${placeholder}#`)) {
        const escapedPlaceholder = placeholder.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&',
        );
        const regex = new RegExp(`\\b${escapedPlaceholder}\\b`, 'g');
        formatted = formatted.replace(regex, value.toString());
      }
    }

    // Step 4: Menghapus semua tanda '#' yang tersisa
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
