import { Injectable } from '@nestjs/common';
import { getPrinters, print } from 'pdf-to-printer';
import fetch from 'node-fetch';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

@Injectable()
export class PrinterService {
  async getPrinters() {
    const printers = await getPrinters();
    return printers.map((p) => ({ name: p.name }));
  }

  async printFile(printerName: string, fileBuffer: Buffer): Promise<any> {
    if (!printerName || !fileBuffer) {
      throw new Error('Printer name and file data are required');
    }

    // Use a more robust way to create a temporary file path
    const tempFilePath = path.join(tmpdir(), `print_job_${Date.now()}.pdf`);

    // Write the buffer received directly from the request to the temp file
    await fs.writeFile(tempFilePath, fileBuffer);

    try {
      // Print the local temporary file
      await print(tempFilePath, { printer: printerName });
      console.log(`Document successfully sent to printer: ${printerName}`);
      return {
        success: true,
        message: 'Document successfully sent to printer',
      };
    } catch (error) {
      console.error('Failed to send document to printer:', error);
      throw new Error('Failed to send document to printer.');
    } finally {
      // Clean up the temporary file
      await fs.unlink(tempFilePath);
    }
  }
}
