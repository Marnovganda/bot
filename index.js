import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import fetch from 'node-fetch';
import schedule from 'node-schedule';
import moment from 'moment-timezone';
import 'moment/locale/id.js';
import express from 'express';
import http from 'http';

moment.locale('id');

// === KONFIGURASI ===
const SHEET_ID = '16z5CZybXHdzfLEhwFCuL0wIYxoM98FsoG-TKMLXPzIU';
const SHEET_NAME = 'HariBesar';
const GROUP_ID = '120363405437459768@g.us';
const TZ = 'Asia/Jakarta';

// === WEB SERVER UNTUK KEEP-ALIVE (Replit + UptimeRobot) ===
const app = express();
app.get('/', (req, res) => res.send('Bot alive'));
app.get('/ping', (req, res) => res.send('pong'));
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🌐 Server listening on port ${PORT}`));

// === INISIALISASI CLIENT WHATSAPP ===
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('🔍 Scan QR di atas untuk login WhatsApp Web.');
});

client.on('ready', () => {
  console.log('✅ Bot WhatsApp pengingat hari besar aktif!');
  // Jadwal kirim otomatis setiap jam 07:00 WIB
  schedule.scheduleJob('0 7 * * *', async () => {
    await kirimPesanTerjadwal();
  });
});

// === FUNGSI UNTUK AMBIL DATA DARI GOOGLE SHEET ===
async function ambilDataSheet() {
  try {
    const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.map(row => ({
      tanggal: row.Tanggal,
      keterangan: row.Keterangan,
      kategori: row.Kategori || ''
    }));
  } catch (error) {
    console.error('❌ Gagal mengambil data sheet:', error);
    return [];
  }
}

// === FUNGSI UNTUK CEK HARI BESAR HARI INI ===
function cariHariBesarHariIni(data) {
  const hariIni = moment().tz(TZ).format('D MMMM YYYY');
  return data.filter(item => moment(item.tanggal, 'D MMMM YYYY').isSame(moment().tz(TZ), 'day'));
}

// === FUNGSI UNTUK KIRIM PESAN OTOMATIS KE GRUP ===
async function kirimPesanTerjadwal() {
  const data = await ambilDataSheet();
  const hariIni = cariHariBesarHariIni(data);

  if (hariIni.length > 0) {
    let pesan = `📅 *Hari Ini:*\n`;
    hariIni.forEach(item => {
      pesan += `🎉 ${item.keterangan}\n`;
      if (item.kategori) pesan += `📌 Kategori: ${item.kategori}\n`;
      pesan += '\n';
    });
    await client.sendMessage(GROUP_ID, pesan.trim());
    console.log('✅ Pesan hari besar terkirim ke grup.');
  } else {
    console.log('ℹ️ Tidak ada hari besar hari ini.');
  }
}

// === RESPON PERINTAH MANUAL ===
client.on('message', async msg => {
  if (msg.body.toLowerCase() === '/cek') {
    const data = await ambilDataSheet();
    const hariIni = cariHariBesarHariIni(data);
    if (hariIni.length > 0) {
      let pesan = `📅 *Hari Ini:*\n`;
      hariIni.forEach(item => {
        pesan += `🎉 ${item.keterangan}\n`;
        if (item.kategori) pesan += `📌 Kategori: ${item.kategori}\n`;
        pesan += '\n';
      });
      msg.reply(pesan.trim());
    } else {
      msg.reply('Hari ini tidak ada hari besar nasional atau Islam.');
    }
  }
});

client.initialize();
