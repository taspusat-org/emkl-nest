import { Injectable } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api'; // Menggunakan import jika menggunakan ESModule
import { Client, ClientOptions, LocalAuth, Message } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import { dbMssql } from 'src/common/utils/db';
import * as path from 'path';
import * as fs from 'fs';
@Injectable()
export class BotService {
  private bot: TelegramBot;
  private chatId: string = '-1002388728181'; // Ganti dengan ID grup Anda
  private whatsappGroupId: string = '6281321232720-1583291142@g.us'; // Ganti dengan ID grup WhatsApp
  private whatsappGroupId2: string = '120363401982707501@g.us'; // Ganti dengan ID grup WhatsApp
  private whatsappChatId: string = '6289652164724@c.us'; // Ganti dengan ID grup WhatsApp
  private whatsappClient: Client;
  constructor() {
    // Tempat menyimpan QR code
    const options: ClientOptions = {
      puppeteer: { headless: true }, // Menggunakan puppeteer untuk menjalankan browser secara headless
    };

    const token = '7025202986:AAHLW64Ght3115fBdvRGaWqLHK-Dlimtvk4'; // Ganti dengan token bot Anda
    this.bot = new TelegramBot(token);

    this.whatsappClient = new Client(options);

    // Menangani QR code untuk login pertama kali
    this.whatsappClient.on('qr', (qr: string) => {
      this.generateQRCode(qr);
    });

    // Debugging: Log jika login gagal
    this.whatsappClient.on('auth_failure', (msg) => {
      console.log('Authentication failed:', msg);
    });

    // Menangani saat WhatsApp client siap
    this.whatsappClient.on('ready', () => {
      console.log('WhatsApp client is ready!');
    });

    // Debugging: Log jika client tidak dapat terkoneksi
    this.whatsappClient.on('disconnected', (reason) => {
      console.log('WhatsApp client disconnected:', reason);
    });

    // Inisialisasi WhatsApp client
    this.whatsappClient.initialize();
  }
  private readonly qrFilePath = path.join(process.cwd(), 'qrcode.png');
  async generateQRCode(qrData: string): Promise<void> {
    // Cek apakah file QR code lama ada dan hapus jika ada
    if (fs.existsSync(this.qrFilePath)) {
      fs.unlinkSync(this.qrFilePath); // Menghapus file lama
      console.log('File QR code lama dihapus.');
    }

    // Menyimpan QR code ke file PNG
    try {
      await qrcode.toFile(this.qrFilePath, qrData); // Menghasilkan QR code dan menyimpannya ke file
      console.log('QR code generated and saved as qrcode.png');
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  }
  // Fungsi untuk mengirim pesan ke grup
  async sendMessage(message: string): Promise<void> {
    try {
      await this.bot.sendMessage(this.chatId, message);
    } catch (error) {
      console.error('Error saat mengirim pesan ke Telegram:', error);
    }
  }
  async sendWhatsappMessage(message: string): Promise<void> {
    try {
      await this.whatsappClient.sendMessage(this.whatsappGroupId, message);
    } catch (error) {
      console.error('Error sending message to WhatsApp:', error);
    }
  }
  async sendWhatsappMessage3(message: string): Promise<void> {
    try {
      await this.whatsappClient.sendMessage(this.whatsappGroupId2, message);
    } catch (error) {
      console.error('Error sending message to WhatsApp:', error);
    }
  }
  async sendWhatsappMessage2(
    numbers: string[],
    namakaryawan: string[],
  ): Promise<void> {
    try {
      let i = 0;
      while (true) {
        const number = numbers[i];
        const name = namakaryawan[i];

        // Format nomor WhatsApp (menghilangkan karakter non-digit dan menambahkan '@c.us')
        const formattedNumber = number.replace(/\D/g, '') + '@c.us';

        // Pesan yang ingin dikirim, dengan nama karyawan disisipkan
        const message = `Halo ${name}, ini adalah pesan otomatis dari Customer Service TAS.`;

        // Kirim pesan menggunakan WhatsApp Client
        await this.whatsappClient.sendMessage(formattedNumber, message);
        console.log(`Pesan berhasil dikirim ke ${formattedNumber}`);

        // Delay 1 detik sebelum mengirim pesan berikutnya
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Mengatur indeks agar jika sudah sampai akhir array kembali ke awal
        i = (i + 1) % numbers.length; // Jika sudah sampai akhir, kembali ke awal array
      }
    } catch (error) {
      console.error('Error sending message to WhatsApp:', error);
    }
  }

  async sendMessageToNumbers(): Promise<void> {
    try {
      // Ambil nomor karyawan dan nama karyawan yang belum resign
      const nomorKaryawan = await dbMssql('karyawan')
        .select('nohp', 'namakaryawan')
        .whereNull('tglresign');

      const batchSize = 1; // Kirim ke 1 nomor per batch
      const delay = 5000; // Delay 5 detik antara batch

      // Fungsi untuk mengirim pesan ke batch
      const sendBatch = async (batch: { number: string; name: string }[]) => {
        for (const { number, name } of batch) {
          const formattedNumber = number.replace(/\D/g, '') + '@c.us'; // Format nomor WhatsApp

          // Modifikasi pesan dengan menyisipkan nama karyawan
          const personalizedMessage = `Halo ${name}, ini tes notifikasi dari transporindo pusat, hanya sekedar testing pengujian broadcast whatsapp`;

          try {
            // Kirim pesan
            await this.whatsappClient.sendMessage(
              formattedNumber,
              personalizedMessage,
            );
            console.log(`Pesan berhasil dikirim ke ${name} (${number})`);
          } catch (error) {
            // Jika gagal mengirim pesan (misalnya nomor tidak terdaftar)
            console.error(
              `Gagal mengirim pesan ke ${name} (${number}): ${error.message}`,
            );
          }
        }
      };

      // Bagi nomor menjadi batch
      for (let i = 0; i < nomorKaryawan.length; i += batchSize) {
        const batch = nomorKaryawan.slice(i, i + batchSize).map((row) => {
          let number = row.nohp;
          if (number.startsWith('0')) {
            number = '62' + number.slice(1);
          }
          return { number, name: row.namakaryawan };
        });

        // Kirim batch
        await sendBatch(batch);

        // Tunggu selama 5 detik sebelum melanjutkan ke batch berikutnya
        if (i + batchSize < nomorKaryawan.length) {
          console.log(
            'Menunggu 5 detik sebelum melanjutkan pengiriman pesan...',
          );
          await new Promise((resolve) => setTimeout(resolve, delay)); // Delay 5 detik
        }
      }
    } catch (error) {
      console.error('Gagal mengirim pesan:', error);
    }
  }

  async sendBulkMessages(
    numbers: string[],
    message: string,
    count: number,
  ): Promise<void> {
    try {
      // Mendeklarasikan tipe array sendPromises yang berisi Promise<Message>
      const sendPromises: Promise<Message>[] = [];

      // Mengirim pesan sebanyak count kali
      for (let i = 0; i < count; i++) {
        numbers.forEach((number) => {
          const formattedNumber = number.replace(/\D/g, '') + '@c.us'; // Format nomor WhatsApp
          const sendPromise = this.whatsappClient.sendMessage(
            formattedNumber,
            `${message} - Pesan ke ${i + 1}`,
          );
          sendPromises.push(sendPromise);
        });
      }

      // Menunggu semua pesan dikirim
      await Promise.all(sendPromises);
      console.log(`${sendPromises.length} pesan berhasil dikirim`);
    } catch (error) {
      console.error('Gagal mengirim pesan:', error);
    }
  }
  async getGroups(): Promise<any[]> {
    try {
      const chats = await this.whatsappClient.getChats();

      return chats;
    } catch (error) {
      console.error('Error fetching groups:', error);
      throw new Error('Error fetching groups');
    }
  }
}
