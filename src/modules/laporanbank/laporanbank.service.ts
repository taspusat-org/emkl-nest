import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook } from 'exceljs';

@Injectable()
export class LaporanbankService {
  private readonly tableName = 'bank';
  create(createLaporanbankDto: any) {
    return 'This action adds a new laporanbank';
  }

  async findAll() {
    return `This action returns  laporanbank`;
  }

  findOne(id: number) {
    return `This action returns a #${id} laporanbank`;
  }

  update(id: number, updateLaporanbankDto: any) {
    return `This action updates a #${id} laporanbank`;
  }

  remove(id: number) {
    return `This action removes a #${id} laporanbank`;
  }

  async exportToExcel(data: any[]) {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Data Export');

    // Header perusahaan
    // Header perusahaan
    worksheet.mergeCells('A1:G1');
    worksheet.mergeCells('A2:G2');
    worksheet.mergeCells('A3:G3');
    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN BANK';
    worksheet.getCell('A3').value = 'Data Export';
    worksheet.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    worksheet.getCell('A2').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    worksheet.getCell('A3').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    worksheet.getCell('A1').font = { size: 14, bold: true };
    worksheet.getCell('A2').font = { bold: true };
    worksheet.getCell('A3').font = { bold: true };

    // Header kolom sesuai database
    const headers = [
      'NO.',
      'NAMA',
      'KETERANGAN',
      'KETERANGAN COA',
      'KETERANGAN COA GANTUNG',
      'STATUS BANK',
      'STATUS AKTIF',
    ];

    // Styling header
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(5, index + 1);
      cell.value = header;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF00' },
      };
      cell.font = { bold: true, name: 'Tahoma', size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Data rows
    data.forEach((row, rowIndex) => {
      const currentRow = rowIndex + 6;

      worksheet.getCell(currentRow, 1).value = rowIndex + 1;
      worksheet.getCell(currentRow, 2).value = row.nama;
      worksheet.getCell(currentRow, 3).value = row.keterangan;
      worksheet.getCell(currentRow, 4).value = row.keterangancoa;
      worksheet.getCell(currentRow, 5).value = row.keterangancoagantung;
      worksheet.getCell(currentRow, 6).value = row.textbank;
      worksheet.getCell(currentRow, 7).value = row.text;

      // Styling untuk setiap cell
      for (let col = 1; col <= headers.length; col++) {
        const cell = worksheet.getCell(currentRow, col);
        cell.font = { name: 'Tahoma', size: 10 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    });

    // Set column widths
    worksheet.getColumn(1).width = 6; // NO
    worksheet.getColumn(2).width = 20; // NAMA
    worksheet.getColumn(3).width = 30; // KETERANGAN
    worksheet.getColumn(4).width = 25; // COA
    worksheet.getColumn(5).width = 25; // KETERANGAN COA
    worksheet.getColumn(6).width = 25; // COA GANTUNG
    worksheet.getColumn(7).width = 25; // KETERANGAN COA GANTUNG

    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_bank_${Date.now()}.xlsx`,
    );
    await workbook.xlsx.writeFile(tempFilePath);

    return tempFilePath;
  }
}
