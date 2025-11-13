// connect.js - versão simplificada para rodar no Railway (não interativo)
import makeWASocket from "@adiwajshing/baileys";
import { useSingleFileAuthState } from "@adiwajshing/baileys";
import qrcode from "qrcode-terminal";
import express from "express";
import http from "http";
import fs from "fs";

const AUTH_FILE = './auth_info_multi.json';

// se a variável AUTH_JSON estiver definida (opção segura), grava em disco
if (process.env.AUTH_JSON) {
  try {
    fs.writeFileSync(AUTH_FILE, process.env.AUTH_JSON, { encoding: 'utf8' });
    console.log('auth_info_multi.json gravado a partir de AUTH_JSON');
  } catch (e) {
    console.error('Erro ao gravar AUTH_JSON em arquivo:', e.message);
  }
}

const { state, saveState } = useSingleFileAuthState(AUTH_FILE);

async function start() {
  // servidor simples pra manter o app "acordado"
  const app = express();
  app.get('/', (req, res) => res.send('Bot Baileys rodando'));
  app.get('/health', (req, res) => res.send('ok'));
  const port = process.env.PORT || 3000;
  http.createServer(app).listen(port, () => {
    console.log(`Servidor HTTP rodando na porta ${port}`);
  });

  // cria socket sem interações extras
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      // ASCII QR para logs (scan direto da tela do Railway)
      qrcode.generate(qr, { small: true });
      // também imprime a string do QR (base64) para casos em que precisa converter
      console.log('--- QR (base64) abaixo ---');
      console.log(qr);
      console.log('--- fim do QR ---');
    }
    if (connection === 'open') {
      console.log('Conectado ao WhatsApp!');
    }
    if (connection === 'close') {
      console.log('Conexão fechou:', lastDisconnect?.error?.message || lastDisconnect);
    }
  });

  // listener simples de mensagens (teste)
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const messages = m.messages ?? [];
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message?.extendedTextMessage?.text || '').toString();
        console.log('Mensagem de', from, ':', text);
        if (text.toLowerCase() === 'ping') {
          await sock.sendMessage(from, { text: 'pong' }, { quoted: msg });
        }
      }
    } catch (err) {
      console.error('Erro processando mensagem:', err);
    }
  });
}

start().catch(err => {
  console.error('Erro ao iniciar bot:', err);
  process.exit(1);
});
