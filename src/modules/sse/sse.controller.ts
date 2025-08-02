import { Controller, Sse } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import * as http from 'http';
import * as ping from 'ping'; // Import ping library
import { BotService } from '../bot/bot.service';

// Definisikan tipe MessageEvent yang lebih ringkas
interface SimpleMessageEvent {
  data: any;
}

@Controller('sse')
export class SseController {
  private statusSubject = new Subject<SimpleMessageEvent>();
  private isServerAlive: Record<string, boolean | null> = {}; // Simpan status untuk banyak server
  private isPingAlive: Record<string, boolean | null> = {}; // Simpan status ping untuk banyak host
  private isMessageSent: Record<string, boolean> = {}; // Status pesan untuk tiap server
  private isPingMessageSent: Record<string, boolean> = {}; // Status pesan untuk tiap host
  private readonly urlsToCheck = {
    'Trucking Jakarta': 'http://tasjkt.kozow.com:8074', // Key adalah nama server
    'Trucking Surabaya': 'http://tassby.kozow.com:8074', // Key adalah nama server
    'Trucking Medan': 'http://tasmdn.kozow.com:8074', // Key adalah nama server
    'Trucking Makassar': 'http://tasmks.kozow.com:8074', // Key adalah nama server
    'Trucking Bitung': 'http://100.118.9.62:8074', // Key adalah nama server
    'Emkl Surabaya': 'http://tassby.kozow.com:8073', // Key adalah nama server
  }; // Daftar URL untuk pengecekan HTTP
  private readonly pingHosts = {
    // 'Ping Trucking Jakarta': 'tasjkt.kozow.com', // Key adalah nama host
    'Server Trucking Surabaya': 'tassby.kozow.com', // Key adalah nama server
    'Server Trucking Medan': 'tasmdn.kozow.com', // Key adalah nama server
    'Server Trucking Makassar': 'tasmks.kozow.com', // Key adalah nama server
    'Server Trucking Bitung': '100.118.9.62', // Key adalah nama server
    'Server Emkl Surabaya': 'tassby.kozow.com', // Key adalah nama server
  }; // Daftar host untuk ping
  private readonly POLL_INTERVAL = 5000; // 5 detik

  constructor(private readonly botService: BotService) {
    // Mulai polling sejak instansiasi controller
    setInterval(() => this.checkServerStatus(), this.POLL_INTERVAL);
  }

  @Sse('status')
  sendStatus(): Observable<SimpleMessageEvent> {
    // Langsung return observable; polling sudah jalan di background
    return this.statusSubject.asObservable();
  }

  private async checkServerStatus() {
    // Loop untuk memeriksa setiap URL HTTP
    for (const [serverName, url] of Object.entries(this.urlsToCheck)) {
      const httpAlive = await this.checkIfServerIsAlive(url);

      // Jika status HTTP server berubah
      if (httpAlive !== this.isServerAlive[serverName]) {
        this.isServerAlive[serverName] = httpAlive;
        const statusMessage = httpAlive
          ? `${serverName} is Alive`
          : `${serverName} is Dead`;
        if (!httpAlive && !this.isMessageSent[serverName]) {
          // Kirim pesan hanya jika server HTTP mati dan belum dikirim
          await this.botService.sendWhatsappMessage3(
            `Alert❗❌\n\n Service Apache pada Server ${serverName} tidak bisa diakses!`,
          );
          this.isMessageSent[serverName] = true; // Tandai pesan sudah dikirim
        } else if (httpAlive && this.isMessageSent[serverName]) {
          this.isMessageSent[serverName] = false; // Reset pesan jika server HTTP kembali hidup
        }

        this.statusSubject.next({ data: { status: statusMessage } });
      }
    }

    // Loop untuk memeriksa setiap host ping
    for (const [hostName, host] of Object.entries(this.pingHosts)) {
      const pingAlive = await this.pingServer(host);
      const statusMessage = pingAlive
        ? `${hostName} is Alive`
        : `${hostName} is Dead`;
      // Jika status ping server berubah
      if (pingAlive !== this.isPingAlive[hostName]) {
        this.isPingAlive[hostName] = pingAlive;

        if (!pingAlive && !this.isPingMessageSent[hostName]) {
          // Kirim pesan ping terputus hanya jika belum pernah dikirim
          await this.botService.sendWhatsappMessage3(
            `Alert❗❌\n\n ${hostName} tidak bisa dijangkau kemungkinan kendala ada di jaringan atau listrik yang padam`,
          );
          this.isPingMessageSent[hostName] = true; // Tandai pesan ping sudah dikirim
        } else if (pingAlive && this.isPingMessageSent[hostName]) {
          this.isPingMessageSent[hostName] = false; // Reset pesan jika ping berhasil kembali
        }
      }
    }
  }

  // Fungsi untuk mengecek status server HTTP
  private checkIfServerIsAlive(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.request(url, { timeout: 3000 }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }

  // Fungsi untuk ping server menggunakan library ping
  private async pingServer(host: string): Promise<boolean> {
    return new Promise((resolve) => {
      ping.promise
        .probe(host, { timeout: 10 }) // Ping dengan timeout 10 detik
        .then((res) => {
          if (res.alive) {
            resolve(true); // Host terjangkau
          } else {
            resolve(false); // Host tidak terjangkau
          }
        })
        .catch((err) => {
          resolve(false); // Jika ada error, anggap tidak terjangkau
        });
    });
  }
}
