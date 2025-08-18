import { Injectable } from '@nestjs/common';
import { CreateLaporanalatbayarDto } from './dto/create-laporanalatbayar.dto';
import { UpdateLaporanalatbayarDto } from './dto/update-laporanalatbayar.dto';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook, Column } from 'exceljs';

@Injectable()
export class LaporanalatbayarService {
  create(createLaporanalatbayarDto: CreateLaporanalatbayarDto) {
    return 'This action adds a new laporanalatbayar';
  }

  findAll() {
    return `This action returns all laporanalatbayar`;
  }

  findOne(id: number) {
    return `This action returns a #${id} laporanalatbayar`;
  }

  update(id: number, updateLaporanalatbayarDto: UpdateLaporanalatbayarDto) {
    return `This action updates a #${id} laporanalatbayar`;
  }

  remove(id: number) {
    return `This action removes a #${id} laporanalatbayar`;
  }

  async exportToExcel(data: any[]) {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Data Export');

    worksheet.mergeCells('A1:G1');
    worksheet.mergeCells('A2:G2');
    worksheet.mergeCells('A3:G3');
    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN ALAT BAYAR';
    worksheet.getCell('A3').value = 'Data Export';
    ['A1', 'A2', 'A3'].forEach((cellKey, i) => {
      worksheet.getCell(cellKey).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      worksheet.getCell(cellKey).font = {
        size: i === 0 ? 14 : 10,
        bold: true,
      };
    });

    const headers = [
      'NO.',
      'NAMA',
      'KETERANGAN',
      'STATUS LANGSUNG CAIR',
      'STATUS DEFAULT',
      'STATUS BANK',
      'STATUS AKTIF',
    ];

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

    data.forEach((row, rowIndex) => {
      const currentRow = rowIndex + 6;
      const rowValues = [
        rowIndex + 1,
        row.nama,
        row.keterangan,
        row.statuslangsungcair_text,
        row.statusdefault_text,
        row.statusbank_text,
        row.text,
      ];
      rowValues.forEach((value, colIndex) => {
        const cell = worksheet.getCell(currentRow, colIndex + 1);
        cell.value = value ?? '';
        cell.font = { name: 'Tahoma', size: 10 };
        cell.alignment = {
          horizontal: colIndex === 0 ? 'center' : 'left',
          vertical: 'middle',
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    worksheet.columns
      .filter((c): c is Column => !!c)
      .forEach((col) => {
        let maxLength = 0;
        col.eachCell({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value ? cell.value.toString() : '';
          maxLength = Math.max(maxLength, cellValue.length);
        });
        col.width = maxLength + 2;
      });

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
