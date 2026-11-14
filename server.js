/*
 * SIGP — Sistema Interno de Gestão Policial (RP)
 * Servidor próprio, sem dependências externas. Basta ter Node.js instalado.
 * Rodar:  node server.js        (porta padrão 3000, ou PORT=8080)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DB_FILE = path.join(ROOT, 'data.json');

// ───────── cargos ─────────
const CARGOS = {
  'Admin Master':     { nivel: 100, label: 'Admin Master' },
  'Chefe de Polícia': { nivel: 90,  label: 'Chefe de Polícia' },
  'Delegado':         { nivel: 80,  label: 'Delegado' },
  'Escrivão':         { nivel: 70,  label: 'Escrivão' },
  'Tático':           { nivel: 60,  label: 'Tático' },
  'Agente':           { nivel: 50,  label: 'Agente' },
  'Guarda Municipal': { nivel: 40,  label: 'Guarda Municipal' },
  'Civil':            { nivel: 10,  label: 'Civil' },
};
const nivel = (c) => (CARGOS[c] ? CARGOS[c].nivel : 0);

// ───────── códigos Q (rádio) — lista padrão, editável pelo Admin Master e Chefe ─────────
const CODIGOS_Q_PADRAO = [
  // ── comunicação básica ──
  { codigo: 'QAP', significado: 'Na escuta / permaneço na escuta aguardando chamado.', grupo: 'Comunicação' },
  { codigo: 'QRA', significado: 'Nome / identificação de quem está operando o rádio.', grupo: 'Comunicação' },
  { codigo: 'QRD', significado: 'Localização ou destino da guarnição.', grupo: 'Comunicação' },
  { codigo: 'QRG', significado: 'Frequência ou canal de operação.', grupo: 'Comunicação' },
  { codigo: 'QRU', significado: 'Tem alguma coisa (mensagem ou ocorrência) para mim?', grupo: 'Comunicação' },
  { codigo: 'QRV', significado: 'Estou à disposição / pronto para transmitir.', grupo: 'Comunicação' },
  { codigo: 'QRX', significado: 'Aguarde, chamo novamente em instantes.', grupo: 'Comunicação' },
  { codigo: 'QRZ', significado: 'Quem está me chamando? (quando não se entendeu o prefixo).', grupo: 'Comunicação' },
  { codigo: 'QSL', significado: 'Entendido / confirmo o recebimento da mensagem.', grupo: 'Comunicação' },
  { codigo: 'QSO', significado: 'Contato / comunicação direta entre duas estações.', grupo: 'Comunicação' },
  { codigo: 'QSY', significado: 'Mudar de frequência ou de canal.', grupo: 'Comunicação' },
  { codigo: 'QSM', significado: 'Repita a última mensagem.', grupo: 'Comunicação' },
  { codigo: 'QSP', significado: 'Retransmita a mensagem para outra estação.', grupo: 'Comunicação' },
  { codigo: 'QTA', significado: 'Cancelar / desconsiderar a última mensagem transmitida.', grupo: 'Comunicação' },
  { codigo: 'QTC', significado: 'Tenho mensagem para transmitir.', grupo: 'Comunicação' },
  { codigo: 'QTH', significado: 'Localização / endereço da ocorrência.', grupo: 'Comunicação' },
  { codigo: 'QTR', significado: 'Hora certa / hora oficial.', grupo: 'Comunicação' },
  { codigo: 'QRT', significado: 'Encerrar a transmissão / sair da escuta.', grupo: 'Comunicação' },
  { codigo: 'QTX', significado: 'Fico à disposição e saio da escuta.', grupo: 'Comunicação' },

  // ── qualidade do sinal ──
  { codigo: 'QSA', significado: 'Intensidade do sinal, de 1 (fraco) a 5 (forte).', grupo: 'Sinal' },
  { codigo: 'QRK', significado: 'Compreensão do sinal, de 1 (ruim) a 5 (perfeita).', grupo: 'Sinal' },
  { codigo: 'QRI', significado: 'Tonalidade do sinal, de 1 a 5.', grupo: 'Sinal' },
  { codigo: 'QSB', significado: 'Sinal fraco ou oscilando.', grupo: 'Sinal' },
  { codigo: 'QRM', significado: 'Interferência de outra estação no canal.', grupo: 'Sinal' },
  { codigo: 'QRN', significado: 'Ruído / chiado na transmissão.', grupo: 'Sinal' },

  // ── operação / apoio ──
  { codigo: 'QRL', significado: 'Estou ocupado, não interfira na frequência.', grupo: 'Operação' },
  { codigo: 'QRO', significado: 'Aumente a potência do rádio.', grupo: 'Operação' },
  { codigo: 'QRP', significado: 'Diminua a potência do rádio.', grupo: 'Operação' },
  { codigo: 'QRQ', significado: 'Transmita mais rápido.', grupo: 'Operação' },
  { codigo: 'QRS', significado: 'Transmita mais devagar (desço a velocidade da fala).', grupo: 'Operação' },
  { codigo: 'QSN', significado: 'Escute-me nesta frequência.', grupo: 'Operação' },
  { codigo: 'QSU', significado: 'Transmita nesta frequência / neste canal.', grupo: 'Operação' },
  { codigo: 'QSJ', significado: 'Valor / custo da ocorrência (em RP: valor de multa ou fiança).', grupo: 'Operação' },
  { codigo: 'QUD', significado: 'Recebi o sinal de emergência.', grupo: 'Operação' },
  { codigo: 'QUM', significado: 'Voltando ao funcionamento normal do serviço.', grupo: 'Operação' },
];

// ───────── banco de dados (arquivo JSON) ─────────
const REGRAS_PADRAO = "***REGRAS DA BÍBLIA RP***\n\n• 4.1 | É proibido a prática de MDM (Mass Deathmatch), que consiste em matar ou causar dano a três ou mais jogadores sem motivo válido dentro do RP.\nPunição: Prisão por 60 minutos, restrição de armas / Banimento de 3 a 7 dias.\n\n• 4.2 | PVP SEM MOTIVO\nÉ proibido iniciar PVP, disparar ou matar outro jogador sem possuir um motivo válido de Roleplay e sem interação prévia. Todo confronto deve possuir contexto e justificativa dentro do RP, sendo proibido iniciar ataques por diversão, vingança sem contexto, conflitos externos ao jogo ou apenas por pertencer a outra organização ou família. O PVP também é proibido em Zonas Seguras, independentemente do motivo.\nPunições:\n• 1ª ocorrência: Jail 60 minutos.\n• 2ª ocorrência no mesmo dia: Jail 120 minutos.\n• 3ª ocorrência: Banimento de 3 dias.\n• PVP em Zona Segura: Banimento de 3 dias.\n\n• 4.3 | É proibido a prática de VDM (Vehicle Deathmatch), que consiste em atropelar jogadores de forma intencional.\nPunição: Prisão por 60 minutos / Banimento de 1 a 5 dias.\n\n• 4.4 | É proibido MG (Metagaming), que consiste em utilizar informações obtidas fora do jogo para benefício próprio ou para prejudicar outro jogador.\nNota: É proibido o uso de emotions/emotes como \"=D\" no chat IC.\nPunição: Prisão por 60 minutos / Banimento de 1 a 3 dias.\n\n• 4.5 | É proibido CL (Combat Log), que consiste em sair do jogo durante uma ação para obter benefício, como evitar ser sequestrado, morto ou preso.\nPunição: Prisão por 60 minutos / Banimento de 1 a 3 dias.\n\n• 4.6 | É expressamente proibido DM (Deathmatch), que consiste em matar ou causar dano a outro jogador sem qualquer motivo válido dentro do RP.\nPunição: Prisão por 60 minutos / Banimento de 1 a 3 dias.\n\n• 4.7 | É proibido RK (Revenge Kill), que consiste em matar ou causar dano a um jogador com o objetivo de vingança por ter sido morto em uma vida anterior.\nPunição: Prisão por 60 minutos / Banimento de 1 a 3 dias.\n\n• 4.8 | É proibido SK (Spawn Kill), que consiste em matar ou causar dano a jogadores no território de qualquer facção ou organização, bem como em locais de spawn do jogador.\nPunição: Prisão por 60 minutos / Banimento de 1 a 5 dias.\n\n• 4.9 | É proibido TK (Team Kill), que consiste em matar ou causar dano a um membro da própria facção ou de facção aliada, sem qualquer motivo válido dentro do RP.\nPunição: Prisão por 40 minutos / Banimento de 1 a 2 dias.\n\n• 4.10 | É extremamente proibido cometer SAAV (Sem Amor à Vida): ato de não se importar com a própria vida no jogo, escolhendo morrer em vez de cooperar com a ação.\nPunição: prisão de 40 minutos / banimento de 1 a 3 dias.\n\n• 4.11 | É proibido Flaming RP\nÉ o uso de ofensas, insultos ou discurso de ódio direcionado a outros jogadores durante o RP.\nPunição: De acordo com a gravidade | Prisão + Mute de 60 minutos / Banimento de 1 a 30 dias.\n\n• 4.12 | É proibido KOS (Kill On Sight / Mate à Vista)\nÉ o ato de matar outro jogador de organização, facção ou família à vista, sem motivo ou contexto de RP.\nExemplo: na vida real, você não mataria uma pessoa apenas por ela pertencer a uma corporação policial.\nPunição: Prisão de 60 minutos / Banimento de 1 a 5 dias.\n\n• 4.13 | É proibido PK (Player Kill)\nRefere-se à morte do personagem, na qual o jogador perde toda a memória relacionada à pessoa que o matou e aos acontecimentos que levaram à sua morte. É proibido utilizar essas informações após o PK.\nPunição: Prisão de 60 minutos / Banimento de 1 a 5 dias.\n\n• 4.14 | É proibido RPFW (Roleplay For The Win)\nÉ o ato de desenvolver um RP visando apenas o próprio benefício, onde o jogador busca sempre \"ganhar\", ignorando consequências ou a lógica da vida real. Na vida real, ninguém vence todas as situações.\nExemplos:\nVenda de vagas ou benefícios em geral.\nIr para zona safe em meio a uma ação.\nTentar utilizar alguma regra para prejudicar outros jogadores ou se beneficiar intencionalmente.\nGuardar veículos de trabalho em locais privados para obter vantagem.\nPunição: Prisão de 60 minutos / Banimento de 1 a 5 dias.\n\n• 4.15 | É proibido MIX\nÉ o ato de misturar assuntos ou informações fora do RP dentro do RP, quebrando a imersão do personagem.\nPunição: Prisão de 60 minutos / Banimento de 1 a 5 dias.\n\n• 4.16 | É proibido a criação de múltiplas contas para transferência de dinheiro\nÉ proibido criar ou utilizar várias contas com o objetivo de transferir dinheiro ou obter vantagens para a conta principal.\nNota:\nÉ estritamente proibido criar e utilizar múltiplas contas com o objetivo de se beneficiar de maneira injusta, prejudicar outros membros do servidor, ou manipular resultados de forma abusiva.\nIsso inclui, mas não se limita a:\n- Utilizar várias contas para obter vantagens indevidas em eventos, guerras ou trocas.\n- Prejudicar intencionalmente outros jogadores com ações coordenadas entre suas contas.\n- Tentar azaralhar ou sabotar servidores, eventos ou a comunidade como um todo.\n- Qualquer violação desta regra será punida com banimento. Não há tolerância para trapaças, manipulação ou ações que comprometam a integridade do servidor.\nPunição: Banimento de 30 dias / Banimento por IP / Permanente\n\n• 4.17 | É proibido AAP (ATRAPALHAR AÇÃO PROPOSITALMENTE), que consiste em interferir de forma intencional em uma ação em andamento.\nExemplo: atrapalhar uma abordagem batendo em outros jogadores, gritando no VOIP, floodando o chat, entre outros.\nPunição: prisão 60 minutos | Ban 1 a 3 dias.\n\n• 4.18 | É proibido DMA (DEATH MATCH AUTO) causar danos a veículos públicos ou pessoais sem motivo.\nPunição: chute | prisão 30 minutos.\n\n• 4.19 | É proibido NRA (NON ROLEPLAY AMBIENTE) utilizar armas em locais públicos, como hospital, delegacia, prefeitura, feirinha, Igreja, leilões, locais de trabalho e praças.\nPunição: prisão 20 minutos.\n\n• 4.20 | É proibido AI (AÇÃO IRREGULAR)\nAto de invadir ou permanecer ao redor de propriedades privadas de outros jogadores, como casas e mansões, com o intuito de forçar uma ação, causando danos diretos ao RP.\nPunição: Banimento de 10 dias. Caso seja família em ação conjunta, sujeito a Aviso de família / Ban IP.";

const DB_VAZIO = { users: [], ocorrencias: [], pontos: [], chat: [], audit: [], notificacoes: [], provas: [], entregas: [], ponto: [], estudos: [], estudosLidos: [], config: {} };
let db = {
  ...DB_VAZIO,
  config: { nomeSistema: 'SIGP', nomeCorporacao: 'Grupamento Municipal de Policiamento', logo: null, tema: 'dourado', regras: REGRAS_PADRAO },
};

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = { ...DB_VAZIO, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
    } catch (e) {
      console.error('data.json inválido, criando backup e reiniciando.', e.message);
      fs.renameSync(DB_FILE, DB_FILE + '.corrompido-' + Date.now());
    }
  }
}

function migrar() {
  if (!db.config) db.config = {};
  if (!Array.isArray(db.estudos)) db.estudos = [];
  if (!Array.isArray(db.estudosLidos)) db.estudosLidos = [];
  if (!db.config.regras || !String(db.config.regras).trim()) db.config.regras = REGRAS_PADRAO;
  if (!Array.isArray(db.config.codigosQ) || (!db.config.codigosQ.length && !db.config.codigosQEditado)) {
    db.config.codigosQ = CODIGOS_Q_PADRAO.map((c) => ({ ...c }));
  }
  // 'Agente Oficial' virou 'Agente'
  if (Array.isArray(db.users)) db.users.forEach((u) => { if (u.cargo === 'Agente Oficial') u.cargo = 'Agente'; });
  if (typeof db.config.logo !== 'string') db.config.logo = null;
  if (!db.config.logoV) db.config.logoV = 1;
  if (!['dourado', 'esmeralda', 'roxo', 'vermelho', 'azul'].includes(db.config.tema)) db.config.tema = 'dourado';
  saveDBNow();
}

// Com DATABASE_URL (Postgres/Neon/Supabase) os dados ficam no banco e NÃO se
// perdem quando o Render reinicia. Sem ela, cai no arquivo data.json (como antes).
const TABELA = 'sigp_dados';
let pool = null;

function abrirBanco() {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: url,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
      max: 3,
    });
    if (typeof pool.on === 'function') pool.on('error', (e) => console.error('Banco (conexão ociosa):', e.message));
    return true;
  } catch (e) {
    console.error('DATABASE_URL definida, mas o pacote "pg" não está instalado:', e.message);
    pool = null;
    return false;
  }
}

async function carregarDoBanco() {
  if (!pool) return false;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS ${TABELA} (id int PRIMARY KEY, dados jsonb NOT NULL, atualizado timestamptz DEFAULT now())`);
  } catch (e) {
    console.warn('Aviso ao criar a tabela (se ela já existir, está tudo certo):', e.message);
  }
  const r = await pool.query(`SELECT dados FROM ${TABELA} WHERE id = 1`);
  if (!r.rows.length) return false;
  const d = r.rows[0].dados;
  if (!d || typeof d !== 'object') return false;
  db = { ...DB_VAZIO, ...d };
  return true;
}

let bancoSalvando = false;
let bancoPendente = false;
function enviarAoBanco() {
  if (!pool) return;
  if (bancoSalvando) { bancoPendente = true; return; }
  bancoSalvando = true;
  const copia = JSON.stringify(db);
  pool.query(
    `INSERT INTO ${TABELA} (id, dados, atualizado) VALUES (1, $1::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET dados = $1::jsonb, atualizado = now()`,
    [copia]
  ).catch((e) => console.error('Falha ao salvar no banco:', e.message))
   .finally(() => {
     bancoSalvando = false;
     if (bancoPendente) { bancoPendente = false; enviarAoBanco(); }
   });
}

function persistir() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch (_) {}
  enviarAoBanco();
}

let saveTimer = null;
function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistir, 40);
}
function saveDBNow() {
  clearTimeout(saveTimer);
  persistir();
}

// ───────── senhas ─────────
function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex');
  return salt + ':' + hash;
}
function checaSenha(senha, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const calc = crypto.scryptSync(String(senha), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calc, 'hex'));
}

const uid = () => crypto.randomBytes(8).toString('hex');
const agora = () => new Date().toISOString();
const horaBR = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ───────── ponto: tempo real trabalhado (descontando pausas) ─────────
const OFFSET_BR = -4; // horário de Campo Grande/MS (UTC-4)
const TURNOS_MS = OFFSET_BR * 3600 * 1000;

function pausasDe(reg) { return Array.isArray(reg && reg.pausas) ? reg.pausas : []; }

// milissegundos efetivamente trabalhados: (saída - entrada) - pausas
function msTrabalhados(reg) {
  if (!reg || !reg.entrada) return 0;
  const fim = reg.saida ? new Date(reg.saida).getTime() : Date.now();
  let ms = fim - new Date(reg.entrada).getTime();
  pausasDe(reg).forEach((p) => {
    const de = new Date(p.de).getTime();
    if (!Number.isFinite(de)) return;
    const ate = p.ate ? new Date(p.ate).getTime() : Date.now();
    ms -= Math.max(0, ate - de);
  });
  return Math.max(0, ms);
}
const minutosTrabalhados = (reg) => Math.round(msTrabalhados(reg) / 60000);

function msPausados(reg) {
  let ms = 0;
  pausasDe(reg).forEach((p) => {
    const de = new Date(p.de).getTime();
    if (!Number.isFinite(de)) return;
    const ate = p.ate ? new Date(p.ate).getTime() : Date.now();
    ms += Math.max(0, ate - de);
  });
  return ms;
}

// ───────── funcionário do mês (soma do ponto de todos no mês corrente) ─────────
function rankingPonto() {
  const ref = new Date(Date.now() + TURNOS_MS);
  const ano = ref.getUTCFullYear();
  const mes = ref.getUTCMonth();
  const mapa = new Map();
  db.ponto.forEach((p) => {
    if (!p.saida) return; // só conta ponto batido e finalizado
    const d = new Date(new Date(p.entrada).getTime() + TURNOS_MS);
    if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes) return;
    const u = db.users.find((x) => x.id === p.userId);
    const atual = mapa.get(p.userId) || {
      userId: p.userId,
      nome: (u && u.nome) || p.nome || p.login || '—',
      login: (u && u.login) || p.login || '—',
      cargo: (u && u.cargo) || p.cargo || '—',
      minutos: 0,
      plantoes: 0,
      pausas: 0,
    };
    atual.minutos += Math.max(0, Number(p.minutos) || 0);
    atual.plantoes += 1;
    atual.pausas += pausasDe(p).length;
    mapa.set(p.userId, atual);
  });
  const lista = Array.from(mapa.values()).sort((a, b) => b.minutos - a.minutos || b.plantoes - a.plantoes);
  return {
    ano, mes: mes + 1,
    rotulo: ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    lista: lista.slice(0, 30),
    total: lista.length,
    destaque: lista[0] || null,
  };
}

// ocorrências vão para o navegador sem o base64 da foto (a foto vem por /foto/ocorrencia/ID)
function ocorrenciasPublicas() {
  return db.ocorrencias.slice(0, 500).map((o) => {
    const copia = { ...o };
    delete copia.foto;
    copia.temFoto = !!(o.foto && String(o.foto).startsWith('data:image/'));
    copia.fotoUrl = copia.temFoto ? '/foto/ocorrencia/' + o.id + '?v=' + (o.fotoV || 0) : null;
    return copia;
  });
}

const NIVEL_OCORRENCIA = 70; // Escrivão, Delegado, Chefe e Admin Master registram ocorrência

// devolve a data URL válida, null quando não há foto, ou false quando é inválida
function validaFotoOcorrencia(foto) {
  if (foto == null || foto === '') return null;
  if (typeof foto !== 'string') return false;
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(foto)) return false;
  if (foto.length > 2_800_000) return false; // ~2 MB
  return foto;
}

// ───────── seed ─────────
function seed() {
  if (db.users.length) return;
  db.users.push({
    id: uid(),
    nome: 'Administrador',
    login: 'admin',
    senha: hashSenha('admin123'),
    cargo: 'Admin Master',
    ativo: true,
    suspensoAte: null,
    suspensaoMotivo: null,
    suspensaoPor: null,
    pontos: 0,
    foto: null,
    recado: '',
    criadoEm: agora(),
    ultimoAcesso: null,
  });
  saveDBNow();
  console.log('Conta inicial criada -> login: admin | senha: admin123');
}

// ───────── sessões ─────────
const sessoes = new Map(); // token -> { userId, expira }
const SESSAO_MS = 12 * 60 * 60 * 1000;

function criaSessao(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  sessoes.set(token, { userId, expira: Date.now() + SESSAO_MS });
  return token;
}
function usuarioDaReq(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const s = sessoes.get(token);
  if (!s || s.expira < Date.now()) { sessoes.delete(token); return null; }
  return db.users.find((u) => u.id === s.userId) || null;
}

// ───────── auditoria e notificação ─────────
function log(feitorPor, acao, detalhe) {
  db.audit.unshift({ id: uid(), em: agora(), feitorPor, acao, detalhe: detalhe || '' });
  if (db.audit.length > 3000) db.audit.length = 3000;
  saveDB();
}
function notificar(paraUserId, titulo, texto) {
  db.notificacoes.unshift({ id: uid(), para: paraUserId, titulo, texto, em: agora(), lida: false });
  if (db.notificacoes.length > 2000) db.notificacoes.length = 2000;
  saveDB();
}

// ───────── utilidades http ─────────
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}
function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 8 * 1024 * 1024) { reject(new Error('Corpo muito grande')); req.destroy(); }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}
// config que vai para o navegador (a foto fica em /logo, para não pesar)
function configPublico() {
  const c = db.config || {};
  return {
    nomeSistema: c.nomeSistema || 'SIGP',
    nomeCorporacao: c.nomeCorporacao || '',
    tema: c.tema || 'dourado',
    logoUrl: c.logo ? '/logo?v=' + (c.logoV || 1) : null,
  };
}

const publico = (u) => ({
  id: u.id, nome: u.nome, login: u.login, cargo: u.cargo, ativo: u.ativo,
  suspensoAte: u.suspensoAte, suspensaoMotivo: u.suspensaoMotivo, suspensaoPor: u.suspensaoPor,
  pontos: u.pontos || 0, foto: u.foto || null, recado: u.recado || '',
  criadoEm: u.criadoEm, ultimoAcesso: u.ultimoAcesso,
});

// ───────── rotas ─────────
async function api(req, res, seg) {
  const metodo = req.method;

  // ---- login ----
  if (seg === 'login' && metodo === 'POST') {
    const { login, senha } = await lerCorpo(req);
    const u = db.users.find((x) => String(x.login).toLowerCase() === String(login || '').trim().toLowerCase());
    if (!u || !checaSenha(senha, u.senha)) {
      log(login || '?', 'LOGIN_FALHOU', 'senha ou login incorreto');
      return json(res, 401, { error: 'Login ou senha incorretos.' });
    }
    if (!u.ativo) return json(res, 403, { error: 'Conta desativada. Procure um superior.' });
    if (u.suspensoAte && new Date(u.suspensoAte).getTime() > Date.now()) {
      return json(res, 403, {
        suspenso: true,
        restanteMs: new Date(u.suspensoAte).getTime() - Date.now(),
        motivo: u.suspensaoMotivo,
        aplicadoPor: u.suspensaoPor,
        expiraEm: u.suspensoAte,
      });
    }
    if (u.suspensoAte && new Date(u.suspensoAte).getTime() <= Date.now()) {
      u.suspensoAte = null; u.suspensaoMotivo = null; u.suspensaoPor = null;
    }
    u.ultimoAcesso = agora();
    saveDB();
    const token = criaSessao(u.id);
    log(u.login, 'LOGIN', 'acesso autenticado');
    return json(res, 200, { token, user: publico(u) });
  }

  // ---- identidade pública (usada na tela de login e no menu do celular) ----
  if (seg === 'identidade' && metodo === 'GET') {
    return json(res, 200, configPublico());
  }

  // ---- daqui pra baixo exige sessão ----
  const eu = usuarioDaReq(req);
  if (!eu) return json(res, 401, { error: 'Sessão expirada. Faça login novamente.' });
  const corpo = metodo === 'GET' || metodo === 'DELETE' && seg.startsWith('users/') ? {} : {};

  if (seg === 'logout' && metodo === 'POST') {
    const h = req.headers['authorization'] || '';
    sessoes.delete(h.slice(7));
    return json(res, 200, { ok: true });
  }

  if (seg === 'me' && metodo === 'GET') return json(res, 200, { user: publico(eu) });

  if (seg === 'state' && metodo === 'GET') {
    const meuNivel = nivel(eu.cargo);
    return json(res, 200, {
      config: configPublico(),
      cargos: Object.keys(CARGOS).map((c) => ({ nome: c, nivel: CARGOS[c].nivel })),
      users: db.users.map(publico),
      ocorrencias: ocorrenciasPublicas(),
      pontos: db.pontos,
      chat: db.chat.slice(-200),
      audit: meuNivel >= 70 ? db.audit.slice(0, 300) : db.audit.filter((a) => a.feitorPor === eu.login).slice(0, 50),
      notificacoes: db.notificacoes.filter((n) => n.para === eu.id).slice(0, 100),
      provas: db.provas,
      entregas: meuNivel >= 80 ? db.entregas : db.entregas.filter((e) => e.userId === eu.id),
      ponto: (meuNivel >= 70 ? db.ponto : db.ponto.filter((p) => p.userId === eu.id)).slice(0, 300),
      estudos: db.estudos,
      estudosLidos: db.estudosLidos,
      regras: db.config.regras || '',
      codigosQ: db.config.codigosQ || [],
      bancoLigado: !!pool,
      funcionarioMes: rankingPonto(),
      meuNivel,
    });
  }

  // ---- perfil ----
  if (seg === 'me/perfil' && metodo === 'PUT') {
    const b = await lerCorpo(req);
    if (typeof b.nome === 'string' && b.nome.trim()) eu.nome = b.nome.trim().slice(0, 60);
    if (typeof b.recado === 'string') {
      if (eu.cargo === 'Civil' || nivel(eu.cargo) < 40) {
        // civil também pode ter recado simples
        eu.recado = b.recado.slice(0, 200);
      } else eu.recado = b.recado.slice(0, 200);
    }
    if (typeof b.foto === 'string') {
      if (b.foto.length > 900000) return json(res, 400, { error: 'Foto muito grande (máx ~600KB).' });
      eu.foto = b.foto || null;
    }
    saveDB();
    log(eu.login, 'PERFIL_ATUALIZADO', 'dados do próprio perfil');
    return json(res, 200, { user: publico(eu) });
  }

  if (seg === 'me/senha' && metodo === 'PUT') {
    const b = await lerCorpo(req);
    if (!checaSenha(b.atual, eu.senha)) return json(res, 400, { error: 'Senha atual incorreta.' });
    if (!b.nova || String(b.nova).length < 4) return json(res, 400, { error: 'Nova senha muito curta (mín. 4).' });
    eu.senha = hashSenha(b.nova);
    saveDB();
    log(eu.login, 'SENHA_ALTERADA', 'o próprio usuário trocou a senha');
    return json(res, 200, { ok: true });
  }

  // ---- usuários (gestão) ----
  if (seg === 'users' && metodo === 'POST') {
    if (nivel(eu.cargo) < 90) return json(res, 403, { error: 'Só o Admin Master e o Chefe de Polícia cadastram membros.' });
    const b = await lerCorpo(req);
    const login = String(b.login || '').trim();
    if (!login || !b.nome || !b.senha) return json(res, 400, { error: 'Nome, login e senha são obrigatórios.' });
    if (db.users.some((u) => u.login.toLowerCase() === login.toLowerCase())) return json(res, 400, { error: 'Este login já existe.' });
    const cargoPedido = String(b.cargo || '').trim();
    if (cargoPedido && !CARGOS[cargoPedido]) return json(res, 400, { error: 'Cargo inválido: ' + cargoPedido });
    const cargo = CARGOS[cargoPedido] ? cargoPedido : 'Guarda Municipal';
    if (nivel(cargo) >= nivel(eu.cargo) && eu.cargo !== 'Admin Master') return json(res, 403, { error: 'Não pode criar alguém do seu nível ou acima.' });
    const novo = {
      id: uid(), nome: String(b.nome).slice(0, 60), login, senha: hashSenha(b.senha), cargo,
      ativo: true, suspensoAte: null, suspensaoMotivo: null, suspensaoPor: null,
      pontos: 0, foto: null, recado: '', criadoEm: agora(), ultimoAcesso: null,
    };
    db.users.push(novo);
    saveDB();
    log(eu.login, 'USUARIO_CRIADO', `${login} como ${cargo}`);
    notificar(novo.id, 'Bem-vindo ao sistema', `Sua conta foi criada por ${eu.nome}.`);
    return json(res, 200, { user: publico(novo) });
  }

  const mUser = seg.match(/^users\/([a-f0-9]+)(?:\/(.+))?$/);
  if (mUser) {
    const alvo = db.users.find((u) => u.id === mUser[1]);
    if (!alvo) return json(res, 404, { error: 'Usuário não encontrado.' });
    const acao = mUser[2] || '';
    const souEu = alvo.id === eu.id;
    const superior = nivel(eu.cargo) > nivel(alvo.cargo) || eu.cargo === 'Admin Master';

    if (!acao && metodo === 'DELETE') {
      if (nivel(eu.cargo) < 80 || !superior) return json(res, 403, { error: 'Sem permissão para excluir este usuário.' });
      db.users = db.users.filter((u) => u.id !== alvo.id);
      saveDB();
      log(eu.login, 'USUARIO_EXCLUIDO', alvo.login);
      return json(res, 200, { ok: true });
    }

    if (acao === 'cargo' && metodo === 'PUT') {
      if (nivel(eu.cargo) < 80 || !superior) return json(res, 403, { error: 'Sem permissão para alterar cargo.' });
      const b = await lerCorpo(req);
      if (!CARGOS[b.cargo]) return json(res, 400, { error: 'Cargo inválido.' });
      if (nivel(b.cargo) >= nivel(eu.cargo) && eu.cargo !== 'Admin Master') return json(res, 403, { error: 'Não pode promover a um nível igual ou acima do seu.' });
      const antes = alvo.cargo;
      alvo.cargo = b.cargo;
      saveDB();
      log(eu.login, 'CARGO_ALTERADO', `${alvo.login}: ${antes} -> ${b.cargo}${b.motivo ? ' | motivo: ' + b.motivo : ''}`);
      notificar(alvo.id, 'Seu cargo mudou', `${antes} → ${b.cargo}${b.motivo ? ' (motivo: ' + b.motivo + ')' : ''}`);
      return json(res, 200, { user: publico(alvo) });
    }

    if (acao === 'senha' && metodo === 'PUT') {
      if (nivel(eu.cargo) < 80 || !superior) return json(res, 403, { error: 'Sem permissão para redefinir esta senha.' });
      const b = await lerCorpo(req);
      if (!b.novaSenha || String(b.novaSenha).length < 4) return json(res, 400, { error: 'Senha muito curta (mín. 4).' });
      alvo.senha = hashSenha(b.novaSenha);
      saveDB();
      log(eu.login, 'SENHA_REDEFINIDA', `senha de ${alvo.login} redefinida`);
      return json(res, 200, { ok: true });
    }

    if (acao === 'status' && metodo === 'PUT') {
      if (nivel(eu.cargo) < 80 || !superior) return json(res, 403, { error: 'Sem permissão.' });
      const b = await lerCorpo(req);
      alvo.ativo = !!b.ativo;
      saveDB();
      log(eu.login, alvo.ativo ? 'USUARIO_ATIVADO' : 'USUARIO_DESATIVADO', alvo.login);
      return json(res, 200, { user: publico(alvo) });
    }

    if (acao === 'suspensao' && metodo === 'PUT') {
      if (nivel(eu.cargo) < 80 || !superior) return json(res, 403, { error: 'Sem permissão.' });
      const b = await lerCorpo(req);
      if (b.minutos === 0 || b.minutos === null) {
        alvo.suspensoAte = null; alvo.suspensaoMotivo = null; alvo.suspensaoPor = null;
        saveDB();
        log(eu.login, 'SUSPENSAO_REMOVIDA', alvo.login);
        return json(res, 200, { user: publico(alvo) });
      }
      const min = Math.max(1, Math.min(43200, Number(b.minutos) || 0));
      alvo.suspensoAte = new Date(Date.now() + min * 60000).toISOString();
      alvo.suspensaoMotivo = String(b.motivo || '—').slice(0, 200);
      alvo.suspensaoPor = eu.login;
      saveDB();
      log(eu.login, 'SUSPENSAO_APLICADA', `${alvo.login} por ${min} min | motivo: ${alvo.suspensaoMotivo}`);
      return json(res, 200, { user: publico(alvo) });
    }

    if (acao === 'ban' && metodo === 'PUT') {
      if (nivel(eu.cargo) < 90) return json(res, 403, { error: 'Só Chefe de Polícia ou Admin Master.' });
      const b = await lerCorpo(req);
      alvo.ativo = false;
      alvo.suspensoAte = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
      alvo.suspensaoMotivo = String(b.motivo || 'Banimento').slice(0, 200);
      alvo.suspensaoPor = eu.login;
      saveDB();
      log(eu.login, 'BANIMENTO', `${alvo.login} | motivo: ${alvo.suspensaoMotivo}`);
      return json(res, 200, { user: publico(alvo) });
    }
  }

  // ---- ocorrências ----
  // Guarda Municipal, Agente e Tático não registram ocorrência.
  if (seg === 'ocorrencias' && metodo === 'POST') {
    if (nivel(eu.cargo) < NIVEL_OCORRENCIA) {
      return json(res, 403, { error: 'Seu cargo não pode registrar ocorrência. Fale com um Escrivão, Delegado, Chefe de Polícia ou Admin Master.' });
    }
    const b = await lerCorpo(req);
    if (!b.titulo && !b.agente) return json(res, 400, { error: 'Informe o agente/título da ocorrência.' });
    const foto = validaFotoOcorrencia(b.foto);
    if (foto === false) return json(res, 400, { error: 'Foto inválida ou muito grande (máx 2 MB). Use uma imagem JPG/PNG.' });
    const oc = {
      id: uid(),
      foto: foto || null,
      fotoV: foto ? Date.now() : null,
      titulo: String(b.titulo || b.agente || 'Ocorrência').slice(0, 120),
      agente: String(b.agente || eu.nome).slice(0, 60),
      cargoAgente: String(b.cargoAgente || eu.cargo).slice(0, 40),
      status: 'Pendente',
      responsavel: '',
      depoimento: String(b.depoimento || '').slice(0, 4000),
      resposta: '',
      criadoPor: eu.login,
      criadoEm: agora(),
      atualizadoEm: agora(),
    };
    db.ocorrencias.unshift(oc);
    saveDB();
    log(eu.login, 'OCORRENCIA_CRIADA', oc.titulo);
    return json(res, 200, { ocorrencia: oc });
  }

  const mOc = seg.match(/^ocorrencias\/([a-f0-9]+)$/);
  if (mOc) {
    const oc = db.ocorrencias.find((o) => o.id === mOc[1]);
    if (!oc) return json(res, 404, { error: 'Ocorrência não encontrada.' });
    const podeMexer = nivel(eu.cargo) >= NIVEL_OCORRENCIA || oc.criadoPor === eu.login;
    if (metodo === 'PUT') {
      if (!podeMexer) return json(res, 403, { error: 'Sem permissão para editar esta ocorrência.' });
      const b = await lerCorpo(req);
      ['titulo', 'agente', 'cargoAgente', 'status', 'responsavel', 'depoimento', 'resposta'].forEach((k) => {
        if (typeof b[k] === 'string') oc[k] = b[k].slice(0, k === 'depoimento' || k === 'resposta' ? 4000 : 120);
      });
      if (typeof b.foto === 'string') {
        if (b.foto === '') { oc.foto = null; oc.fotoV = null; }
        else {
          const foto = validaFotoOcorrencia(b.foto);
          if (foto === false) return json(res, 400, { error: 'Foto inválida ou muito grande (máx 2 MB).' });
          oc.foto = foto; oc.fotoV = Date.now();
        }
      }
      oc.atualizadoEm = agora();
      saveDB();
      log(eu.login, 'OCORRENCIA_EDITADA', `${oc.titulo} -> ${oc.status}`);
      return json(res, 200, { ocorrencia: oc });
    }
    if (metodo === 'DELETE') {
      if (nivel(eu.cargo) < 70) return json(res, 403, { error: 'Sem permissão para excluir ocorrência.' });
      db.ocorrencias = db.ocorrencias.filter((o) => o.id !== oc.id);
      saveDB();
      log(eu.login, 'OCORRENCIA_EXCLUIDA', oc.titulo);
      return json(res, 200, { ok: true });
    }
  }

  // ---- pontos ----
  if (seg === 'pontos' && metodo === 'POST') {
    if (nivel(eu.cargo) < 60) return json(res, 403, { error: 'Sem permissão para lançar pontos.' });
    const b = await lerCorpo(req);
    const alvo = db.users.find((u) => u.id === b.userId);
    if (!alvo) return json(res, 404, { error: 'Policial não encontrado.' });
    const delta = Number(b.delta);
    if (!Number.isFinite(delta) || delta === 0) return json(res, 400, { error: 'Informe uma quantidade de pontos válida.' });
    alvo.pontos = (alvo.pontos || 0) + delta;
    const reg = { id: uid(), userId: alvo.id, login: alvo.login, delta, motivo: String(b.motivo || '—').slice(0, 200), por: eu.login, em: agora() };
    db.pontos.unshift(reg);
    saveDB();
    log(eu.login, 'PONTOS', `${delta > 0 ? '+' : ''}${delta} para ${alvo.login} | ${reg.motivo}`);
    notificar(alvo.id, 'Seus pontos mudaram', `${delta > 0 ? '+' : ''}${delta} pontos (${reg.motivo}). Total: ${alvo.pontos}`);
    return json(res, 200, { user: publico(alvo), registro: reg });
  }

  // ---- provas (Chefe, Delegado e Admin Master lançam) ----
  if (seg === 'provas' && metodo === 'POST') {
    if (nivel(eu.cargo) < 80) return json(res, 403, { error: 'Só Chefe de Polícia, Delegado ou Admin Master lança provas.' });
    const b = await lerCorpo(req);
    if (!b.titulo || !String(b.titulo).trim()) return json(res, 400, { error: 'Informe o título da prova.' });
    const prova = {
      id: uid(),
      titulo: String(b.titulo).trim().slice(0, 120),
      descricao: String(b.descricao || '').slice(0, 2000),
      perguntas: String(b.perguntas || '').slice(0, 6000),
      prazo: b.prazo ? String(b.prazo).slice(0, 10) : null,
      criadoPor: eu.login,
      criadoPorNome: eu.nome,
      criadoEm: agora(),
      ativa: true,
    };
    db.provas.unshift(prova);
    saveDB();
    log(eu.login, 'PROVA_LANCADA', prova.titulo);
    db.users.filter((u) => u.ativo).forEach((u) => {
      if (u.id !== eu.id) notificar(u.id, 'Nova prova lançada', prova.titulo + ' — veja em Provas.');
    });
    return json(res, 200, { prova });
  }

  const mProva = seg.match(/^provas\/([a-f0-9]+)(?:\/(.+))?$/);
  if (mProva) {
    const prova = db.provas.find((p) => p.id === mProva[1]);
    if (!prova) return json(res, 404, { error: 'Prova não encontrada.' });
    const acao = mProva[2] || '';

    if (acao === 'entregar' && metodo === 'POST') {
      if (db.entregas.some((e) => e.provaId === prova.id && e.userId === eu.id)) {
        return json(res, 400, { error: 'Você já enviou esta prova.' });
      }
      const b = await lerCorpo(req);
      const respostas = String(b.respostas || '').trim();
      if (!respostas) return json(res, 400, { error: 'Escreva suas respostas antes de enviar.' });
      const entrega = {
        id: uid(), provaId: prova.id, provaTitulo: prova.titulo,
        userId: eu.id, login: eu.login, nome: eu.nome, cargo: eu.cargo,
        respostas: respostas.slice(0, 10000), em: agora(),
        status: 'Aguardando', nota: null, feedback: '', avaliadoPor: null, avaliadoEm: null,
      };
      db.entregas.unshift(entrega);
      saveDB();
      log(eu.login, 'PROVA_ENTREGUE', prova.titulo);
      db.users.filter((u) => u.ativo && nivel(u.cargo) >= 80).forEach((u) => {
        notificar(u.id, 'Prova entregue', `${eu.nome} (@${eu.login}) enviou "${prova.titulo}".`);
      });
      return json(res, 200, { entrega });
    }

    if (!acao && metodo === 'DELETE') {
      if (nivel(eu.cargo) < 80) return json(res, 403, { error: 'Sem permissão para excluir provas.' });
      db.provas = db.provas.filter((p) => p.id !== prova.id);
      db.entregas = db.entregas.filter((e) => e.provaId !== prova.id);
      saveDB();
      log(eu.login, 'PROVA_EXCLUIDA', prova.titulo);
      return json(res, 200, { ok: true });
    }
  }

  // ---- avaliar prova entregue ----
  const mEnt = seg.match(/^entregas\/([a-f0-9]+)$/);
  if (mEnt && metodo === 'PUT') {
    if (nivel(eu.cargo) < 80) return json(res, 403, { error: 'Só Chefe de Polícia, Delegado ou Admin Master avalia provas.' });
    const ent = db.entregas.find((e) => e.id === mEnt[1]);
    if (!ent) return json(res, 404, { error: 'Entrega não encontrada.' });
    const b = await lerCorpo(req);
    ent.status = b.status === 'Aprovada' ? 'Aprovada' : 'Reprovada';
    const n = Number(b.nota);
    ent.nota = Number.isFinite(n) && b.nota !== '' && b.nota != null ? Math.max(0, Math.min(10, n)) : null;
    ent.feedback = String(b.feedback || '').slice(0, 1000);
    ent.avaliadoPor = eu.login;
    ent.avaliadoEm = agora();
    saveDB();
    log(eu.login, 'PROVA_AVALIADA', `${ent.login} | ${ent.provaTitulo} -> ${ent.status}${ent.nota != null ? ' | nota ' + ent.nota : ''}`);
    notificar(ent.userId, 'Sua prova foi avaliada',
      `${ent.provaTitulo}: ${ent.status}${ent.nota != null ? ' | nota ' + ent.nota : ''}${ent.feedback ? ' — ' + ent.feedback : ''}`);
    return json(res, 200, { entrega: ent });
  }

  // ---- bate ponto (entrada, pausar, despausar e finalizar) ----
  if (seg === 'ponto' && metodo === 'POST') {
    const b = await lerCorpo(req);
    let acao = String(b.acao || 'entrada').toLowerCase();
    if (acao === 'pausa') acao = 'pausar';
    if (acao === 'retomar' || acao === 'continuar') acao = 'despausar';
    if (acao === 'finalizar' || acao === 'fim') acao = 'saida';
    if (!['entrada', 'pausar', 'despausar', 'saida'].includes(acao)) acao = 'entrada';

    const aberto = db.ponto.find((p) => p.userId === eu.id && !p.saida);

    if (acao === 'entrada') {
      if (aberto) return json(res, 400, { error: 'Você já bateu entrada às ' + horaBR(aberto.entrada) + '. Finalize o ponto primeiro.' });
      const reg = {
        id: uid(), userId: eu.id, login: eu.login, nome: eu.nome, cargo: eu.cargo,
        entrada: agora(), saida: null, minutos: null,
        pausas: [], pausadoEm: null,
      };
      db.ponto.unshift(reg);
      if (db.ponto.length > 5000) db.ponto.length = 5000;
      saveDB();
      log(eu.login, 'PONTO_ENTRADA', 'entrada às ' + horaBR(reg.entrada));
      return json(res, 200, { registro: reg, mensagem: 'Entrada registrada às ' + horaBR(reg.entrada) });
    }

    if (!aberto) return json(res, 400, { error: 'Você não tem ponto aberto. Bata a entrada primeiro.' });
    if (!Array.isArray(aberto.pausas)) aberto.pausas = [];

    if (acao === 'pausar') {
      if (aberto.pausadoEm) return json(res, 400, { error: 'O ponto já está pausado desde ' + horaBR(aberto.pausadoEm) + '.' });
      aberto.pausadoEm = agora();
      aberto.pausas.push({ de: aberto.pausadoEm, ate: null });
      saveDB();
      log(eu.login, 'PONTO_PAUSA', 'pausou às ' + horaBR(aberto.pausadoEm));
      return json(res, 200, { registro: aberto, mensagem: 'Ponto pausado às ' + horaBR(aberto.pausadoEm) });
    }

    if (acao === 'despausar') {
      if (!aberto.pausadoEm) return json(res, 400, { error: 'O ponto não está pausado.' });
      const hora = agora();
      const aberta = aberto.pausas.find((p) => !p.ate);
      if (aberta) aberta.ate = hora;
      else aberto.pausas.push({ de: aberto.pausadoEm, ate: hora });
      const pausadoMin = Math.round((new Date(hora) - new Date(aberto.pausadoEm)) / 60000);
      aberto.pausadoEm = null;
      saveDB();
      log(eu.login, 'PONTO_RETOMADO', `voltou às ${horaBR(hora)} | pausou ${pausadoMin} min`);
      return json(res, 200, { registro: aberto, mensagem: 'Serviço retomado às ' + horaBR(hora) });
    }

    // finalizar
    const horaSaida = agora();
    if (aberto.pausadoEm) {
      const aberta = aberto.pausas.find((p) => !p.ate);
      if (aberta) aberta.ate = horaSaida;
      aberto.pausadoEm = null;
    }
    aberto.saida = horaSaida;
    aberto.minutos = Math.max(1, minutosTrabalhados(aberto));
    aberto.minutosPausados = Math.round(msPausados(aberto) / 60000);
    saveDB();
    log(eu.login, 'PONTO_SAIDA', `saída às ${horaBR(aberto.saida)} | ${aberto.minutos} min trabalhados | ${aberto.minutosPausados} min de pausa`);
    return json(res, 200, {
      registro: aberto,
      mensagem: `Ponto finalizado às ${horaBR(aberto.saida)} · ${aberto.minutos} min trabalhados`,
    });
  }

  // ---- estudos (material de estudo lançado pelo comando) ----
  if (seg === 'estudos' && metodo === 'POST') {
    if (nivel(eu.cargo) < 90) return json(res, 403, { error: 'Só o Admin Master e o Chefe de Polícia lançam estudos.' });
    const b = await lerCorpo(req);
    const titulo = String(b.titulo || '').trim();
    const conteudo = String(b.conteudo || '').trim();
    if (!titulo) return json(res, 400, { error: 'Informe o título do estudo.' });
    if (!conteudo) return json(res, 400, { error: 'Escreva o conteúdo do estudo.' });
    const estudo = {
      id: uid(),
      titulo: titulo.slice(0, 140),
      categoria: String(b.categoria || 'Geral').trim().slice(0, 40) || 'Geral',
      conteudo: conteudo.slice(0, 20000),
      criadoPor: eu.login,
      criadoPorNome: eu.nome,
      criadoEm: agora(),
      atualizadoEm: agora(),
    };
    db.estudos.unshift(estudo);
    if (db.estudos.length > 500) db.estudos.length = 500;
    saveDB();
    log(eu.login, 'ESTUDO_LANCADO', estudo.titulo);
    db.users.filter((u) => u.ativo).forEach((u) => {
      if (u.id !== eu.id) notificar(u.id, 'Novo estudo disponível', estudo.titulo + ' — veja em Estudos.');
    });
    return json(res, 200, { estudo });
  }

  const mEst = seg.match(/^estudos\/([a-f0-9]+)(?:\/(.+))?$/);
  if (mEst) {
    const estudo = db.estudos.find((e) => e.id === mEst[1]);
    if (!estudo) return json(res, 404, { error: 'Estudo não encontrado.' });
    const acao = mEst[2] || '';

    if (acao === 'estudar' && metodo === 'POST') {
      const jaEstudou = db.estudosLidos.find((x) => x.estudoId === estudo.id && x.userId === eu.id);
      if (jaEstudou) {
        db.estudosLidos = db.estudosLidos.filter((x) => !(x.estudoId === estudo.id && x.userId === eu.id));
        saveDB();
        return json(res, 200, { estudado: false });
      }
      db.estudosLidos.unshift({ id: uid(), estudoId: estudo.id, userId: eu.id, login: eu.login, nome: eu.nome, em: agora() });
      if (db.estudosLidos.length > 20000) db.estudosLidos.length = 20000;
      saveDB();
      log(eu.login, 'ESTUDO_CONCLUIDO', estudo.titulo);
      return json(res, 200, { estudado: true });
    }

    if (!acao && metodo === 'PUT') {
      if (nivel(eu.cargo) < 90) return json(res, 403, { error: 'Só o Admin Master e o Chefe de Polícia editam estudos.' });
      const b = await lerCorpo(req);
      if (typeof b.titulo === 'string' && b.titulo.trim()) estudo.titulo = b.titulo.trim().slice(0, 140);
      if (typeof b.categoria === 'string' && b.categoria.trim()) estudo.categoria = b.categoria.trim().slice(0, 40);
      if (typeof b.conteudo === 'string' && b.conteudo.trim()) estudo.conteudo = b.conteudo.slice(0, 20000);
      estudo.atualizadoEm = agora();
      saveDB();
      log(eu.login, 'ESTUDO_EDITADO', estudo.titulo);
      return json(res, 200, { estudo });
    }

    if (!acao && metodo === 'DELETE') {
      if (nivel(eu.cargo) < 90) return json(res, 403, { error: 'Só o Admin Master e o Chefe de Polícia excluem estudos.' });
      db.estudos = db.estudos.filter((e) => e.id !== estudo.id);
      db.estudosLidos = db.estudosLidos.filter((x) => x.estudoId !== estudo.id);
      saveDB();
      log(eu.login, 'ESTUDO_EXCLUIDO', estudo.titulo);
      return json(res, 200, { ok: true });
    }
  }

  // ---- regras do RP ----
  if (seg === 'regras' && metodo === 'PUT') {
    if (nivel(eu.cargo) < 90) return json(res, 403, { error: 'Só o Admin Master e o Chefe de Polícia editam as regras.' });
    const b = await lerCorpo(req);
    db.config.regras = String(b.texto || '').slice(0, 20000);
    saveDB();
    log(eu.login, 'REGRAS_ATUALIZADAS', 'regras do RP atualizadas');
    return json(res, 200, { regras: db.config.regras });
  }

  // ---- chat ----
  if (seg === 'chat' && metodo === 'POST') {
    const b = await lerCorpo(req);
    const texto = String(b.texto || '').trim().slice(0, 800);
    if (!texto) return json(res, 400, { error: 'Mensagem vazia.' });
    const msg = { id: uid(), de: eu.login, nome: eu.nome, cargo: eu.cargo, texto, em: agora() };
    db.chat.push(msg);
    if (db.chat.length > 1000) db.chat = db.chat.slice(-1000);
    saveDB();
    return json(res, 200, { mensagem: msg });
  }

  // ---- notificações ----
  if (seg === 'notificacoes/ler' && metodo === 'POST') {
    db.notificacoes.forEach((n) => { if (n.para === eu.id) n.lida = true; });
    saveDB();
    return json(res, 200, { ok: true });
  }

  // ---- configuração ----
  if (seg === 'config' && metodo === 'PUT') {
    if (eu.cargo !== 'Admin Master') return json(res, 403, { error: 'Apenas o Admin Master.' });
    const b = await lerCorpo(req);
    if (typeof b.nomeSistema === 'string' && b.nomeSistema.trim()) db.config.nomeSistema = b.nomeSistema.trim().slice(0, 24);
    if (typeof b.nomeCorporacao === 'string') db.config.nomeCorporacao = b.nomeCorporacao.trim().slice(0, 80);
    if (typeof b.logo === 'string') {
      if (b.logo === '') db.config.logo = null;
      else if (b.logo.length > 8000000) return json(res, 400, { error: 'Foto muito grande. Use uma imagem menor.' });
      else if (!/^data:image\//.test(b.logo)) return json(res, 400, { error: 'Arquivo de imagem inválido.' });
      else db.config.logo = b.logo;
      db.config.logoV = Date.now();
    }
    if (typeof b.tema === 'string' && ['dourado', 'esmeralda', 'roxo', 'vermelho', 'azul'].includes(b.tema)) db.config.tema = b.tema;
    saveDB();
    log(eu.login, 'CONFIG_ALTERADA', `${db.config.nomeSistema} | ${db.config.nomeCorporacao}`);
    return json(res, 200, { config: configPublico() });
  }

  // ---- códigos Q (Admin Master e Chefe de Polícia editam) ----
  if (seg === 'codigosq' && metodo === 'PUT') {
    if (nivel(eu.cargo) < 90) return json(res, 403, { error: 'Só o Admin Master e o Chefe de Polícia editam os Códigos Q.' });
    const b = await lerCorpo(req);
    if (!Array.isArray(b.codigos)) return json(res, 400, { error: 'Lista de códigos inválida.' });
    if (b.codigos.length > 300) return json(res, 400, { error: 'Muitos códigos (máx 300).' });
    const limpos = [];
    for (const item of b.codigos) {
      const codigo = String((item && item.codigo) || '').trim().toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 10);
      const significado = String((item && item.significado) || '').trim().slice(0, 240);
      if (!codigo || !significado) continue;
      const grupo = String((item && item.grupo) || 'Outros').trim().slice(0, 40) || 'Outros';
      limpos.push({ codigo, significado, grupo });
    }
    db.config.codigosQ = limpos;
    db.config.codigosQEditado = true;
    saveDBNow();
    log(eu.login, 'CODIGOS_Q_ALTERADOS', `${limpos.length} códigos salvos`);
    return json(res, 200, { codigosQ: limpos });
  }

  if ((seg === 'codigosq/padrao' || seg === 'codigosq-padrao') && metodo === 'POST') {
    if (nivel(eu.cargo) < 90) return json(res, 403, { error: 'Só o Admin Master e o Chefe de Polícia.' });
    db.config.codigosQ = CODIGOS_Q_PADRAO.map((c) => ({ ...c }));
    db.config.codigosQEditado = false;
    saveDBNow();
    log(eu.login, 'CODIGOS_Q_PADRAO', 'lista padrão restaurada');
    return json(res, 200, { codigosQ: db.config.codigosQ });
  }

  // ---- limpeza de dados (só Admin Master) ----
  if (seg === 'limpar' && metodo === 'POST') {
    if (eu.cargo !== 'Admin Master') return json(res, 403, { error: 'Só o Admin Master pode limpar dados.' });
    const b = await lerCorpo(req);
    const alvo = String(b.alvo || '').toLowerCase();
    const alvos = ['chat', 'auditoria', 'ponto', 'pontuacao', 'ocorrencias', 'provas', 'tudo'];
    if (!alvos.includes(alvo)) return json(res, 400, { error: 'Alvo de limpeza inválido.' });

    const apagados = {};
    const limparChat = () => { apagados.mensagens = db.chat.length; db.chat = []; };
    const limparAuditoria = () => { apagados.auditoria = db.audit.length; db.audit = []; };
    const limparPonto = () => { apagados.pontosBatidos = db.ponto.length; db.ponto = []; };
    const limparPontuacao = () => { apagados.lancamentos = db.pontos.length; db.pontos = []; db.users.forEach((u) => { u.pontos = 0; }); };
    const limparOcorrencias = () => { apagados.ocorrencias = db.ocorrencias.length; db.ocorrencias = []; };
    const limparProvas = () => { apagados.provasEnviadas = db.entregas.length; db.entregas = []; };

    if (alvo === 'chat') limparChat();
    else if (alvo === 'auditoria') limparAuditoria();
    else if (alvo === 'ponto') limparPonto();
    else if (alvo === 'pontuacao') limparPontuacao();
    else if (alvo === 'ocorrencias') limparOcorrencias();
    else if (alvo === 'provas') limparProvas();
    else {
      // tudo: apaga os registros, mantendo contas, regras, estudos e a identidade
      limparChat(); limparAuditoria(); limparPonto(); limparPontuacao(); limparOcorrencias(); limparProvas();
      apagados.estudosLidos = db.estudosLidos.length;
      db.estudosLidos = [];
      apagados.notificacoes = db.notificacoes.length;
      db.notificacoes = [];
    }

    saveDBNow();
    const resumo = Object.entries(apagados).map(([k, v]) => `${v} ${k}`).join(', ') || 'nada';
    log(eu.login, 'DADOS_LIMPOS', `${alvo}: ${resumo}`);
    return json(res, 200, { ok: true, alvo, apagados, mensagem: 'Limpeza feita: ' + resumo + '.' });
  }

  // ---- backup ----
  if (seg === 'backup' && metodo === 'GET') {
    if (nivel(eu.cargo) < 90) return json(res, 403, { error: 'Apenas Chefe de Polícia ou Admin Master.' });
    log(eu.login, 'BACKUP_GERADO', 'download completo');
    saveDBNow();
    return json(res, 200, { geradoEm: agora(), por: eu.login, dados: db });
  }

  if (seg === 'restore' && metodo === 'POST') {
    if (eu.cargo !== 'Admin Master') return json(res, 403, { error: 'Apenas o Admin Master pode restaurar.' });
    const b = await lerCorpo(req);
    const d = b.dados || b;
    if (!d || !Array.isArray(d.users)) return json(res, 400, { error: 'Arquivo de backup inválido.' });
    db = { ...DB_VAZIO, ...d };
    migrar();
    saveDBNow();
    log(eu.login, 'BACKUP_RESTAURADO', `${db.users.length} usuários, ${db.ocorrencias.length} ocorrências`);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'Rota não encontrada.' });
}

// ───────── arquivos estáticos ─────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp',
};
const EMBUTIDOS = {"/index.html":"PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9InB0LUJSIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLCB2aWV3cG9ydC1maXQ9Y292ZXIiPgo8bWV0YSBuYW1lPSJ0aGVtZS1jb2xvciIgY29udGVudD0iIzA5MGIwZiI+CjxtZXRhIG5hbWU9ImFwcGxlLW1vYmlsZS13ZWItYXBwLWNhcGFibGUiIGNvbnRlbnQ9InllcyI+Cjx0aXRsZT5TSUdQIOKAlCBTaXN0ZW1hIEludGVybm88L3RpdGxlPgo8bGluayByZWw9InByZWNvbm5lY3QiIGhyZWY9Imh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20iPgo8bGluayBocmVmPSJodHRwczovL2ZvbnRzLmdvb2dsZWFwaXMuY29tL2NzczI/ZmFtaWx5PUludGVyOndnaHRANDAwOzUwMDs2MDA7NzAwOzgwMCZkaXNwbGF5PXN3YXAiIHJlbD0ic3R5bGVzaGVldCI+CjxsaW5rIHJlbD0ic3R5bGVzaGVldCIgaHJlZj0ic3R5bGUuY3NzIj4KPC9oZWFkPgo8Ym9keT4KCjwhLS0g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIExPR0lOIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCAtLT4KPHNlY3Rpb24gaWQ9InRlbGEtbG9naW4iIGNsYXNzPSJsb2dpbi13cmFwIj4KICA8ZGl2IGNsYXNzPSJsb2dpbi1jYXJkIj4KICAgIDxkaXYgY2xhc3M9ImxvZ2luLWJhZGdlIiBpZD0ibG9naW4tYmFkZ2UiPuKWuDwvZGl2PgogICAgPGgxIGlkPSJsb2dpbi1ub21lIj5TSUdQPC9oMT4KICAgIDxwIGNsYXNzPSJzdWIiIGlkPSJsb2dpbi1zdWIiPkdydXBhbWVudG8gTXVuaWNpcGFsIGRlIFBvbGljaWFtZW50bzwvcD4KICAgIDxwIGNsYXNzPSJ0YWciPkFDRVNTTyBSRVNUUklUTzwvcD4KICAgIDxmb3JtIGlkPSJmb3JtLWxvZ2luIiBhdXRvY29tcGxldGU9Im9mZiI+CiAgICAgIDxsYWJlbD5Vc3XDoXJpbzxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0iaW4tbG9naW4iIHJlcXVpcmVkIGF1dG9jb21wbGV0ZT0idXNlcm5hbWUiPjwvbGFiZWw+CiAgICAgIDxsYWJlbD5TZW5oYQogICAgICAgIDxzcGFuIGNsYXNzPSJzZW5oYS13cmFwIj4KICAgICAgICAgIDxpbnB1dCB0eXBlPSJwYXNzd29yZCIgaWQ9ImluLXNlbmhhIiByZXF1aXJlZCBhdXRvY29tcGxldGU9ImN1cnJlbnQtcGFzc3dvcmQiPgogICAgICAgICAgPGJ1dHRvbiB0eXBlPSJidXR0b24iIGlkPSJidG4tb2xobyIgdGl0bGU9Im1vc3RyYXIgc2VuaGEiPvCfkYE8L2J1dHRvbj4KICAgICAgICA8L3NwYW4+CiAgICAgIDwvbGFiZWw+CiAgICAgIDxkaXYgaWQ9ImxvZ2luLWVycm8iIGNsYXNzPSJlcnJvIGhpZGRlbiI+PC9kaXY+CiAgICAgIDxidXR0b24gdHlwZT0ic3VibWl0IiBjbGFzcz0iYnRuLXByaW1hcmlvIj7ilrggQVVURU5USUNBUjwvYnV0dG9uPgogICAgPC9mb3JtPgogICAgPHAgY2xhc3M9ImF2aXNvIj5Ow6NvIHRlbSBhY2Vzc28/IFPDsyBvIEFkbWluIE1hc3RlciBlIG8gQ2hlZmUgZGUgUG9sw61jaWEgY2FkYXN0cmFtIG5vdm9zIG1lbWJyb3MuPC9wPgogICAgPHAgY2xhc3M9ImF2aXNvIj5BY2Vzc28gbW9uaXRvcmFkby4gTyB1c28gaW5kZXZpZG8gcmVzdWx0YXLDoSBlbSBwdW5pw6fDo28gYWRtaW5pc3RyYXRpdmEuPC9wPgogIDwvZGl2Pgo8L3NlY3Rpb24+Cgo8IS0tIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBURUxBIERFIFNVU1BFTlPDg08g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIC0tPgo8c2VjdGlvbiBpZD0idGVsYS1zdXNwZW5zYW8iIGNsYXNzPSJsb2dpbi13cmFwIGhpZGRlbiI+CiAgPGRpdiBjbGFzcz0ibG9naW4tY2FyZCBzdXNwZW5zbyI+CiAgICA8ZGl2IGNsYXNzPSJzdXNwLWljb25lIj7im5Q8L2Rpdj4KICAgIDxoMT5BQ0VTU08gU1VTUEVOU088L2gxPgogICAgPHAgY2xhc3M9InN1YiI+Vm9jw6ogZXN0w6EgdGVtcG9yYXJpYW1lbnRlIHN1c3BlbnNvIGRvIHNpc3RlbWE8L3A+CiAgICA8ZGl2IGNsYXNzPSJjcm9ub21ldHJvIiBpZD0ic3VzcC10ZW1wbyI+MDA6MDA6MDA8L2Rpdj4KICAgIDxkaXYgY2xhc3M9InN1c3AtaW5mbyI+CiAgICAgIDxkaXY+PHNwYW4+QXBsaWNhZG8gcG9yPC9zcGFuPjxzdHJvbmcgaWQ9InN1c3AtcG9yIj7igJQ8L3N0cm9uZz48L2Rpdj4KICAgICAgPGRpdj48c3Bhbj5Nb3Rpdm88L3NwYW4+PHN0cm9uZyBpZD0ic3VzcC1tb3Rpdm8iPuKAlDwvc3Ryb25nPjwvZGl2PgogICAgICA8ZGl2PjxzcGFuPkV4cGlyYSBlbTwvc3Bhbj48c3Ryb25nIGlkPSJzdXNwLWV4cGlyYSI+4oCUPC9zdHJvbmc+PC9kaXY+CiAgICA8L2Rpdj4KICAgIDxidXR0b24gY2xhc3M9ImJ0bi1zZWN1bmRhcmlvIiBpZD0iYnRuLXZvbHRhci1sb2dpbiI+Vm9sdGFyIGFvIGxvZ2luPC9idXR0b24+CiAgPC9kaXY+Cjwvc2VjdGlvbj4KCjwhLS0g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIEFQUCDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgLS0+CjxkaXYgaWQ9ImFwcCIgY2xhc3M9ImFwcCBoaWRkZW4iPgogIDxhc2lkZSBjbGFzcz0ic2lkZWJhciIgaWQ9InNpZGViYXIiPgogICAgPGRpdiBjbGFzcz0ibWFyY2EiPgogICAgICA8ZGl2IGNsYXNzPSJtYXJjYS1pY29uZSIgaWQ9Im1hcmNhLWljb25lIj7ilrg8L2Rpdj4KICAgICAgPGRpdj48c3Ryb25nIGlkPSJtYXJjYS1ub21lIj5TSUdQPC9zdHJvbmc+PHNtYWxsIGlkPSJtYXJjYS1zdWIiPlNpc3RlbWEgSW50ZXJubzwvc21hbGw+PC9kaXY+CiAgICA8L2Rpdj4KICAgIDxuYXYgaWQ9Im5hdiI+CiAgICAgIDxidXR0b24gY2xhc3M9Im5hdi1pdGVtIGF0aXZvIiBkYXRhLXRlbGE9ImRhc2hib2FyZCI+PHNwYW4+4pamPC9zcGFuPiBQYWluZWw8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ibmF2LWl0ZW0iIGRhdGEtdGVsYT0ib2NvcnJlbmNpYXMiPjxzcGFuPvCfk4s8L3NwYW4+IE9jb3Jyw6puY2lhczwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJuYXYtaXRlbSIgZGF0YS10ZWxhPSJwcm92YXMiPjxzcGFuPvCfk508L3NwYW4+IFByb3ZhczwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJuYXYtaXRlbSIgZGF0YS10ZWxhPSJwb250byI+PHNwYW4+8J+Vkjwvc3Bhbj4gQmF0ZSBQb250bzwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJuYXYtaXRlbSIgZGF0YS10ZWxhPSJoaWVyYXJxdWlhIj48c3Bhbj7wn46W77iPPC9zcGFuPiBIaWVyYXJxdWlhPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9Im5hdi1pdGVtIiBkYXRhLXRlbGE9InJlZ3JhcyI+PHNwYW4+8J+TnDwvc3Bhbj4gUmVncmFzIGRvIFJQPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9Im5hdi1pdGVtIiBkYXRhLXRlbGE9ImNvZGlnb3NxIj48c3Bhbj7wn5O7PC9zcGFuPiBDw7NkaWdvcyBRPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9Im5hdi1pdGVtIiBkYXRhLXRlbGE9ImVzdHVkb3MiPjxzcGFuPvCfk5o8L3NwYW4+IEVzdHVkb3M8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ibmF2LWl0ZW0iIGRhdGEtdGVsYT0iZWZldGl2byI+PHNwYW4+8J+Rrjwvc3Bhbj4gRWZldGl2bzwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJuYXYtaXRlbSIgZGF0YS10ZWxhPSJwb250b3MiPjxzcGFuPuKtkDwvc3Bhbj4gUG9udHVhw6fDo288L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ibmF2LWl0ZW0iIGRhdGEtdGVsYT0iY2hhdCI+PHNwYW4+8J+SrDwvc3Bhbj4gQ2hhdDwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJuYXYtaXRlbSIgZGF0YS10ZWxhPSJhdWRpdG9yaWEiPjxzcGFuPvCfm6HvuI88L3NwYW4+IEF1ZGl0b3JpYTwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJuYXYtaXRlbSIgZGF0YS10ZWxhPSJwZXJmaWwiPjxzcGFuPvCfkaQ8L3NwYW4+IE1ldSBQZXJmaWw8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ibmF2LWl0ZW0iIGRhdGEtdGVsYT0iYWRtaW4iIGlkPSJuYXYtYWRtaW4iPjxzcGFuPuKame+4jzwvc3Bhbj4gQWRtaW5pc3RyYcOnw6NvPC9idXR0b24+CiAgICA8L25hdj4KICAgIDxkaXYgY2xhc3M9InNpZGViYXItcGUiPgogICAgICA8ZGl2IGNsYXNzPSJldSI+CiAgICAgICAgPGRpdiBjbGFzcz0iYXZhdGFyIiBpZD0iZXUtYXZhdGFyIj4/PC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0iZXUtaW5mbyI+PHN0cm9uZyBpZD0iZXUtbm9tZSI+4oCUPC9zdHJvbmc+PHNtYWxsIGlkPSJldS1jYXJnbyI+4oCUPC9zbWFsbD48L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1zYWlyIiBpZD0iYnRuLXNhaXIiPuKPuyBTYWlyPC9idXR0b24+CiAgICA8L2Rpdj4KICA8L2FzaWRlPgogIDxkaXYgY2xhc3M9InNpZGViYXItZnVuZG8gaGlkZGVuIiBpZD0ic2lkZWJhci1mdW5kbyI+PC9kaXY+CgogIDxtYWluIGNsYXNzPSJjb250ZXVkbyI+CiAgICA8aGVhZGVyIGNsYXNzPSJ0b3BiYXIiPgogICAgICA8ZGl2IGNsYXNzPSJ0b3BiYXItZXNxIj4KICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4tbWVudSIgaWQ9ImJ0bi1tZW51IiB0eXBlPSJidXR0b24iIGFyaWEtbGFiZWw9IkFicmlyIG1lbnUiIGFyaWEtZXhwYW5kZWQ9ImZhbHNlIj4KICAgICAgICAgIDxzcGFuPjwvc3Bhbj48c3Bhbj48L3NwYW4+PHNwYW4+PC9zcGFuPgogICAgICAgIDwvYnV0dG9uPgogICAgICAgIDxkaXY+CiAgICAgICAgICA8aDIgaWQ9InRpdHVsby10ZWxhIj5QYWluZWw8L2gyPgogICAgICAgICAgPHAgY2xhc3M9InRvcGJhci1zdWIiIGlkPSJzdWJ0aXR1bG8tdGVsYSI+Vmlzw6NvIGdlcmFsIGRvIGdydXBhbWVudG88L3A+CiAgICAgICAgPC9kaXY+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJ0b3BiYXItZGlyIj4KICAgICAgICA8ZGl2IGNsYXNzPSJ0b3BiYXItbG9nbyIgaWQ9InRvcGJhci1sb2dvIj7ilrg8L2Rpdj4KICAgICAgICA8YnV0dG9uIGNsYXNzPSJzaW5vIiBpZD0iYnRuLW5vdGlmIj7wn5SUPGIgaWQ9Im5vdGlmLWJhZGdlIiBjbGFzcz0iaGlkZGVuIj4wPC9iPjwvYnV0dG9uPgogICAgICA8L2Rpdj4KICAgIDwvaGVhZGVyPgoKICAgIDxkaXYgaWQ9Im1lbnNhZ2VtLWZsdXR1YW50ZSIgY2xhc3M9ImZsdXR1YW50ZSBoaWRkZW4iPjwvZGl2PgoKICAgIDwhLS0gUEFJTkVMIC0tPgogICAgPHNlY3Rpb24gY2xhc3M9InRlbGEiIGlkPSJ0ZWxhLWRhc2hib2FyZCI+CiAgICAgIDxkaXYgY2xhc3M9ImNhcmRzIiBpZD0iY2FyZHMtZGFzaGJvYXJkIj48L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0iZHVhcy1jb2x1bmFzIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5PY29ycsOqbmNpYXMgcmVjZW50ZXM8L2gzPjwvZGl2PgogICAgICAgICAgPGRpdiBpZD0iZGFzaC1vY29ycmVuY2lhcyI+PC9kaXY+CiAgICAgICAgPC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj48aDM+UmFua2luZyBkZSBwb250b3M8L2gzPjwvZGl2PgogICAgICAgICAgPGRpdiBpZD0iZGFzaC1yYW5raW5nIj48L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L3NlY3Rpb24+CgogICAgPCEtLSBPQ09SUsOKTkNJQVMgLS0+CiAgICA8c2VjdGlvbiBjbGFzcz0idGVsYSBoaWRkZW4iIGlkPSJ0ZWxhLW9jb3JyZW5jaWFzIj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+CiAgICAgICAgICA8aDM+UmVnaXN0cmFyIG9jb3Jyw6puY2lhPC9oMz4KICAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSIgaWQ9ImJ0bi1hYnJpci1vY29ycmVuY2lhIj4rIE5vdmEgb2NvcnLDqm5jaWE8L2J1dHRvbj4KICAgICAgICA8L2Rpdj4KICAgICAgICA8cCBjbGFzcz0idGV4dG8tYWp1ZGEgaGlkZGVuIiBpZD0iYXZpc28tb2NvcnJlbmNpYSI+PC9wPgogICAgICAgIDxkaXYgaWQ9Imxpc3RhLW9jb3JyZW5jaWFzIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L3NlY3Rpb24+CgogICAgPCEtLSBFRkVUSVZPIC0tPgogICAgPHNlY3Rpb24gY2xhc3M9InRlbGEgaGlkZGVuIiBpZD0idGVsYS1lZmV0aXZvIj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+CiAgICAgICAgICA8aDM+RWZldGl2bzwvaDM+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJ0b3BvLWFjb2VzIj4KICAgICAgICAgICAgPGlucHV0IHR5cGU9InNlYXJjaCIgaWQ9ImJ1c2NhLWVmZXRpdm8iIHBsYWNlaG9sZGVyPSJCdXNjYXIgbm9tZSBvdSBsb2dpbi4uLiI+CiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSIgaWQ9ImJ0bi1hYnJpci11c3VhcmlvIj4rIE5vdm8gdXN1w6FyaW88L2J1dHRvbj4KICAgICAgICAgIDwvZGl2PgogICAgICAgIDwvZGl2PgogICAgICAgIDxkaXYgaWQ9InRhYmVsYS1lZmV0aXZvIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L3NlY3Rpb24+CgogICAgPCEtLSBQT05UT1MgLS0+CiAgICA8c2VjdGlvbiBjbGFzcz0idGVsYSBoaWRkZW4iIGlkPSJ0ZWxhLXBvbnRvcyI+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5MYW7Dp2FyIHBvbnRvczwvaDM+PC9kaXY+CiAgICAgICAgPGZvcm0gaWQ9ImZvcm0tcG9udG9zIiBjbGFzcz0iZm9ybS1saW5oYSI+CiAgICAgICAgICA8bGFiZWw+UG9saWNpYWw8c2VsZWN0IGlkPSJwb250b3MtdXNlciIgcmVxdWlyZWQ+PC9zZWxlY3Q+PC9sYWJlbD4KICAgICAgICAgIDxsYWJlbD5Qb250b3MgKCsgb3UgLSk8aW5wdXQgdHlwZT0ibnVtYmVyIiBpZD0icG9udG9zLWRlbHRhIiB2YWx1ZT0iMTAiIHJlcXVpcmVkPjwvbGFiZWw+CiAgICAgICAgICA8bGFiZWw+TW90aXZvPGlucHV0IHR5cGU9InRleHQiIGlkPSJwb250b3MtbW90aXZvIiBwbGFjZWhvbGRlcj0iRXguOiBhYm9yZGFnZW0gYmVtIGZlaXRhIiByZXF1aXJlZD48L2xhYmVsPgogICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIiB0eXBlPSJzdWJtaXQiPkxhbsOnYXI8L2J1dHRvbj4KICAgICAgICA8L2Zvcm0+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj48aDM+SGlzdMOzcmljbyBkZSBwb250dWHDp8OjbzwvaDM+PC9kaXY+CiAgICAgICAgPGRpdiBpZD0iaGlzdG9yaWNvLXBvbnRvcyI+PC9kaXY+CiAgICAgIDwvZGl2PgogICAgPC9zZWN0aW9uPgoKICAgIDwhLS0gQ0hBVCAtLT4KICAgIDxzZWN0aW9uIGNsYXNzPSJ0ZWxhIGhpZGRlbiIgaWQ9InRlbGEtY2hhdCI+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCBjaGF0LXBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5DaGF0IGRvIGVmZXRpdm88L2gzPjwvZGl2PgogICAgICAgIDxkaXYgaWQ9ImNoYXQtbWVuc2FnZW5zIiBjbGFzcz0iY2hhdC1tZW5zYWdlbnMiPjwvZGl2PgogICAgICAgIDxmb3JtIGlkPSJmb3JtLWNoYXQiIGNsYXNzPSJjaGF0LWZvcm0iPgogICAgICAgICAgPGlucHV0IHR5cGU9InRleHQiIGlkPSJjaGF0LWlucHV0IiBwbGFjZWhvbGRlcj0iRXNjcmV2YSB1bWEgbWVuc2FnZW0uLi4iIG1heGxlbmd0aD0iODAwIiBhdXRvY29tcGxldGU9Im9mZiI+CiAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4tcHJpbWFyaW8gc20iIHR5cGU9InN1Ym1pdCI+RW52aWFyPC9idXR0b24+CiAgICAgICAgPC9mb3JtPgogICAgICA8L2Rpdj4KICAgIDwvc2VjdGlvbj4KCiAgICA8IS0tIFBST1ZBUyAtLT4KICAgIDxzZWN0aW9uIGNsYXNzPSJ0ZWxhIGhpZGRlbiIgaWQ9InRlbGEtcHJvdmFzIj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+CiAgICAgICAgICA8aDM+UHJvdmFzPC9oMz4KICAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSBoaWRkZW4iIGlkPSJidG4tYWJyaXItcHJvdmEiPisgTGFuw6dhciBwcm92YTwvYnV0dG9uPgogICAgICAgIDwvZGl2PgogICAgICAgIDxwIGNsYXNzPSJ0ZXh0by1hanVkYSIgaWQ9InByb3Zhcy1hdmlzbyI+QXMgcHJvdmFzIGxhbsOnYWRhcyBhcGFyZWNlbSBhcXVpIHBhcmEgdG9kbyBvIGVmZXRpdm8uIEZhw6dhIGEgc3VhIGUgZW52aWUgcGFyYSBhdmFsaWHDp8Ojby48L3A+CiAgICAgICAgPGRpdiBpZD0ibGlzdGEtcHJvdmFzIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCBoaWRkZW4iIGlkPSJwYWluZWwtZW50cmVnYXMiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj48aDM+UHJvdmFzIGVudHJlZ3VlcyBwYXJhIGF2YWxpYXI8L2gzPjwvZGl2PgogICAgICAgIDxkaXYgaWQ9Imxpc3RhLWVudHJlZ2FzIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L3NlY3Rpb24+CgogICAgPCEtLSBCQVRFIFBPTlRPIC0tPgogICAgPHNlY3Rpb24gY2xhc3M9InRlbGEgaGlkZGVuIiBpZD0idGVsYS1wb250byI+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5NZXUgcG9udG88L2gzPjwvZGl2PgogICAgICAgIDxkaXYgaWQ9InBvbnRvLXN0YXR1cyI+PC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0ibGluaGEtYm90b2VzIiBpZD0icG9udG8tYm90b2VzIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5GdW5jaW9uw6FyaW8gZG8gbcOqczwvaDM+PC9kaXY+CiAgICAgICAgPGRpdiBpZD0icG9udG8tZnVuY2lvbmFyaW8tbWVzIj48L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJyYW5raW5nLW1lcyIgaWQ9InBvbnRvLXJhbmtpbmctbWVzIj48L2Rpdj4KICAgICAgICA8cCBjbGFzcz0idGV4dG8tYWp1ZGEiIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPkNvbnRhIGEgc29tYSBkZSB0b2RvIG8gdGVtcG8gZGUgcG9udG8gYmF0aWRvIGUgZmluYWxpemFkbyBubyBtw6pzLiBQYXVzYXMgbsOjbyBlbnRyYW0gbmEgY29udGEuPC9wPgogICAgICA8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+PGgzPk1ldSBoaXN0w7NyaWNvIGRlIHBvbnRvPC9oMz48L2Rpdj4KICAgICAgICA8ZGl2IGlkPSJwb250by1oaXN0b3JpY28iPjwvZGl2PgogICAgICA8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIGhpZGRlbiIgaWQ9InBhaW5lbC1wb250by10b2RvcyI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5Qb250byBkZSB0b2RvIG8gZWZldGl2bzwvaDM+PC9kaXY+CiAgICAgICAgPGRpdiBpZD0icG9udG8tdG9kb3MiPjwvZGl2PgogICAgICA8L2Rpdj4KICAgIDwvc2VjdGlvbj4KCiAgICA8IS0tIEhJRVJBUlFVSUEgLS0+CiAgICA8c2VjdGlvbiBjbGFzcz0idGVsYSBoaWRkZW4iIGlkPSJ0ZWxhLWhpZXJhcnF1aWEiPgogICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj48aDM+Q2FkZWlhIGRlIGNvbWFuZG88L2gzPjwvZGl2PgogICAgICAgIDxkaXYgaWQ9Imxpc3RhLWhpZXJhcnF1aWEiPjwvZGl2PgogICAgICA8L2Rpdj4KICAgIDwvc2VjdGlvbj4KCiAgICA8IS0tIFJFR1JBUyBETyBSUCAtLT4KICAgIDxzZWN0aW9uIGNsYXNzPSJ0ZWxhIGhpZGRlbiIgaWQ9InRlbGEtcmVncmFzIj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+PGgzPlJlZ3JhcyBkbyBSUDwvaDM+PC9kaXY+CiAgICAgICAgPGRpdiBpZD0idGV4dG8tcmVncmFzIiBjbGFzcz0icmVncmFzLXRleHRvIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCBoaWRkZW4iIGlkPSJwYWluZWwtZWRpdGFyLXJlZ3JhcyI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5FZGl0YXIgcmVncmFzPC9oMz48L2Rpdj4KICAgICAgICA8Zm9ybSBpZD0iZm9ybS1yZWdyYXMiIGNsYXNzPSJmb3JtLWNvbHVuYSI+CiAgICAgICAgICA8dGV4dGFyZWEgaWQ9InJlZ3Jhcy10ZXh0by1lZCIgcm93cz0iMTQiIG1heGxlbmd0aD0iMjAwMDAiIHBsYWNlaG9sZGVyPSJDb2xlIGFxdWkgYXMgcmVncmFzIGRvIFJQICh1bWEgcG9yIGxpbmhhKS4uLiI+PC90ZXh0YXJlYT4KICAgICAgICAgIDxkaXYgY2xhc3M9ImxpbmhhLWJvdG9lcyI+PGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIiB0eXBlPSJzdWJtaXQiPlNhbHZhciByZWdyYXM8L2J1dHRvbj48L2Rpdj4KICAgICAgICA8L2Zvcm0+CiAgICAgIDwvZGl2PgogICAgPC9zZWN0aW9uPgoKICAgIDwhLS0gQ8OTRElHT1MgUSAtLT4KICAgIDxzZWN0aW9uIGNsYXNzPSJ0ZWxhIGhpZGRlbiIgaWQ9InRlbGEtY29kaWdvc3EiPgogICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj4KICAgICAgICAgIDxoMz5Dw7NkaWdvcyBRIChyw6FkaW8pPC9oMz4KICAgICAgICAgIDxkaXYgY2xhc3M9ImFjb2VzLWxpbmhhIiBpZD0iY3EtYWNvZXMiPjwvZGl2PgogICAgICAgIDwvZGl2PgogICAgICAgIDxwIGNsYXNzPSJ0ZXh0by1hanVkYSI+Tm8gcsOhZGlvLCBjYWRhIGPDs2RpZ28gc3Vic3RpdHVpIHVtYSBmcmFzZSBpbnRlaXJhLiBEaWdpdGUgbmEgYnVzY2EgcHJhIGFjaGFyIHLDoXBpZG8gKGPDs2RpZ28gb3Ugc2lnbmlmaWNhZG8pLjwvcD4KICAgICAgICA8ZGl2IGNsYXNzPSJmb3JtLWxpbmhhIj4KICAgICAgICAgIDxsYWJlbD5CdXNjYXI8aW5wdXQgdHlwZT0idGV4dCIgaWQ9ImNxLWJ1c2NhIiBwbGFjZWhvbGRlcj0iRXguOiBRQVAsIGVzY3V0YSwgbG9jYWxpemHDp8OjbyI+PC9sYWJlbD4KICAgICAgICAgIDxsYWJlbD5HcnVwbzxzZWxlY3QgaWQ9ImNxLWdydXBvIj48b3B0aW9uIHZhbHVlPSIiPlRvZG9zPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD4KICAgICAgICA8L2Rpdj4KICAgICAgICA8ZGl2IGlkPSJsaXN0YS1jb2RpZ29zcSI+PC9kaXY+CiAgICAgIDwvZGl2PgogICAgPC9zZWN0aW9uPgoKICAgIDwhLS0gRVNUVURPUyAtLT4KICAgIDxzZWN0aW9uIGNsYXNzPSJ0ZWxhIGhpZGRlbiIgaWQ9InRlbGEtZXN0dWRvcyI+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPgogICAgICAgICAgPGgzPkVzdHVkb3M8L2gzPgogICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIGhpZGRlbiIgaWQ9ImJ0bi1hYnJpci1lc3R1ZG8iPisgTm92byBlc3R1ZG88L2J1dHRvbj4KICAgICAgICA8L2Rpdj4KICAgICAgICA8cCBjbGFzcz0idGV4dG8tYWp1ZGEiIGlkPSJlc3R1ZG9zLWF2aXNvIj48L3A+CiAgICAgICAgPGRpdiBpZD0ibGlzdGEtZXN0dWRvcyI+PC9kaXY+CiAgICAgIDwvZGl2PgogICAgPC9zZWN0aW9uPgoKICAgIDwhLS0gQVVESVRPUklBIC0tPgogICAgPHNlY3Rpb24gY2xhc3M9InRlbGEgaGlkZGVuIiBpZD0idGVsYS1hdWRpdG9yaWEiPgogICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj48aDM+UmVnaXN0cm8gZGUgYXVkaXRvcmlhPC9oMz48L2Rpdj4KICAgICAgICA8ZGl2IGlkPSJsaXN0YS1hdWRpdG9yaWEiPjwvZGl2PgogICAgICA8L2Rpdj4KICAgIDwvc2VjdGlvbj4KCiAgICA8IS0tIFBFUkZJTCAtLT4KICAgIDxzZWN0aW9uIGNsYXNzPSJ0ZWxhIGhpZGRlbiIgaWQ9InRlbGEtcGVyZmlsIj4KICAgICAgPGRpdiBjbGFzcz0iZHVhcy1jb2x1bmFzIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5NZXVzIGRhZG9zPC9oMz48L2Rpdj4KICAgICAgICAgIDxmb3JtIGlkPSJmb3JtLXBlcmZpbCIgY2xhc3M9ImZvcm0tY29sdW5hIj4KICAgICAgICAgICAgPGxhYmVsPk5vbWU8aW5wdXQgdHlwZT0idGV4dCIgaWQ9InBlcmZpbC1ub21lIiBtYXhsZW5ndGg9IjYwIj48L2xhYmVsPgogICAgICAgICAgICA8bGFiZWw+UmVjYWRvIChtw6F4IDIwMCk8dGV4dGFyZWEgaWQ9InBlcmZpbC1yZWNhZG8iIG1heGxlbmd0aD0iMjAwIiByb3dzPSIzIj48L3RleHRhcmVhPjwvbGFiZWw+CiAgICAgICAgICAgIDxsYWJlbD5Gb3RvCiAgICAgICAgICAgICAgPGlucHV0IHR5cGU9ImZpbGUiIGlkPSJwZXJmaWwtZm90byIgYWNjZXB0PSJpbWFnZS8qIj4KICAgICAgICAgICAgPC9sYWJlbD4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iZm90by1wcmV2aWV3Ij48aW1nIGlkPSJwZXJmaWwtZm90by1pbWciIGFsdD0iIiBjbGFzcz0iaGlkZGVuIj48c3BhbiBpZD0icGVyZmlsLXNlbS1mb3RvIj5zZW0gZm90bzwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0ibGluaGEtYm90b2VzIj4KICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4tcHJpbWFyaW8gc20iIHR5cGU9InN1Ym1pdCI+U2FsdmFyPC9idXR0b24+CiAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXNlY3VuZGFyaW8gc20iIHR5cGU9ImJ1dHRvbiIgaWQ9ImJ0bi1yZW1vdmVyLWZvdG8iPlJlbW92ZXIgZm90bzwvYnV0dG9uPgogICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgIDwvZm9ybT4KICAgICAgICA8L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5BbHRlcmFyIHNlbmhhPC9oMz48L2Rpdj4KICAgICAgICAgIDxmb3JtIGlkPSJmb3JtLXNlbmhhIiBjbGFzcz0iZm9ybS1jb2x1bmEiPgogICAgICAgICAgICA8bGFiZWw+U2VuaGEgYXR1YWw8aW5wdXQgdHlwZT0icGFzc3dvcmQiIGlkPSJzZW5oYS1hdHVhbCIgcmVxdWlyZWQ+PC9sYWJlbD4KICAgICAgICAgICAgPGxhYmVsPk5vdmEgc2VuaGE8aW5wdXQgdHlwZT0icGFzc3dvcmQiIGlkPSJzZW5oYS1ub3ZhIiByZXF1aXJlZCBtaW5sZW5ndGg9IjQiPjwvbGFiZWw+CiAgICAgICAgICAgIDxsYWJlbD5Db25maXJtYXIgbm92YSBzZW5oYTxpbnB1dCB0eXBlPSJwYXNzd29yZCIgaWQ9InNlbmhhLWNvbmYiIHJlcXVpcmVkIG1pbmxlbmd0aD0iNCI+PC9sYWJlbD4KICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIiB0eXBlPSJzdWJtaXQiPkFsdGVyYXIgc2VuaGE8L2J1dHRvbj4KICAgICAgICAgIDwvZm9ybT4KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5NZXVzIHBvbnRvczwvaDM+PC9kaXY+CiAgICAgICAgPGRpdiBpZD0icGVyZmlsLXBvbnRvcyI+PC9kaXY+CiAgICAgIDwvZGl2PgogICAgPC9zZWN0aW9uPgoKICAgIDwhLS0gQURNSU4gLS0+CiAgICA8c2VjdGlvbiBjbGFzcz0idGVsYSBoaWRkZW4iIGlkPSJ0ZWxhLWFkbWluIj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+PGgzPkJhY2t1cCBkbyBzaXN0ZW1hPC9oMz48L2Rpdj4KICAgICAgICA8cCBjbGFzcz0idGV4dG8tYWp1ZGEiPkJhaXhlIHVtYSBjw7NwaWEgY29tcGxldGEgZG9zIGRhZG9zICh1c3XDoXJpb3MsIG9jb3Jyw6puY2lhcywgcG9udG9zLCBjaGF0IGUgYXVkaXRvcmlhKS4gR3VhcmRlIG8gYXJxdWl2byBmb3JhIGRvIHNlcnZpZG9yLjwvcD4KICAgICAgICA8ZGl2IGNsYXNzPSJsaW5oYS1ib3RvZXMiPgogICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIiBpZD0iYnRuLWJhY2t1cCI+4qyH77iPIEJhaXhhciBiYWNrdXA8L2J1dHRvbj4KICAgICAgICAgIDxsYWJlbCBjbGFzcz0iYnRuLXNlY3VuZGFyaW8gc20gYXJxdWl2by1sYWJlbCI+4qyG77iPIFJlc3RhdXJhciBiYWNrdXA8aW5wdXQgdHlwZT0iZmlsZSIgaWQ9ImluLXJlc3RvcmUiIGFjY2VwdD0iYXBwbGljYXRpb24vanNvbiIgaGlkZGVuPjwvbGFiZWw+CiAgICAgICAgPC9kaXY+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj4KICAgICAgICAgIDxoMz5JZGVudGlkYWRlIGRvIHNpc3RlbWE8L2gzPgogICAgICAgICAgPHNwYW4gY2xhc3M9ImJhZGdlIGFtYXJlbG8iPnPDsyBBZG1pbiBNYXN0ZXI8L3NwYW4+CiAgICAgICAgPC9kaXY+CiAgICAgICAgPHAgY2xhc3M9InRleHRvLWFqdWRhIj5BcXVpIHZvY8OqIHRyb2NhIG8gbm9tZSwgYSBmb3RvIChzw61tYm9sbykgZSBhIGNvciBkbyBzaXN0ZW1hLiBUdWRvIGlzc28gYXBhcmVjZSBwYXJhIHRvZG8gbyBlZmV0aXZvLCBpbmNsdXNpdmUgbmEgdGVsYSBkZSBsb2dpbiBlIG5vIG1lbnUgZG8gY2VsdWxhci48L3A+CiAgICAgICAgPGRpdiBjbGFzcz0iaWRlbnRpZGFkZSI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJpZGVudC1wcmV2aWV3Ij4KICAgICAgICAgICAgPGRpdiBjbGFzcz0ibWFyY2EtaWNvbmUiIGlkPSJpZGVudC1pY29uZSI+4pa4PC9kaXY+CiAgICAgICAgICAgIDxkaXY+CiAgICAgICAgICAgICAgPHN0cm9uZyBpZD0iaWRlbnQtbm9tZSI+U0lHUDwvc3Ryb25nPgogICAgICAgICAgICAgIDxzbWFsbCBpZD0iaWRlbnQtY29ycCI+U2lzdGVtYSBJbnRlcm5vPC9zbWFsbD4KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICA8L2Rpdj4KICAgICAgICAgIDxmb3JtIGlkPSJmb3JtLWNvbmZpZyIgY2xhc3M9ImZvcm0tY29sdW5hIj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iZm9ybS1kdXBsYSI+CiAgICAgICAgICAgICAgPGxhYmVsPlNpZ2xhIC8gbm9tZSBjdXJ0bzxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0iY2ZnLW5vbWUiIG1heGxlbmd0aD0iMjQiIHBsYWNlaG9sZGVyPSJTSUdQIj48L2xhYmVsPgogICAgICAgICAgICAgIDxsYWJlbD5Ob21lIGRhIGNvcnBvcmHDp8OjbzxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0iY2ZnLWNvcnAiIG1heGxlbmd0aD0iODAiIHBsYWNlaG9sZGVyPSJHcnVwYW1lbnRvIE11bmljaXBhbCBkZSBQb2xpY2lhbWVudG8iPjwvbGFiZWw+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICA8bGFiZWw+Rm90byAvIHPDrW1ib2xvIGRvIHNpc3RlbWEgKFBORywgSlBHKQogICAgICAgICAgICAgIDxpbnB1dCB0eXBlPSJmaWxlIiBpZD0iY2ZnLWxvZ28iIGFjY2VwdD0iaW1hZ2UvKiI+CiAgICAgICAgICAgIDwvbGFiZWw+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImxvZ28tcHJldmlldyI+CiAgICAgICAgICAgICAgPGltZyBpZD0iY2ZnLWxvZ28taW1nIiBhbHQ9IiIgY2xhc3M9ImhpZGRlbiI+CiAgICAgICAgICAgICAgPHNwYW4gaWQ9ImNmZy1zZW0tbG9nbyI+c2VtIGZvdG88L3NwYW4+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICA8bGFiZWw+Q29yIGRvIHNpc3RlbWE8L2xhYmVsPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJ0ZW1hcyIgaWQ9InRlbWFzIj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0ibGluaGEtYm90b2VzIj4KICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4tcHJpbWFyaW8gc20iIHR5cGU9InN1Ym1pdCI+U2FsdmFyIGlkZW50aWRhZGU8L2J1dHRvbj4KICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4tc2VjdW5kYXJpbyBzbSIgdHlwZT0iYnV0dG9uIiBpZD0iYnRuLXJlbW92ZXItbG9nbyI+UmVtb3ZlciBmb3RvPC9idXR0b24+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgPC9mb3JtPgogICAgICAgIDwvZGl2PgogICAgICA8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIGhpZGRlbiIgaWQ9InBhaW5lbC1saW1wZXphIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+CiAgICAgICAgICA8aDM+TGltcGFyIGRhZG9zPC9oMz4KICAgICAgICAgIDxzcGFuIGNsYXNzPSJiYWRnZSB2ZXJtZWxobyI+c8OzIEFkbWluIE1hc3Rlcjwvc3Bhbj4KICAgICAgICA8L2Rpdj4KICAgICAgICA8cCBjbGFzcz0idGV4dG8tYWp1ZGEiPkFxdWkgdm9jw6ogYXBhZ2EgYXMgbGlzdGFzIGRvIHNpc3RlbWEuIDxzdHJvbmc+TsOjbyB0ZW0gY29tbyBkZXNmYXplcjwvc3Ryb25nPiwgZW50w6NvIGJhaXhlIHVtIGJhY2t1cCBhbnRlcy4gQXMgY29udGFzIGRvcyBtZW1icm9zLCBhcyBSZWdyYXMgZG8gUlAsIG9zIEVzdHVkb3MgZSBhIGlkZW50aWRhZGUgKG5vbWUsIGZvdG8sIGNvcikgbnVuY2Egc8OjbyBhcGFnYWRvcy48L3A+CiAgICAgICAgPGRpdiBjbGFzcz0iZ3JhZGUtbGltcGV6YSIgaWQ9ImdyYWRlLWxpbXBlemEiPjwvZGl2PgogICAgICA8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+PGgzPlJlc3VtbzwvaDM+PC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0idGV4dG8tYWp1ZGEiIGlkPSJhZG1pbi1pbmZvIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L3NlY3Rpb24+CiAgPC9tYWluPgo8L2Rpdj4KCjwhLS0g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIE1PREFJUyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgLS0+CjxkaXYgY2xhc3M9Im92ZXJsYXkgaGlkZGVuIiBpZD0ib3ZlcmxheSI+CiAgPGRpdiBjbGFzcz0ibW9kYWwiIGlkPSJtb2RhbCI+CiAgICA8ZGl2IGNsYXNzPSJtb2RhbC10b3BvIj48aDMgaWQ9Im1vZGFsLXRpdHVsbyI+4oCUPC9oMz48YnV0dG9uIGlkPSJtb2RhbC1mZWNoYXIiPuKclTwvYnV0dG9uPjwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9kYWwtY29ycG8iIGlkPSJtb2RhbC1jb3JwbyI+PC9kaXY+CiAgPC9kaXY+CjwvZGl2PgoKPHNjcmlwdCBzcmM9ImFwcC5qcyI+PC9zY3JpcHQ+CjwvYm9keT4KPC9odG1sPgo=","/style.css":"KiB7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IG1hcmdpbjogMDsgcGFkZGluZzogMDsgfQoKLyog4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIHBhbGV0YSDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAKICAgQSBjb3IgZGUgZGVzdGFxdWUgKC0tYWMpIHZlbSBkbyAidGVtYSIgc2Fsdm8gZW0gQWRtaW5pc3RyYcOnw6NvIOKGkiBJZGVudGlkYWRlLgogICBPIHBhZHLDo28gw6kgRG91cmFkbzsgbyBKUyB0cm9jYSBlc3NhcyB2YXJpw6F2ZWlzIHF1YW5kbyBvIHRlbWEgbXVkYS4gICAgICAgICAqLwo6cm9vdCB7CiAgLS1iZzogIzA3MDgwYjsKICAtLWJnMjogIzBjMGUxMzsKICAtLWNhcmQ6ICMxMTEzMTk7CiAgLS1jYXJkMjogcmdiYSgyMywgMjYsIDMzLCAuNjIpOwogIC0tbGluaGE6ICMyNDI3MmY7CiAgLS10ZXh0bzogI2VkZWZmNDsKICAtLXN1YXZlOiAjOTdhMGIxOwogIC0tYWM6ICNlOGI5NWU7CiAgLS1hYzI6ICNiNDg2MmM7CiAgLS1hYy10eHQ6ICMxYjE0MDg7CiAgLS1hYy1zb2Z0OiByZ2JhKDIzMiwgMTg1LCA5NCwgLjEzKTsKICAtLWFjLWxpbmU6IHJnYmEoMjMyLCAxODUsIDk0LCAuMzgpOwogIC0tdmVybWVsaG86ICNlZjViNWI7CiAgLS12ZXJkZTogIzM0ZDM5OTsKICAtLWFtYXJlbG86ICNlOGIyM2E7Cn0KCmh0bWwgeyAtd2Via2l0LXRleHQtc2l6ZS1hZGp1c3Q6IDEwMCU7IH0KCmJvZHkgewogIGZvbnQtZmFtaWx5OiAnSW50ZXInLCBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7CiAgYmFja2dyb3VuZDoKICAgIHJhZGlhbC1ncmFkaWVudCg5MDBweCA1MjBweCBhdCA4JSAtMTIlLCByZ2JhKDIzMiwgMTg1LCA5NCwgLjEwKSAwJSwgdHJhbnNwYXJlbnQgNjAlKSwKICAgIHJhZGlhbC1ncmFkaWVudCg4MDBweCA1MDBweCBhdCAxMDAlIDAlLCByZ2JhKDI1NSwgMjU1LCAyNTUsIC4wMzUpIDAlLCB0cmFuc3BhcmVudCA1NSUpLAogICAgdmFyKC0tYmcpOwogIGNvbG9yOiB2YXIoLS10ZXh0byk7CiAgbWluLWhlaWdodDogMTAwdmg7CiAgLXdlYmtpdC1mb250LXNtb290aGluZzogYW50aWFsaWFzZWQ7Cn0KCi5oaWRkZW4geyBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7IH0KCi8qIOKUgOKUgOKUgOKUgOKUgCBsb2dpbiDilIDilIDilIDilIDilIAgKi8KLmxvZ2luLXdyYXAgeyBtaW4taGVpZ2h0OiAxMDB2aDsgbWluLWhlaWdodDogMTAwZHZoOyBkaXNwbGF5OiBncmlkOyBwbGFjZS1pdGVtczogY2VudGVyOyBwYWRkaW5nOiAyNHB4OyB9Ci5sb2dpbi1jYXJkIHsKICB3aWR0aDogMTAwJTsgbWF4LXdpZHRoOiA0MDBweDsgYmFja2dyb3VuZDogdmFyKC0tY2FyZCk7CiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBib3JkZXItcmFkaXVzOiAyMHB4OyBwYWRkaW5nOiAzNHB4IDI4cHg7CiAgYm94LXNoYWRvdzogMCAzMHB4IDgwcHggcmdiYSgwLCAwLCAwLCAuNiksIGluc2V0IDAgMXB4IDAgcmdiYSgyNTUsIDI1NSwgMjU1LCAuMDQpOwogIHRleHQtYWxpZ246IGNlbnRlcjsKfQoubG9naW4tYmFkZ2UgewogIHdpZHRoOiA2NHB4OyBoZWlnaHQ6IDY0cHg7IG1hcmdpbjogMCBhdXRvIDE2cHg7IGJvcmRlci1yYWRpdXM6IDE4cHg7IG92ZXJmbG93OiBoaWRkZW47CiAgZGlzcGxheTogZ3JpZDsgcGxhY2UtaXRlbXM6IGNlbnRlcjsgZm9udC1zaXplOiAzMHB4OyBmb250LXdlaWdodDogODAwOyBjb2xvcjogdmFyKC0tYWMtdHh0KTsKICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTU1ZGVnLCB2YXIoLS1hYyksIHZhcigtLWFjMikpOwogIGJveC1zaGFkb3c6IDAgMTJweCAzNHB4IHJnYmEoMCwgMCwgMCwgLjQ1KTsKfQoubWFyY2EtaWNvbmUgaW1nLCAubG9naW4tYmFkZ2UgaW1nLCAudG9wYmFyLWxvZ28gaW1nIHsKICB3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDAlOyBvYmplY3QtZml0OiBjb3ZlcjsgZGlzcGxheTogYmxvY2s7Cn0KLmxvZ2luLWNhcmQgaDEgeyBmb250LXNpemU6IDI2cHg7IGxldHRlci1zcGFjaW5nOiAycHg7IGZvbnQtd2VpZ2h0OiA4MDA7IH0KLmxvZ2luLWNhcmQgLnN1YiB7IGNvbG9yOiB2YXIoLS1zdWF2ZSk7IGZvbnQtc2l6ZTogMTNweDsgbWFyZ2luLXRvcDogNHB4OyB9Ci5sb2dpbi1jYXJkIC50YWcgewogIGRpc3BsYXk6IGlubGluZS1ibG9jazsgbWFyZ2luOiAxOHB4IDAgMjBweDsgZm9udC1zaXplOiAxMHB4OyBsZXR0ZXItc3BhY2luZzogMi41cHg7CiAgY29sb3I6IHZhcigtLWFjKTsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYWMtbGluZSk7IGJhY2tncm91bmQ6IHZhcigtLWFjLXNvZnQpOwogIHBhZGRpbmc6IDVweCAxMnB4OyBib3JkZXItcmFkaXVzOiA5OTlweDsgZm9udC13ZWlnaHQ6IDYwMDsKfQoubG9naW4tY2FyZCBmb3JtIHsgdGV4dC1hbGlnbjogbGVmdDsgfQpsYWJlbCB7IGRpc3BsYXk6IGJsb2NrOyBmb250LXNpemU6IDEycHg7IGNvbG9yOiB2YXIoLS1zdWF2ZSk7IG1hcmdpbi1ib3R0b206IDE0cHg7IGZvbnQtd2VpZ2h0OiA1MDA7IH0KaW5wdXQsIHNlbGVjdCwgdGV4dGFyZWEgewogIHdpZHRoOiAxMDAlOyBtYXJnaW4tdG9wOiA2cHg7IGJhY2tncm91bmQ6ICMwYTBjMTE7IGNvbG9yOiB2YXIoLS10ZXh0byk7CiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBib3JkZXItcmFkaXVzOiAxMXB4OyBwYWRkaW5nOiAxMnB4IDEzcHg7CiAgZm9udC1mYW1pbHk6IGluaGVyaXQ7IGZvbnQtc2l6ZTogMTRweDsgb3V0bGluZTogbm9uZTsgdHJhbnNpdGlvbjogLjE1czsKfQppbnB1dDpmb2N1cywgc2VsZWN0OmZvY3VzLCB0ZXh0YXJlYTpmb2N1cyB7IGJvcmRlci1jb2xvcjogdmFyKC0tYWMtbGluZSk7IGJveC1zaGFkb3c6IDAgMCAwIDNweCB2YXIoLS1hYy1zb2Z0KTsgfQouc2VuaGEtd3JhcCB7IHBvc2l0aW9uOiByZWxhdGl2ZTsgZGlzcGxheTogYmxvY2s7IH0KLnNlbmhhLXdyYXAgYnV0dG9uIHsKICBwb3NpdGlvbjogYWJzb2x1dGU7IHJpZ2h0OiA4cHg7IHRvcDogNTAlOyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSk7CiAgYmFja2dyb3VuZDogbm9uZTsgYm9yZGVyOiBub25lOyBjb2xvcjogdmFyKC0tc3VhdmUpOyBjdXJzb3I6IHBvaW50ZXI7IGZvbnQtc2l6ZTogMTVweDsKICBwYWRkaW5nOiA2cHg7Cn0KLmJ0bi1wcmltYXJpbyB7CiAgd2lkdGg6IDEwMCU7IGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxODBkZWcsIHZhcigtLWFjKSwgdmFyKC0tYWMyKSk7CiAgY29sb3I6IHZhcigtLWFjLXR4dCk7IGJvcmRlcjogbm9uZTsgYm9yZGVyLXJhZGl1czogMTFweDsgcGFkZGluZzogMTNweDsgZm9udC13ZWlnaHQ6IDgwMDsKICBmb250LXNpemU6IDEzcHg7IGxldHRlci1zcGFjaW5nOiAxcHg7IGN1cnNvcjogcG9pbnRlcjsgdHJhbnNpdGlvbjogLjE1czsKICBmb250LWZhbWlseTogaW5oZXJpdDsKfQouYnRuLXByaW1hcmlvOmhvdmVyIHsgZmlsdGVyOiBicmlnaHRuZXNzKDEuMDgpOyB9Ci5idG4tcHJpbWFyaW8uc20geyB3aWR0aDogYXV0bzsgcGFkZGluZzogMTBweCAxOHB4OyB9Ci5idG4tc2VjdW5kYXJpbyB7CiAgYmFja2dyb3VuZDogIzE3MWEyMjsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBjb2xvcjogdmFyKC0tdGV4dG8pOwogIGJvcmRlci1yYWRpdXM6IDExcHg7IHBhZGRpbmc6IDEwcHggMTZweDsgZm9udC1zaXplOiAxM3B4OyBmb250LXdlaWdodDogNjAwOwogIGN1cnNvcjogcG9pbnRlcjsgZGlzcGxheTogaW5saW5lLWJsb2NrOyBmb250LWZhbWlseTogaW5oZXJpdDsKfQouYnRuLXNlY3VuZGFyaW86aG92ZXIgeyBib3JkZXItY29sb3I6IHZhcigtLWFjLWxpbmUpOyB9Ci5hcnF1aXZvLWxhYmVsIHsgY3Vyc29yOiBwb2ludGVyOyB9Ci5hdmlzbyB7IGZvbnQtc2l6ZTogMTFweDsgY29sb3I6ICM1ZTY2NzU7IG1hcmdpbi10b3A6IDE4cHg7IGxpbmUtaGVpZ2h0OiAxLjU7IH0KLmVycm8gewogIGJhY2tncm91bmQ6ICMzNDE1MTg7IGJvcmRlcjogMXB4IHNvbGlkICM2YjI2MmQ7IGNvbG9yOiAjZmZiMGIzOwogIGZvbnQtc2l6ZTogMTJweDsgYm9yZGVyLXJhZGl1czogMTBweDsgcGFkZGluZzogMTBweCAxMnB4OyBtYXJnaW4tYm90dG9tOiAxMnB4Owp9CgovKiDilIDilIDilIDilIDilIAgc3VzcGVuc8OjbyDilIDilIDilIDilIDilIAgKi8KLnN1c3BlbnNvIHsgbWF4LXdpZHRoOiA0NDBweDsgfQouc3VzcC1pY29uZSB7IGZvbnQtc2l6ZTogNDRweDsgbWFyZ2luLWJvdHRvbTogMTBweDsgfQouY3Jvbm9tZXRybyB7CiAgZm9udC1zaXplOiA0MHB4OyBmb250LXdlaWdodDogODAwOyBsZXR0ZXItc3BhY2luZzogM3B4OyBjb2xvcjogdmFyKC0tdmVybWVsaG8pOwogIGZvbnQtdmFyaWFudC1udW1lcmljOiB0YWJ1bGFyLW51bXM7IG1hcmdpbjogMThweCAwOwp9Ci5zdXNwLWluZm8geyBkaXNwbGF5OiBncmlkOyBnYXA6IDhweDsgdGV4dC1hbGlnbjogbGVmdDsgbWFyZ2luLWJvdHRvbTogMjBweDsgfQouc3VzcC1pbmZvID4gZGl2IHsKICBkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47IGdhcDogMTJweDsKICBiYWNrZ3JvdW5kOiAjMGEwYzExOyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7IGJvcmRlci1yYWRpdXM6IDExcHg7IHBhZGRpbmc6IDEwcHggMTNweDsKICBmb250LXNpemU6IDEycHg7Cn0KLnN1c3AtaW5mbyBzcGFuIHsgY29sb3I6IHZhcigtLXN1YXZlKTsgfQouc3VzcC1pbmZvIHN0cm9uZyB7IGZvbnQtd2VpZ2h0OiA2MDA7IHRleHQtYWxpZ246IHJpZ2h0OyB9CgovKiDilIDilIDilIDilIDilIAgYXBwIOKUgOKUgOKUgOKUgOKUgCAqLwouYXBwIHsgZGlzcGxheTogZmxleDsgbWluLWhlaWdodDogMTAwdmg7IG1pbi1oZWlnaHQ6IDEwMGR2aDsgfQoKLnNpZGViYXIgewogIHdpZHRoOiAyNTRweDsgZmxleC1zaHJpbms6IDA7IGJhY2tncm91bmQ6ICMwODBhMGU7IGJvcmRlci1yaWdodDogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsKICBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBwYWRkaW5nOiAyMHB4IDE0cHg7IHBvc2l0aW9uOiBzdGlja3k7IHRvcDogMDsgaGVpZ2h0OiAxMDB2aDsKICBoZWlnaHQ6IDEwMGR2aDsgei1pbmRleDogOTA7Cn0KLm1hcmNhIHsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiAxMXB4OyBwYWRkaW5nOiAwIDZweCAyMHB4OyB9Ci5tYXJjYS1pY29uZSB7CiAgd2lkdGg6IDQycHg7IGhlaWdodDogNDJweDsgYm9yZGVyLXJhZGl1czogMTJweDsgZmxleC1zaHJpbms6IDA7IG92ZXJmbG93OiBoaWRkZW47CiAgZGlzcGxheTogZ3JpZDsgcGxhY2UtaXRlbXM6IGNlbnRlcjsgZm9udC1zaXplOiAyMHB4OyBmb250LXdlaWdodDogODAwOyBjb2xvcjogdmFyKC0tYWMtdHh0KTsKICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTU1ZGVnLCB2YXIoLS1hYyksIHZhcigtLWFjMikpOwogIGJveC1zaGFkb3c6IDAgOHB4IDIycHggcmdiYSgwLCAwLCAwLCAuNCk7Cn0KLm1hcmNhIHN0cm9uZyB7IGRpc3BsYXk6IGJsb2NrOyBmb250LXNpemU6IDE1cHg7IGxldHRlci1zcGFjaW5nOiAuNHB4OyB9Ci5tYXJjYSBzbWFsbCB7IGNvbG9yOiB2YXIoLS1zdWF2ZSk7IGZvbnQtc2l6ZTogMTAuNXB4OyBkaXNwbGF5OiBibG9jazsgbWF4LXdpZHRoOiAxNjVweDsKICBvdmVyZmxvdzogaGlkZGVuOyB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpczsgd2hpdGUtc3BhY2U6IG5vd3JhcDsgfQoKI25hdiB7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IGdhcDogM3B4OyBmbGV4OiAxOyBvdmVyZmxvdy15OiBhdXRvOyBwYWRkaW5nLXJpZ2h0OiAycHg7IH0KI25hdjo6LXdlYmtpdC1zY3JvbGxiYXIgeyB3aWR0aDogNnB4OyB9CiNuYXY6Oi13ZWJraXQtc2Nyb2xsYmFyLXRodW1iIHsgYmFja2dyb3VuZDogIzIzMjYyZjsgYm9yZGVyLXJhZGl1czogOTlweDsgfQoubmF2LWl0ZW0gewogIGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTFweDsgd2lkdGg6IDEwMCU7IHRleHQtYWxpZ246IGxlZnQ7CiAgYmFja2dyb3VuZDogbm9uZTsgYm9yZGVyOiBub25lOyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LWZhbWlseTogaW5oZXJpdDsKICBmb250LXNpemU6IDEzLjVweDsgZm9udC13ZWlnaHQ6IDUwMDsgcGFkZGluZzogMTJweCAxMnB4OyBib3JkZXItcmFkaXVzOiAxMXB4OyBjdXJzb3I6IHBvaW50ZXI7CiAgdHJhbnNpdGlvbjogLjE1czsgZmxleC1zaHJpbms6IDA7Cn0KLm5hdi1pdGVtIHNwYW4geyB3aWR0aDogMThweDsgdGV4dC1hbGlnbjogY2VudGVyOyBmb250LXNpemU6IDE0cHg7IH0KLm5hdi1pdGVtOmhvdmVyIHsgYmFja2dyb3VuZDogIzExMTQxYTsgY29sb3I6IHZhcigtLXRleHRvKTsgfQoubmF2LWl0ZW0uYXRpdm8gewogIGJhY2tncm91bmQ6IHZhcigtLWFjLXNvZnQpOyBjb2xvcjogI2ZmZjsgZm9udC13ZWlnaHQ6IDY1MDsKICBib3gtc2hhZG93OiBpbnNldCAzcHggMCAwIHZhcigtLWFjKTsKfQoKLnNpZGViYXItcGUgeyBib3JkZXItdG9wOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBwYWRkaW5nLXRvcDogMTRweDsgbWFyZ2luLXRvcDogMTBweDsgfQouZXUgeyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDEwcHg7IG1hcmdpbi1ib3R0b206IDEycHg7IH0KLmF2YXRhciB7CiAgd2lkdGg6IDM4cHg7IGhlaWdodDogMzhweDsgYm9yZGVyLXJhZGl1czogNTAlOyBmbGV4LXNocmluazogMDsgb3ZlcmZsb3c6IGhpZGRlbjsKICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTU1ZGVnLCAjMmEyZDM4LCAjMTQxNjFjKTsgZGlzcGxheTogZ3JpZDsgcGxhY2UtaXRlbXM6IGNlbnRlcjsKICBmb250LXdlaWdodDogNzAwOyBmb250LXNpemU6IDEzcHg7IGNvbG9yOiB2YXIoLS1hYyk7IGJhY2tncm91bmQtc2l6ZTogY292ZXI7IGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjsKICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7Cn0KLmV1LWluZm8geyBtaW4td2lkdGg6IDA7IH0KLmV1LWluZm8gc3Ryb25nIHsgZGlzcGxheTogYmxvY2s7IGZvbnQtc2l6ZTogMTNweDsgb3ZlcmZsb3c6IGhpZGRlbjsgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7IHdoaXRlLXNwYWNlOiBub3dyYXA7IH0KLmV1LWluZm8gc21hbGwgeyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDExcHg7IH0KLmJ0bi1zYWlyIHsKICB3aWR0aDogMTAwJTsgYmFja2dyb3VuZDogIzI0MTQxNjsgYm9yZGVyOiAxcHggc29saWQgIzQ2MjMyYTsgY29sb3I6ICNmZjlkOTU7CiAgYm9yZGVyLXJhZGl1czogMTFweDsgcGFkZGluZzogMTBweDsgZm9udC1mYW1pbHk6IGluaGVyaXQ7IGZvbnQtc2l6ZTogMTIuNXB4OwogIGZvbnQtd2VpZ2h0OiA2MDA7IGN1cnNvcjogcG9pbnRlcjsKfQouYnRuLXNhaXI6aG92ZXIgeyBiYWNrZ3JvdW5kOiAjMzAxYTFkOyB9CgouY29udGV1ZG8geyBmbGV4OiAxOyBwYWRkaW5nOiAyMnB4IDI2cHggNzBweDsgbWluLXdpZHRoOiAwOyB9Ci50b3BiYXIgeyBkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47IGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0OyBtYXJnaW4tYm90dG9tOiAyMnB4OyBnYXA6IDE2cHg7IH0KLnRvcGJhci1lc3EgeyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDEycHg7IG1pbi13aWR0aDogMDsgfQoudG9wYmFyIGgyIHsgZm9udC1zaXplOiAyMXB4OyBmb250LXdlaWdodDogNzUwOyB9Ci50b3BiYXItc3ViIHsgY29sb3I6IHZhcigtLXN1YXZlKTsgZm9udC1zaXplOiAxMi41cHg7IG1hcmdpbi10b3A6IDNweDsgfQoudG9wYmFyLWRpciB7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTBweDsgfQoudG9wYmFyLWxvZ28gewogIGRpc3BsYXk6IG5vbmU7IHdpZHRoOiAzOHB4OyBoZWlnaHQ6IDM4cHg7IGJvcmRlci1yYWRpdXM6IDExcHg7IG92ZXJmbG93OiBoaWRkZW47CiAgcGxhY2UtaXRlbXM6IGNlbnRlcjsgZm9udC13ZWlnaHQ6IDgwMDsgZm9udC1zaXplOiAxN3B4OyBjb2xvcjogdmFyKC0tYWMtdHh0KTsKICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTU1ZGVnLCB2YXIoLS1hYyksIHZhcigtLWFjMikpOwp9CgovKiBib3TDo28gZG8gbWVudSBubyBjZWx1bGFyICovCi5idG4tbWVudSB7CiAgZGlzcGxheTogbm9uZTsgd2lkdGg6IDQ0cHg7IGhlaWdodDogNDRweDsgZmxleC1zaHJpbms6IDA7CiAgYmFja2dyb3VuZDogIzExMTQxYTsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBib3JkZXItcmFkaXVzOiAxMnB4OwogIGN1cnNvcjogcG9pbnRlcjsgcGFkZGluZzogMDsgcGxhY2UtaXRlbXM6IGNlbnRlcjsgZ2FwOiA0cHg7IGFsaWduLWNvbnRlbnQ6IGNlbnRlcjsKICBncmlkLWF1dG8tcm93czogbWluLWNvbnRlbnQ7Cn0KLmJ0bi1tZW51IHNwYW4geyBkaXNwbGF5OiBibG9jazsgd2lkdGg6IDE4cHg7IGhlaWdodDogMnB4OyBib3JkZXItcmFkaXVzOiAycHg7IGJhY2tncm91bmQ6IHZhcigtLXRleHRvKTsgfQouYnRuLW1lbnU6YWN0aXZlIHsgYm9yZGVyLWNvbG9yOiB2YXIoLS1hYy1saW5lKTsgfQouc2lkZWJhci1mdW5kbyB7CiAgcG9zaXRpb246IGZpeGVkOyBpbnNldDogMDsgYmFja2dyb3VuZDogcmdiYSg0LCA1LCA4LCAuNjgpOyBiYWNrZHJvcC1maWx0ZXI6IGJsdXIoMnB4KTsgei1pbmRleDogODU7Cn0KCi5zaW5vIHsKICBwb3NpdGlvbjogcmVsYXRpdmU7IGJhY2tncm91bmQ6ICMxMTE0MWE7IGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsgY29sb3I6IHZhcigtLXRleHRvKTsKICB3aWR0aDogNDJweDsgaGVpZ2h0OiA0MnB4OyBib3JkZXItcmFkaXVzOiAxMnB4OyBjdXJzb3I6IHBvaW50ZXI7IGZvbnQtc2l6ZTogMTVweDsKfQouc2lubyBiIHsKICBwb3NpdGlvbjogYWJzb2x1dGU7IHRvcDogLTVweDsgcmlnaHQ6IC01cHg7IGJhY2tncm91bmQ6IHZhcigtLXZlcm1lbGhvKTsgY29sb3I6ICNmZmY7CiAgZm9udC1zaXplOiAxMHB4OyBtaW4td2lkdGg6IDE4cHg7IGhlaWdodDogMThweDsgYm9yZGVyLXJhZGl1czogOXB4OyBkaXNwbGF5OiBncmlkOwogIHBsYWNlLWl0ZW1zOiBjZW50ZXI7IHBhZGRpbmc6IDAgNXB4Owp9CgovKiDilIDilIDilIDilIDilIAgcGFpbsOpaXMg4pSA4pSA4pSA4pSA4pSAICovCi5jYXJkcyB7IGRpc3BsYXk6IGdyaWQ7IGdyaWQtdGVtcGxhdGUtY29sdW1uczogcmVwZWF0KGF1dG8tZml0LCBtaW5tYXgoMTYwcHgsIDFmcikpOyBnYXA6IDE0cHg7IG1hcmdpbi1ib3R0b206IDE4cHg7IH0KLmNhcmQgewogIGJhY2tncm91bmQ6IHZhcigtLWNhcmQpOyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7IGJvcmRlci1yYWRpdXM6IDE1cHg7IHBhZGRpbmc6IDE2cHggMThweDsKfQouY2FyZCBzbWFsbCB7IGNvbG9yOiB2YXIoLS1zdWF2ZSk7IGZvbnQtc2l6ZTogMTEuNXB4OyBmb250LXdlaWdodDogNjAwOyBsZXR0ZXItc3BhY2luZzogLjNweDsgfQouY2FyZCBzdHJvbmcgeyBkaXNwbGF5OiBibG9jazsgZm9udC1zaXplOiAyOHB4OyBmb250LXdlaWdodDogODAwOyBtYXJnaW4tdG9wOiA2cHg7IH0KLmNhcmQuZGVzdGFxdWUgewogIGJvcmRlci1jb2xvcjogdmFyKC0tYWMtbGluZSk7CiAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDE1NWRlZywgdmFyKC0tYWMtc29mdCksIHZhcigtLWNhcmQpKTsKfQoKLnBhaW5lbCB7IGJhY2tncm91bmQ6IHZhcigtLWNhcmQpOyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7IGJvcmRlci1yYWRpdXM6IDE1cHg7IHBhZGRpbmc6IDE4cHg7IG1hcmdpbi1ib3R0b206IDE2cHg7IH0KLnBhaW5lbC10b3BvIHsgZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuOyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDEycHg7IG1hcmdpbi1ib3R0b206IDE0cHg7IGZsZXgtd3JhcDogd3JhcDsgfQoucGFpbmVsLXRvcG8gaDMgeyBmb250LXNpemU6IDE1cHg7IGZvbnQtd2VpZ2h0OiA3MDA7IH0KLnRvcG8tYWNvZXMgeyBkaXNwbGF5OiBmbGV4OyBnYXA6IDlweDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZmxleC13cmFwOiB3cmFwOyB9Ci50b3BvLWFjb2VzIGlucHV0W3R5cGU9c2VhcmNoXSB7IG1hcmdpbjogMDsgd2lkdGg6IDIwMHB4OyBwYWRkaW5nOiA5cHggMTJweDsgZm9udC1zaXplOiAxM3B4OyB9Ci5kdWFzLWNvbHVuYXMgeyBkaXNwbGF5OiBncmlkOyBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmciAxZnI7IGdhcDogMTZweDsgfQpAbWVkaWEgKG1heC13aWR0aDogOTgwcHgpIHsgLmR1YXMtY29sdW5hcyB7IGdyaWQtdGVtcGxhdGUtY29sdW1uczogMWZyOyB9IH0KCi8qIOKUgOKUgOKUgOKUgOKUgCB0YWJlbGFzIOKUgOKUgOKUgOKUgOKUgCAqLwoudGFiZWxhLXJvbGFnZW0geyBvdmVyZmxvdy14OiBhdXRvOyAtd2Via2l0LW92ZXJmbG93LXNjcm9sbGluZzogdG91Y2g7IH0KdGFibGUgeyB3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxM3B4OyB9CnRoIHsKICB0ZXh0LWFsaWduOiBsZWZ0OyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDExcHg7IGZvbnQtd2VpZ2h0OiA2MDA7CiAgbGV0dGVyLXNwYWNpbmc6IC42cHg7IHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7IHBhZGRpbmc6IDlweCAxMHB4OyBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tbGluaGEpOwogIHdoaXRlLXNwYWNlOiBub3dyYXA7Cn0KdGQgeyBwYWRkaW5nOiAxMXB4IDEwcHg7IGJvcmRlci1ib3R0b206IDFweCBzb2xpZCAjMWExZDI0OyB2ZXJ0aWNhbC1hbGlnbjogbWlkZGxlOyB9CnRyOmxhc3QtY2hpbGQgdGQgeyBib3JkZXItYm90dG9tOiBub25lOyB9Ci5ub21lLWNlbCB7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTBweDsgfQoubm9tZS1jZWwgLmF2YXRhciB7IHdpZHRoOiAzMHB4OyBoZWlnaHQ6IDMwcHg7IGZvbnQtc2l6ZTogMTFweDsgfQoubG9naW4tc3VhdmUgeyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDExLjVweDsgfQoKLmJhZGdlIHsKICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IGZvbnQtc2l6ZTogMTAuNXB4OyBmb250LXdlaWdodDogNzAwOyBsZXR0ZXItc3BhY2luZzogLjRweDsKICBwYWRkaW5nOiA0cHggOXB4OyBib3JkZXItcmFkaXVzOiA5OTlweDsgYmFja2dyb3VuZDogIzFiMWUyNjsgY29sb3I6ICNhOWIyYzE7CiAgd2hpdGUtc3BhY2U6IG5vd3JhcDsKfQouYmFkZ2UuYXp1bCB7IGJhY2tncm91bmQ6IHZhcigtLWFjLXNvZnQpOyBjb2xvcjogdmFyKC0tYWMpOyB9Ci5iYWRnZS52ZXJkZSB7IGJhY2tncm91bmQ6ICMwZTM1Mjc7IGNvbG9yOiAjNmVlN2EzOyB9Ci5iYWRnZS52ZXJtZWxobyB7IGJhY2tncm91bmQ6ICMzYTE3MWI7IGNvbG9yOiAjZmY5ZDk1OyB9Ci5iYWRnZS5hbWFyZWxvIHsgYmFja2dyb3VuZDogIzNhMmYxMjsgY29sb3I6ICNmM2NkNzc7IH0KCi5hY29lcy1saW5oYSB7IGRpc3BsYXk6IGZsZXg7IGdhcDogNnB4OyBmbGV4LXdyYXA6IHdyYXA7IH0KLm1pbmkgewogIGJhY2tncm91bmQ6ICMxNzFhMjI7IGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsgY29sb3I6IHZhcigtLXRleHRvKTsKICBib3JkZXItcmFkaXVzOiA5cHg7IHBhZGRpbmc6IDZweCAxMHB4OyBmb250LXNpemU6IDExLjVweDsgZm9udC1mYW1pbHk6IGluaGVyaXQ7CiAgY3Vyc29yOiBwb2ludGVyOyBmb250LXdlaWdodDogNjAwOwp9Ci5taW5pOmhvdmVyIHsgYm9yZGVyLWNvbG9yOiB2YXIoLS1hYy1saW5lKTsgfQoubWluaS5wZXJpZ28geyBjb2xvcjogI2ZmOWQ5NTsgYm9yZGVyLWNvbG9yOiAjNDYyMzJhOyBiYWNrZ3JvdW5kOiAjMjQxNDE2OyB9Ci5taW5pLnBlcmlnbzpob3ZlciB7IGJhY2tncm91bmQ6ICMzMDFhMWQ7IH0KLm1pbmkuZXN0dWRhZG8geyBjb2xvcjogIzZlZTdhMzsgYm9yZGVyLWNvbG9yOiAjMWY1MTM4OyBiYWNrZ3JvdW5kOiAjMGUzNTI3OyB9CgoudmF6aW8geyB0ZXh0LWFsaWduOiBjZW50ZXI7IGNvbG9yOiAjNWU2Njc1OyBmb250LXNpemU6IDEzcHg7IHBhZGRpbmc6IDI2cHggMDsgfQoudGV4dG8tYWp1ZGEgeyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDEyLjVweDsgbGluZS1oZWlnaHQ6IDEuNjsgbWFyZ2luLWJvdHRvbTogMTRweDsgfQoKLyog4pSA4pSA4pSA4pSA4pSAIGZvcm11bMOhcmlvcyDilIDilIDilIDilIDilIAgKi8KLmZvcm0tbGluaGEgeyBkaXNwbGF5OiBncmlkOyBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmciAxMzBweCAxLjRmciBhdXRvOyBnYXA6IDEycHg7IGFsaWduLWl0ZW1zOiBlbmQ7IH0KLmZvcm0tbGluaGEgbGFiZWwgeyBtYXJnaW46IDA7IH0KLmZvcm0tY29sdW5hIHsgZGlzcGxheTogZ3JpZDsgZ2FwOiA0cHg7IH0KLmZvcm0tZHVwbGEgeyBkaXNwbGF5OiBncmlkOyBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmciAxLjZmcjsgZ2FwOiAxMnB4OyB9Ci5saW5oYS1ib3RvZXMgeyBkaXNwbGF5OiBmbGV4OyBnYXA6IDlweDsgZmxleC13cmFwOiB3cmFwOyBtYXJnaW4tdG9wOiA2cHg7IH0KLmZvdG8tcHJldmlldyB7IG1hcmdpbjogNnB4IDAgMTBweDsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiAxMHB4OyB9Ci5mb3RvLXByZXZpZXcgaW1nIHsgd2lkdGg6IDc0cHg7IGhlaWdodDogNzRweDsgYm9yZGVyLXJhZGl1czogNTAlOyBvYmplY3QtZml0OiBjb3ZlcjsgYm9yZGVyOiAycHggc29saWQgdmFyKC0tbGluaGEpOyB9Ci5mb3RvLXByZXZpZXcgc3BhbiB7IGNvbG9yOiAjNWU2Njc1OyBmb250LXNpemU6IDEycHg7IH0KQG1lZGlhIChtYXgtd2lkdGg6IDc2MHB4KSB7IC5mb3JtLWxpbmhhLCAuZm9ybS1kdXBsYSB7IGdyaWQtdGVtcGxhdGUtY29sdW1uczogMWZyOyB9IH0KCi8qIOKUgOKUgOKUgOKUgOKUgCBpZGVudGlkYWRlIChub21lLCBmb3RvIGUgY29yKSDilIDilIDilIDilIDilIAgKi8KLmlkZW50aWRhZGUgeyBkaXNwbGF5OiBncmlkOyBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDI2MHB4IDFmcjsgZ2FwOiAxOHB4OyBhbGlnbi1pdGVtczogc3RhcnQ7IH0KQG1lZGlhIChtYXgtd2lkdGg6IDkwMHB4KSB7IC5pZGVudGlkYWRlIHsgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiAxZnI7IH0gfQouaWRlbnQtcHJldmlldyB7CiAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDE1NWRlZywgdmFyKC0tYWMtc29mdCksICMwYzBlMTMpOwogIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWFjLWxpbmUpOyBib3JkZXItcmFkaXVzOiAxNnB4OyBwYWRkaW5nOiAxOHB4OwogIGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogMTJweDsKfQouaWRlbnQtcHJldmlldyAubWFyY2EtaWNvbmUgeyB3aWR0aDogNTRweDsgaGVpZ2h0OiA1NHB4OyBib3JkZXItcmFkaXVzOiAxNXB4OyBmb250LXNpemU6IDI0cHg7IH0KLmlkZW50LXByZXZpZXcgc3Ryb25nIHsgZGlzcGxheTogYmxvY2s7IGZvbnQtc2l6ZTogMTZweDsgfQouaWRlbnQtcHJldmlldyBzbWFsbCB7IGNvbG9yOiB2YXIoLS1zdWF2ZSk7IGZvbnQtc2l6ZTogMTEuNXB4OyB9Ci5sb2dvLXByZXZpZXcgeyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDEycHg7IG1hcmdpbjogNHB4IDAgMTJweDsgfQoubG9nby1wcmV2aWV3IGltZyB7CiAgd2lkdGg6IDcycHg7IGhlaWdodDogNzJweDsgYm9yZGVyLXJhZGl1czogMTZweDsgb2JqZWN0LWZpdDogY292ZXI7CiAgYm9yZGVyOiAycHggc29saWQgdmFyKC0tYWMtbGluZSk7IGJhY2tncm91bmQ6ICMwYTBjMTE7Cn0KLmxvZ28tcHJldmlldyBzcGFuIHsgY29sb3I6ICM1ZTY2NzU7IGZvbnQtc2l6ZTogMTJweDsgfQoudGVtYXMgeyBkaXNwbGF5OiBmbGV4OyBnYXA6IDEwcHg7IGZsZXgtd3JhcDogd3JhcDsgbWFyZ2luOiA0cHggMCAxNHB4OyB9Ci50ZW1hLWJvbGEgewogIHdpZHRoOiA0NHB4OyBoZWlnaHQ6IDQ0cHg7IGJvcmRlci1yYWRpdXM6IDE0cHg7IGJvcmRlcjogMnB4IHNvbGlkIHZhcigtLWxpbmhhKTsKICBjdXJzb3I6IHBvaW50ZXI7IHBhZGRpbmc6IDA7IHBvc2l0aW9uOiByZWxhdGl2ZTsgdHJhbnNpdGlvbjogLjE1czsKfQoudGVtYS1ib2xhOmhvdmVyIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC0ycHgpOyB9Ci50ZW1hLWJvbGEuZXNjb2xoaWRvIHsgYm9yZGVyLWNvbG9yOiAjZmZmOyBib3gtc2hhZG93OiAwIDAgMCAzcHggdmFyKC0tYWMtc29mdCk7IH0KLnRlbWEtYm9sYS5lc2NvbGhpZG86OmFmdGVyIHsKICBjb250ZW50OiAn4pyTJzsgcG9zaXRpb246IGFic29sdXRlOyBpbnNldDogMDsgZGlzcGxheTogZ3JpZDsgcGxhY2UtaXRlbXM6IGNlbnRlcjsKICBmb250LXNpemU6IDE3cHg7IGZvbnQtd2VpZ2h0OiA4MDA7IGNvbG9yOiAjZmZmOyB0ZXh0LXNoYWRvdzogMCAxcHggNHB4IHJnYmEoMCwgMCwgMCwgLjYpOwp9CgovKiDilIDilIDilIDilIDilIAgY2hhdCDilIDilIDilIDilIDilIAgKi8KLmNoYXQtcGFpbmVsIHsgZGlzcGxheTogZmxleDsgZmxleC1kaXJlY3Rpb246IGNvbHVtbjsgaGVpZ2h0OiBjYWxjKDEwMHZoIC0gMTkwcHgpOyB9Ci5jaGF0LW1lbnNhZ2VucyB7IGZsZXg6IDE7IG92ZXJmbG93LXk6IGF1dG87IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IGdhcDogMTBweDsgcGFkZGluZy1yaWdodDogNHB4OyB9Ci5tc2cgeyBtYXgtd2lkdGg6IDc4JTsgYmFja2dyb3VuZDogIzE3MWEyMjsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBib3JkZXItcmFkaXVzOiAxM3B4OyBwYWRkaW5nOiA5cHggMTJweDsgfQoubXNnLm1pbmhhIHsgYWxpZ24tc2VsZjogZmxleC1lbmQ7IGJhY2tncm91bmQ6IHZhcigtLWFjLXNvZnQpOyBib3JkZXItY29sb3I6IHZhcigtLWFjLWxpbmUpOyB9Ci5tc2ctdG9wbyB7IGRpc3BsYXk6IGZsZXg7IGdhcDogOHB4OyBhbGlnbi1pdGVtczogYmFzZWxpbmU7IG1hcmdpbi1ib3R0b206IDNweDsgfQoubXNnLXRvcG8gc3Ryb25nIHsgZm9udC1zaXplOiAxMnB4OyB9Ci5tc2ctdG9wbyBzbWFsbCB7IGNvbG9yOiB2YXIoLS1zdWF2ZSk7IGZvbnQtc2l6ZTogMTAuNXB4OyB9Ci5tc2cgcCB7IGZvbnQtc2l6ZTogMTNweDsgbGluZS1oZWlnaHQ6IDEuNDU7IHdvcmQtYnJlYWs6IGJyZWFrLXdvcmQ7IH0KLmNoYXQtZm9ybSB7IGRpc3BsYXk6IGZsZXg7IGdhcDogOXB4OyBtYXJnaW4tdG9wOiAxMnB4OyB9Ci5jaGF0LWZvcm0gaW5wdXQgeyBtYXJnaW46IDA7IH0KCi8qIOKUgOKUgOKUgOKUgOKUgCBmbHV0dWFudGUg4pSA4pSA4pSA4pSA4pSAICovCi5mbHV0dWFudGUgewogIHBvc2l0aW9uOiBmaXhlZDsgYm90dG9tOiAyNHB4OyByaWdodDogMjRweDsgbGVmdDogYXV0bzsgei1pbmRleDogMTAwOwogIGJhY2tncm91bmQ6ICMxNzFhMjI7IGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWFjLWxpbmUpOyBjb2xvcjogI2YyZjRmODsKICBwYWRkaW5nOiAxM3B4IDE4cHg7IGJvcmRlci1yYWRpdXM6IDEycHg7IGZvbnQtc2l6ZTogMTNweDsgZm9udC13ZWlnaHQ6IDUwMDsKICBib3gtc2hhZG93OiAwIDE4cHggNDZweCByZ2JhKDAsIDAsIDAsIC42KTsgYW5pbWF0aW9uOiBzb2JlIC4ycyBlYXNlOwogIG1heC13aWR0aDogY2FsYygxMDB2dyAtIDQ4cHgpOwp9Ci5mbHV0dWFudGUuZXJybyB7IGJhY2tncm91bmQ6ICMzNDE1MTg7IGJvcmRlci1jb2xvcjogIzZiMjYyZDsgY29sb3I6ICNmZmIwYjM7IH0KQGtleWZyYW1lcyBzb2JlIHsgZnJvbSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSg4cHgpOyBvcGFjaXR5OiAwOyB9IH0KCi8qIOKUgOKUgOKUgOKUgOKUgCBtb2RhbCDilIDilIDilIDilIDilIAgKi8KLm92ZXJsYXkgewogIHBvc2l0aW9uOiBmaXhlZDsgaW5zZXQ6IDA7IGJhY2tncm91bmQ6IHJnYmEoMywgNCwgNywgLjgpOyBiYWNrZHJvcC1maWx0ZXI6IGJsdXIoM3B4KTsKICBkaXNwbGF5OiBncmlkOyBwbGFjZS1pdGVtczogY2VudGVyOyBwYWRkaW5nOiAxOHB4OyB6LWluZGV4OiA5NTsKfQoubW9kYWwgewogIGJhY2tncm91bmQ6IHZhcigtLWNhcmQpOyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7IGJvcmRlci1yYWRpdXM6IDE4cHg7CiAgd2lkdGg6IDEwMCU7IG1heC13aWR0aDogNTIwcHg7IG1heC1oZWlnaHQ6IDg4dmg7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47CiAgYm94LXNoYWRvdzogMCAzMHB4IDkwcHggcmdiYSgwLCAwLCAwLCAuNyk7Cn0KLm1vZGFsLXRvcG8gewogIGRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsgYWxpZ24taXRlbXM6IGNlbnRlcjsKICBwYWRkaW5nOiAxNnB4IDIwcHg7IGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7Cn0KLm1vZGFsLXRvcG8gaDMgeyBmb250LXNpemU6IDE1cHg7IH0KLm1vZGFsLXRvcG8gYnV0dG9uIHsgYmFja2dyb3VuZDogbm9uZTsgYm9yZGVyOiBub25lOyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDE2cHg7IGN1cnNvcjogcG9pbnRlcjsgcGFkZGluZzogNnB4OyB9Ci5tb2RhbC1jb3JwbyB7IHBhZGRpbmc6IDIwcHg7IG92ZXJmbG93LXk6IGF1dG87IG92ZXJmbG93LXg6IGF1dG87IH0KLm1vZGFsLWNvcnBvIC5idG4tcHJpbWFyaW8geyBtYXJnaW4tdG9wOiA2cHg7IH0KCi5ub3RpZi1pdGVtIHsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICMxYTFkMjQ7IHBhZGRpbmc6IDExcHggMDsgZm9udC1zaXplOiAxMi41cHg7IH0KLm5vdGlmLWl0ZW06bGFzdC1jaGlsZCB7IGJvcmRlci1ib3R0b206IG5vbmU7IH0KLm5vdGlmLWl0ZW0gc3Ryb25nIHsgZGlzcGxheTogYmxvY2s7IGZvbnQtc2l6ZTogMTNweDsgbWFyZ2luLWJvdHRvbTogMnB4OyB9Ci5ub3RpZi1pdGVtIHNtYWxsIHsgY29sb3I6IHZhcigtLXN1YXZlKTsgZm9udC1zaXplOiAxMXB4OyB9Ci5ub3RpZi1pdGVtIHAgeyBjb2xvcjogI2JjYzRkMjsgbWFyZ2luLXRvcDogM3B4OyBsaW5lLWhlaWdodDogMS40NTsgfQoKLm9jLWNhcmQgeyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7IGJvcmRlci1yYWRpdXM6IDEzcHg7IHBhZGRpbmc6IDE0cHg7IG1hcmdpbi1ib3R0b206IDEwcHg7IGJhY2tncm91bmQ6ICMwZDBmMTQ7IH0KLm9jLXRvcG8geyBkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47IGdhcDogMTBweDsgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7IG1hcmdpbi1ib3R0b206IDhweDsgZmxleC13cmFwOiB3cmFwOyB9Ci5vYy10b3BvIHN0cm9uZyB7IGZvbnQtc2l6ZTogMTMuNXB4OyB9Ci5vYy1tZXRhIHsgY29sb3I6IHZhcigtLXN1YXZlKTsgZm9udC1zaXplOiAxMS41cHg7IG1hcmdpbi10b3A6IDJweDsgfQoub2MtZGVwIHsgZm9udC1zaXplOiAxMi41cHg7IGNvbG9yOiAjYmNjNGQyOyBsaW5lLWhlaWdodDogMS41OyBtYXJnaW4tdG9wOiA2cHg7IHdoaXRlLXNwYWNlOiBwcmUtd3JhcDsgfQoub2MtcmVzcCB7IGZvbnQtc2l6ZTogMTIuNXB4OyBjb2xvcjogdmFyKC0tYWMpOyBtYXJnaW4tdG9wOiA2cHg7IHdoaXRlLXNwYWNlOiBwcmUtd3JhcDsgfQoKLyog4pSA4pSA4pSA4pSA4pSAIHJlZ3JhcyAvIHByb3ZhcyAvIHBvbnRvIC8gaGllcmFycXVpYSDilIDilIDilIDilIDilIAgKi8KLnJlZ3Jhcy10ZXh0byB7IHdoaXRlLXNwYWNlOiBwcmUtd3JhcDsgbGluZS1oZWlnaHQ6IDEuNzsgZm9udC1zaXplOiAxNHB4OyBjb2xvcjogdmFyKC0tdGV4dG8pOyB3b3JkLWJyZWFrOiBicmVhay13b3JkOyB9Ci5wcm92YS10ZXh0byB7IG1hcmdpbi1ib3R0b206IDE0cHg7IH0KLnBvbnRvLWNhcmQgewogIGJhY2tncm91bmQ6IHZhcigtLWNhcmQyKTsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBib3JkZXItcmFkaXVzOiAxNHB4OwogIHBhZGRpbmc6IDE4cHggMjBweDsgZGlzcGxheTogZ3JpZDsgZ2FwOiA2cHg7Cn0KLnBvbnRvLWNhcmQuZW0tc2VydmljbyB7IGJvcmRlci1jb2xvcjogcmdiYSg1MiwgMjExLCAxNTMsIC40NSk7IGJveC1zaGFkb3c6IGluc2V0IDAgMCAwIDFweCByZ2JhKDUyLCAyMTEsIDE1MywgLjE4KTsgfQoucG9udG8tcm90dWxvIHsgZm9udC1zaXplOiAxMXB4OyBsZXR0ZXItc3BhY2luZzogMnB4OyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXdlaWdodDogNzAwOyB9Ci5wb250by1jYXJkLmVtLXNlcnZpY28gLnBvbnRvLXJvdHVsbyB7IGNvbG9yOiB2YXIoLS12ZXJkZSk7IH0KLnBvbnRvLWhvcmEgeyBmb250LXNpemU6IDE1cHg7IH0KCi8qIOKUgOKUgOKUgOKUgOKUgCBlc3R1ZG9zIOKUgOKUgOKUgOKUgOKUgCAqLwouZXN0dWRvLWNhcmQgeyBiYWNrZ3JvdW5kOiAjMGQwZjE0OyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7IGJvcmRlci1yYWRpdXM6IDE0cHg7IHBhZGRpbmc6IDE2cHggMThweDsgbWFyZ2luLWJvdHRvbTogMTJweDsgfQouZXN0dWRvLXRvcG8geyBkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47IGdhcDogMTRweDsgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7IGZsZXgtd3JhcDogd3JhcDsgfQouZXN0dWRvLXRpdHVsbyB7IGZvbnQtc2l6ZTogMTVweDsgZm9udC13ZWlnaHQ6IDcwMDsgY29sb3I6IHZhcigtLXRleHRvKTsgbWFyZ2luOiA4cHggMCA0cHg7IH0KLmVzdHVkby1kZXRhbGhlIHsgbWFyZ2luLXRvcDogMTJweDsgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsgcGFkZGluZy10b3A6IDEwcHg7IH0KLmVzdHVkby1kZXRhbGhlIHN1bW1hcnkgeyBjdXJzb3I6IHBvaW50ZXI7IGNvbG9yOiB2YXIoLS1hYyk7IGZvbnQtc2l6ZTogMTIuNXB4OyBmb250LXdlaWdodDogNjAwOyBsaXN0LXN0eWxlOiBub25lOyBvdXRsaW5lOiBub25lOyB9Ci5lc3R1ZG8tZGV0YWxoZSBzdW1tYXJ5Ojotd2Via2l0LWRldGFpbHMtbWFya2VyIHsgZGlzcGxheTogbm9uZTsgfQouZXN0dWRvLWRldGFsaGUgc3VtbWFyeTo6YmVmb3JlIHsgY29udGVudDogJ+KWuCAnOyB9Ci5lc3R1ZG8tZGV0YWxoZVtvcGVuXSBzdW1tYXJ5OjpiZWZvcmUgeyBjb250ZW50OiAn4pa+ICc7IH0KLmVzdHVkby1kZXRhbGhlIC5yZWdyYXMtdGV4dG8geyBtYXJnaW4tdG9wOiAxMHB4OyB9CgovKiDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgY2VsdWxhciDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgKi8KQG1lZGlhIChtYXgtd2lkdGg6IDkwMHB4KSB7CiAgLmJ0bi1tZW51IHsgZGlzcGxheTogZ3JpZDsgfQogIC50b3BiYXItbG9nbyB7IGRpc3BsYXk6IGdyaWQ7IH0KICAuc2lkZWJhciB7CiAgICBwb3NpdGlvbjogZml4ZWQ7IHRvcDogMDsgbGVmdDogMDsgaGVpZ2h0OiAxMDB2aDsgaGVpZ2h0OiAxMDBkdmg7CiAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTEwMiUpOyB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gLjIycyBlYXNlOwogICAgYm94LXNoYWRvdzogMjRweCAwIDYwcHggcmdiYSgwLCAwLCAwLCAuNik7CiAgfQogIC5zaWRlYmFyLmFiZXJ0YSB7IHRyYW5zZm9ybTogbm9uZTsgfQogIC5jb250ZXVkbyB7IHBhZGRpbmc6IDAgMTRweCA4MHB4OyB9CiAgLnRvcGJhciB7CiAgICBwb3NpdGlvbjogc3RpY2t5OyB0b3A6IDA7IHotaW5kZXg6IDQwOwogICAgcGFkZGluZzogMTJweCAxNHB4OyBtYXJnaW46IDAgLTE0cHggMTZweDsKICAgIGJhY2tncm91bmQ6IHJnYmEoOSwgMTEsIDE1LCAuOTIpOyBiYWNrZHJvcC1maWx0ZXI6IGJsdXIoMTBweCk7CiAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tbGluaGEpOwogICAgYWxpZ24taXRlbXM6IGNlbnRlcjsKICB9CiAgLnRvcGJhciBoMiB7IGZvbnQtc2l6ZTogMThweDsgfQogIC50b3BiYXItc3ViIHsgZm9udC1zaXplOiAxMS41cHg7IH0KICAuY2hhdC1wYWluZWwgeyBoZWlnaHQ6IGNhbGMoMTAwZHZoIC0gMjMwcHgpOyB9CiAgLm5hdi1pdGVtIHsgcGFkZGluZzogMTNweCAxMnB4OyBmb250LXNpemU6IDE0cHg7IH0KICB0YWJsZSB7IGZvbnQtc2l6ZTogMTIuNXB4OyBtaW4td2lkdGg6IDQ4MHB4OyB9CiAgdGgsIHRkIHsgcGFkZGluZzogOXB4IDhweDsgfQogIC5wYWluZWwgeyBwYWRkaW5nOiAxNXB4OyBvdmVyZmxvdy14OiBhdXRvOyB9CiAgLmZsdXR1YW50ZSB7IGJvdHRvbTogMTZweDsgcmlnaHQ6IDEycHg7IGxlZnQ6IDEycHg7IHRleHQtYWxpZ246IGNlbnRlcjsgfQogIC5tb2RhbCB7IG1heC1oZWlnaHQ6IDkydmg7IH0KICAuc2lubyB7IHdpZHRoOiA0MHB4OyBoZWlnaHQ6IDQwcHg7IH0KfQoKQG1lZGlhIChtYXgtd2lkdGg6IDQyMHB4KSB7CiAgLnRvcGJhci1sb2dvIHsgZGlzcGxheTogbm9uZTsgfQogIC5jYXJkcyB7IGdyaWQtdGVtcGxhdGUtY29sdW1uczogMWZyIDFmcjsgZ2FwOiAxMHB4OyB9CiAgLmNhcmQgeyBwYWRkaW5nOiAxM3B4OyB9CiAgLmNhcmQgc3Ryb25nIHsgZm9udC1zaXplOiAyM3B4OyB9Cn0KCi8qIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBmdW5jaW9uw6FyaW8gZG8gbcOqcyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgKi8KLmZ1bmNpb25hcmlvLW1lcyB7CiAgZGlzcGxheTogZmxleDsgZ2FwOiAxNnB4OyBhbGlnbi1pdGVtczogY2VudGVyOwogIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsIHZhcigtLWFjLXNvZnQpLCByZ2JhKDAsIDAsIDAsIDApIDcyJSk7CiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYWMtbGluZSk7IGJvcmRlci1yYWRpdXM6IDE2cHg7IHBhZGRpbmc6IDE4cHg7Cn0KLmZtLW1lZGFsaGEgeyBmb250LXNpemU6IDQwcHg7IGxpbmUtaGVpZ2h0OiAxOyBmaWx0ZXI6IGRyb3Atc2hhZG93KDAgNnB4IDE0cHggcmdiYSgwLCAwLCAwLCAuNSkpOyB9Ci5mbS1pbmZvIHsgbWluLXdpZHRoOiAwOyB9Ci5mbS1yb3R1bG8geyBmb250LXNpemU6IDEwcHg7IGxldHRlci1zcGFjaW5nOiAycHg7IGNvbG9yOiB2YXIoLS1hYyk7IGZvbnQtd2VpZ2h0OiA3MDA7IHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7IH0KLmZtLW5vbWUgeyBmb250LXNpemU6IDIwcHg7IGZvbnQtd2VpZ2h0OiA4MDA7IG1hcmdpbi10b3A6IDVweDsgbGluZS1oZWlnaHQ6IDEuMTU7IH0KLmZtLW1ldGEgeyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDEycHg7IG1hcmdpbi10b3A6IDNweDsgfQouZm0tdGVtcG8geyBtYXJnaW4tdG9wOiA5cHg7IGZvbnQtc2l6ZTogMTdweDsgZm9udC13ZWlnaHQ6IDcwMDsgfQouZm0tdGVtcG8gc3BhbiB7IGRpc3BsYXk6IGJsb2NrOyBmb250LXNpemU6IDExLjVweDsgZm9udC13ZWlnaHQ6IDUwMDsgY29sb3I6IHZhcigtLXN1YXZlKTsgbWFyZ2luLXRvcDogM3B4OyB9Ci5yYW5raW5nLW1lcyB7IG1hcmdpbi10b3A6IDE0cHg7IG92ZXJmbG93LXg6IGF1dG87IH0KCi8qIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBmb3RvIGRhIG9jb3Jyw6puY2lhIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCAqLwoub2MtZm90byB7CiAgZGlzcGxheTogYmxvY2s7IG1hcmdpbi10b3A6IDEwcHg7IG1heC13aWR0aDogMzIwcHg7CiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBib3JkZXItcmFkaXVzOiAxMXB4OyBvdmVyZmxvdzogaGlkZGVuOyBiYWNrZ3JvdW5kOiAjMGEwYzExOwp9Ci5vYy1mb3RvIGltZyB7IGRpc3BsYXk6IGJsb2NrOyB3aWR0aDogMTAwJTsgaGVpZ2h0OiBhdXRvOyB9Ci5vYy1mb3RvOmhvdmVyIHsgYm9yZGVyLWNvbG9yOiB2YXIoLS1hYy1saW5lKTsgfQoub2MtZm90by1wcmV2aWEgeyBtYXJnaW4tdG9wOiA4cHg7IGRpc3BsYXk6IGdyaWQ7IGdhcDogOHB4OyBqdXN0aWZ5LWl0ZW1zOiBzdGFydDsgfQoub2MtZm90by1wcmV2aWEgaW1nIHsgbWF4LXdpZHRoOiAxMDAlOyBtYXgtaGVpZ2h0OiAyMjBweDsgYm9yZGVyLXJhZGl1czogMTFweDsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyB9CgovKiDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgcG9udG8gcGF1c2FkbyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgKi8KLnBvbnRvLWNhcmQucGF1c2FkbyB7IGJvcmRlci1jb2xvcjogcmdiYSgyMzIsIDE3OCwgNTgsIC41KTsgYm94LXNoYWRvdzogaW5zZXQgMCAwIDAgMXB4IHJnYmEoMjMyLCAxNzgsIDU4LCAuMTYpOyB9Ci5wb250by1jYXJkLnBhdXNhZG8gLnBvbnRvLXJvdHVsbyB7IGNvbG9yOiB2YXIoLS1hbWFyZWxvKTsgfQouYnRuLXBlcmlnbyB7CiAgYmFja2dyb3VuZDogIzI0MTQxNjsgYm9yZGVyOiAxcHggc29saWQgIzQ2MjMyYTsgY29sb3I6ICNmZjlkOTU7CiAgYm9yZGVyLXJhZGl1czogMTFweDsgcGFkZGluZzogMTBweCAxNnB4OyBmb250LXNpemU6IDEzcHg7IGZvbnQtd2VpZ2h0OiA3MDA7CiAgY3Vyc29yOiBwb2ludGVyOyBmb250LWZhbWlseTogaW5oZXJpdDsKfQouYnRuLXBlcmlnbzpob3ZlciB7IGJhY2tncm91bmQ6ICMzMDFhMWQ7IH0KLmJ0bi1wZXJpZ28uc20geyB3aWR0aDogYXV0bzsgcGFkZGluZzogMTBweCAxOHB4OyB9CgpAbWVkaWEgKG1heC13aWR0aDogNTIwcHgpIHsKICAuZnVuY2lvbmFyaW8tbWVzIHsgZ2FwOiAxMnB4OyBwYWRkaW5nOiAxNHB4OyB9CiAgLmZtLW1lZGFsaGEgeyBmb250LXNpemU6IDMycHg7IH0KICAuZm0tbm9tZSB7IGZvbnQtc2l6ZTogMTdweDsgfQogIC5mbS10ZW1wbyB7IGZvbnQtc2l6ZTogMTVweDsgfQogIC5vYy1mb3RvIHsgbWF4LXdpZHRoOiAxMDAlOyB9Cn0KCi8qIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBsaW1wYXIgZGFkb3MgKGFkbWluKSDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgKi8KLmdyYWRlLWxpbXBlemEgeyBkaXNwbGF5OiBncmlkOyBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IHJlcGVhdChhdXRvLWZpdCwgbWlubWF4KDIzMHB4LCAxZnIpKTsgZ2FwOiAxMnB4OyB9Ci5saW1wZXphLWNhcmQgewogIGJhY2tncm91bmQ6ICMwZDBmMTQ7IGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsgYm9yZGVyLXJhZGl1czogMTRweDsKICBwYWRkaW5nOiAxNXB4OyBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBnYXA6IDhweDsKfQoubGltcGV6YS1jYXJkLnR1ZG8geyBib3JkZXItY29sb3I6ICM0NjIzMmE7IGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxNjBkZWcsICMxYjEwMTMsICMwZDBmMTQgNzAlKTsgfQoubGltcGV6YS10b3BvIHsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiA4cHg7IH0KLmxpbXBlemEtdG9wbyBzdHJvbmcgeyBmb250LXNpemU6IDEzLjVweDsgfQoubGltcGV6YS1pY29uZSB7IGZvbnQtc2l6ZTogMTdweDsgbGluZS1oZWlnaHQ6IDE7IH0KLmxpbXBlemEtZGVzYyB7IGZvbnQtc2l6ZTogMTJweDsgY29sb3I6IHZhcigtLXN1YXZlKTsgbGluZS1oZWlnaHQ6IDEuNTU7IGZsZXg6IDE7IH0KLmxpbXBlemEtZGVzYyBzdHJvbmcgeyBjb2xvcjogI2JjYzRkMjsgfQoubGltcGV6YS1jb250YSB7IGZvbnQtc2l6ZTogMTFweDsgY29sb3I6IHZhcigtLWFjKTsgZm9udC13ZWlnaHQ6IDcwMDsgbGV0dGVyLXNwYWNpbmc6IC4zcHg7IH0KLmxpbXBlemEtY2FyZCAuYnRuLXBlcmlnby5zbSB7IGFsaWduLXNlbGY6IGZsZXgtc3RhcnQ7IH0KCi8qIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBjw7NkaWdvcyBRIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCAqLwouY3EtYmxvY28geyBtYXJnaW4tdG9wOiAxOHB4OyB9Ci5jcS1ncnVwby10aXR1bG8gewogIGZvbnQtc2l6ZTogMTFweDsgbGV0dGVyLXNwYWNpbmc6IDEuNnB4OyB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlOyBjb2xvcjogdmFyKC0tYWMpOwogIGZvbnQtd2VpZ2h0OiA3MDA7IG1hcmdpbi1ib3R0b206IDEwcHg7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGdhcDogOHB4Owp9Ci5jcS1ncnVwby10aXR1bG8gc3BhbiB7CiAgZm9udC1zaXplOiAxMHB4OyBsZXR0ZXItc3BhY2luZzogMDsgY29sb3I6IHZhcigtLXN1YXZlKTsKICBiYWNrZ3JvdW5kOiAjMTcxYTIyOyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7IGJvcmRlci1yYWRpdXM6IDIwcHg7IHBhZGRpbmc6IDFweCA4cHg7Cn0KLmNxLWdyYWRlIHsgZGlzcGxheTogZ3JpZDsgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiByZXBlYXQoYXV0by1maWxsLCBtaW5tYXgoMjYwcHgsIDFmcikpOyBnYXA6IDEwcHg7IH0KLmNxLWNhcmQgewogIGJhY2tncm91bmQ6ICMwZDBmMTQ7IGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsgYm9yZGVyLXJhZGl1czogMTJweDsgcGFkZGluZzogMTJweCAxNHB4OwogIGRpc3BsYXk6IGZsZXg7IGdhcDogMTJweDsgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7Cn0KLmNxLWNvZGlnbyB7CiAgZmxleC1zaHJpbms6IDA7IG1pbi13aWR0aDogNTRweDsgdGV4dC1hbGlnbjogY2VudGVyOwogIGZvbnQtZmFtaWx5OiB1aS1tb25vc3BhY2UsIE1lbmxvLCBtb25vc3BhY2U7IGZvbnQtd2VpZ2h0OiA4MDA7IGZvbnQtc2l6ZTogMTNweDsKICBjb2xvcjogdmFyKC0tYWMpOyBiYWNrZ3JvdW5kOiB2YXIoLS1hYy1zb2Z0KTsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYWMtbGluZSk7CiAgYm9yZGVyLXJhZGl1czogOHB4OyBwYWRkaW5nOiA1cHggN3B4Owp9Ci5jcS1zaWduaWZpY2FkbyB7IGZvbnQtc2l6ZTogMTIuNXB4OyBsaW5lLWhlaWdodDogMS41OyBjb2xvcjogI2M2Y2RkYTsgfQouY3EtY2FyZDpob3ZlciB7IGJvcmRlci1jb2xvcjogdmFyKC0tYWMtbGluZSk7IH0KCkBtZWRpYSAobWF4LXdpZHRoOiA1MjBweCkgewogIC5jcS1ncmFkZSB7IGdyaWQtdGVtcGxhdGUtY29sdW1uczogMWZyOyB9CiAgLmNxLWNhcmQgeyBwYWRkaW5nOiAxMXB4IDEycHg7IH0KfQo=","/app.js":"Ly8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIFNJR1Ag4oCUIGZyb250ZW5kIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkApjb25zdCAkID0gKHNlbCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWwpOwpjb25zdCAkJCA9IChzZWwpID0+IEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWwpKTsKCmNvbnN0IFMgPSB7CiAgdG9rZW46IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdzaWdwX3Rva2VuJykgfHwgbnVsbCwKICBldTogbnVsbCwKICBkYWRvczogbnVsbCwKICB0ZWxhOiAnZGFzaGJvYXJkJywKICBidXNjYTogJycsCiAgc3VzcFRpbWVyOiBudWxsLAogIHBvbnRvQWJlcnRvOiBudWxsLAogIGNxQnVzY2E6ICcnLAogIGNxR3J1cG86ICcnLAp9OwoKY29uc3QgQ0FSR09fQ09SID0gewogICdBZG1pbiBNYXN0ZXInOiAndmVybWVsaG8nLAogICdDaGVmZSBkZSBQb2zDrWNpYSc6ICd2ZXJtZWxobycsCiAgJ0RlbGVnYWRvJzogJ2FtYXJlbG8nLAogICdFc2NyaXbDo28nOiAnYXp1bCcsCiAgJ1TDoXRpY28nOiAnYXp1bCcsCiAgJ0FnZW50ZSc6ICdhenVsJywKICAnR3VhcmRhIE11bmljaXBhbCc6ICcnLAogICdDaXZpbCc6ICcnLAp9OwoKZnVuY3Rpb24gZXNjYXBlSHRtbCh0KSB7CiAgcmV0dXJuIFN0cmluZyh0ID09IG51bGwgPyAnJyA6IHQpLnJlcGxhY2UoL1smPD4iJ10vZywgKGMpID0+ICgKICAgIHsgJyYnOiAnJmFtcDsnLCAnPCc6ICcmbHQ7JywgJz4nOiAnJmd0OycsICciJzogJyZxdW90OycsICInIjogJyYjMzk7JyB9W2NdCiAgKSk7Cn0KZnVuY3Rpb24gZGF0YUJSKGlzbykgewogIGlmICghaXNvKSByZXR1cm4gJ+KAlCc7CiAgY29uc3QgZCA9IG5ldyBEYXRlKGlzbyk7CiAgcmV0dXJuIGQudG9Mb2NhbGVTdHJpbmcoJ3B0LUJSJywgeyBkYXk6ICcyLWRpZ2l0JywgbW9udGg6ICcyLWRpZ2l0JywgeWVhcjogJzItZGlnaXQnLCBob3VyOiAnMi1kaWdpdCcsIG1pbnV0ZTogJzItZGlnaXQnIH0pOwp9CmZ1bmN0aW9uIHRlbXBvUmVsKGlzbykgewogIGNvbnN0IHMgPSBNYXRoLmZsb29yKChEYXRlLm5vdygpIC0gbmV3IERhdGUoaXNvKS5nZXRUaW1lKCkpIC8gMTAwMCk7CiAgaWYgKHMgPCA2MCkgcmV0dXJuICdhZ29yYSc7CiAgaWYgKHMgPCAzNjAwKSByZXR1cm4gTWF0aC5mbG9vcihzIC8gNjApICsgJ21pbic7CiAgaWYgKHMgPCA4NjQwMCkgcmV0dXJuIE1hdGguZmxvb3IocyAvIDM2MDApICsgJ2gnOwogIHJldHVybiBNYXRoLmZsb29yKHMgLyA4NjQwMCkgKyAnZCc7Cn0KCmZ1bmN0aW9uIGZsdXR1YW50ZShtc2csIHRpcG8pIHsKICBjb25zdCBlbCA9ICQoJyNtZW5zYWdlbS1mbHV0dWFudGUnKTsKICBlbC50ZXh0Q29udGVudCA9IG1zZzsKICBlbC5jbGFzc05hbWUgPSAnZmx1dHVhbnRlJyArICh0aXBvID09PSAnZXJybycgPyAnIGVycm8nIDogJycpOwogIGNsZWFyVGltZW91dChlbC5fdCk7CiAgZWwuX3QgPSBzZXRUaW1lb3V0KCgpID0+IGVsLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpLCAzMjAwKTsKfQoKLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIEFQSSDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAKYXN5bmMgZnVuY3Rpb24gYXBpKG1ldG9kbywgY2FtaW5obywgY29ycG8pIHsKICBjb25zdCBvcHRzID0geyBtZXRob2Q6IG1ldG9kbywgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0gfTsKICBpZiAoUy50b2tlbikgb3B0cy5oZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSAnQmVhcmVyICcgKyBTLnRva2VuOwogIGlmIChjb3JwbyAhPT0gdW5kZWZpbmVkKSBvcHRzLmJvZHkgPSBKU09OLnN0cmluZ2lmeShjb3Jwbyk7CiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGknICsgY2FtaW5obywgb3B0cyk7CiAgY29uc3QgdGV4dG8gPSBhd2FpdCByZXMudGV4dCgpOwogIGxldCBkYWRvcyA9IHt9OwogIHRyeSB7IGRhZG9zID0gdGV4dG8gPyBKU09OLnBhcnNlKHRleHRvKSA6IHt9OyB9IGNhdGNoIChfKSB7IHRocm93IG5ldyBFcnJvcignUmVzcG9zdGEgaW52w6FsaWRhIGRvIHNlcnZpZG9yLicpOyB9CiAgaWYgKHJlcy5zdGF0dXMgPT09IDQwMSkgeyBzYWlyTG9jYWwoKTsgdGhyb3cgbmV3IEVycm9yKCdTZXNzw6NvIGV4cGlyYWRhLicpOyB9CiAgaWYgKCFyZXMub2spIHsKICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihkYWRvcy5lcnJvciB8fCAnRXJybyAnICsgcmVzLnN0YXR1cyk7CiAgICBlcnIuZGFkb3MgPSBkYWRvczsKICAgIHRocm93IGVycjsKICB9CiAgcmV0dXJuIGRhZG9zOwp9CgovLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgbG9naW4gLyBzZXNzw6NvIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkApmdW5jdGlvbiBzYWlyTG9jYWwoKSB7CiAgUy50b2tlbiA9IG51bGw7IFMuZXUgPSBudWxsOyBTLmRhZG9zID0gbnVsbDsKICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc2lncF90b2tlbicpOwogICQoJyNhcHAnKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsKICAkKCcjdGVsYS1zdXNwZW5zYW8nKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsKICAkKCcjdGVsYS1sb2dpbicpLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpOwogIGZlY2hhck1lbnUoKTsKfQoKJCgnI2Zvcm0tbG9naW4nKS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBhc3luYyAoZXYpID0+IHsKICBldi5wcmV2ZW50RGVmYXVsdCgpOwogIGNvbnN0IGVycm8gPSAkKCcjbG9naW4tZXJybycpOwogIGVycm8uY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7CiAgdHJ5IHsKICAgIGNvbnN0IHIgPSBhd2FpdCBhcGkoJ1BPU1QnLCAnL2xvZ2luJywgeyBsb2dpbjogJCgnI2luLWxvZ2luJykudmFsdWUsIHNlbmhhOiAkKCcjaW4tc2VuaGEnKS52YWx1ZSB9KTsKICAgIFMudG9rZW4gPSByLnRva2VuOwogICAgUy5ldSA9IHIudXNlcjsKICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdzaWdwX3Rva2VuJywgci50b2tlbik7CiAgICAkKCcjaW4tc2VuaGEnKS52YWx1ZSA9ICcnOwogICAgYXdhaXQgZW50cmFyKCk7CiAgfSBjYXRjaCAoZSkgewogICAgaWYgKGUuZGFkb3MgJiYgZS5kYWRvcy5zdXNwZW5zbykgcmV0dXJuIG1vc3RyYXJTdXNwZW5zYW8oZS5kYWRvcyk7CiAgICBlcnJvLnRleHRDb250ZW50ID0gZS5tZXNzYWdlOwogICAgZXJyby5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTsKICB9Cn0pOwoKJCgnI2J0bi1vbGhvJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7CiAgY29uc3QgaSA9ICQoJyNpbi1zZW5oYScpOwogIGkudHlwZSA9IGkudHlwZSA9PT0gJ3Bhc3N3b3JkJyA/ICd0ZXh0JyA6ICdwYXNzd29yZCc7Cn0pOwoKZnVuY3Rpb24gbW9zdHJhclN1c3BlbnNhbyhkKSB7CiAgJCgnI3RlbGEtbG9naW4nKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsKICAkKCcjdGVsYS1zdXNwZW5zYW8nKS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTsKICAkKCcjc3VzcC1wb3InKS50ZXh0Q29udGVudCA9IGQuYXBsaWNhZG9Qb3IgfHwgJ+KAlCc7CiAgJCgnI3N1c3AtbW90aXZvJykudGV4dENvbnRlbnQgPSBkLm1vdGl2byB8fCAn4oCUJzsKICAkKCcjc3VzcC1leHBpcmEnKS50ZXh0Q29udGVudCA9IGRhdGFCUihkLmV4cGlyYUVtKTsKICBsZXQgcmVzdGFudGUgPSBNYXRoLm1heCgwLCBNYXRoLmZsb29yKGQucmVzdGFudGVNcyAvIDEwMDApKTsKICBjbGVhckludGVydmFsKFMuc3VzcFRpbWVyKTsKICBjb25zdCBkZXNlbmhhID0gKCkgPT4gewogICAgY29uc3QgaCA9IFN0cmluZyhNYXRoLmZsb29yKHJlc3RhbnRlIC8gMzYwMCkpLnBhZFN0YXJ0KDIsICcwJyk7CiAgICBjb25zdCBtID0gU3RyaW5nKE1hdGguZmxvb3IoKHJlc3RhbnRlICUgMzYwMCkgLyA2MCkpLnBhZFN0YXJ0KDIsICcwJyk7CiAgICBjb25zdCBzID0gU3RyaW5nKHJlc3RhbnRlICUgNjApLnBhZFN0YXJ0KDIsICcwJyk7CiAgICAkKCcjc3VzcC10ZW1wbycpLnRleHRDb250ZW50ID0gYCR7aH06JHttfToke3N9YDsKICAgIGlmIChyZXN0YW50ZSA8PSAwKSB7IGNsZWFySW50ZXJ2YWwoUy5zdXNwVGltZXIpOyB2b2x0YXJMb2dpbigpOyByZXR1cm47IH0KICAgIHJlc3RhbnRlLS07CiAgfTsKICBkZXNlbmhhKCk7CiAgUy5zdXNwVGltZXIgPSBzZXRJbnRlcnZhbChkZXNlbmhhLCAxMDAwKTsKfQpmdW5jdGlvbiB2b2x0YXJMb2dpbigpIHsKICBjbGVhckludGVydmFsKFMuc3VzcFRpbWVyKTsKICAkKCcjdGVsYS1zdXNwZW5zYW8nKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsKICAkKCcjdGVsYS1sb2dpbicpLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpOwp9CiQoJyNidG4tdm9sdGFyLWxvZ2luJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB2b2x0YXJMb2dpbik7Cgphc3luYyBmdW5jdGlvbiBlbnRyYXIoKSB7CiAgJCgnI3RlbGEtbG9naW4nKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsKICAkKCcjdGVsYS1zdXNwZW5zYW8nKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsKICAkKCcjYXBwJykuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7CiAgYXdhaXQgY2FycmVnYXIoKTsKICBpclBhcmEoJ2Rhc2hib2FyZCcpOwogIGluaWNpYXJQb2xsaW5nKCk7Cn0KCmFzeW5jIGZ1bmN0aW9uIGNhcnJlZ2FyKCkgewogIGNvbnN0IGQgPSBhd2FpdCBhcGkoJ0dFVCcsICcvc3RhdGUnKTsKICBTLmRhZG9zID0gZDsKICBTLmV1ID0gZC51c2Vycy5maW5kKCh1KSA9PiB1LmlkID09PSAoUy5ldSAmJiBTLmV1LmlkKSkgfHwgUy5ldTsKICBwaW50YXJJZGVudGlkYWRlKCk7CiAgcmVuZGVyVHVkbygpOwp9CgpmdW5jdGlvbiBwaW50YXJJZGVudGlkYWRlKCkgewogIGNvbnN0IGV1ID0gUy5ldTsKICBpZiAoZXUpIHsKICAgICQoJyNldS1ub21lJykudGV4dENvbnRlbnQgPSBldS5ub21lOwogICAgJCgnI2V1LWNhcmdvJykudGV4dENvbnRlbnQgPSBldS5jYXJnbzsKICAgIGNvbnN0IGF2ID0gJCgnI2V1LWF2YXRhcicpOwogICAgYXYudGV4dENvbnRlbnQgPSAoZXUubm9tZSB8fCAnPycpLnRyaW0oKS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKTsKICAgIGlmIChldS5mb3RvKSB7IGF2LnN0eWxlLmJhY2tncm91bmRJbWFnZSA9IGB1cmwoJHtldS5mb3RvfSlgOyBhdi50ZXh0Q29udGVudCA9ICcnOyB9CiAgICBlbHNlIGF2LnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICdub25lJzsKICAgICQoJyNuYXYtYWRtaW4nKS5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCAoUy5kYWRvcyA/IFMuZGFkb3MubWV1Tml2ZWwgOiAwKSA8IDkwKTsKICB9CiAgaWYgKFMuZGFkb3MgJiYgUy5kYWRvcy5jb25maWcpIGFwbGljYXJJZGVudGlkYWRlKFMuZGFkb3MuY29uZmlnKTsKfQoKLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIGlkZW50aWRhZGUgdmlzdWFsIChub21lLCBmb3RvIGUgY29yKSDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAKY29uc3QgVEVNQVMgPSB7CiAgZG91cmFkbzogICB7IG5vbWU6ICdEb3VyYWRvJywgICBhYzogJyNlOGI5NWUnLCBhYzI6ICcjYjQ4NjJjJywgdHh0OiAnIzFiMTQwOCcgfSwKICBlc21lcmFsZGE6IHsgbm9tZTogJ0VzbWVyYWxkYScsIGFjOiAnIzNkZGM5NycsIGFjMjogJyMxNThhNWUnLCB0eHQ6ICcjMDQxNjBlJyB9LAogIHJveG86ICAgICAgeyBub21lOiAnUm94bycsICAgICAgYWM6ICcjYTc4YmZhJywgYWMyOiAnIzZkNDNkOCcsIHR4dDogJyMxMDA3MjUnIH0sCiAgdmVybWVsaG86ICB7IG5vbWU6ICdDYXJtZXNpbScsICBhYzogJyNmMDYxNmInLCBhYzI6ICcjYjAyYTM3JywgdHh0OiAnIzFkMDYwYScgfSwKICBhenVsOiAgICAgIHsgbm9tZTogJ0F6dWwnLCAgICAgIGFjOiAnIzRkOGRmZicsIGFjMjogJyMxZDVlY2InLCB0eHQ6ICcjMDQxMjJiJyB9LAp9Owpjb25zdCBURU1BX1BBRFJBTyA9ICdkb3VyYWRvJzsKCmZ1bmN0aW9uIHJnYmEoaGV4LCBhKSB7CiAgY29uc3QgaCA9IFN0cmluZyhoZXggfHwgJycpLnJlcGxhY2UoJyMnLCAnJyk7CiAgY29uc3QgY2hlaW8gPSBoLmxlbmd0aCA9PT0gMyA/IGguc3BsaXQoJycpLm1hcCgoYykgPT4gYyArIGMpLmpvaW4oJycpIDogaDsKICBjb25zdCBuID0gcGFyc2VJbnQoY2hlaW8sIDE2KSB8fCAwOwogIHJldHVybiBgcmdiYSgkeyhuID4+IDE2KSAmIDI1NX0sICR7KG4gPj4gOCkgJiAyNTV9LCAke24gJiAyNTV9LCAke2F9KWA7Cn0KCmZ1bmN0aW9uIG1hcmNhclRlbWEoY2hhdmUpIHsKICAkJCgnLnRlbWEtYm9sYScpLmZvckVhY2goKGIpID0+IGIuY2xhc3NMaXN0LnRvZ2dsZSgnZXNjb2xoaWRvJywgYi5kYXRhc2V0LnRlbWEgPT09IGNoYXZlKSk7Cn0KCmZ1bmN0aW9uIGFwbGljYXJUZW1hKGNoYXZlKSB7CiAgY29uc3QgdCA9IFRFTUFTW2NoYXZlXSB8fCBURU1BU1tURU1BX1BBRFJBT107CiAgY29uc3QgciA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZTsKICByLnNldFByb3BlcnR5KCctLWFjJywgdC5hYyk7CiAgci5zZXRQcm9wZXJ0eSgnLS1hYzInLCB0LmFjMik7CiAgci5zZXRQcm9wZXJ0eSgnLS1hYy10eHQnLCB0LnR4dCk7CiAgci5zZXRQcm9wZXJ0eSgnLS1hYy1zb2Z0JywgcmdiYSh0LmFjLCAwLjE1KSk7CiAgci5zZXRQcm9wZXJ0eSgnLS1hYy1saW5lJywgcmdiYSh0LmFjLCAwLjQyKSk7CiAgbWFyY2FyVGVtYShURU1BU1tjaGF2ZV0gPyBjaGF2ZSA6IFRFTUFfUEFEUkFPKTsKfQoKZnVuY3Rpb24gcGludGFyTG9nbyhlbCwgbG9nbywgbm9tZSkgewogIGlmICghZWwpIHJldHVybjsKICBpZiAobG9nbykgewogICAgZWwuaW5uZXJIVE1MID0gJyc7CiAgICBjb25zdCBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTsKICAgIGltZy5zcmMgPSBsb2dvOwogICAgaW1nLmFsdCA9IG5vbWUgfHwgJ2ZvdG8nOwogICAgZWwuYXBwZW5kQ2hpbGQoaW1nKTsKICB9IGVsc2UgewogICAgZWwudGV4dENvbnRlbnQgPSAoKG5vbWUgfHwgJycpLnRyaW0oKS5jaGFyQXQoMCkgfHwgJ1MnKS50b1VwcGVyQ2FzZSgpOwogIH0KfQoKZnVuY3Rpb24gZGVmaW5pckZhdmljb24obG9nbywgbm9tZSkgewogIGxldCBsaW5rID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbGlua1tyZWw9Imljb24iXScpOwogIGlmICghbGluaykgeyBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGluaycpOyBsaW5rLnJlbCA9ICdpY29uJzsgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChsaW5rKTsgfQogIGlmIChsb2dvKSB7IGxpbmsuaHJlZiA9IGxvZ287IHJldHVybjsgfQogIGNvbnN0IGxldHJhID0gKChub21lIHx8ICcnKS50cmltKCkuY2hhckF0KDApIHx8ICdTJykudG9VcHBlckNhc2UoKTsKICBjb25zdCBlc2N1cm8gPSAnIzBiMGQxMic7CiAgY29uc3Qgc3ZnID0gYDxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgNjQgNjQiPjxyZWN0IHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgcng9IjE0IiBmaWxsPSIke2VzY3Vyb30iLz48dGV4dCB4PSIzMiIgeT0iNDUiIGZvbnQtZmFtaWx5PSJBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjM2IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI2U4Yjk1ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+JHtsZXRyYX08L3RleHQ+PC9zdmc+YDsKICBsaW5rLmhyZWYgPSAnZGF0YTppbWFnZS9zdmcreG1sO2NoYXJzZXQ9dXRmLTgsJyArIGVuY29kZVVSSUNvbXBvbmVudChzdmcpOwp9CgovLyBhcGxpY2Egbm9tZSwgZm90byBlIGNvciBubyBzaXN0ZW1hIGludGVpcm8gKG1lbnUsIHRvcG8sIGxvZ2luIGUgYWJhIGRvIG5hdmVnYWRvcikKZnVuY3Rpb24gYXBsaWNhcklkZW50aWRhZGUoY2ZnKSB7CiAgY2ZnID0gY2ZnIHx8IHt9OwogIGNvbnN0IG5vbWUgPSBTdHJpbmcoY2ZnLm5vbWVTaXN0ZW1hIHx8ICcnKS50cmltKCkgfHwgJ1NJR1AnOwogIGNvbnN0IGNvcnAgPSBTdHJpbmcoY2ZnLm5vbWVDb3Jwb3JhY2FvIHx8ICcnKS50cmltKCk7CiAgZG9jdW1lbnQudGl0bGUgPSBub21lICsgJyDigJQgU2lzdGVtYSBJbnRlcm5vJzsKICAkKCcjbWFyY2Etbm9tZScpLnRleHRDb250ZW50ID0gbm9tZTsKICAkKCcjbWFyY2Etc3ViJykudGV4dENvbnRlbnQgPSBjb3JwIHx8ICdTaXN0ZW1hIEludGVybm8nOwogICQoJyNsb2dpbi1ub21lJykudGV4dENvbnRlbnQgPSBub21lOwogICQoJyNsb2dpbi1zdWInKS50ZXh0Q29udGVudCA9IGNvcnAgfHwgJ1Npc3RlbWEgSW50ZXJubyc7CiAgWycjbWFyY2EtaWNvbmUnLCAnI2xvZ2luLWJhZGdlJywgJyN0b3BiYXItbG9nbyddLmZvckVhY2goKHNlbCkgPT4gcGludGFyTG9nbygkKHNlbCksIGNmZy5sb2dvVXJsLCBub21lKSk7CiAgZGVmaW5pckZhdmljb24oY2ZnLmxvZ29VcmwsIG5vbWUpOwogIGFwbGljYXJUZW1hKGNmZy50ZW1hKTsKfQoKLy8gZmljYSBzw7MgY29tYmluYWRvIG8gcXVlIG8gQWRtaW4gTWFzdGVyIGVzdMOhIGVkaXRhbmRvIChhbnRlcyBkZSBzYWx2YXIpClMuaWRlbnQgPSBudWxsOwpTLmlkZW50RWRpdGFuZG8gPSBmYWxzZTsKCmZ1bmN0aW9uIGlkZW50Q29tb0NmZygpIHsKICBjb25zdCBpID0gUy5pZGVudCB8fCB7fTsKICByZXR1cm4geyBub21lU2lzdGVtYTogaS5ub21lLCBub21lQ29ycG9yYWNhbzogaS5jb3JwLCBsb2dvVXJsOiBpLmxvZ28sIHRlbWE6IGkudGVtYSB9Owp9CgpmdW5jdGlvbiBpZGVudERvU2Vydmlkb3IoY2ZnKSB7CiAgY2ZnID0gY2ZnIHx8IHt9OwogIHJldHVybiB7CiAgICBub21lOiBjZmcubm9tZVNpc3RlbWEgfHwgJycsCiAgICBjb3JwOiBjZmcubm9tZUNvcnBvcmFjYW8gfHwgJycsCiAgICBsb2dvOiBjZmcubG9nb1VybCB8fCBudWxsLAogICAgdGVtYTogY2ZnLnRlbWEgfHwgVEVNQV9QQURSQU8sCiAgICBsb2dvTm92bzogdW5kZWZpbmVkLAogICAgcmVtb3ZlckxvZ286IGZhbHNlLAogIH07Cn0KCmZ1bmN0aW9uIHByZXZpZXdJZGVudGlkYWRlKCkgewogIGNvbnN0IGkgPSBTLmlkZW50IHx8IHt9OwogIGNvbnN0IG5vbWUgPSBTdHJpbmcoaS5ub21lIHx8ICcnKS50cmltKCkgfHwgJ1NJR1AnOwogIHBpbnRhckxvZ28oJCgnI2lkZW50LWljb25lJyksIGkubG9nbywgbm9tZSk7CiAgJCgnI2lkZW50LW5vbWUnKS50ZXh0Q29udGVudCA9IG5vbWU7CiAgJCgnI2lkZW50LWNvcnAnKS50ZXh0Q29udGVudCA9IFN0cmluZyhpLmNvcnAgfHwgJycpLnRyaW0oKSB8fCAnU2lzdGVtYSBJbnRlcm5vJzsKICBjb25zdCBpbWcgPSAkKCcjY2ZnLWxvZ28taW1nJyk7CiAgaWYgKGltZykgewogICAgaWYgKGkubG9nbykgeyBpbWcuc3JjID0gaS5sb2dvOyBpbWcuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7ICQoJyNjZmctc2VtLWxvZ28nKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsgfQogICAgZWxzZSB7IGltZy5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsgJCgnI2NmZy1zZW0tbG9nbycpLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpOyB9CiAgfQogIG1hcmNhclRlbWEoaS50ZW1hIHx8IFRFTUFfUEFEUkFPKTsKICBhcGxpY2FySWRlbnRpZGFkZShpZGVudENvbW9DZmcoKSk7Cn0KCmZ1bmN0aW9uIG1vbnRhclRlbWFzKCkgewogIGNvbnN0IGJveCA9ICQoJyN0ZW1hcycpOwogIGlmICghYm94IHx8IGJveC5kYXRhc2V0LnByb250bykgcmV0dXJuOwogIGJveC5kYXRhc2V0LnByb250byA9ICcxJzsKICBib3guaW5uZXJIVE1MID0gT2JqZWN0LmtleXMoVEVNQVMpLm1hcCgoaykgPT4gewogICAgY29uc3QgdCA9IFRFTUFTW2tdOwogICAgcmV0dXJuIGA8YnV0dG9uIHR5cGU9ImJ1dHRvbiIgY2xhc3M9InRlbWEtYm9sYSIgZGF0YS10ZW1hPSIke2t9IiB0aXRsZT0iJHt0Lm5vbWV9IiBhcmlhLWxhYmVsPSIke3Qubm9tZX0iIHN0eWxlPSJiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNTVkZWcsJHt0LmFjfSwke3QuYWMyfSkiPjwvYnV0dG9uPmA7CiAgfSkuam9pbignJyk7CiAgYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2KSA9PiB7CiAgICBjb25zdCBiID0gZXYudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLXRlbWFdJyk7CiAgICBpZiAoIWIpIHJldHVybjsKICAgIFMuaWRlbnQgPSBTLmlkZW50IHx8IHt9OwogICAgUy5pZGVudC50ZW1hID0gYi5kYXRhc2V0LnRlbWE7CiAgICBTLmlkZW50RWRpdGFuZG8gPSB0cnVlOwogICAgYXBsaWNhclRlbWEoYi5kYXRhc2V0LnRlbWEpOwogICAgbWFyY2FyVGVtYShiLmRhdGFzZXQudGVtYSk7CiAgfSk7Cn0KCi8vIHJlZHV6IGUgcmVjb3J0YSBhIGltYWdlbSBlc2NvbGhpZGEgKGRlaXhhIGxldmUgcGFyYSBjYWJlciBubyBzZXJ2aWRvcikKZnVuY3Rpb24gbGVySW1hZ2VtKGZpbGUsIGxhZG8sIGNiKSB7CiAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTsKICByZWFkZXIub25lcnJvciA9ICgpID0+IGNiKG51bGwpOwogIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7CiAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKTsKICAgIGltZy5vbmVycm9yID0gKCkgPT4gY2IobnVsbCk7CiAgICBpbWcub25sb2FkID0gKCkgPT4gewogICAgICBjb25zdCBtZW5vciA9IE1hdGgubWluKGltZy53aWR0aCwgaW1nLmhlaWdodCkgfHwgMTsKICAgICAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7CiAgICAgIGNhbnZhcy53aWR0aCA9IGxhZG87CiAgICAgIGNhbnZhcy5oZWlnaHQgPSBsYWRvOwogICAgICBjb25zdCBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTsKICAgICAgY3R4LmRyYXdJbWFnZShpbWcsIChpbWcud2lkdGggLSBtZW5vcikgLyAyLCAoaW1nLmhlaWdodCAtIG1lbm9yKSAvIDIsIG1lbm9yLCBtZW5vciwgMCwgMCwgbGFkbywgbGFkbyk7CiAgICAgIGNiKGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3BuZycpKTsKICAgIH07CiAgICBpbWcuc3JjID0gcmVhZGVyLnJlc3VsdDsKICB9OwogIHJlYWRlci5yZWFkQXNEYXRhVVJMKGZpbGUpOwp9CgokKCcjYnRuLXNhaXInKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHsKICB0cnkgeyBhd2FpdCBhcGkoJ1BPU1QnLCAnL2xvZ291dCcpOyB9IGNhdGNoIChfKSB7fQogIHNhaXJMb2NhbCgpOwp9KTsKCi8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBuYXZlZ2HDp8OjbyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAKZnVuY3Rpb24gaXJQYXJhKHRlbGEpIHsKICBTLnRlbGEgPSB0ZWxhOwogICQkKCcubmF2LWl0ZW0nKS5mb3JFYWNoKChiKSA9PiBiLmNsYXNzTGlzdC50b2dnbGUoJ2F0aXZvJywgYi5kYXRhc2V0LnRlbGEgPT09IHRlbGEpKTsKICAkJCgnLnRlbGEnKS5mb3JFYWNoKChzKSA9PiBzLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpKTsKICBjb25zdCBlbCA9ICQoJyN0ZWxhLScgKyB0ZWxhKTsKICBpZiAoZWwpIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpOwogIGNvbnN0IHRpdHVsb3MgPSB7CiAgICBkYXNoYm9hcmQ6IFsnUGFpbmVsJywgJ1Zpc8OjbyBnZXJhbCBkbyBncnVwYW1lbnRvJ10sCiAgICBvY29ycmVuY2lhczogWydPY29ycsOqbmNpYXMnLCAnUmVnaXN0cm8gZSBhY29tcGFuaGFtZW50byddLAogICAgcHJvdmFzOiBbJ1Byb3ZhcycsICdQcm92YXMgZG8gUlAgZSBhdmFsaWHDp8O1ZXMnXSwKICAgIHBvbnRvOiBbJ0JhdGUgUG9udG8nLCAnRW50cmFkYSwgc2HDrWRhIGUgaG9yw6FyaW8gZGUgc2VydmnDp28nXSwKICAgIGhpZXJhcnF1aWE6IFsnSGllcmFycXVpYScsICdDYWRlaWEgZGUgY29tYW5kbyBkbyBncnVwYW1lbnRvJ10sCiAgICByZWdyYXM6IFsnUmVncmFzIGRvIFJQJywgJ05vcm1hcyBkbyByb2xlcGxheSddLAogICAgY29kaWdvc3E6IFsnQ8OzZGlnb3MgUScsICdMaW5ndWFnZW0gZG8gcsOhZGlvJ10sCiAgICBlc3R1ZG9zOiBbJ0VzdHVkb3MnLCAnTWF0ZXJpYWwgZGUgZXN0dWRvIGRvIGVmZXRpdm8nXSwKICAgIGVmZXRpdm86IFsnRWZldGl2bycsICdUb2RvcyBvcyBpbnRlZ3JhbnRlcyBkbyBzaXN0ZW1hJ10sCiAgICBwb250b3M6IFsnUG9udHVhw6fDo28nLCAnTGFuw6dhbWVudG8gZSBoaXN0w7NyaWNvIGRlIHBvbnRvcyddLAogICAgY2hhdDogWydDaGF0JywgJ0NvbXVuaWNhw6fDo28gZG8gZWZldGl2byddLAogICAgYXVkaXRvcmlhOiBbJ0F1ZGl0b3JpYScsICdUdWRvIG8gcXVlIGFjb250ZWNlIG5vIHNpc3RlbWEnXSwKICAgIHBlcmZpbDogWydNZXUgUGVyZmlsJywgJ1NldXMgZGFkb3MgZSBzdWEgc2VuaGEnXSwKICAgIGFkbWluOiBbJ0FkbWluaXN0cmHDp8OjbycsICdCYWNrdXAgZSBjb25maWd1cmHDp8OjbyddLAogIH07CiAgY29uc3QgdCA9IHRpdHVsb3NbdGVsYV0gfHwgWyfigJQnLCAnJ107CiAgJCgnI3RpdHVsby10ZWxhJykudGV4dENvbnRlbnQgPSB0WzBdOwogICQoJyNzdWJ0aXR1bG8tdGVsYScpLnRleHRDb250ZW50ID0gdFsxXTsKICBmZWNoYXJNZW51KCk7CiAgaWYgKHRlbGEgPT09ICdhZG1pbicpIHsKICAgIFMuaWRlbnRFZGl0YW5kbyA9IGZhbHNlOwogICAgcmVuZGVyQWRtaW4oKTsKICB9IGVsc2UgaWYgKFMuaWRlbnRFZGl0YW5kbykgewogICAgLy8gc2FpdSBkYSB0ZWxhIHNlbSBzYWx2YXI6IHZvbHRhIHBhcmEgbyBxdWUgZXN0w6Egc2Fsdm8gbm8gc2Vydmlkb3IKICAgIFMuaWRlbnRFZGl0YW5kbyA9IGZhbHNlOwogICAgaWYgKFMuZGFkb3MgJiYgUy5kYWRvcy5jb25maWcpIGFwbGljYXJJZGVudGlkYWRlKFMuZGFkb3MuY29uZmlnKTsKICB9CiAgaWYgKHRlbGEgPT09ICdjaGF0Jykgcm9sYXJDaGF0KCk7Cn0KJCQoJy5uYXYtaXRlbScpLmZvckVhY2goKGIpID0+IGIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBpclBhcmEoYi5kYXRhc2V0LnRlbGEpKSk7CgovLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgbWVudSBsYXRlcmFsIG5vIGNlbHVsYXIg4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQCmZ1bmN0aW9uIGFicmlyTWVudSgpIHsKICAkKCcjc2lkZWJhcicpLmNsYXNzTGlzdC5hZGQoJ2FiZXJ0YScpOwogICQoJyNzaWRlYmFyLWZ1bmRvJykuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7CiAgJCgnI2J0bi1tZW51Jykuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ3RydWUnKTsKfQpmdW5jdGlvbiBmZWNoYXJNZW51KCkgewogICQoJyNzaWRlYmFyJykuY2xhc3NMaXN0LnJlbW92ZSgnYWJlcnRhJyk7CiAgJCgnI3NpZGViYXItZnVuZG8nKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsKICBjb25zdCBiID0gJCgnI2J0bi1tZW51Jyk7CiAgaWYgKGIpIGIuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7Cn0KJCgnI2J0bi1tZW51JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7CiAgaWYgKCQoJyNzaWRlYmFyJykuY2xhc3NMaXN0LmNvbnRhaW5zKCdhYmVydGEnKSkgZmVjaGFyTWVudSgpOyBlbHNlIGFicmlyTWVudSgpOwp9KTsKJCgnI3NpZGViYXItZnVuZG8nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZlY2hhck1lbnUpOwpkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGV2KSA9PiB7IGlmIChldi5rZXkgPT09ICdFc2NhcGUnKSBmZWNoYXJNZW51KCk7IH0pOwp3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgKCkgPT4geyBpZiAod2luZG93LmlubmVyV2lkdGggPiA5MDApIGZlY2hhck1lbnUoKTsgfSk7CgovLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgbW9kYWlzIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkApmdW5jdGlvbiBhYnJpck1vZGFsKHRpdHVsbywgaHRtbCkgewogICQoJyNtb2RhbC10aXR1bG8nKS50ZXh0Q29udGVudCA9IHRpdHVsbzsKICAkKCcjbW9kYWwtY29ycG8nKS5pbm5lckhUTUwgPSBodG1sOwogICQoJyNvdmVybGF5JykuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7Cn0KZnVuY3Rpb24gZmVjaGFyTW9kYWwoKSB7CiAgJCgnI292ZXJsYXknKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsKICAkKCcjbW9kYWwtY29ycG8nKS5pbm5lckhUTUwgPSAnJzsKfQokKCcjbW9kYWwtZmVjaGFyJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmZWNoYXJNb2RhbCk7CiQoJyNvdmVybGF5JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4geyBpZiAoZS50YXJnZXQuaWQgPT09ICdvdmVybGF5JykgZmVjaGFyTW9kYWwoKTsgfSk7CgovLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgcmVuZGVyIGdlcmFsIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkApmdW5jdGlvbiByZW5kZXJUdWRvKCkgewogIGlmICghUy5kYWRvcykgcmV0dXJuOwogIGNvbnN0IGV1ID0gUy5kYWRvcy51c2Vycy5maW5kKCh1KSA9PiBTLmV1ICYmIHUuaWQgPT09IFMuZXUuaWQpIHx8IFMuZXU7CiAgUy5ldSA9IGV1OwogIHBpbnRhcklkZW50aWRhZGUoKTsKICByZW5kZXJEYXNoYm9hcmQoKTsKICByZW5kZXJPY29ycmVuY2lhcygpOwogIHJlbmRlclByb3ZhcygpOwogIHJlbmRlclBvbnRvKCk7CiAgcmVuZGVySGllcmFycXVpYSgpOwogIHJlbmRlclJlZ3JhcygpOwogIHJlbmRlckNvZGlnb3NRKCk7CiAgcmVuZGVyRXN0dWRvcygpOwogIHJlbmRlckVmZXRpdm8oKTsKICByZW5kZXJQb250b3MoKTsKICByZW5kZXJDaGF0KCk7CiAgcmVuZGVyQXVkaXRvcmlhKCk7CiAgcmVuZGVyUGVyZmlsKCk7CiAgcmVuZGVyQWRtaW4oKTsKICByZW5kZXJOb3RpZkJhZGdlKCk7CiAgaWYgKFMudGVsYSA9PT0gJ2NoYXQnKSByb2xhckNoYXQoKTsKfQoKLy8g4pSA4pSAIHBhaW5lbCDilIDilIAKZnVuY3Rpb24gcmVuZGVyRGFzaGJvYXJkKCkgewogIGNvbnN0IGQgPSBTLmRhZG9zOwogIGNvbnN0IHBlbmQgPSBkLm9jb3JyZW5jaWFzLmZpbHRlcigobykgPT4gby5zdGF0dXMgPT09ICdQZW5kZW50ZScpLmxlbmd0aDsKICBjb25zdCBhY2VpdGFzID0gZC5vY29ycmVuY2lhcy5maWx0ZXIoKG8pID0+IG8uc3RhdHVzID09PSAnQWNlaXRhJykubGVuZ3RoOwogIGNvbnN0IGF0aXZvcyA9IGQudXNlcnMuZmlsdGVyKCh1KSA9PiB1LmF0aXZvKS5sZW5ndGg7CiAgY29uc3Qgc3VzcGVuc29zID0gZC51c2Vycy5maWx0ZXIoKHUpID0+IHUuc3VzcGVuc29BdGUgJiYgbmV3IERhdGUodS5zdXNwZW5zb0F0ZSkgPiBuZXcgRGF0ZSgpKS5sZW5ndGg7CgogICQoJyNjYXJkcy1kYXNoYm9hcmQnKS5pbm5lckhUTUwgPSBgCiAgICA8ZGl2IGNsYXNzPSJjYXJkIGRlc3RhcXVlIj48c21hbGw+RUZFVElWTyBBVElWTzwvc21hbGw+PHN0cm9uZz4ke2F0aXZvc308L3N0cm9uZz48L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImNhcmQiPjxzbWFsbD5PQ09SUsOKTkNJQVMgUEVOREVOVEVTPC9zbWFsbD48c3Ryb25nPiR7cGVuZH08L3N0cm9uZz48L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImNhcmQiPjxzbWFsbD5PQ09SUsOKTkNJQVMgQUNFSVRBUzwvc21hbGw+PHN0cm9uZz4ke2FjZWl0YXN9PC9zdHJvbmc+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJjYXJkIj48c21hbGw+U1VTUEVOU09TPC9zbWFsbD48c3Ryb25nPiR7c3VzcGVuc29zfTwvc3Ryb25nPjwvZGl2PmA7CgogIGNvbnN0IHJlYyA9IGQub2NvcnJlbmNpYXMuc2xpY2UoMCwgNik7CiAgJCgnI2Rhc2gtb2NvcnJlbmNpYXMnKS5pbm5lckhUTUwgPSByZWMubGVuZ3RoCiAgICA/IHJlYy5tYXAoKG8pID0+IGAKICAgICAgPGRpdiBjbGFzcz0ib2MtY2FyZCI+CiAgICAgICAgPGRpdiBjbGFzcz0ib2MtdG9wbyI+CiAgICAgICAgICA8ZGl2PjxzdHJvbmc+JHtlc2NhcGVIdG1sKG8udGl0dWxvKX08L3N0cm9uZz4KICAgICAgICAgIDxkaXYgY2xhc3M9Im9jLW1ldGEiPiR7ZXNjYXBlSHRtbChvLmFnZW50ZSl9IMK3ICR7ZGF0YUJSKG8uY3JpYWRvRW0pfTwvZGl2PjwvZGl2PgogICAgICAgICAgJHtiYWRnZVN0YXR1cyhvLnN0YXR1cyl9CiAgICAgICAgPC9kaXY+CiAgICAgIDwvZGl2PmApLmpvaW4oJycpCiAgICA6ICc8ZGl2IGNsYXNzPSJ2YXppbyI+TmVuaHVtYSBvY29ycsOqbmNpYSByZWdpc3RyYWRhIGFpbmRhLjwvZGl2Pic7CgogIGNvbnN0IHJhbmsgPSBbLi4uZC51c2Vyc10uc29ydCgoYSwgYikgPT4gKGIucG9udG9zIHx8IDApIC0gKGEucG9udG9zIHx8IDApKS5zbGljZSgwLCA4KTsKICAkKCcjZGFzaC1yYW5raW5nJykuaW5uZXJIVE1MID0gcmFuay5sZW5ndGgKICAgID8gYDx0YWJsZT48dGhlYWQ+PHRyPjx0aD4jPC90aD48dGg+UG9saWNpYWw8L3RoPjx0aD5DYXJnbzwvdGg+PHRoIHN0eWxlPSJ0ZXh0LWFsaWduOnJpZ2h0Ij5Qb250b3M8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAgICR7cmFuay5tYXAoKHUsIGkpID0+IGA8dHI+CiAgICAgICAgPHRkPiR7aSArIDF9wro8L3RkPgogICAgICAgIDx0ZD4ke2VzY2FwZUh0bWwodS5ub21lKX08ZGl2IGNsYXNzPSJsb2dpbi1zdWF2ZSI+QCR7ZXNjYXBlSHRtbCh1LmxvZ2luKX08L2Rpdj48L3RkPgogICAgICAgIDx0ZD48c3BhbiBjbGFzcz0iYmFkZ2UgJHtDQVJHT19DT1JbdS5jYXJnb10gfHwgJyd9Ij4ke2VzY2FwZUh0bWwodS5jYXJnbyl9PC9zcGFuPjwvdGQ+CiAgICAgICAgPHRkIHN0eWxlPSJ0ZXh0LWFsaWduOnJpZ2h0Ij48c3Ryb25nPiR7dS5wb250b3MgfHwgMH08L3N0cm9uZz48L3RkPgogICAgICA8L3RyPmApLmpvaW4oJycpfTwvdGJvZHk+PC90YWJsZT5gCiAgICA6ICc8ZGl2IGNsYXNzPSJ2YXppbyI+U2VtIHBvbnR1YcOnw6NvIGxhbsOnYWRhLjwvZGl2Pic7Cn0KCmZ1bmN0aW9uIGJhZGdlU3RhdHVzKHMpIHsKICBjb25zdCBjb3IgPSB7IFBlbmRlbnRlOiAnYW1hcmVsbycsIEFjZWl0YTogJ3ZlcmRlJywgUmVjdXNhZGE6ICd2ZXJtZWxobycsIENhbmNlbGFkYTogJycgfVtzXSB8fCAnJzsKICByZXR1cm4gYDxzcGFuIGNsYXNzPSJiYWRnZSAke2Nvcn0iPiR7ZXNjYXBlSHRtbChzKX08L3NwYW4+YDsKfQoKLy8g4pSA4pSAIG9jb3Jyw6puY2lhcyDilIDilIAKY29uc3QgTklWRUxfT0NPUlJFTkNJQSA9IDcwOyAvLyBFc2NyaXbDo28sIERlbGVnYWRvLCBDaGVmZSBlIEFkbWluIE1hc3RlcgpmdW5jdGlvbiBwb2RlUmVnaXN0cmFyT2NvcnJlbmNpYSgpIHsgcmV0dXJuIChTLmRhZG9zICYmIFMuZGFkb3MubWV1Tml2ZWwgfHwgMCkgPj0gTklWRUxfT0NPUlJFTkNJQTsgfQoKLy8gcmVkdXogYSBpbWFnZW0gbWFudGVuZG8gbyBmb3JtYXRvIChmb3RvIGRlIG9jb3Jyw6puY2lhLCBuw6NvIMOpIGF2YXRhciBxdWFkcmFkbykKZnVuY3Rpb24gbGVyRm90b0xhcmdhKGZpbGUsIG1heExhZG8sIGNiKSB7CiAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTsKICByZWFkZXIub25lcnJvciA9ICgpID0+IGNiKG51bGwpOwogIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7CiAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKTsKICAgIGltZy5vbmVycm9yID0gKCkgPT4gY2IobnVsbCk7CiAgICBpbWcub25sb2FkID0gKCkgPT4gewogICAgICBjb25zdCBlc2NhbGEgPSBNYXRoLm1pbigxLCBtYXhMYWRvIC8gTWF0aC5tYXgoaW1nLndpZHRoIHx8IDEsIGltZy5oZWlnaHQgfHwgMSkpOwogICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTsKICAgICAgY2FudmFzLndpZHRoID0gTWF0aC5tYXgoMSwgTWF0aC5yb3VuZCgoaW1nLndpZHRoIHx8IDEpICogZXNjYWxhKSk7CiAgICAgIGNhbnZhcy5oZWlnaHQgPSBNYXRoLm1heCgxLCBNYXRoLnJvdW5kKChpbWcuaGVpZ2h0IHx8IDEpICogZXNjYWxhKSk7CiAgICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpOwogICAgICBpZiAoIWN0eCkgcmV0dXJuIGNiKG51bGwpOwogICAgICBjdHguZHJhd0ltYWdlKGltZywgMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTsKICAgICAgdHJ5IHsgY2IoY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvanBlZycsIDAuNzIpKTsgfSBjYXRjaCAoXykgeyBjYihudWxsKTsgfQogICAgfTsKICAgIGltZy5zcmMgPSByZWFkZXIucmVzdWx0OwogIH07CiAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoZmlsZSk7Cn0KCmZ1bmN0aW9uIHJlbmRlck9jb3JyZW5jaWFzKCkgewogIGNvbnN0IGQgPSBTLmRhZG9zOwogIGNvbnN0IGxpc3RhID0gZC5vY29ycmVuY2lhczsKICBjb25zdCBwb2RlRXhjbHVpciA9IGQubWV1Tml2ZWwgPj0gNzA7CiAgY29uc3QgcG9kZUNyaWFyID0gcG9kZVJlZ2lzdHJhck9jb3JyZW5jaWEoKTsKCiAgY29uc3QgYnRuID0gJCgnI2J0bi1hYnJpci1vY29ycmVuY2lhJyk7CiAgaWYgKGJ0bikgYnRuLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsICFwb2RlQ3JpYXIpOwogIGNvbnN0IGF2aXNvID0gJCgnI2F2aXNvLW9jb3JyZW5jaWEnKTsKICBpZiAoYXZpc28pIHsKICAgIGF2aXNvLnRleHRDb250ZW50ID0gcG9kZUNyaWFyCiAgICAgID8gJycKICAgICAgOiAnU2V1IGNhcmdvIG7Do28gcmVnaXN0cmEgb2NvcnLDqm5jaWEuIFNvbWVudGUgRXNjcml2w6NvLCBEZWxlZ2FkbywgQ2hlZmUgZGUgUG9sw61jaWEgZSBBZG1pbiBNYXN0ZXIgbGFuw6dhbSBvY29ycsOqbmNpYXMuJzsKICAgIGF2aXNvLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsIHBvZGVDcmlhcik7CiAgfQoKICAkKCcjbGlzdGEtb2NvcnJlbmNpYXMnKS5pbm5lckhUTUwgPSBsaXN0YS5sZW5ndGgKICAgID8gbGlzdGEubWFwKChvKSA9PiB7CiAgICAgIGNvbnN0IHBvZGVFZGl0YXIgPSBwb2RlRXhjbHVpciB8fCAoUy5ldSAmJiBvLmNyaWFkb1BvciA9PT0gUy5ldS5sb2dpbik7CiAgICAgIHJldHVybiBgCiAgICAgIDxkaXYgY2xhc3M9Im9jLWNhcmQiPgogICAgICAgIDxkaXYgY2xhc3M9Im9jLXRvcG8iPgogICAgICAgICAgPGRpdj4KICAgICAgICAgICAgPHN0cm9uZz4ke2VzY2FwZUh0bWwoby50aXR1bG8pfTwvc3Ryb25nPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJvYy1tZXRhIj4ke2VzY2FwZUh0bWwoby5hZ2VudGUpfSDCtyAke2VzY2FwZUh0bWwoby5jYXJnb0FnZW50ZSB8fCAnJyl9IMK3ICR7ZGF0YUJSKG8uY3JpYWRvRW0pfSR7by5yZXNwb25zYXZlbCA/ICcgwrcgcmVzcC46ICcgKyBlc2NhcGVIdG1sKG8ucmVzcG9uc2F2ZWwpIDogJyd9PC9kaXY+CiAgICAgICAgICA8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9ImFjb2VzLWxpbmhhIj4KICAgICAgICAgICAgJHtiYWRnZVN0YXR1cyhvLnN0YXR1cyl9CiAgICAgICAgICAgICR7cG9kZUVkaXRhciA/IGA8YnV0dG9uIGNsYXNzPSJtaW5pIiBkYXRhLW9jLWVkaXRhcj0iJHtvLmlkfSI+RWRpdGFyPC9idXR0b24+YCA6ICcnfQogICAgICAgICAgICAke3BvZGVFeGNsdWlyID8gYDxidXR0b24gY2xhc3M9Im1pbmkgcGVyaWdvIiBkYXRhLW9jLWV4Y2x1aXI9IiR7by5pZH0iPkV4Y2x1aXI8L2J1dHRvbj5gIDogJyd9CiAgICAgICAgICA8L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgICAke28uZGVwb2ltZW50byA/IGA8ZGl2IGNsYXNzPSJvYy1kZXAiPiR7ZXNjYXBlSHRtbChvLmRlcG9pbWVudG8pfTwvZGl2PmAgOiAnJ30KICAgICAgICAke28uZm90b1VybCA/IGA8YSBjbGFzcz0ib2MtZm90byIgaHJlZj0iJHtlc2NhcGVIdG1sKG8uZm90b1VybCl9IiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciIgdGl0bGU9IkFicmlyIGEgZm90byBkYSBvY29ycsOqbmNpYSI+PGltZyBzcmM9IiR7ZXNjYXBlSHRtbChvLmZvdG9VcmwpfSIgYWx0PSJGb3RvIGRhIG9jb3Jyw6puY2lhOiAke2VzY2FwZUh0bWwoby50aXR1bG8pfSIgbG9hZGluZz0ibGF6eSI+PC9hPmAgOiAnJ30KICAgICAgICAke28ucmVzcG9zdGEgPyBgPGRpdiBjbGFzcz0ib2MtcmVzcCI+4oazICR7ZXNjYXBlSHRtbChvLnJlc3Bvc3RhKX08L2Rpdj5gIDogJyd9CiAgICAgIDwvZGl2PmA7CiAgICB9KS5qb2luKCcnKQogICAgOiAnPGRpdiBjbGFzcz0idmF6aW8iPk5lbmh1bWEgb2NvcnLDqm5jaWEgcmVnaXN0cmFkYSBhaW5kYS48L2Rpdj4nOwoKICAkJCgnW2RhdGEtb2MtZWRpdGFyXScpLmZvckVhY2goKGIpID0+IGIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBtb2RhbE9jb3JyZW5jaWEoYi5kYXRhc2V0Lm9jRWRpdGFyKSkpOwogICQkKCdbZGF0YS1vYy1leGNsdWlyXScpLmZvckVhY2goKGIpID0+IGIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7CiAgICBpZiAoIWNvbmZpcm0oJ0V4Y2x1aXIgZXN0YSBvY29ycsOqbmNpYSBkZWZpbml0aXZhbWVudGU/JykpIHJldHVybjsKICAgIHRyeSB7IGF3YWl0IGFwaSgnREVMRVRFJywgJy9vY29ycmVuY2lhcy8nICsgYi5kYXRhc2V0Lm9jRXhjbHVpcik7IGF3YWl0IGNhcnJlZ2FyKCk7IGZsdXR1YW50ZSgnT2NvcnLDqm5jaWEgZXhjbHXDrWRhLicpOyB9CiAgICBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9CiAgfSkpOwp9CgokKCcjYnRuLWFicmlyLW9jb3JyZW5jaWEnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IG1vZGFsT2NvcnJlbmNpYShudWxsKSk7CgpmdW5jdGlvbiBtb2RhbE9jb3JyZW5jaWEoaWQpIHsKICBjb25zdCBvYyA9IGlkID8gUy5kYWRvcy5vY29ycmVuY2lhcy5maW5kKChvKSA9PiBvLmlkID09PSBpZCkgOiBudWxsOwogIGNvbnN0IGNhcmdvcyA9IGxpc3RhQ2FyZ29zKCkubWFwKChjKSA9PiBjLm5vbWUpOwogIGNvbnN0IHN0YXR1cyA9IFsnUGVuZGVudGUnLCAnQWNlaXRhJywgJ1JlY3VzYWRhJywgJ0NhbmNlbGFkYSddOwogIGxldCBmb3RvTm92YTsgLy8gdW5kZWZpbmVkID0gbsOjbyBtZXhldSB8IGRhdGFVUkwgPSBub3ZhIGZvdG8gfCAnJyA9IHJlbW92ZXIKCiAgYWJyaXJNb2RhbChvYyA/ICdFZGl0YXIgb2NvcnLDqm5jaWEnIDogJ05vdmEgb2NvcnLDqm5jaWEnLCBgCiAgICA8Zm9ybSBpZD0iZm9ybS1vYyI+CiAgICAgIDxsYWJlbD5Uw610dWxvIC8gYXNzdW50bzxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0ib2MtdGl0dWxvIiByZXF1aXJlZCBtYXhsZW5ndGg9IjEyMCIgdmFsdWU9IiR7ZXNjYXBlSHRtbChvYyA/IG9jLnRpdHVsbyA6ICcnKX0iPjwvbGFiZWw+CiAgICAgIDxsYWJlbD5BZ2VudGU8aW5wdXQgdHlwZT0idGV4dCIgaWQ9Im9jLWFnZW50ZSIgcmVxdWlyZWQgbWF4bGVuZ3RoPSI2MCIgdmFsdWU9IiR7ZXNjYXBlSHRtbChvYyA/IG9jLmFnZW50ZSA6IChTLmV1ID8gUy5ldS5ub21lIDogJycpKX0iPjwvbGFiZWw+CiAgICAgIDxsYWJlbD5DYXJnbyBkbyBhZ2VudGU8c2VsZWN0IGlkPSJvYy1jYXJnbyI+CiAgICAgICAgJHtjYXJnb3MubWFwKChjKSA9PiBgPG9wdGlvbiB2YWx1ZT0iJHtlc2NhcGVIdG1sKGMpfSIgJHtvYyAmJiBvYy5jYXJnb0FnZW50ZSA9PT0gYyA/ICdzZWxlY3RlZCcgOiAoIW9jICYmIFMuZXUgJiYgUy5ldS5jYXJnbyA9PT0gYyA/ICdzZWxlY3RlZCcgOiAnJyl9PiR7ZXNjYXBlSHRtbChjKX08L29wdGlvbj5gKS5qb2luKCcnKX0KICAgICAgPC9zZWxlY3Q+PC9sYWJlbD4KICAgICAgPGxhYmVsPlN0YXR1czxzZWxlY3QgaWQ9Im9jLXN0YXR1cyI+JHtzdGF0dXMubWFwKChzKSA9PiBgPG9wdGlvbiAke29jICYmIG9jLnN0YXR1cyA9PT0gcyA/ICdzZWxlY3RlZCcgOiAnJ30+JHtzfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgICAgIDxsYWJlbD5SZXNwb25zw6F2ZWwgKHF1ZW0gYXRlbmRldSk8aW5wdXQgdHlwZT0idGV4dCIgaWQ9Im9jLXJlc3BvbnNhdmVsIiBtYXhsZW5ndGg9IjYwIiB2YWx1ZT0iJHtlc2NhcGVIdG1sKG9jID8gb2MucmVzcG9uc2F2ZWwgfHwgJycgOiAnJyl9Ij48L2xhYmVsPgogICAgICA8bGFiZWw+RGVwb2ltZW50bzx0ZXh0YXJlYSBpZD0ib2MtZGVwb2ltZW50byIgcm93cz0iNCIgbWF4bGVuZ3RoPSI0MDAwIj4ke2VzY2FwZUh0bWwob2MgPyBvYy5kZXBvaW1lbnRvIDogJycpfTwvdGV4dGFyZWE+PC9sYWJlbD4KICAgICAgPGxhYmVsPlJlc3Bvc3RhIC8gb2JzZXJ2YcOnw6NvPHRleHRhcmVhIGlkPSJvYy1yZXNwb3N0YSIgcm93cz0iMyIgbWF4bGVuZ3RoPSI0MDAwIj4ke2VzY2FwZUh0bWwob2MgPyBvYy5yZXNwb3N0YSA6ICcnKX08L3RleHRhcmVhPjwvbGFiZWw+CiAgICAgIDxsYWJlbD5Gb3RvIGRhIG9jb3Jyw6puY2lhIChvcGNpb25hbCkKICAgICAgICA8aW5wdXQgdHlwZT0iZmlsZSIgaWQ9Im9jLWZvdG8iIGFjY2VwdD0iaW1hZ2UvKiI+CiAgICAgIDwvbGFiZWw+CiAgICAgIDxkaXYgY2xhc3M9Im9jLWZvdG8tcHJldmlhIGhpZGRlbiIgaWQ9Im9jLWZvdG8tcHJldmlhIj4KICAgICAgICA8aW1nIGlkPSJvYy1mb3RvLWltZyIgYWx0PSJQcsOpdmlhIGRhIGZvdG8iPgogICAgICAgIDxidXR0b24gdHlwZT0iYnV0dG9uIiBjbGFzcz0ibWluaSBwZXJpZ28iIGlkPSJvYy1mb3RvLXJlbW92ZXIiPlJlbW92ZXIgZm90bzwvYnV0dG9uPgogICAgICA8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ibG9naW4tc3VhdmUiIGlkPSJvYy1mb3RvLWRpY2EiPkEgZm90byBhcGFyZWNlIG5vIGNhcmQgZGEgb2NvcnLDqm5jaWEgcGFyYSB0b2RvIG8gZWZldGl2by48L2Rpdj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIiB0eXBlPSJzdWJtaXQiPiR7b2MgPyAnU2FsdmFyIGFsdGVyYcOnw7VlcycgOiAnUmVnaXN0cmFyIG9jb3Jyw6puY2lhJ308L2J1dHRvbj4KICAgIDwvZm9ybT5gKTsKCiAgY29uc3QgcHJldmlhID0gJCgnI29jLWZvdG8tcHJldmlhJyk7CiAgY29uc3QgaW1nUHJldmlhID0gJCgnI29jLWZvdG8taW1nJyk7CiAgY29uc3QgZGljYSA9ICQoJyNvYy1mb3RvLWRpY2EnKTsKICBjb25zdCBtb3N0cmFyUHJldmlhID0gKHNyYykgPT4gewogICAgaWYgKHNyYykgeyBpbWdQcmV2aWEuc3JjID0gc3JjOyBwcmV2aWEuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7IGlmIChkaWNhKSBkaWNhLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpOyB9CiAgICBlbHNlIHsgaW1nUHJldmlhLnJlbW92ZUF0dHJpYnV0ZSgnc3JjJyk7IHByZXZpYS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsgaWYgKGRpY2EpIGRpY2EuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7IH0KICB9OwogIG1vc3RyYXJQcmV2aWEob2MgPyBvYy5mb3RvVXJsIDogbnVsbCk7CgogICQoJyNvYy1mb3RvJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGV2KSA9PiB7CiAgICBjb25zdCBmaWxlID0gZXYudGFyZ2V0LmZpbGVzWzBdOwogICAgaWYgKCFmaWxlKSByZXR1cm47CiAgICBpZiAoIS9eaW1hZ2VcLy8udGVzdChmaWxlLnR5cGUpKSB7IGV2LnRhcmdldC52YWx1ZSA9ICcnOyByZXR1cm4gZmx1dHVhbnRlKCdFc2NvbGhhIHVtIGFycXVpdm8gZGUgaW1hZ2VtIChKUEcsIFBORy4uLikuJywgJ2Vycm8nKTsgfQogICAgbGVyRm90b0xhcmdhKGZpbGUsIDEwMDAsIChkYXRhVXJsKSA9PiB7CiAgICAgIGlmICghZGF0YVVybCkgcmV0dXJuIGZsdXR1YW50ZSgnTsOjbyBjb25zZWd1aSBsZXIgZXNzYSBpbWFnZW0uJywgJ2Vycm8nKTsKICAgICAgZm90b05vdmEgPSBkYXRhVXJsOwogICAgICBtb3N0cmFyUHJldmlhKGRhdGFVcmwpOwogICAgfSk7CiAgfSk7CgogICQoJyNvYy1mb3RvLXJlbW92ZXInKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHsKICAgIGZvdG9Ob3ZhID0gJyc7CiAgICAkKCcjb2MtZm90bycpLnZhbHVlID0gJyc7CiAgICBtb3N0cmFyUHJldmlhKG51bGwpOwogIH0pOwoKICAkKCcjZm9ybS1vYycpLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGFzeW5jIChldikgPT4gewogICAgZXYucHJldmVudERlZmF1bHQoKTsKICAgIGNvbnN0IGNvcnBvID0gewogICAgICB0aXR1bG86ICQoJyNvYy10aXR1bG8nKS52YWx1ZSwgYWdlbnRlOiAkKCcjb2MtYWdlbnRlJykudmFsdWUsIGNhcmdvQWdlbnRlOiAkKCcjb2MtY2FyZ28nKS52YWx1ZSwKICAgICAgc3RhdHVzOiAkKCcjb2Mtc3RhdHVzJykudmFsdWUsIHJlc3BvbnNhdmVsOiAkKCcjb2MtcmVzcG9uc2F2ZWwnKS52YWx1ZSwKICAgICAgZGVwb2ltZW50bzogJCgnI29jLWRlcG9pbWVudG8nKS52YWx1ZSwgcmVzcG9zdGE6ICQoJyNvYy1yZXNwb3N0YScpLnZhbHVlLAogICAgfTsKICAgIGlmIChmb3RvTm92YSAhPT0gdW5kZWZpbmVkKSBjb3Jwby5mb3RvID0gZm90b05vdmE7CiAgICB0cnkgewogICAgICBpZiAob2MpIGF3YWl0IGFwaSgnUFVUJywgJy9vY29ycmVuY2lhcy8nICsgb2MuaWQsIGNvcnBvKTsKICAgICAgZWxzZSBhd2FpdCBhcGkoJ1BPU1QnLCAnL29jb3JyZW5jaWFzJywgY29ycG8pOwogICAgICBmZWNoYXJNb2RhbCgpOyBhd2FpdCBjYXJyZWdhcigpOyBmbHV0dWFudGUoJ09jb3Jyw6puY2lhIHNhbHZhLicpOwogICAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9CiAgfSk7Cn0KCi8vIOKUgOKUgCBlZmV0aXZvIOKUgOKUgAokKCcjYnVzY2EtZWZldGl2bycpLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKGUpID0+IHsgUy5idXNjYSA9IGUudGFyZ2V0LnZhbHVlLnRvTG93ZXJDYXNlKCk7IHJlbmRlckVmZXRpdm8oKTsgfSk7CiQoJyNidG4tYWJyaXItdXN1YXJpbycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgbW9kYWxOb3ZvVXN1YXJpbyk7CgpmdW5jdGlvbiByZW5kZXJFZmV0aXZvKCkgewogIGNvbnN0IGV1ID0gUy5ldSB8fCB7fTsKICBjb25zdCBtZXVOaXZlbCA9IFMuZGFkb3MubWV1Tml2ZWw7CiAgY29uc3QgcG9kZUdlcmlyID0gbWV1Tml2ZWwgPj0gODA7CiAgY29uc3QgbGlzdGEgPSBTLmRhZG9zLnVzZXJzCiAgICAuZmlsdGVyKCh1KSA9PiAhUy5idXNjYSB8fCAodS5ub21lICsgJyAnICsgdS5sb2dpbiArICcgJyArIHUuY2FyZ28pLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoUy5idXNjYSkpCiAgICAuc29ydCgoYSwgYikgPT4gbGlzdGFDYXJnb3MoKS5maW5kSW5kZXgoKGMpID0+IGMubm9tZSA9PT0gYi5jYXJnbykgLSBsaXN0YUNhcmdvcygpLmZpbmRJbmRleCgoYykgPT4gYy5ub21lID09PSBhLmNhcmdvKSk7CgogICQoJyNidG4tYWJyaXItdXN1YXJpbycpLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsICFwb2RlR2VyaXIpOwoKICAkKCcjdGFiZWxhLWVmZXRpdm8nKS5pbm5lckhUTUwgPSBsaXN0YS5sZW5ndGggPyBgCiAgICA8dGFibGU+PHRoZWFkPjx0cj4KICAgICAgPHRoPlBvbGljaWFsPC90aD48dGg+Q2FyZ288L3RoPjx0aD5TaXR1YcOnw6NvPC90aD48dGggc3R5bGU9InRleHQtYWxpZ246cmlnaHQiPlBvbnRvczwvdGg+PHRoPjwvdGg+CiAgICA8L3RyPjwvdGhlYWQ+PHRib2R5PgogICAgJHtsaXN0YS5tYXAoKHUpID0+IHsKICAgICAgY29uc3Qgc3VzcCA9IHUuc3VzcGVuc29BdGUgJiYgbmV3IERhdGUodS5zdXNwZW5zb0F0ZSkgPiBuZXcgRGF0ZSgpOwogICAgICBjb25zdCBzaXR1YWNhbyA9ICF1LmF0aXZvID8gJzxzcGFuIGNsYXNzPSJiYWRnZSB2ZXJtZWxobyI+RGVzYXRpdmFkbzwvc3Bhbj4nCiAgICAgICAgOiBzdXNwID8gJzxzcGFuIGNsYXNzPSJiYWRnZSBhbWFyZWxvIj5TdXNwZW5zbzwvc3Bhbj4nCiAgICAgICAgOiAnPHNwYW4gY2xhc3M9ImJhZGdlIHZlcmRlIj5BdGl2bzwvc3Bhbj4nOwogICAgICBjb25zdCBzdXBlcmlvciA9IChsaXN0YUNhcmdvcygpLmZpbmQoKGMpID0+IGMubm9tZSA9PT0gZXUuY2FyZ28pIHx8IHt9KS5uaXZlbCA+IChsaXN0YUNhcmdvcygpLmZpbmQoKGMpID0+IGMubm9tZSA9PT0gdS5jYXJnbykgfHwge30pLm5pdmVsIHx8IGV1LmNhcmdvID09PSAnQWRtaW4gTWFzdGVyJzsKICAgICAgY29uc3QgcG9kZUFxdWkgPSBwb2RlR2VyaXIgJiYgc3VwZXJpb3IgJiYgdS5pZCAhPT0gZXUuaWQ7CiAgICAgIHJldHVybiBgPHRyPgogICAgICAgIDx0ZD48ZGl2IGNsYXNzPSJub21lLWNlbCI+PGRpdiBjbGFzcz0iYXZhdGFyIiAke3UuZm90byA/IGBzdHlsZT0iYmFja2dyb3VuZC1pbWFnZTp1cmwoJHt1LmZvdG99KSJgIDogJyd9PiR7dS5mb3RvID8gJycgOiBlc2NhcGVIdG1sKCh1Lm5vbWUgfHwgJz8nKS5jaGFyQXQoMCkpfTwvZGl2PgogICAgICAgICAgPGRpdj48c3Ryb25nPiR7ZXNjYXBlSHRtbCh1Lm5vbWUpfTwvc3Ryb25nPjxkaXYgY2xhc3M9ImxvZ2luLXN1YXZlIj5AJHtlc2NhcGVIdG1sKHUubG9naW4pfTwvZGl2PjwvZGl2PjwvZGl2PjwvdGQ+CiAgICAgICAgPHRkPjxzcGFuIGNsYXNzPSJiYWRnZSAke0NBUkdPX0NPUlt1LmNhcmdvXSB8fCAnJ30iPiR7ZXNjYXBlSHRtbCh1LmNhcmdvKX08L3NwYW4+PC90ZD4KICAgICAgICA8dGQ+JHtzaXR1YWNhb308L3RkPgogICAgICAgIDx0ZCBzdHlsZT0idGV4dC1hbGlnbjpyaWdodCI+PHN0cm9uZz4ke3UucG9udG9zIHx8IDB9PC9zdHJvbmc+PC90ZD4KICAgICAgICA8dGQ+PGRpdiBjbGFzcz0iYWNvZXMtbGluaGEiPgogICAgICAgICAgJHtwb2RlQXF1aSA/IGA8YnV0dG9uIGNsYXNzPSJtaW5pIiBkYXRhLWNhcmdvPSIke3UuaWR9Ij5DYXJnbzwvYnV0dG9uPgogICAgICAgICAgPGJ1dHRvbiBjbGFzcz0ibWluaSIgZGF0YS1zZW5oYT0iJHt1LmlkfSI+U2VuaGE8L2J1dHRvbj4KICAgICAgICAgIDxidXR0b24gY2xhc3M9Im1pbmkiIGRhdGEtc3VzcD0iJHt1LmlkfSI+JHtzdXNwID8gJ1N1c3BlbnPDo28nIDogJ1N1c3BlbmRlcid9PC9idXR0b24+CiAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJtaW5pIiBkYXRhLXN0YXR1cz0iJHt1LmlkfSI+JHt1LmF0aXZvID8gJ0Rlc2F0aXZhcicgOiAnQXRpdmFyJ308L2J1dHRvbj4KICAgICAgICAgIDxidXR0b24gY2xhc3M9Im1pbmkgcGVyaWdvIiBkYXRhLWV4Y2x1aXI9IiR7dS5pZH0iPkV4Y2x1aXI8L2J1dHRvbj5gIDogJzxzcGFuIGNsYXNzPSJsb2dpbi1zdWF2ZSI+4oCUPC9zcGFuPid9CiAgICAgICAgPC9kaXY+PC90ZD4KICAgICAgPC90cj5gOwogICAgfSkuam9pbignJyl9PC90Ym9keT48L3RhYmxlPmAKICAgIDogJzxkaXYgY2xhc3M9InZhemlvIj5OZW5odW0gcG9saWNpYWwgZW5jb250cmFkby48L2Rpdj4nOwoKICAkJCgnW2RhdGEtY2FyZ29dJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IG1vZGFsQ2FyZ28oYi5kYXRhc2V0LmNhcmdvKSkpOwogICQkKCdbZGF0YS1zZW5oYV0nKS5mb3JFYWNoKChiKSA9PiBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gbW9kYWxTZW5oYShiLmRhdGFzZXQuc2VuaGEpKSk7CiAgJCQoJ1tkYXRhLXN1c3BdJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IG1vZGFsU3VzcGVuc2FvKGIuZGF0YXNldC5zdXNwKSkpOwogICQkKCdbZGF0YS1zdGF0dXNdJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHsKICAgIGNvbnN0IHUgPSBTLmRhZG9zLnVzZXJzLmZpbmQoKHgpID0+IHguaWQgPT09IGIuZGF0YXNldC5zdGF0dXMpOwogICAgdHJ5IHsKICAgICAgYXdhaXQgYXBpKCdQVVQnLCBgL3VzZXJzLyR7dS5pZH0vc3RhdHVzYCwgeyBhdGl2bzogIXUuYXRpdm8gfSk7CiAgICAgIGF3YWl0IGNhcnJlZ2FyKCk7IGZsdXR1YW50ZSh1LmF0aXZvID8gJ1VzdcOhcmlvIGRlc2F0aXZhZG8uJyA6ICdVc3XDoXJpbyBhdGl2YWRvLicpOwogICAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9CiAgfSkpOwogICQkKCdbZGF0YS1leGNsdWlyXScpLmZvckVhY2goKGIpID0+IGIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7CiAgICBjb25zdCB1ID0gUy5kYWRvcy51c2Vycy5maW5kKCh4KSA9PiB4LmlkID09PSBiLmRhdGFzZXQuZXhjbHVpcik7CiAgICBpZiAoIWNvbmZpcm0oYEV4Y2x1aXIgJHt1Lm5vbWV9IChAJHt1LmxvZ2lufSk/IElzc28gbsOjbyBwb2RlIHNlciBkZXNmZWl0by5gKSkgcmV0dXJuOwogICAgdHJ5IHsgYXdhaXQgYXBpKCdERUxFVEUnLCAnL3VzZXJzLycgKyB1LmlkKTsgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKCdVc3XDoXJpbyBleGNsdcOtZG8uJyk7IH0KICAgIGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICB9KSk7Cn0KCmNvbnN0IENBUkdPU19QQURSQU8gPSBbCiAgeyBub21lOiAnQWRtaW4gTWFzdGVyJywgbml2ZWw6IDEwMCB9LCB7IG5vbWU6ICdDaGVmZSBkZSBQb2zDrWNpYScsIG5pdmVsOiA5MCB9LAogIHsgbm9tZTogJ0RlbGVnYWRvJywgbml2ZWw6IDgwIH0sIHsgbm9tZTogJ0VzY3JpdsOjbycsIG5pdmVsOiA3MCB9LAogIHsgbm9tZTogJ1TDoXRpY28nLCBuaXZlbDogNjAgfSwgeyBub21lOiAnQWdlbnRlJywgbml2ZWw6IDUwIH0sCiAgeyBub21lOiAnR3VhcmRhIE11bmljaXBhbCcsIG5pdmVsOiA0MCB9LCB7IG5vbWU6ICdDaXZpbCcsIG5pdmVsOiAxMCB9LApdOwoKZnVuY3Rpb24gbGlzdGFDYXJnb3MoKSB7CiAgY29uc3QgZG9TZXJ2aWRvciA9IChTLmRhZG9zICYmIEFycmF5LmlzQXJyYXkoUy5kYWRvcy5jYXJnb3MpKSA/IFMuZGFkb3MuY2FyZ29zIDogW107CiAgcmV0dXJuIGRvU2Vydmlkb3IubGVuZ3RoID8gZG9TZXJ2aWRvciA6IENBUkdPU19QQURSQU87Cn0KCmZ1bmN0aW9uIG1vZGFsTm92b1VzdWFyaW8oKSB7CiAgY29uc3QgY2FyZ29zID0gbGlzdGFDYXJnb3MoKS5maWx0ZXIoKGMpID0+IGMubml2ZWwgPCBTLmRhZG9zLm1ldU5pdmVsIHx8IFMuZXUuY2FyZ28gPT09ICdBZG1pbiBNYXN0ZXInKTsKICBhYnJpck1vZGFsKCdOb3ZvIHVzdcOhcmlvJywgYAogICAgPGZvcm0gaWQ9ImZvcm0tbm92byI+CiAgICAgIDxsYWJlbD5Ob21lIGNvbXBsZXRvPGlucHV0IHR5cGU9InRleHQiIGlkPSJudS1ub21lIiByZXF1aXJlZCBtYXhsZW5ndGg9IjYwIj48L2xhYmVsPgogICAgICA8bGFiZWw+TG9naW4gKMO6bmljbyk8aW5wdXQgdHlwZT0idGV4dCIgaWQ9Im51LWxvZ2luIiByZXF1aXJlZCBtYXhsZW5ndGg9IjI0IiBwbGFjZWhvbGRlcj0iZXg6IHNpbHZhIj48L2xhYmVsPgogICAgICA8bGFiZWw+Q2FyZ288c2VsZWN0IGlkPSJudS1jYXJnbyI+JHtjYXJnb3MubWFwKChjKSA9PiBgPG9wdGlvbiB2YWx1ZT0iJHtlc2NhcGVIdG1sKGMubm9tZSl9Ij4ke2VzY2FwZUh0bWwoYy5ub21lKX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogICAgICA8bGFiZWw+U2VuaGEgaW5pY2lhbDxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0ibnUtc2VuaGEiIHJlcXVpcmVkIG1pbmxlbmd0aD0iNCIgdmFsdWU9IjEyMzQiPjwvbGFiZWw+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyIgdHlwZT0ic3VibWl0Ij5DcmlhciBhY2Vzc288L2J1dHRvbj4KICAgIDwvZm9ybT5gKTsKICAkKCcjZm9ybS1ub3ZvJykuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgICBldi5wcmV2ZW50RGVmYXVsdCgpOwogICAgdHJ5IHsKICAgICAgYXdhaXQgYXBpKCdQT1NUJywgJy91c2VycycsIHsKICAgICAgICBub21lOiAkKCcjbnUtbm9tZScpLnZhbHVlLCBsb2dpbjogJCgnI251LWxvZ2luJykudmFsdWUudHJpbSgpLAogICAgICAgIGNhcmdvOiAkKCcjbnUtY2FyZ28nKS52YWx1ZSwgc2VuaGE6ICQoJyNudS1zZW5oYScpLnZhbHVlLAogICAgICB9KTsKICAgICAgZmVjaGFyTW9kYWwoKTsgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKCdVc3XDoXJpbyBjcmlhZG8uJyk7CiAgICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICB9KTsKfQoKZnVuY3Rpb24gbW9kYWxDYXJnbyhpZCkgewogIGNvbnN0IHUgPSBTLmRhZG9zLnVzZXJzLmZpbmQoKHgpID0+IHguaWQgPT09IGlkKTsKICBhYnJpck1vZGFsKCdBbHRlcmFyIGNhcmdvJywgYAogICAgPHAgY2xhc3M9InRleHRvLWFqdWRhIj4ke2VzY2FwZUh0bWwodS5ub21lKX0gKEAke2VzY2FwZUh0bWwodS5sb2dpbil9KSBlc3TDoSBjb21vIDxzdHJvbmc+JHtlc2NhcGVIdG1sKHUuY2FyZ28pfTwvc3Ryb25nPi48L3A+CiAgICA8Zm9ybSBpZD0iZm9ybS1jYXJnbyI+CiAgICAgIDxsYWJlbD5Ob3ZvIGNhcmdvPHNlbGVjdCBpZD0iY2ctY2FyZ28iPiR7bGlzdGFDYXJnb3MoKS5tYXAoKGMpID0+IGA8b3B0aW9uIHZhbHVlPSIke2VzY2FwZUh0bWwoYy5ub21lKX0iICR7Yy5ub21lID09PSB1LmNhcmdvID8gJ3NlbGVjdGVkJyA6ICcnfT4ke2VzY2FwZUh0bWwoYy5ub21lKX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogICAgICA8bGFiZWw+TW90aXZvICh2YWkgcGFyYSBhIGF1ZGl0b3JpYSk8aW5wdXQgdHlwZT0idGV4dCIgaWQ9ImNnLW1vdGl2byIgbWF4bGVuZ3RoPSIyMDAiIHBsYWNlaG9sZGVyPSJleDogcHJvbW/Dp8OjbyBwb3IgZGVzZW1wZW5obyI+PC9sYWJlbD4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIiB0eXBlPSJzdWJtaXQiPlNhbHZhciBjYXJnbzwvYnV0dG9uPgogICAgPC9mb3JtPmApOwogICQoJyNmb3JtLWNhcmdvJykuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgICBldi5wcmV2ZW50RGVmYXVsdCgpOwogICAgdHJ5IHsKICAgICAgYXdhaXQgYXBpKCdQVVQnLCBgL3VzZXJzLyR7dS5pZH0vY2FyZ29gLCB7IGNhcmdvOiAkKCcjY2ctY2FyZ28nKS52YWx1ZSwgbW90aXZvOiAkKCcjY2ctbW90aXZvJykudmFsdWUgfSk7CiAgICAgIGZlY2hhck1vZGFsKCk7IGF3YWl0IGNhcnJlZ2FyKCk7IGZsdXR1YW50ZSgnQ2FyZ28gYXR1YWxpemFkby4nKTsKICAgIH0gY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQogIH0pOwp9CgpmdW5jdGlvbiBtb2RhbFNlbmhhKGlkKSB7CiAgY29uc3QgdSA9IFMuZGFkb3MudXNlcnMuZmluZCgoeCkgPT4geC5pZCA9PT0gaWQpOwogIGFicmlyTW9kYWwoJ1JlZGVmaW5pciBzZW5oYScsIGAKICAgIDxwIGNsYXNzPSJ0ZXh0by1hanVkYSI+RGVmaW5pciBub3ZhIHNlbmhhIHBhcmEgJHtlc2NhcGVIdG1sKHUubm9tZSl9IChAJHtlc2NhcGVIdG1sKHUubG9naW4pfSkuPC9wPgogICAgPGZvcm0gaWQ9ImZvcm0tcnMiPgogICAgICA8bGFiZWw+Tm92YSBzZW5oYTxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0icnMtbm92YSIgcmVxdWlyZWQgbWlubGVuZ3RoPSI0Ij48L2xhYmVsPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4tcHJpbWFyaW8iIHR5cGU9InN1Ym1pdCI+UmVkZWZpbmlyPC9idXR0b24+CiAgICA8L2Zvcm0+YCk7CiAgJCgnI2Zvcm0tcnMnKS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBhc3luYyAoZXYpID0+IHsKICAgIGV2LnByZXZlbnREZWZhdWx0KCk7CiAgICB0cnkgewogICAgICBhd2FpdCBhcGkoJ1BVVCcsIGAvdXNlcnMvJHt1LmlkfS9zZW5oYWAsIHsgbm92YVNlbmhhOiAkKCcjcnMtbm92YScpLnZhbHVlIH0pOwogICAgICBmZWNoYXJNb2RhbCgpOyBmbHV0dWFudGUoJ1NlbmhhIHJlZGVmaW5pZGEuJyk7CiAgICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICB9KTsKfQoKZnVuY3Rpb24gbW9kYWxTdXNwZW5zYW8oaWQpIHsKICBjb25zdCB1ID0gUy5kYWRvcy51c2Vycy5maW5kKCh4KSA9PiB4LmlkID09PSBpZCk7CiAgY29uc3Qgc3VzcCA9IHUuc3VzcGVuc29BdGUgJiYgbmV3IERhdGUodS5zdXNwZW5zb0F0ZSkgPiBuZXcgRGF0ZSgpOwogIGFicmlyTW9kYWwoJ1N1c3BlbnPDo28nLCBgCiAgICAke3N1c3AgPyBgPHAgY2xhc3M9InRleHRvLWFqdWRhIj5TdXNwZW5zbyBhdMOpIDxzdHJvbmc+JHtkYXRhQlIodS5zdXNwZW5zb0F0ZSl9PC9zdHJvbmc+IOKAlCBtb3Rpdm86ICR7ZXNjYXBlSHRtbCh1LnN1c3BlbnNhb01vdGl2byB8fCAn4oCUJyl9PC9wPmAgOiAnJ30KICAgIDxmb3JtIGlkPSJmb3JtLXN1c3AiPgogICAgICA8bGFiZWw+RHVyYcOnw6NvIGVtIG1pbnV0b3M8aW5wdXQgdHlwZT0ibnVtYmVyIiBpZD0ic3AtbWluIiBtaW49IjEiIG1heD0iNDMyMDAiIHZhbHVlPSIke3N1c3AgPyA2MCA6IDYwfSIgcmVxdWlyZWQ+PC9sYWJlbD4KICAgICAgPGxhYmVsPk1vdGl2bzxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0ic3AtbW90aXZvIiByZXF1aXJlZCBtYXhsZW5ndGg9IjIwMCI+PC9sYWJlbD4KICAgICAgPGRpdiBjbGFzcz0ibGluaGEtYm90b2VzIj4KICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4tcHJpbWFyaW8gc20iIHR5cGU9InN1Ym1pdCI+QXBsaWNhciBzdXNwZW5zw6NvPC9idXR0b24+CiAgICAgICAgJHtzdXNwID8gJzxidXR0b24gY2xhc3M9ImJ0bi1zZWN1bmRhcmlvIHNtIiB0eXBlPSJidXR0b24iIGlkPSJzcC1yZW1vdmVyIj5SZW1vdmVyIHN1c3BlbnPDo288L2J1dHRvbj4nIDogJyd9CiAgICAgIDwvZGl2PgogICAgPC9mb3JtPmApOwogICQoJyNmb3JtLXN1c3AnKS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBhc3luYyAoZXYpID0+IHsKICAgIGV2LnByZXZlbnREZWZhdWx0KCk7CiAgICB0cnkgewogICAgICBhd2FpdCBhcGkoJ1BVVCcsIGAvdXNlcnMvJHt1LmlkfS9zdXNwZW5zYW9gLCB7IG1pbnV0b3M6IE51bWJlcigkKCcjc3AtbWluJykudmFsdWUpLCBtb3Rpdm86ICQoJyNzcC1tb3Rpdm8nKS52YWx1ZSB9KTsKICAgICAgZmVjaGFyTW9kYWwoKTsgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKCdTdXNwZW5zw6NvIGFwbGljYWRhLicpOwogICAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9CiAgfSk7CiAgY29uc3QgcmVtID0gJCgnI3NwLXJlbW92ZXInKTsKICBpZiAocmVtKSByZW0uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7CiAgICB0cnkgewogICAgICBhd2FpdCBhcGkoJ1BVVCcsIGAvdXNlcnMvJHt1LmlkfS9zdXNwZW5zYW9gLCB7IG1pbnV0b3M6IDAgfSk7CiAgICAgIGZlY2hhck1vZGFsKCk7IGF3YWl0IGNhcnJlZ2FyKCk7IGZsdXR1YW50ZSgnU3VzcGVuc8OjbyByZW1vdmlkYS4nKTsKICAgIH0gY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQogIH0pOwp9CgovLyDilIDilIAgcG9udG9zIOKUgOKUgApmdW5jdGlvbiByZW5kZXJQb250b3MoKSB7CiAgY29uc3QgcG9kZUxhbmNhciA9IFMuZGFkb3MubWV1Tml2ZWwgPj0gNjA7CiAgY29uc3QgZm9ybSA9ICQoJyNmb3JtLXBvbnRvcycpOwogIGZvcm0uY2xvc2VzdCgnLnBhaW5lbCcpLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsICFwb2RlTGFuY2FyKTsKCiAgY29uc3Qgc2VsZWN0ID0gJCgnI3BvbnRvcy11c2VyJyk7CiAgY29uc3QgYXR1YWwgPSBzZWxlY3QudmFsdWU7CiAgc2VsZWN0LmlubmVySFRNTCA9ICc8b3B0aW9uIHZhbHVlPSIiPlNlbGVjaW9uZS4uLjwvb3B0aW9uPicgKyBTLmRhZG9zLnVzZXJzCiAgICAuc2xpY2UoKS5zb3J0KChhLCBiKSA9PiBhLm5vbWUubG9jYWxlQ29tcGFyZShiLm5vbWUpKQogICAgLm1hcCgodSkgPT4gYDxvcHRpb24gdmFsdWU9IiR7dS5pZH0iPiR7ZXNjYXBlSHRtbCh1Lm5vbWUpfSAoQCR7ZXNjYXBlSHRtbCh1LmxvZ2luKX0pIOKAlCAke3UucG9udG9zIHx8IDB9IHB0czwvb3B0aW9uPmApLmpvaW4oJycpOwogIGlmIChhdHVhbCkgc2VsZWN0LnZhbHVlID0gYXR1YWw7CgogIGNvbnN0IGhpc3QgPSBTLmRhZG9zLnBvbnRvcy5zbGljZSgwLCA2MCk7CiAgJCgnI2hpc3Rvcmljby1wb250b3MnKS5pbm5lckhUTUwgPSBoaXN0Lmxlbmd0aCA/IGAKICAgIDx0YWJsZT48dGhlYWQ+PHRyPjx0aD5Qb2xpY2lhbDwvdGg+PHRoPlBvbnRvczwvdGg+PHRoPk1vdGl2bzwvdGg+PHRoPlBvcjwvdGg+PHRoPlF1YW5kbzwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgICR7aGlzdC5tYXAoKHApID0+IGA8dHI+CiAgICAgIDx0ZD5AJHtlc2NhcGVIdG1sKHAubG9naW4pfTwvdGQ+CiAgICAgIDx0ZD48c3Ryb25nIHN0eWxlPSJjb2xvcjoke3AuZGVsdGEgPiAwID8gJ3ZhcigtLXZlcmRlKScgOiAndmFyKC0tdmVybWVsaG8pJ30iPiR7cC5kZWx0YSA+IDAgPyAnKycgOiAnJ30ke3AuZGVsdGF9PC9zdHJvbmc+PC90ZD4KICAgICAgPHRkPiR7ZXNjYXBlSHRtbChwLm1vdGl2byl9PC90ZD4KICAgICAgPHRkIGNsYXNzPSJsb2dpbi1zdWF2ZSI+QCR7ZXNjYXBlSHRtbChwLnBvcil9PC90ZD4KICAgICAgPHRkIGNsYXNzPSJsb2dpbi1zdWF2ZSI+JHtkYXRhQlIocC5lbSl9PC90ZD4KICAgIDwvdHI+YCkuam9pbignJyl9PC90Ym9keT48L3RhYmxlPmAKICAgIDogJzxkaXYgY2xhc3M9InZhemlvIj5OZW5odW0gbGFuw6dhbWVudG8gYWluZGEuPC9kaXY+JzsKCiAgY29uc3QgbWV1cyA9IFMuZGFkb3MucG9udG9zLmZpbHRlcigocCkgPT4gUy5ldSAmJiBwLnVzZXJJZCA9PT0gUy5ldS5pZCkuc2xpY2UoMCwgNDApOwogICQoJyNwZXJmaWwtcG9udG9zJykuaW5uZXJIVE1MID0gbWV1cy5sZW5ndGggPyBgCiAgICA8dGFibGU+PHRoZWFkPjx0cj48dGg+UG9udG9zPC90aD48dGg+TW90aXZvPC90aD48dGg+UG9yPC90aD48dGg+UXVhbmRvPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAgJHttZXVzLm1hcCgocCkgPT4gYDx0cj4KICAgICAgPHRkPjxzdHJvbmcgc3R5bGU9ImNvbG9yOiR7cC5kZWx0YSA+IDAgPyAndmFyKC0tdmVyZGUpJyA6ICd2YXIoLS12ZXJtZWxobyknfSI+JHtwLmRlbHRhID4gMCA/ICcrJyA6ICcnfSR7cC5kZWx0YX08L3N0cm9uZz48L3RkPgogICAgICA8dGQ+JHtlc2NhcGVIdG1sKHAubW90aXZvKX08L3RkPjx0ZCBjbGFzcz0ibG9naW4tc3VhdmUiPkAke2VzY2FwZUh0bWwocC5wb3IpfTwvdGQ+CiAgICAgIDx0ZCBjbGFzcz0ibG9naW4tc3VhdmUiPiR7ZGF0YUJSKHAuZW0pfTwvdGQ+PC90cj5gKS5qb2luKCcnKX08L3Rib2R5PjwvdGFibGU+YAogICAgOiAnPGRpdiBjbGFzcz0idmF6aW8iPlZvY8OqIGFpbmRhIG7Do28gcmVjZWJldSBwb250b3MuPC9kaXY+JzsKfQoKJCgnI2Zvcm0tcG9udG9zJykuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgZXYucHJldmVudERlZmF1bHQoKTsKICBjb25zdCB1c2VySWQgPSAkKCcjcG9udG9zLXVzZXInKS52YWx1ZTsKICBpZiAoIXVzZXJJZCkgcmV0dXJuIGZsdXR1YW50ZSgnU2VsZWNpb25lIG8gcG9saWNpYWwuJywgJ2Vycm8nKTsKICB0cnkgewogICAgYXdhaXQgYXBpKCdQT1NUJywgJy9wb250b3MnLCB7IHVzZXJJZCwgZGVsdGE6IE51bWJlcigkKCcjcG9udG9zLWRlbHRhJykudmFsdWUpLCBtb3Rpdm86ICQoJyNwb250b3MtbW90aXZvJykudmFsdWUgfSk7CiAgICAkKCcjcG9udG9zLW1vdGl2bycpLnZhbHVlID0gJyc7CiAgICBhd2FpdCBjYXJyZWdhcigpOyBmbHV0dWFudGUoJ1BvbnRvcyBsYW7Dp2Fkb3MuJyk7CiAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9Cn0pOwoKLy8g4pSA4pSAIGNoYXQg4pSA4pSACgovLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgcHJvdmFzIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkApmdW5jdGlvbiBkdXJhY2FvRGUobWluKSB7CiAgaWYgKG1pbiA9PSBudWxsKSByZXR1cm4gJ+KAlCc7CiAgY29uc3QgaCA9IE1hdGguZmxvb3IobWluIC8gNjApLCBtID0gbWluICUgNjA7CiAgcmV0dXJuIChoID8gaCArICdoICcgOiAnJykgKyBtICsgJ21pbic7Cn0KZnVuY3Rpb24gYmFkZ2VFbnRyZWdhKGUpIHsKICBpZiAoIWUpIHJldHVybiAnPHNwYW4gY2xhc3M9ImJhZGdlIj5Ow6NvIGVudmlhZGE8L3NwYW4+JzsKICBpZiAoZS5zdGF0dXMgPT09ICdBcHJvdmFkYScpIHJldHVybiBgPHNwYW4gY2xhc3M9ImJhZGdlIHZlcmRlIj5BcHJvdmFkYSR7ZS5ub3RhICE9IG51bGwgPyAnIMK3ICcgKyBlLm5vdGEgOiAnJ308L3NwYW4+YDsKICBpZiAoZS5zdGF0dXMgPT09ICdSZXByb3ZhZGEnKSByZXR1cm4gYDxzcGFuIGNsYXNzPSJiYWRnZSB2ZXJtZWxobyI+UmVwcm92YWRhJHtlLm5vdGEgIT0gbnVsbCA/ICcgwrcgJyArIGUubm90YSA6ICcnfTwvc3Bhbj5gOwogIHJldHVybiAnPHNwYW4gY2xhc3M9ImJhZGdlIGFtYXJlbG8iPkFndWFyZGFuZG8gYXZhbGlhw6fDo288L3NwYW4+JzsKfQoKZnVuY3Rpb24gcmVuZGVyUHJvdmFzKCkgewogIGNvbnN0IGQgPSBTLmRhZG9zOwogIGNvbnN0IG1ldU5pdmVsID0gZC5tZXVOaXZlbDsKICBjb25zdCBwb2RlTGFuY2FyID0gbWV1Tml2ZWwgPj0gODA7CiAgY29uc3QgZXUgPSBTLmV1OwogIGNvbnN0IHByb3ZhcyA9IGQucHJvdmFzIHx8IFtdOwogIGNvbnN0IGVudHJlZ2FzID0gZC5lbnRyZWdhcyB8fCBbXTsKCiAgJCgnI2J0bi1hYnJpci1wcm92YScpLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsICFwb2RlTGFuY2FyKTsKICAkKCcjcHJvdmFzLWF2aXNvJykudGV4dENvbnRlbnQgPSBwb2RlTGFuY2FyCiAgICA/ICdWb2PDqiBwb2RlIGxhbsOnYXIgcHJvdmFzIGFxdWkuIFF1YW5kbyBhbGd1w6ltIGVudmlhciBhIHByb3ZhIGZlaXRhLCBlbGEgYXBhcmVjZSBuYSBsaXN0YSBkZSBiYWl4byBwYXJhIGF2YWxpYXIuJwogICAgOiAnQXMgcHJvdmFzIGxhbsOnYWRhcyBhcGFyZWNlbSBhcXVpLiBGYcOnYSBhIHN1YSwgZXNjcmV2YSBhcyByZXNwb3N0YXMgZSBlbnZpZSBwYXJhIGF2YWxpYcOnw6NvIGRvIGNvbWFuZG8uJzsKCiAgJCgnI2xpc3RhLXByb3ZhcycpLmlubmVySFRNTCA9IHByb3Zhcy5sZW5ndGggPyBgCiAgICA8dGFibGU+PHRoZWFkPjx0cj4KICAgICAgPHRoPlByb3ZhPC90aD48dGg+TGFuw6dhZGEgcG9yPC90aD48dGg+UHJhem88L3RoPjx0aD5NaW5oYSBzaXR1YcOnw6NvPC90aD48dGg+PC90aD4KICAgIDwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAke3Byb3Zhcy5tYXAoKHApID0+IHsKICAgICAgY29uc3QgbWluaGEgPSBlbnRyZWdhcy5maW5kKChlKSA9PiBlLnByb3ZhSWQgPT09IHAuaWQgJiYgZS51c2VySWQgPT09IGV1LmlkKTsKICAgICAgcmV0dXJuIGA8dHI+CiAgICAgICAgPHRkPjxzdHJvbmc+JHtlc2NhcGVIdG1sKHAudGl0dWxvKX08L3N0cm9uZz4KICAgICAgICAgICR7cC5kZXNjcmljYW8gPyBgPGRpdiBjbGFzcz0ibG9naW4tc3VhdmUiPiR7ZXNjYXBlSHRtbChwLmRlc2NyaWNhbykuc2xpY2UoMCwgMTYwKX08L2Rpdj5gIDogJyd9PC90ZD4KICAgICAgICA8dGQ+JHtlc2NhcGVIdG1sKHAuY3JpYWRvUG9yTm9tZSB8fCBwLmNyaWFkb1Bvcil9PGRpdiBjbGFzcz0ibG9naW4tc3VhdmUiPiR7ZGF0YUJSKHAuY3JpYWRvRW0pfTwvZGl2PjwvdGQ+CiAgICAgICAgPHRkPiR7cC5wcmF6byA/IGVzY2FwZUh0bWwocC5wcmF6bykgOiAn4oCUJ308L3RkPgogICAgICAgIDx0ZD4ke2JhZGdlRW50cmVnYShtaW5oYSl9PC90ZD4KICAgICAgICA8dGQ+PGRpdiBjbGFzcz0iYWNvZXMtbGluaGEiPgogICAgICAgICAgJHttaW5oYSA/IGA8YnV0dG9uIGNsYXNzPSJtaW5pIiBkYXRhLXZlci1lbnRyZWdhPSIke21pbmhhLmlkfSI+VmVyIGVudmlvPC9idXR0b24+YAogICAgICAgICAgICAgICAgICA6IGA8YnV0dG9uIGNsYXNzPSJtaW5pIiBkYXRhLWZhemVyPSIke3AuaWR9Ij5GYXplciBwcm92YTwvYnV0dG9uPmB9CiAgICAgICAgICAke3BvZGVMYW5jYXIgPyBgPGJ1dHRvbiBjbGFzcz0ibWluaSBwZXJpZ28iIGRhdGEtZXhjbHVpci1wcm92YT0iJHtwLmlkfSI+RXhjbHVpcjwvYnV0dG9uPmAgOiAnJ30KICAgICAgICA8L2Rpdj48L3RkPgogICAgICA8L3RyPmA7CiAgICB9KS5qb2luKCcnKX08L3Rib2R5PjwvdGFibGU+YAogICAgOiAnPGRpdiBjbGFzcz0idmF6aW8iPk5lbmh1bWEgcHJvdmEgbGFuw6dhZGEgYWluZGEuPC9kaXY+JzsKCiAgY29uc3QgcGFpbmVsRW50ID0gJCgnI3BhaW5lbC1lbnRyZWdhcycpOwogIHBhaW5lbEVudC5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCAhcG9kZUxhbmNhcik7CiAgaWYgKHBvZGVMYW5jYXIpIHsKICAgIGNvbnN0IGFndWFyZGFuZG8gPSBlbnRyZWdhcy5maWx0ZXIoKGUpID0+IGUuc3RhdHVzID09PSAnQWd1YXJkYW5kbycpOwogICAgY29uc3Qgb3V0cmFzID0gZW50cmVnYXMuZmlsdGVyKChlKSA9PiBlLnN0YXR1cyAhPT0gJ0FndWFyZGFuZG8nKTsKICAgIGNvbnN0IGxpbmhhID0gKGUpID0+IGA8dHI+CiAgICAgIDx0ZD48c3Ryb25nPiR7ZXNjYXBlSHRtbChlLm5vbWUpfTwvc3Ryb25nPjxkaXYgY2xhc3M9ImxvZ2luLXN1YXZlIj5AJHtlc2NhcGVIdG1sKGUubG9naW4pfSDCtyAke2VzY2FwZUh0bWwoZS5jYXJnbyl9PC9kaXY+PC90ZD4KICAgICAgPHRkPiR7ZXNjYXBlSHRtbChlLnByb3ZhVGl0dWxvKX08L3RkPgogICAgICA8dGQ+JHtkYXRhQlIoZS5lbSl9PC90ZD4KICAgICAgPHRkPiR7YmFkZ2VFbnRyZWdhKGUpfTwvdGQ+CiAgICAgIDx0ZD48ZGl2IGNsYXNzPSJhY29lcy1saW5oYSI+PGJ1dHRvbiBjbGFzcz0ibWluaSIgZGF0YS1hdmFsaWFyPSIke2UuaWR9Ij4ke2Uuc3RhdHVzID09PSAnQWd1YXJkYW5kbycgPyAnQXZhbGlhcicgOiAnUmVhdmFsaWFyJ308L2J1dHRvbj48L2Rpdj48L3RkPgogICAgPC90cj5gOwogICAgJCgnI2xpc3RhLWVudHJlZ2FzJykuaW5uZXJIVE1MID0gZW50cmVnYXMubGVuZ3RoID8gYAogICAgICA8dGFibGU+PHRoZWFkPjx0cj48dGg+TWVtYnJvPC90aD48dGg+UHJvdmE8L3RoPjx0aD5FbnZpYWRhIGVtPC90aD48dGg+U2l0dWHDp8OjbzwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPgogICAgICA8dGJvZHk+JHtbLi4uYWd1YXJkYW5kbywgLi4ub3V0cmFzXS5tYXAobGluaGEpLmpvaW4oJycpfTwvdGJvZHk+PC90YWJsZT5gCiAgICAgIDogJzxkaXYgY2xhc3M9InZhemlvIj5OaW5ndcOpbSBlbnZpb3UgcHJvdmEgYWluZGEuPC9kaXY+JzsKICB9CgogICQkKCdbZGF0YS1mYXplcl0nKS5mb3JFYWNoKChiKSA9PiBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gbW9kYWxGYXplclByb3ZhKGIuZGF0YXNldC5mYXplcikpKTsKICAkJCgnW2RhdGEtYXZhbGlhcl0nKS5mb3JFYWNoKChiKSA9PiBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gbW9kYWxBdmFsaWFyKGIuZGF0YXNldC5hdmFsaWFyKSkpOwogICQkKCdbZGF0YS12ZXItZW50cmVnYV0nKS5mb3JFYWNoKChiKSA9PiBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gbW9kYWxWZXJFbnRyZWdhKGIuZGF0YXNldC52ZXJFbnRyZWdhKSkpOwogICQkKCdbZGF0YS1leGNsdWlyLXByb3ZhXScpLmZvckVhY2goKGIpID0+IGIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7CiAgICBpZiAoIWNvbmZpcm0oJ0V4Y2x1aXIgZXN0YSBwcm92YSBlIHRvZGFzIGFzIGVudHJlZ2FzIGRlbGE/JykpIHJldHVybjsKICAgIHRyeSB7IGF3YWl0IGFwaSgnREVMRVRFJywgJy9wcm92YXMvJyArIGIuZGF0YXNldC5leGNsdWlyUHJvdmEpOyBhd2FpdCBjYXJyZWdhcigpOyBmbHV0dWFudGUoJ1Byb3ZhIGV4Y2x1w61kYS4nKTsgfQogICAgY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQogIH0pKTsKfQoKZnVuY3Rpb24gbW9kYWxOb3ZhUHJvdmEoKSB7CiAgYWJyaXJNb2RhbCgnTGFuw6dhciBwcm92YScsIGAKICAgIDxmb3JtIGlkPSJmb3JtLXByb3ZhIj4KICAgICAgPGxhYmVsPlTDrXR1bG88aW5wdXQgdHlwZT0idGV4dCIgaWQ9InByLXRpdHVsbyIgcmVxdWlyZWQgbWF4bGVuZ3RoPSIxMjAiIHBsYWNlaG9sZGVyPSJFeC46IFByb3ZhIGRlIFTDoXRpY28g4oCUIDHCqiBldGFwYSI+PC9sYWJlbD4KICAgICAgPGxhYmVsPkRlc2NyacOnw6NvIChvcGNpb25hbCk8aW5wdXQgdHlwZT0idGV4dCIgaWQ9InByLWRlc2MiIG1heGxlbmd0aD0iMzAwIiBwbGFjZWhvbGRlcj0iRXguOiBQcm92YSBwcsOhdGljYSBkZSBhYm9yZGFnZW0iPjwvbGFiZWw+CiAgICAgIDxsYWJlbD5QZXJndW50YXMgLyBpbnN0cnXDp8O1ZXM8dGV4dGFyZWEgaWQ9InByLXBlcmd1bnRhcyIgcm93cz0iOCIgbWF4bGVuZ3RoPSI2MDAwIiBwbGFjZWhvbGRlcj0iMSkgLi4uJiMxMDsyKSAuLi4mIzEwOzMpIC4uLiI+PC90ZXh0YXJlYT48L2xhYmVsPgogICAgICA8bGFiZWw+UHJhem8gKG9wY2lvbmFsKTxpbnB1dCB0eXBlPSJkYXRlIiBpZD0icHItcHJhem8iPjwvbGFiZWw+CiAgICAgIDxkaXYgY2xhc3M9ImxpbmhhLWJvdG9lcyI+PGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIiB0eXBlPSJzdWJtaXQiPkxhbsOnYXIgcGFyYSBvIGVmZXRpdm88L2J1dHRvbj48L2Rpdj4KICAgIDwvZm9ybT5gKTsKICAkKCcjZm9ybS1wcm92YScpLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGFzeW5jIChldikgPT4gewogICAgZXYucHJldmVudERlZmF1bHQoKTsKICAgIHRyeSB7CiAgICAgIGF3YWl0IGFwaSgnUE9TVCcsICcvcHJvdmFzJywgewogICAgICAgIHRpdHVsbzogJCgnI3ByLXRpdHVsbycpLnZhbHVlLAogICAgICAgIGRlc2NyaWNhbzogJCgnI3ByLWRlc2MnKS52YWx1ZSwKICAgICAgICBwZXJndW50YXM6ICQoJyNwci1wZXJndW50YXMnKS52YWx1ZSwKICAgICAgICBwcmF6bzogJCgnI3ByLXByYXpvJykudmFsdWUgfHwgbnVsbCwKICAgICAgfSk7CiAgICAgIGZlY2hhck1vZGFsKCk7IGF3YWl0IGNhcnJlZ2FyKCk7IGZsdXR1YW50ZSgnUHJvdmEgbGFuw6dhZGEgcGFyYSBvIGVmZXRpdm8uJyk7CiAgICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICB9KTsKfQoKZnVuY3Rpb24gbW9kYWxGYXplclByb3ZhKGlkKSB7CiAgY29uc3QgcCA9IChTLmRhZG9zLnByb3ZhcyB8fCBbXSkuZmluZCgoeCkgPT4geC5pZCA9PT0gaWQpOwogIGlmICghcCkgcmV0dXJuOwogIGFicmlyTW9kYWwocC50aXR1bG8sIGAKICAgIDxkaXYgY2xhc3M9InByb3ZhLXRleHRvIj4KICAgICAgJHtwLmRlc2NyaWNhbyA/IGA8cCBjbGFzcz0idGV4dG8tYWp1ZGEiPiR7ZXNjYXBlSHRtbChwLmRlc2NyaWNhbyl9PC9wPmAgOiAnJ30KICAgICAgPGRpdiBjbGFzcz0icmVncmFzLXRleHRvIj4ke2VzY2FwZUh0bWwocC5wZXJndW50YXMgfHwgJ1NlbSBwZXJndW50YXMgZXNjcml0YXMuIFJlc3BvbmRhIGNvbmZvcm1lIG8gcXVlIGZvaSBwZWRpZG8gbm8gY2hhdC9jb21hbmRvLicpLnJlcGxhY2UoL1xuL2csICc8YnI+Jyl9PC9kaXY+CiAgICA8L2Rpdj4KICAgIDxmb3JtIGlkPSJmb3JtLWVudHJlZ2EiPgogICAgICA8bGFiZWw+U3VhcyByZXNwb3N0YXM8dGV4dGFyZWEgaWQ9ImVuLXJlc3Bvc3RhcyIgcm93cz0iMTAiIHJlcXVpcmVkIG1heGxlbmd0aD0iMTAwMDAiIHBsYWNlaG9sZGVyPSJSZXNwb25kYSBhcXVpLCBudW1lcmFuZG8gaWd1YWwgw6BzIHBlcmd1bnRhcy4uLiI+PC90ZXh0YXJlYT48L2xhYmVsPgogICAgICA8ZGl2IGNsYXNzPSJsaW5oYS1ib3RvZXMiPjxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSIgdHlwZT0ic3VibWl0Ij5FbnZpYXIgcHJvdmEgZmVpdGE8L2J1dHRvbj48L2Rpdj4KICAgIDwvZm9ybT5gKTsKICAkKCcjZm9ybS1lbnRyZWdhJykuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgICBldi5wcmV2ZW50RGVmYXVsdCgpOwogICAgdHJ5IHsKICAgICAgYXdhaXQgYXBpKCdQT1NUJywgJy9wcm92YXMvJyArIHAuaWQgKyAnL2VudHJlZ2FyJywgeyByZXNwb3N0YXM6ICQoJyNlbi1yZXNwb3N0YXMnKS52YWx1ZSB9KTsKICAgICAgZmVjaGFyTW9kYWwoKTsgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKCdQcm92YSBlbnZpYWRhIHBhcmEgYXZhbGlhw6fDo28uJyk7CiAgICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICB9KTsKfQoKZnVuY3Rpb24gbW9kYWxWZXJFbnRyZWdhKGlkKSB7CiAgY29uc3QgZSA9IChTLmRhZG9zLmVudHJlZ2FzIHx8IFtdKS5maW5kKCh4KSA9PiB4LmlkID09PSBpZCk7CiAgaWYgKCFlKSByZXR1cm47CiAgYWJyaXJNb2RhbCgnTWluaGEgcHJvdmE6ICcgKyBlLnByb3ZhVGl0dWxvLCBgCiAgICA8cCBjbGFzcz0idGV4dG8tYWp1ZGEiPkVudmlhZGEgZW0gJHtkYXRhQlIoZS5lbSl9IOKAlCAke2JhZGdlRW50cmVnYShlKX08L3A+CiAgICA8ZGl2IGNsYXNzPSJyZWdyYXMtdGV4dG8iPiR7ZXNjYXBlSHRtbChlLnJlc3Bvc3RhcykucmVwbGFjZSgvXG4vZywgJzxicj4nKX08L2Rpdj4KICAgICR7ZS5mZWVkYmFjayA/IGA8cCBjbGFzcz0idGV4dG8tYWp1ZGEiIHN0eWxlPSJtYXJnaW4tdG9wOjE0cHgiPjxzdHJvbmc+Q29tZW50w6FyaW8gZG8gY29tYW5kbzo8L3N0cm9uZz4gJHtlc2NhcGVIdG1sKGUuZmVlZGJhY2spfTwvcD5gIDogJyd9YCk7Cn0KCmZ1bmN0aW9uIG1vZGFsQXZhbGlhcihpZCkgewogIGNvbnN0IGUgPSAoUy5kYWRvcy5lbnRyZWdhcyB8fCBbXSkuZmluZCgoeCkgPT4geC5pZCA9PT0gaWQpOwogIGlmICghZSkgcmV0dXJuOwogIGFicmlyTW9kYWwoJ0F2YWxpYXIgcHJvdmEnLCBgCiAgICA8cCBjbGFzcz0idGV4dG8tYWp1ZGEiPjxzdHJvbmc+JHtlc2NhcGVIdG1sKGUubm9tZSl9PC9zdHJvbmc+IChAJHtlc2NhcGVIdG1sKGUubG9naW4pfSkg4oCUICR7ZXNjYXBlSHRtbChlLmNhcmdvKX08YnI+CiAgICAgICR7ZXNjYXBlSHRtbChlLnByb3ZhVGl0dWxvKX0gwrcgZW52aWFkYSBlbSAke2RhdGFCUihlLmVtKX08L3A+CiAgICA8ZGl2IGNsYXNzPSJyZWdyYXMtdGV4dG8iIHN0eWxlPSJtYXgtaGVpZ2h0OjI0MHB4O292ZXJmbG93OmF1dG87bWFyZ2luOjEycHggMCI+JHtlc2NhcGVIdG1sKGUucmVzcG9zdGFzKS5yZXBsYWNlKC9cbi9nLCAnPGJyPicpfTwvZGl2PgogICAgPGZvcm0gaWQ9ImZvcm0tYXZhbGlhciI+CiAgICAgIDxsYWJlbD5SZXN1bHRhZG88c2VsZWN0IGlkPSJhdi1zdGF0dXMiPgogICAgICAgIDxvcHRpb24gJHtlLnN0YXR1cyA9PT0gJ0Fwcm92YWRhJyA/ICdzZWxlY3RlZCcgOiAnJ30+QXByb3ZhZGE8L29wdGlvbj4KICAgICAgICA8b3B0aW9uICR7ZS5zdGF0dXMgPT09ICdSZXByb3ZhZGEnID8gJ3NlbGVjdGVkJyA6ICcnfT5SZXByb3ZhZGE8L29wdGlvbj4KICAgICAgPC9zZWxlY3Q+PC9sYWJlbD4KICAgICAgPGxhYmVsPk5vdGEgKDAgYSAxMCwgb3BjaW9uYWwpPGlucHV0IHR5cGU9Im51bWJlciIgaWQ9ImF2LW5vdGEiIG1pbj0iMCIgbWF4PSIxMCIgc3RlcD0iMC41IiB2YWx1ZT0iJHtlLm5vdGEgIT0gbnVsbCA/IGUubm90YSA6IDEwfSI+PC9sYWJlbD4KICAgICAgPGxhYmVsPkNvbWVudMOhcmlvIChvcGNpb25hbCk8aW5wdXQgdHlwZT0idGV4dCIgaWQ9ImF2LWZlZWRiYWNrIiBtYXhsZW5ndGg9IjMwMCIgdmFsdWU9IiR7ZXNjYXBlSHRtbChlLmZlZWRiYWNrIHx8ICcnKX0iPjwvbGFiZWw+CiAgICAgIDxkaXYgY2xhc3M9ImxpbmhhLWJvdG9lcyI+PGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIiB0eXBlPSJzdWJtaXQiPlNhbHZhciBhdmFsaWHDp8OjbzwvYnV0dG9uPjwvZGl2PgogICAgPC9mb3JtPmApOwogICQoJyNmb3JtLWF2YWxpYXInKS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBhc3luYyAoZXYpID0+IHsKICAgIGV2LnByZXZlbnREZWZhdWx0KCk7CiAgICB0cnkgewogICAgICBhd2FpdCBhcGkoJ1BVVCcsICcvZW50cmVnYXMvJyArIGUuaWQsIHsKICAgICAgICBzdGF0dXM6ICQoJyNhdi1zdGF0dXMnKS52YWx1ZSwKICAgICAgICBub3RhOiAkKCcjYXYtbm90YScpLnZhbHVlLAogICAgICAgIGZlZWRiYWNrOiAkKCcjYXYtZmVlZGJhY2snKS52YWx1ZSwKICAgICAgfSk7CiAgICAgIGZlY2hhck1vZGFsKCk7IGF3YWl0IGNhcnJlZ2FyKCk7IGZsdXR1YW50ZSgnQXZhbGlhw6fDo28gc2FsdmEuJyk7CiAgICB9IGNhdGNoIChlcnIpIHsgZmx1dHVhbnRlKGVyci5tZXNzYWdlLCAnZXJybycpOyB9CiAgfSk7Cn0KCi8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBjw7NkaWdvcyBRIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkApmdW5jdGlvbiBzZW1BY2VudG8odCkgewogIHJldHVybiBTdHJpbmcodCA9PSBudWxsID8gJycgOiB0KS5ub3JtYWxpemUoJ05GRCcpLnJlcGxhY2UoL1tcdTAzMDAtXHUwMzZmXS9nLCAnJykudG9Mb3dlckNhc2UoKTsKfQoKZnVuY3Rpb24gcmVuZGVyQ29kaWdvc1EoKSB7CiAgY29uc3QgbGlzdGEgPSAoUy5kYWRvcyAmJiBTLmRhZG9zLmNvZGlnb3NRKSB8fCBbXTsKICBjb25zdCBldSA9IFMuZXUgfHwge307CiAgY29uc3QgcG9kZUVkaXRhciA9IChTLmRhZG9zICYmIFMuZGFkb3MubWV1Tml2ZWwgfHwgMCkgPj0gOTA7CgogIGNvbnN0IGFjb2VzID0gJCgnI2NxLWFjb2VzJyk7CiAgaWYgKGFjb2VzKSB7CiAgICBhY29lcy5pbm5lckhUTUwgPSBwb2RlRWRpdGFyCiAgICAgID8gJzxidXR0b24gY2xhc3M9ImJ0bi1zZWN1bmRhcmlvIHNtIiBpZD0iYnRuLWNxLWVkaXRhciI+RWRpdGFyIGxpc3RhPC9idXR0b24+PGJ1dHRvbiBjbGFzcz0iYnRuLXNlY3VuZGFyaW8gc20iIGlkPSJidG4tY3EtcGFkcmFvIj5SZXN0YXVyYXIgcGFkcsOjbzwvYnV0dG9uPicKICAgICAgOiBgPHNwYW4gY2xhc3M9ImJhZGdlIj4ke2xpc3RhLmxlbmd0aH0gY8OzZGlnb3M8L3NwYW4+YDsKICAgIGNvbnN0IGJlID0gJCgnI2J0bi1jcS1lZGl0YXInKTsKICAgIGlmIChiZSkgYmUuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBtb2RhbENvZGlnb3NRKTsKICAgIGNvbnN0IGJwID0gJCgnI2J0bi1jcS1wYWRyYW8nKTsKICAgIGlmIChicCkgYnAuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7CiAgICAgIGlmICghY29uZmlybSgnVm9sdGFyIGEgbGlzdGEgcGFkcsOjbyBkb3MgQ8OzZGlnb3MgUT8gTyBxdWUgdm9jw6ogZWRpdG91IG5lc3NhIGxpc3RhIHNlcsOhIHN1YnN0aXR1w61kby4nKSkgcmV0dXJuOwogICAgICB0cnkgeyBhd2FpdCBhcGkoJ1BPU1QnLCAnL2NvZGlnb3NxL3BhZHJhbycpOyBhd2FpdCBjYXJyZWdhcigpOyBmbHV0dWFudGUoJ0xpc3RhIHBhZHLDo28gcmVzdGF1cmFkYS4nKTsgfQogICAgICBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9CiAgICB9KTsKICB9CgogIGNvbnN0IGdydXBvcyA9IEFycmF5LmZyb20obmV3IFNldChsaXN0YS5tYXAoKGMpID0+IGMuZ3J1cG8gfHwgJ091dHJvcycpKSkuc29ydCgpOwogIGNvbnN0IHNlbCA9ICQoJyNjcS1ncnVwbycpOwogIGlmIChzZWwpIHsKICAgIGNvbnN0IGF0dWFsID0gUy5jcUdydXBvIHx8ICcnOwogICAgY29uc3QgaWd1YWwgPSBzZWwub3B0aW9ucy5sZW5ndGggPT09IGdydXBvcy5sZW5ndGggKyAxICYmIGdydXBvcy5ldmVyeSgoZywgaSkgPT4gc2VsLm9wdGlvbnNbaSArIDFdICYmIHNlbC5vcHRpb25zW2kgKyAxXS52YWx1ZSA9PT0gZyk7CiAgICBpZiAoIWlndWFsKSB7CiAgICAgIHNlbC5pbm5lckhUTUwgPSAnPG9wdGlvbiB2YWx1ZT0iIj5Ub2Rvczwvb3B0aW9uPicgKyBncnVwb3MubWFwKChnKSA9PiBgPG9wdGlvbiAke2F0dWFsID09PSBnID8gJ3NlbGVjdGVkJyA6ICcnfT4ke2VzY2FwZUh0bWwoZyl9PC9vcHRpb24+YCkuam9pbignJyk7CiAgICB9CiAgICBpZiAoc2VsLnZhbHVlICE9PSBhdHVhbCkgc2VsLnZhbHVlID0gYXR1YWw7CiAgICBpZiAoIXNlbC5kYXRhc2V0LmxpZ2FkbykgewogICAgICBzZWwuZGF0YXNldC5saWdhZG8gPSAnMSc7CiAgICAgIHNlbC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7IFMuY3FHcnVwbyA9IHNlbC52YWx1ZTsgcmVuZGVyQ29kaWdvc1EoKTsgfSk7CiAgICB9CiAgfQoKICBjb25zdCBidXNjYSA9ICQoJyNjcS1idXNjYScpOwogIGlmIChidXNjYSkgewogICAgaWYgKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgIT09IGJ1c2NhICYmIGJ1c2NhLnZhbHVlICE9PSAoUy5jcUJ1c2NhIHx8ICcnKSkgYnVzY2EudmFsdWUgPSBTLmNxQnVzY2EgfHwgJyc7CiAgICBpZiAoIWJ1c2NhLmRhdGFzZXQubGlnYWRvKSB7CiAgICAgIGJ1c2NhLmRhdGFzZXQubGlnYWRvID0gJzEnOwogICAgICBidXNjYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsgUy5jcUJ1c2NhID0gYnVzY2EudmFsdWU7IHJlbmRlckxpc3RhQ29kaWdvc1EoKTsgfSk7CiAgICB9CiAgfQoKICByZW5kZXJMaXN0YUNvZGlnb3NRKCk7Cn0KCmZ1bmN0aW9uIHJlbmRlckxpc3RhQ29kaWdvc1EoKSB7CiAgY29uc3QgYm94ID0gJCgnI2xpc3RhLWNvZGlnb3NxJyk7CiAgaWYgKCFib3gpIHJldHVybjsKICBjb25zdCB0b2RvcyA9IChTLmRhZG9zICYmIFMuZGFkb3MuY29kaWdvc1EpIHx8IFtdOwogIGNvbnN0IHRlcm1vID0gc2VtQWNlbnRvKFMuY3FCdXNjYSB8fCAnJykudHJpbSgpOwogIGNvbnN0IGdydXBvID0gUy5jcUdydXBvIHx8ICcnOwoKICBjb25zdCBmaWx0cmFkb3MgPSB0b2Rvcy5maWx0ZXIoKGMpID0+IHsKICAgIGlmIChncnVwbyAmJiAoYy5ncnVwbyB8fCAnT3V0cm9zJykgIT09IGdydXBvKSByZXR1cm4gZmFsc2U7CiAgICBpZiAoIXRlcm1vKSByZXR1cm4gdHJ1ZTsKICAgIHJldHVybiBzZW1BY2VudG8oYy5jb2RpZ28pLmluY2x1ZGVzKHRlcm1vKSB8fCBzZW1BY2VudG8oYy5zaWduaWZpY2FkbykuaW5jbHVkZXModGVybW8pIHx8IHNlbUFjZW50byhjLmdydXBvKS5pbmNsdWRlcyh0ZXJtbyk7CiAgfSk7CgogIGlmICghZmlsdHJhZG9zLmxlbmd0aCkgewogICAgYm94LmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPSJ2YXppbyI+JHt0b2Rvcy5sZW5ndGggPyAnTmVuaHVtIGPDs2RpZ28gZW5jb250cmFkbyBwYXJhIGVzc2EgYnVzY2EuJyA6ICdOZW5odW0gY8OzZGlnbyBjYWRhc3RyYWRvIGFpbmRhLid9PC9kaXY+YDsKICAgIHJldHVybjsKICB9CgogIGNvbnN0IGdydXBvcyA9IHt9OwogIGZpbHRyYWRvcy5mb3JFYWNoKChjKSA9PiB7CiAgICBjb25zdCBnID0gYy5ncnVwbyB8fCAnT3V0cm9zJzsKICAgIGlmICghZ3J1cG9zW2ddKSBncnVwb3NbZ10gPSBbXTsKICAgIGdydXBvc1tnXS5wdXNoKGMpOwogIH0pOwoKICBib3guaW5uZXJIVE1MID0gT2JqZWN0LmtleXMoZ3J1cG9zKS5zb3J0KCkubWFwKChnKSA9PiBgCiAgICA8ZGl2IGNsYXNzPSJjcS1ibG9jbyI+CiAgICAgIDxoNCBjbGFzcz0iY3EtZ3J1cG8tdGl0dWxvIj4ke2VzY2FwZUh0bWwoZyl9IDxzcGFuPiR7Z3J1cG9zW2ddLmxlbmd0aH08L3NwYW4+PC9oND4KICAgICAgPGRpdiBjbGFzcz0iY3EtZ3JhZGUiPgogICAgICAgICR7Z3J1cG9zW2ddLnNvcnQoKGEsIGIpID0+IGEuY29kaWdvLmxvY2FsZUNvbXBhcmUoYi5jb2RpZ28pKS5tYXAoKGMpID0+IGAKICAgICAgICAgIDxkaXYgY2xhc3M9ImNxLWNhcmQiPgogICAgICAgICAgICA8c3BhbiBjbGFzcz0iY3EtY29kaWdvIj4ke2VzY2FwZUh0bWwoYy5jb2RpZ28pfTwvc3Bhbj4KICAgICAgICAgICAgPHNwYW4gY2xhc3M9ImNxLXNpZ25pZmljYWRvIj4ke2VzY2FwZUh0bWwoYy5zaWduaWZpY2Fkbyl9PC9zcGFuPgogICAgICAgICAgPC9kaXY+YCkuam9pbignJyl9CiAgICAgIDwvZGl2PgogICAgPC9kaXY+YCkuam9pbignJyk7Cn0KCmZ1bmN0aW9uIG1vZGFsQ29kaWdvc1EoKSB7CiAgY29uc3QgbGlzdGEgPSAoUy5kYWRvcyAmJiBTLmRhZG9zLmNvZGlnb3NRKSB8fCBbXTsKICBjb25zdCB0ZXh0byA9IGxpc3RhLm1hcCgoYykgPT4gYCR7Yy5jb2RpZ299IHwgJHtjLnNpZ25pZmljYWRvfSB8ICR7Yy5ncnVwbyB8fCAnT3V0cm9zJ31gKS5qb2luKCdcbicpOwogIGFicmlyTW9kYWwoJ0VkaXRhciBDw7NkaWdvcyBRJywgYAogICAgPHAgY2xhc3M9InRleHRvLWFqdWRhIj5VbSBjw7NkaWdvIHBvciBsaW5oYSwgbm8gZm9ybWF0byA8c3Ryb25nPkPDk0RJR08gfCBzaWduaWZpY2FkbyB8IGdydXBvPC9zdHJvbmc+LiBPIGdydXBvIMOpIG9wY2lvbmFsIChzZSBkZWl4YXIgZW0gYnJhbmNvIHZhaSBwYXJhICJPdXRyb3MiKS4gQXBhZ2FyIHVtYSBsaW5oYSBhcGFnYSBvIGPDs2RpZ28uPC9wPgogICAgPGZvcm0gaWQ9ImZvcm0tY3EiPgogICAgICA8bGFiZWw+TGlzdGEgZGUgY8OzZGlnb3MKICAgICAgICA8dGV4dGFyZWEgaWQ9ImNxLXRleHRvIiByb3dzPSIxNiIgc3BlbGxjaGVjaz0iZmFsc2UiIHN0eWxlPSJmb250LWZhbWlseTp1aS1tb25vc3BhY2UsTWVubG8sbW9ub3NwYWNlO2ZvbnQtc2l6ZToxMi41cHgiPiR7ZXNjYXBlSHRtbCh0ZXh0byl9PC90ZXh0YXJlYT4KICAgICAgPC9sYWJlbD4KICAgICAgPGRpdiBjbGFzcz0ibG9naW4tc3VhdmUiIGlkPSJjcS1jb250YWRvciI+JHtsaXN0YS5sZW5ndGh9IGPDs2RpZ29zPC9kaXY+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyIgdHlwZT0ic3VibWl0Ij5TYWx2YXIgY8OzZGlnb3M8L2J1dHRvbj4KICAgIDwvZm9ybT5gKTsKCiAgY29uc3QgYXJlYSA9ICQoJyNjcS10ZXh0bycpOwogIGNvbnN0IGNvbnRhZG9yID0gJCgnI2NxLWNvbnRhZG9yJyk7CiAgY29uc3QgY29udGFyID0gKCkgPT4gewogICAgY29uc3QgbiA9IGxlckNvZGlnb3NEb1RleHRvKGFyZWEudmFsdWUpLmxlbmd0aDsKICAgIGlmIChjb250YWRvcikgY29udGFkb3IudGV4dENvbnRlbnQgPSBuICsgKG4gPT09IDEgPyAnIGPDs2RpZ28nIDogJyBjw7NkaWdvcycpOwogIH07CiAgYXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGNvbnRhcik7CiAgY29udGFyKCk7CgogICQoJyNmb3JtLWNxJykuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgICBldi5wcmV2ZW50RGVmYXVsdCgpOwogICAgY29uc3QgY29kaWdvcyA9IGxlckNvZGlnb3NEb1RleHRvKGFyZWEudmFsdWUpOwogICAgaWYgKCFjb2RpZ29zLmxlbmd0aCkgcmV0dXJuIGZsdXR1YW50ZSgnQSBsaXN0YSBlc3TDoSB2YXppYS4gRXNjcmV2YSBwZWxvIG1lbm9zIHVtIGPDs2RpZ28uJywgJ2Vycm8nKTsKICAgIHRyeSB7CiAgICAgIGF3YWl0IGFwaSgnUFVUJywgJy9jb2RpZ29zcScsIHsgY29kaWdvcyB9KTsKICAgICAgZmVjaGFyTW9kYWwoKTsgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKGNvZGlnb3MubGVuZ3RoICsgJyBjw7NkaWdvcyBzYWx2b3MuJyk7CiAgICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICB9KTsKfQoKZnVuY3Rpb24gbGVyQ29kaWdvc0RvVGV4dG8odHh0KSB7CiAgcmV0dXJuIFN0cmluZyh0eHQgfHwgJycpLnNwbGl0KC9ccj9cbi8pLm1hcCgobGluaGEpID0+IHsKICAgIGNvbnN0IHQgPSBsaW5oYS50cmltKCk7CiAgICBpZiAoIXQgfHwgdC5zdGFydHNXaXRoKCcjJykgfHwgdC5zdGFydHNXaXRoKCcvLycpKSByZXR1cm4gbnVsbDsKICAgIGNvbnN0IHBhcnRlcyA9IHQuc3BsaXQoJ3wnKS5tYXAoKHgpID0+IHgudHJpbSgpKTsKICAgIGlmIChwYXJ0ZXMubGVuZ3RoIDwgMikgcmV0dXJuIG51bGw7CiAgICBjb25zdCBjb2RpZ28gPSBwYXJ0ZXNbMF0udG9VcHBlckNhc2UoKS5yZXBsYWNlKC9bXkEtWjAtOVwtXS9nLCAnJyk7CiAgICBjb25zdCBzaWduaWZpY2FkbyA9IHBhcnRlcy5zbGljZSgxLCBwYXJ0ZXMubGVuZ3RoIC0gMSkuam9pbignIHwgJykudHJpbSgpIHx8IChwYXJ0ZXMubGVuZ3RoID09PSAyID8gcGFydGVzWzFdIDogJycpOwogICAgY29uc3QgZ3J1cG8gPSBwYXJ0ZXMubGVuZ3RoID49IDMgPyAocGFydGVzW3BhcnRlcy5sZW5ndGggLSAxXSB8fCAnT3V0cm9zJykgOiAnT3V0cm9zJzsKICAgIGlmICghY29kaWdvIHx8ICFzaWduaWZpY2FkbykgcmV0dXJuIG51bGw7CiAgICByZXR1cm4geyBjb2RpZ28sIHNpZ25pZmljYWRvLCBncnVwbyB9OwogIH0pLmZpbHRlcihCb29sZWFuKTsKfQoKLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIGJhdGUgcG9udG8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQCi8vIHRlbXBvIGVmZXRpdmFtZW50ZSB0cmFiYWxoYWRvIChkZXNjb250YSBhcyBwYXVzYXMpCmZ1bmN0aW9uIG1zVHJhYmFsaG9Qb250byhyZWcpIHsKICBpZiAoIXJlZyB8fCAhcmVnLmVudHJhZGEpIHJldHVybiAwOwogIGNvbnN0IGZpbSA9IHJlZy5zYWlkYSA/IG5ldyBEYXRlKHJlZy5zYWlkYSkuZ2V0VGltZSgpIDogRGF0ZS5ub3coKTsKICBsZXQgbXMgPSBmaW0gLSBuZXcgRGF0ZShyZWcuZW50cmFkYSkuZ2V0VGltZSgpOwogICgocmVnICYmIHJlZy5wYXVzYXMpIHx8IFtdKS5mb3JFYWNoKChwKSA9PiB7CiAgICBjb25zdCBkZSA9IG5ldyBEYXRlKHAuZGUpLmdldFRpbWUoKTsKICAgIGlmICghaXNGaW5pdGUoZGUpKSByZXR1cm47CiAgICBjb25zdCBhdGUgPSBwLmF0ZSA/IG5ldyBEYXRlKHAuYXRlKS5nZXRUaW1lKCkgOiBEYXRlLm5vdygpOwogICAgbXMgLT0gTWF0aC5tYXgoMCwgYXRlIC0gZGUpOwogIH0pOwogIHJldHVybiBNYXRoLm1heCgwLCBtcyk7Cn0KZnVuY3Rpb24gbXNQYXVzYVBvbnRvKHJlZykgewogIGxldCBtcyA9IDA7CiAgKChyZWcgJiYgcmVnLnBhdXNhcykgfHwgW10pLmZvckVhY2goKHApID0+IHsKICAgIGNvbnN0IGRlID0gbmV3IERhdGUocC5kZSkuZ2V0VGltZSgpOwogICAgaWYgKCFpc0Zpbml0ZShkZSkpIHJldHVybjsKICAgIGNvbnN0IGF0ZSA9IHAuYXRlID8gbmV3IERhdGUocC5hdGUpLmdldFRpbWUoKSA6IERhdGUubm93KCk7CiAgICBtcyArPSBNYXRoLm1heCgwLCBhdGUgLSBkZSk7CiAgfSk7CiAgcmV0dXJuIG1zOwp9CmZ1bmN0aW9uIGNyb25vbWV0cm8obXMpIHsKICBjb25zdCB0b3RhbCA9IE1hdGguZmxvb3IoTWF0aC5tYXgoMCwgbXMpIC8gMTAwMCk7CiAgY29uc3QgaCA9IE1hdGguZmxvb3IodG90YWwgLyAzNjAwKTsKICBjb25zdCBtID0gTWF0aC5mbG9vcigodG90YWwgJSAzNjAwKSAvIDYwKTsKICBjb25zdCBzZWcgPSB0b3RhbCAlIDYwOwogIHJldHVybiAoaCA/IGggKyAnaCAnIDogJycpICsgKGggPyBTdHJpbmcobSkucGFkU3RhcnQoMiwgJzAnKSA6IG0pICsgJ21pbiAnICsgU3RyaW5nKHNlZykucGFkU3RhcnQoMiwgJzAnKSArICdzJzsKfQoKYXN5bmMgZnVuY3Rpb24gYWNhb1BvbnRvKGFjYW8pIHsKICB0cnkgewogICAgY29uc3QgciA9IGF3YWl0IGFwaSgnUE9TVCcsICcvcG9udG8nLCB7IGFjYW8gfSk7CiAgICBhd2FpdCBjYXJyZWdhcigpOwogICAgZmx1dHVhbnRlKChyICYmIHIubWVuc2FnZW0pIHx8ICdQb250byBhdHVhbGl6YWRvLicpOwogIH0gY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQp9CgpmdW5jdGlvbiByZW5kZXJQb250bygpIHsKICBjb25zdCBkID0gUy5kYWRvczsKICBjb25zdCBldSA9IFMuZXU7CiAgY29uc3QgdG9kb3MgPSBkLnBvbnRvIHx8IFtdOwogIGNvbnN0IG1ldXMgPSB0b2Rvcy5maWx0ZXIoKHApID0+IGV1ICYmIHAudXNlcklkID09PSBldS5pZCk7CiAgY29uc3QgYWJlcnRvID0gbWV1cy5maW5kKChwKSA9PiAhcC5zYWlkYSkgfHwgbnVsbDsKICBTLnBvbnRvQWJlcnRvID0gYWJlcnRvOwoKICBpZiAoYWJlcnRvKSB7CiAgICBjb25zdCBwYXVzYWRvID0gISFhYmVydG8ucGF1c2Fkb0VtOwogICAgY29uc3QgcGF1c2FNaW4gPSBNYXRoLnJvdW5kKG1zUGF1c2FQb250byhhYmVydG8pIC8gNjAwMDApOwogICAgJCgnI3BvbnRvLXN0YXR1cycpLmlubmVySFRNTCA9IGAKICAgICAgPGRpdiBjbGFzcz0icG9udG8tY2FyZCAke3BhdXNhZG8gPyAncGF1c2FkbycgOiAnZW0tc2Vydmljbyd9Ij4KICAgICAgICA8ZGl2IGNsYXNzPSJwb250by1yb3R1bG8iPiR7cGF1c2FkbyA/ICdQQVVTQURPJyA6ICdFTSBTRVJWScOHTyd9PC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0icG9udG8taG9yYSI+RW50cmFkYTogPHN0cm9uZz4ke2RhdGFCUihhYmVydG8uZW50cmFkYSl9PC9zdHJvbmc+PC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0icG9udG8taG9yYSI+VGVtcG8gdHJhYmFsaGFkbzogPHN0cm9uZyBpZD0icG9udG8tdGVtcG8tdml2byI+JHtjcm9ub21ldHJvKG1zVHJhYmFsaG9Qb250byhhYmVydG8pKX08L3N0cm9uZz48L2Rpdj4KICAgICAgICAke3BhdXNhZG8gPyBgPGRpdiBjbGFzcz0icG9udG8taG9yYSI+UGF1c2FkbyBkZXNkZTogPHN0cm9uZz4ke2RhdGFCUihhYmVydG8ucGF1c2Fkb0VtKX08L3N0cm9uZz48L2Rpdj5gIDogJyd9CiAgICAgICAgJHtwYXVzYU1pbiA/IGA8ZGl2IGNsYXNzPSJsb2dpbi1zdWF2ZSI+VG90YWwgZGUgcGF1c2FzOiAke2R1cmFjYW9EZShwYXVzYU1pbil9PC9kaXY+YCA6ICcnfQogICAgICAgIDxkaXYgY2xhc3M9ImxvZ2luLXN1YXZlIj4ke3BhdXNhZG8gPyAnTyBjcm9uw7RtZXRybyBlc3TDoSBwYXJhZG8uIENsaXF1ZSBlbSAiRGVzcGF1c2FyIiBxdWFuZG8gdm9sdGFyIGFvIHNlcnZpw6dvLicgOiAnUG9udG8gYWJlcnRvLiBVc2UgUGF1c2FyIHF1YW5kbyBwcmVjaXNhciBwYXJhciBlIEZpbmFsaXphciBxdWFuZG8gc2Fpci4nfTwvZGl2PgogICAgICA8L2Rpdj5gOwoKICAgICQoJyNwb250by1ib3RvZXMnKS5pbm5lckhUTUwgPSBwYXVzYWRvCiAgICAgID8gJzxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSIgaWQ9ImJ0bi1wb250by1kZXNwYXVzYXIiPkRlc3BhdXNhcjwvYnV0dG9uPjxidXR0b24gY2xhc3M9ImJ0bi1wZXJpZ28gc20iIGlkPSJidG4tcG9udG8tc2FpZGEiPkZpbmFsaXphciBwb250bzwvYnV0dG9uPicKICAgICAgOiAnPGJ1dHRvbiBjbGFzcz0iYnRuLXNlY3VuZGFyaW8gc20iIGlkPSJidG4tcG9udG8tcGF1c2FyIj5QYXVzYXI8L2J1dHRvbj48YnV0dG9uIGNsYXNzPSJidG4tcGVyaWdvIHNtIiBpZD0iYnRuLXBvbnRvLXNhaWRhIj5GaW5hbGl6YXIgcG9udG88L2J1dHRvbj4nOwoKICAgIGNvbnN0IGJwID0gJCgnI2J0bi1wb250by1wYXVzYXInKTsKICAgIGlmIChicCkgYnAuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBhY2FvUG9udG8oJ3BhdXNhcicpKTsKICAgIGNvbnN0IGJkID0gJCgnI2J0bi1wb250by1kZXNwYXVzYXInKTsKICAgIGlmIChiZCkgYmQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBhY2FvUG9udG8oJ2Rlc3BhdXNhcicpKTsKICAgIGNvbnN0IGJmID0gJCgnI2J0bi1wb250by1zYWlkYScpOwogICAgaWYgKGJmKSBiZi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHsKICAgICAgaWYgKGNvbmZpcm0oJ0ZpbmFsaXphciBvIHBvbnRvIGFnb3JhPyBPIHRlbXBvIGRlIHBhdXNhIG7Do28gY29udGEuJykpIGFjYW9Qb250bygnc2FpZGEnKTsKICAgIH0pOwogIH0gZWxzZSB7CiAgICAkKCcjcG9udG8tc3RhdHVzJykuaW5uZXJIVE1MID0gYAogICAgICA8ZGl2IGNsYXNzPSJwb250by1jYXJkIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwb250by1yb3R1bG8iPkZPUkEgREUgU0VSVknDh088L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJwb250by1ob3JhIj5Wb2PDqiBuw6NvIHRlbSBwb250byBhYmVydG8uPC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0ibG9naW4tc3VhdmUiPkJhdGEgYSBlbnRyYWRhIHF1YW5kbyBjb21lw6dhciBvIHNlcnZpw6dvLjwvZGl2PgogICAgICA8L2Rpdj5gOwogICAgJCgnI3BvbnRvLWJvdG9lcycpLmlubmVySFRNTCA9ICc8YnV0dG9uIGNsYXNzPSJidG4tcHJpbWFyaW8gc20iIGlkPSJidG4tcG9udG8tZW50cmFkYSI+QmF0ZXIgZW50cmFkYTwvYnV0dG9uPic7CiAgICBjb25zdCBiZSA9ICQoJyNidG4tcG9udG8tZW50cmFkYScpOwogICAgaWYgKGJlKSBiZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGFjYW9Qb250bygnZW50cmFkYScpKTsKICB9CgogIGNvbnN0IHRhYmVsYSA9IChsaXN0YSwgY29tTm9tZSkgPT4gbGlzdGEubGVuZ3RoID8gYAogICAgPHRhYmxlPjx0aGVhZD48dHI+CiAgICAgICR7Y29tTm9tZSA/ICc8dGg+UG9saWNpYWw8L3RoPicgOiAnJ308dGg+RW50cmFkYTwvdGg+PHRoPlBhdXNhczwvdGg+PHRoPlNhw61kYTwvdGg+PHRoPlRyYWJhbGhhZG88L3RoPjx0aD5TaXR1YcOnw6NvPC90aD4KICAgIDwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAke2xpc3RhLm1hcCgocCkgPT4gewogICAgICBjb25zdCBxdGRQYXVzYXMgPSAocC5wYXVzYXMgfHwgW10pLmxlbmd0aDsKICAgICAgY29uc3QgcGF1c2FNaW4gPSBNYXRoLnJvdW5kKG1zUGF1c2FQb250byhwKSAvIDYwMDAwKTsKICAgICAgY29uc3Qgc2l0dWFjYW8gPSBwLnNhaWRhCiAgICAgICAgPyAnPHNwYW4gY2xhc3M9ImJhZGdlIj5GaW5hbGl6YWRvPC9zcGFuPicKICAgICAgICA6IChwLnBhdXNhZG9FbSA/ICc8c3BhbiBjbGFzcz0iYmFkZ2UgYW1hcmVsbyI+UGF1c2Fkbzwvc3Bhbj4nIDogJzxzcGFuIGNsYXNzPSJiYWRnZSB2ZXJkZSI+RW0gc2VydmnDp288L3NwYW4+Jyk7CiAgICAgIHJldHVybiBgPHRyPgogICAgICAke2NvbU5vbWUgPyBgPHRkPjxzdHJvbmc+JHtlc2NhcGVIdG1sKHAubm9tZSl9PC9zdHJvbmc+PGRpdiBjbGFzcz0ibG9naW4tc3VhdmUiPkAke2VzY2FwZUh0bWwocC5sb2dpbil9IMK3ICR7ZXNjYXBlSHRtbChwLmNhcmdvKX08L2Rpdj48L3RkPmAgOiAnJ30KICAgICAgPHRkPiR7ZGF0YUJSKHAuZW50cmFkYSl9PC90ZD4KICAgICAgPHRkPiR7cXRkUGF1c2FzID8gcXRkUGF1c2FzICsgJ8OXJyArIChwYXVzYU1pbiA/ICc8ZGl2IGNsYXNzPSJsb2dpbi1zdWF2ZSI+JyArIGR1cmFjYW9EZShwYXVzYU1pbikgKyAnPC9kaXY+JyA6ICcnKSA6ICfigJQnfTwvdGQ+CiAgICAgIDx0ZD4ke3Auc2FpZGEgPyBkYXRhQlIocC5zYWlkYSkgOiAn4oCUJ308L3RkPgogICAgICA8dGQ+JHtkdXJhY2FvRGUocC5zYWlkYSA/IChwLm1pbnV0b3MgfHwgMCkgOiBNYXRoLmZsb29yKG1zVHJhYmFsaG9Qb250byhwKSAvIDYwMDAwKSl9PC90ZD4KICAgICAgPHRkPiR7c2l0dWFjYW99PC90ZD4KICAgIDwvdHI+YDsKICAgIH0pLmpvaW4oJycpfTwvdGJvZHk+PC90YWJsZT5gCiAgICA6ICc8ZGl2IGNsYXNzPSJ2YXppbyI+TmVuaHVtIHJlZ2lzdHJvIGRlIHBvbnRvLjwvZGl2Pic7CgogICQoJyNwb250by1oaXN0b3JpY28nKS5pbm5lckhUTUwgPSB0YWJlbGEobWV1cy5zbGljZSgwLCA2MCksIGZhbHNlKTsKCiAgY29uc3QgcG9kZVZlclRvZG9zID0gZC5tZXVOaXZlbCA+PSA3MDsKICAkKCcjcGFpbmVsLXBvbnRvLXRvZG9zJykuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgIXBvZGVWZXJUb2Rvcyk7CiAgaWYgKHBvZGVWZXJUb2RvcykgJCgnI3BvbnRvLXRvZG9zJykuaW5uZXJIVE1MID0gdGFiZWxhKHRvZG9zLnNsaWNlKDAsIDIwMCksIHRydWUpOwoKICByZW5kZXJGdW5jaW9uYXJpb01lcygpOwp9CgovLyDwn4+GIHF1ZW0gbWFpcyBzb21vdSB0ZW1wbyBkZSBwb250byBubyBtw6pzIChzw7MgcG9udG9zIGJhdGlkb3MgZSBmaW5hbGl6YWRvcykKZnVuY3Rpb24gcmVuZGVyRnVuY2lvbmFyaW9NZXMoKSB7CiAgY29uc3QgYm94ID0gJCgnI3BvbnRvLWZ1bmNpb25hcmlvLW1lcycpOwogIGlmICghYm94KSByZXR1cm47CiAgY29uc3QgZm0gPSBTLmRhZG9zLmZ1bmNpb25hcmlvTWVzOwogIGNvbnN0IHJhbmsgPSAkKCcjcG9udG8tcmFua2luZy1tZXMnKTsKCiAgaWYgKCFmbSB8fCAhZm0uZGVzdGFxdWUpIHsKICAgIGJveC5pbm5lckhUTUwgPSBgPGRpdiBjbGFzcz0idmF6aW8iPk5pbmd1w6ltIGZpbmFsaXpvdSBwb250byBlbSAke2VzY2FwZUh0bWwoKGZtICYmIGZtLnJvdHVsbykgfHwgJ2VzdGUgbcOqcycpfSBhaW5kYS4gTyBwcmltZWlybyBhIGZpbmFsaXphciBhcGFyZWNlIGFxdWkuPC9kaXY+YDsKICAgIGlmIChyYW5rKSByYW5rLmlubmVySFRNTCA9ICcnOwogICAgcmV0dXJuOwogIH0KCiAgY29uc3QgYyA9IGZtLmRlc3RhcXVlOwogIGNvbnN0IHNvdUV1ID0gUy5ldSAmJiBjLnVzZXJJZCA9PT0gUy5ldS5pZDsKICBib3guaW5uZXJIVE1MID0gYAogICAgPGRpdiBjbGFzcz0iZnVuY2lvbmFyaW8tbWVzIj4KICAgICAgPGRpdiBjbGFzcz0iZm0tbWVkYWxoYSI+8J+PhjwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJmbS1pbmZvIj4KICAgICAgICA8ZGl2IGNsYXNzPSJmbS1yb3R1bG8iPkZ1bmNpb27DoXJpbyBkbyBtw6pzIMK3ICR7ZXNjYXBlSHRtbChmbS5yb3R1bG8gfHwgJycpfTwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9ImZtLW5vbWUiPiR7ZXNjYXBlSHRtbChjLm5vbWUpfSR7c291RXUgPyAnIDxzcGFuIGNsYXNzPSJiYWRnZSB2ZXJkZSI+dm9jw6o8L3NwYW4+JyA6ICcnfTwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9ImZtLW1ldGEiPkAke2VzY2FwZUh0bWwoYy5sb2dpbil9IMK3ICR7ZXNjYXBlSHRtbChjLmNhcmdvKX08L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJmbS10ZW1wbyI+JHtkdXJhY2FvRGUoYy5taW51dG9zKX08c3Bhbj5zb21hbmRvICR7Yy5wbGFudG9lc30gcG9udG8ke2MucGxhbnRvZXMgPiAxID8gJ3MnIDogJyd9IGZpbmFsaXphZG8ke2MucGxhbnRvZXMgPiAxID8gJ3MnIDogJyd9JHtjLnBhdXNhcyA/ICcgwrcgJyArIGMucGF1c2FzICsgJyBwYXVzYScgKyAoYy5wYXVzYXMgPiAxID8gJ3MnIDogJycpIDogJyd9PC9zcGFuPjwvZGl2PgogICAgICA8L2Rpdj4KICAgIDwvZGl2PmA7CgogIGlmIChyYW5rKSB7CiAgICByYW5rLmlubmVySFRNTCA9IGZtLmxpc3RhLmxlbmd0aCA+IDEgPyBgCiAgICAgIDx0YWJsZT48dGhlYWQ+PHRyPjx0aD4jPC90aD48dGg+UG9saWNpYWw8L3RoPjx0aD5UZW1wbyBubyBtw6pzPC90aD48dGg+UG9udG9zPC90aD48dGg+UGF1c2FzPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PgogICAgICAke2ZtLmxpc3RhLnNsaWNlKDAsIDEwKS5tYXAoKHAsIGkpID0+IGA8dHI+CiAgICAgICAgPHRkPiR7aSArIDF9wro8L3RkPgogICAgICAgIDx0ZD48c3Ryb25nPiR7ZXNjYXBlSHRtbChwLm5vbWUpfTwvc3Ryb25nPjxkaXYgY2xhc3M9ImxvZ2luLXN1YXZlIj5AJHtlc2NhcGVIdG1sKHAubG9naW4pfSDCtyAke2VzY2FwZUh0bWwocC5jYXJnbyl9PC9kaXY+PC90ZD4KICAgICAgICA8dGQ+PHN0cm9uZz4ke2R1cmFjYW9EZShwLm1pbnV0b3MpfTwvc3Ryb25nPjwvdGQ+CiAgICAgICAgPHRkPiR7cC5wbGFudG9lc308L3RkPgogICAgICAgIDx0ZD4ke3AucGF1c2FzIHx8IDB9PC90ZD4KICAgICAgPC90cj5gKS5qb2luKCcnKX08L3Rib2R5PjwvdGFibGU+YAogICAgICA6ICc8ZGl2IGNsYXNzPSJ2YXppbyI+U8OzIHVtYSBwZXNzb2EgYmF0ZXUgcG9udG8gbmVzdGUgbcOqcy48L2Rpdj4nOwogIH0KfQoKLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIGhpZXJhcnF1aWEg4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQCmZ1bmN0aW9uIHJlbmRlckhpZXJhcnF1aWEoKSB7CiAgY29uc3QgZCA9IFMuZGFkb3M7CiAgY29uc3QgY2FyZ29zID0gWy4uLmxpc3RhQ2FyZ29zKCldLnNvcnQoKGEsIGIpID0+IGIubml2ZWwgLSBhLm5pdmVsKTsKICBjb25zdCBsaW5oYXMgPSBjYXJnb3MubWFwKChjKSA9PiB7CiAgICBjb25zdCBtZW1icm9zID0gZC51c2Vycy5maWx0ZXIoKHUpID0+IHUuY2FyZ28gPT09IGMubm9tZSkuc29ydCgoYSwgYikgPT4gKGIucG9udG9zIHx8IDApIC0gKGEucG9udG9zIHx8IDApKTsKICAgIHJldHVybiBgPHRyPgogICAgICA8dGQ+PHNwYW4gY2xhc3M9ImJhZGdlICR7Q0FSR09fQ09SW2Mubm9tZV0gfHwgJyd9Ij4ke2VzY2FwZUh0bWwoYy5ub21lKX08L3NwYW4+PGRpdiBjbGFzcz0ibG9naW4tc3VhdmUiPk7DrXZlbCAke2Mubml2ZWx9PC9kaXY+PC90ZD4KICAgICAgPHRkPiR7bWVtYnJvcy5sZW5ndGh9CiAgICAgICAgPGRpdiBjbGFzcz0ibG9naW4tc3VhdmUiPiR7bWVtYnJvcy5zbGljZSgwLCA2KS5tYXAoKG0pID0+IGVzY2FwZUh0bWwobS5ub21lKSkuam9pbignLCAnKSB8fCAnbmluZ3XDqW0nfTwvZGl2PjwvdGQ+CiAgICA8L3RyPmA7CiAgfSkuam9pbignJyk7CiAgJCgnI2xpc3RhLWhpZXJhcnF1aWEnKS5pbm5lckhUTUwgPSBgCiAgICA8cCBjbGFzcz0idGV4dG8tYWp1ZGEiPlF1YW50byBtYWlvciBvIG7DrXZlbCwgbWFpb3IgYSBhdXRvcmlkYWRlLiBOaW5ndcOpbSBwb2RlIHByb21vdmVyIGFsZ3XDqW0gcGFyYSBvIHByw7NwcmlvIG7DrXZlbCBvdSBhY2ltYS48L3A+CiAgICA8dGFibGU+PHRoZWFkPjx0cj48dGg+Q2FyZ288L3RoPjx0aD5JbnRlZ3JhbnRlczwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4ke2xpbmhhc308L3Rib2R5PjwvdGFibGU+YDsKfQoKLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIHJlZ3JhcyBkbyBSUCDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAKZnVuY3Rpb24gcmVuZGVyUmVncmFzKCkgewogIGNvbnN0IGQgPSBTLmRhZG9zOwogIGNvbnN0IHRleHRvID0gKGQucmVncmFzIHx8ICcnKS50cmltKCk7CiAgJCgnI3RleHRvLXJlZ3JhcycpLmlubmVySFRNTCA9IHRleHRvCiAgICA/IGVzY2FwZUh0bWwodGV4dG8pLnJlcGxhY2UoL1xuL2csICc8YnI+JykKICAgIDogJzxkaXYgY2xhc3M9InZhemlvIj5BcyByZWdyYXMgZG8gUlAgYWluZGEgbsOjbyBmb3JhbSBjYWRhc3RyYWRhcy4gTyBBZG1pbiBNYXN0ZXIgb3UgbyBDaGVmZSBkZSBQb2zDrWNpYSBwb2RlIGNvbGFyIG8gdGV4dG8gYXF1aSBlbWJhaXhvLjwvZGl2Pic7CiAgY29uc3QgcG9kZUVkaXRhciA9IGQubWV1Tml2ZWwgPj0gOTA7CiAgJCgnI3BhaW5lbC1lZGl0YXItcmVncmFzJykuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgIXBvZGVFZGl0YXIpOwogIGlmIChwb2RlRWRpdGFyKSB7CiAgICBjb25zdCB0YSA9ICQoJyNyZWdyYXMtdGV4dG8tZWQnKTsKICAgIGlmIChkb2N1bWVudC5hY3RpdmVFbGVtZW50ICE9PSB0YSkgdGEudmFsdWUgPSBkLnJlZ3JhcyB8fCAnJzsKICB9Cn0KCi8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBlc3R1ZG9zIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkApmdW5jdGlvbiByZW5kZXJFc3R1ZG9zKCkgewogIGNvbnN0IGQgPSBTLmRhZG9zOwogIGNvbnN0IHBvZGVMYW5jYXIgPSBkLm1ldU5pdmVsID49IDkwOwogIGNvbnN0IGVzdHVkb3MgPSBkLmVzdHVkb3MgfHwgW107CiAgY29uc3QgbGlkb3MgPSBkLmVzdHVkb3NMaWRvcyB8fCBbXTsKICBjb25zdCBldSA9IFMuZXUgfHwge307CiAgY29uc3QgYXRpdm9zID0gKGQudXNlcnMgfHwgW10pLmZpbHRlcigodSkgPT4gdS5hdGl2bykubGVuZ3RoOwoKICAkKCcjYnRuLWFicmlyLWVzdHVkbycpLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsICFwb2RlTGFuY2FyKTsKICAkKCcjZXN0dWRvcy1hdmlzbycpLnRleHRDb250ZW50ID0gcG9kZUxhbmNhcgogICAgPyAnVm9jw6ogbGFuw6dhIG9zIGVzdHVkb3MgYXF1aSBlIHRvZG8gbyBlZmV0aXZvIHbDqiBuYSBob3JhLiBDYWRhIHVtIG1hcmNhICJKw6EgZXN0dWRlaSIgZSB2b2PDqiBhY29tcGFuaGEgcXVlbSBsZXUuJwogICAgOiAnTWF0ZXJpYWwgZGUgZXN0dWRvIHB1YmxpY2FkbyBwZWxvIGNvbWFuZG8uIExlaWEgZSBjbGlxdWUgZW0gIk1hcmNhciBjb21vIGVzdHVkYWRvIiBwYXJhIG8gY29tYW5kbyBhY29tcGFuaGFyLic7CgogICQoJyNsaXN0YS1lc3R1ZG9zJykuaW5uZXJIVE1MID0gZXN0dWRvcy5sZW5ndGggPyBlc3R1ZG9zLm1hcCgoZSkgPT4gewogICAgY29uc3QgcXVlbUxldSA9IGxpZG9zLmZpbHRlcigobCkgPT4gbC5lc3R1ZG9JZCA9PT0gZS5pZCk7CiAgICBjb25zdCBldUxpID0gcXVlbUxldS5zb21lKChsKSA9PiBsLnVzZXJJZCA9PT0gZXUuaWQpOwogICAgcmV0dXJuIGA8YXJ0aWNsZSBjbGFzcz0iZXN0dWRvLWNhcmQiPgogICAgICA8ZGl2IGNsYXNzPSJlc3R1ZG8tdG9wbyI+CiAgICAgICAgPGRpdj4KICAgICAgICAgIDxzcGFuIGNsYXNzPSJiYWRnZSBhbWFyZWxvIj4ke2VzY2FwZUh0bWwoZS5jYXRlZ29yaWEgfHwgJ0dlcmFsJyl9PC9zcGFuPgogICAgICAgICAgPGRpdiBjbGFzcz0iZXN0dWRvLXRpdHVsbyI+JHtlc2NhcGVIdG1sKGUudGl0dWxvKX08L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9ImxvZ2luLXN1YXZlIj4ke2VzY2FwZUh0bWwoZS5jcmlhZG9Qb3JOb21lIHx8IGUuY3JpYWRvUG9yKX0gwrcgJHtkYXRhQlIoZS5jcmlhZG9FbSl9IMK3ICR7cXVlbUxldS5sZW5ndGh9IGRlICR7YXRpdm9zfSBlc3R1ZGFyYW08L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJhY29lcy1saW5oYSI+CiAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJtaW5pICR7ZXVMaSA/ICdlc3R1ZGFkbycgOiAnJ30iIGRhdGEtZXN0dWRhcj0iJHtlLmlkfSI+JHtldUxpID8gJ+KclCBKw6EgZXN0dWRlaScgOiAnTWFyY2FyIGNvbW8gZXN0dWRhZG8nfTwvYnV0dG9uPgogICAgICAgICAgJHtwb2RlTGFuY2FyID8gYDxidXR0b24gY2xhc3M9Im1pbmkiIGRhdGEtZWRpdGFyLWVzdHVkbz0iJHtlLmlkfSI+RWRpdGFyPC9idXR0b24+CiAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJtaW5pIHBlcmlnbyIgZGF0YS1leGNsdWlyLWVzdHVkbz0iJHtlLmlkfSI+RXhjbHVpcjwvYnV0dG9uPmAgOiAnJ30KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkZXRhaWxzIGNsYXNzPSJlc3R1ZG8tZGV0YWxoZSI+CiAgICAgICAgPHN1bW1hcnk+TGVyIG8gY29udGXDumRvPC9zdW1tYXJ5PgogICAgICAgIDxkaXYgY2xhc3M9InJlZ3Jhcy10ZXh0byI+JHtlc2NhcGVIdG1sKGUuY29udGV1ZG8pLnJlcGxhY2UoL1xuL2csICc8YnI+Jyl9PC9kaXY+CiAgICAgIDwvZGV0YWlscz4KICAgICAgJHtwb2RlTGFuY2FyICYmIHF1ZW1MZXUubGVuZ3RoID8gYDxkZXRhaWxzIGNsYXNzPSJlc3R1ZG8tZGV0YWxoZSI+CiAgICAgICAgPHN1bW1hcnk+UXVlbSBqw6EgZXN0dWRvdSAoJHtxdWVtTGV1Lmxlbmd0aH0pPC9zdW1tYXJ5PgogICAgICAgICR7cXVlbUxldS5tYXAoKGwpID0+IGA8ZGl2IGNsYXNzPSJsb2dpbi1zdWF2ZSI+JHtlc2NhcGVIdG1sKGwubm9tZSl9IChAJHtlc2NhcGVIdG1sKGwubG9naW4pfSkgwrcgJHtkYXRhQlIobC5lbSl9PC9kaXY+YCkuam9pbignJyl9CiAgICAgIDwvZGV0YWlscz5gIDogJyd9CiAgICA8L2FydGljbGU+YDsKICB9KS5qb2luKCcnKSA6ICc8ZGl2IGNsYXNzPSJ2YXppbyI+TmVuaHVtIGVzdHVkbyBwdWJsaWNhZG8gYWluZGEuIFPDsyBvIEFkbWluIE1hc3RlciBlIG8gQ2hlZmUgZGUgUG9sw61jaWEgcHVibGljYW0uPC9kaXY+JzsKCiAgJCQoJ1tkYXRhLWVzdHVkYXJdJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHsKICAgIHRyeSB7IGF3YWl0IGFwaSgnUE9TVCcsICcvZXN0dWRvcy8nICsgYi5kYXRhc2V0LmVzdHVkYXIgKyAnL2VzdHVkYXInKTsgYXdhaXQgY2FycmVnYXIoKTsgfQogICAgY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQogIH0pKTsKICAkJCgnW2RhdGEtZWRpdGFyLWVzdHVkb10nKS5mb3JFYWNoKChiKSA9PiBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gbW9kYWxFc3R1ZG8oYi5kYXRhc2V0LmVkaXRhckVzdHVkbykpKTsKICAkJCgnW2RhdGEtZXhjbHVpci1lc3R1ZG9dJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHsKICAgIGlmICghY29uZmlybSgnRXhjbHVpciBlc3RlIGVzdHVkbz8nKSkgcmV0dXJuOwogICAgdHJ5IHsgYXdhaXQgYXBpKCdERUxFVEUnLCAnL2VzdHVkb3MvJyArIGIuZGF0YXNldC5leGNsdWlyRXN0dWRvKTsgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKCdFc3R1ZG8gZXhjbHXDrWRvLicpOyB9CiAgICBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9CiAgfSkpOwp9CgpmdW5jdGlvbiBtb2RhbEVzdHVkbyhpZCkgewogIGNvbnN0IGUgPSBpZCA/IChTLmRhZG9zLmVzdHVkb3MgfHwgW10pLmZpbmQoKHgpID0+IHguaWQgPT09IGlkKSA6IG51bGw7CiAgY29uc3QgY2F0ZWdvcmlhcyA9IFsnR2VyYWwnLCAnUmVncmFzIGRvIFJQJywgJ0PDs2RpZ28gUScsICdBYm9yZGFnZW0nLCAnUHJvY2VkaW1lbnRvJywgJ0NyaW1lcyBlIGVzdHJlbGFzJywgJ0hpZXJhcnF1aWEnLCAnT3V0cm8nXTsKICBhYnJpck1vZGFsKGUgPyAnRWRpdGFyIGVzdHVkbycgOiAnTm92byBlc3R1ZG8nLCBgCiAgICA8Zm9ybSBpZD0iZm9ybS1lc3R1ZG8iPgogICAgICA8bGFiZWw+VMOtdHVsbzxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0iZXMtdGl0dWxvIiByZXF1aXJlZCBtYXhsZW5ndGg9IjE0MCIgdmFsdWU9IiR7ZSA/IGVzY2FwZUh0bWwoZS50aXR1bG8pIDogJyd9IiBwbGFjZWhvbGRlcj0iRXguOiBDw7NkaWdvIFEg4oCUIHVzbyBubyByw6FkaW8iPjwvbGFiZWw+CiAgICAgIDxsYWJlbD5DYXRlZ29yaWEKICAgICAgICA8c2VsZWN0IGlkPSJlcy1jYXRlZ29yaWEiPgogICAgICAgICAgJHtjYXRlZ29yaWFzLm1hcCgoYykgPT4gYDxvcHRpb24gdmFsdWU9IiR7Y30iICR7ZSAmJiBlLmNhdGVnb3JpYSA9PT0gYyA/ICdzZWxlY3RlZCcgOiAnJ30+JHtjfTwvb3B0aW9uPmApLmpvaW4oJycpfQogICAgICAgIDwvc2VsZWN0PgogICAgICA8L2xhYmVsPgogICAgICA8bGFiZWw+Q29udGXDumRvCiAgICAgICAgPHRleHRhcmVhIGlkPSJlcy1jb250ZXVkbyIgcm93cz0iMTQiIG1heGxlbmd0aD0iMjAwMDAiIHJlcXVpcmVkIHBsYWNlaG9sZGVyPSJFc2NyZXZhIGFxdWkgbyBtYXRlcmlhbCBkZSBlc3R1ZG8uLi4iPiR7ZSA/IGVzY2FwZUh0bWwoZS5jb250ZXVkbykgOiAnJ308L3RleHRhcmVhPgogICAgICA8L2xhYmVsPgogICAgICA8ZGl2IGNsYXNzPSJsaW5oYS1ib3RvZXMiPjxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSIgdHlwZT0ic3VibWl0Ij4ke2UgPyAnU2FsdmFyIGFsdGVyYcOnw7VlcycgOiAnUHVibGljYXIgcGFyYSBvIGVmZXRpdm8nfTwvYnV0dG9uPjwvZGl2PgogICAgPC9mb3JtPmApOwogICQoJyNmb3JtLWVzdHVkbycpLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGFzeW5jIChldikgPT4gewogICAgZXYucHJldmVudERlZmF1bHQoKTsKICAgIGNvbnN0IGNvcnBvID0geyB0aXR1bG86ICQoJyNlcy10aXR1bG8nKS52YWx1ZSwgY2F0ZWdvcmlhOiAkKCcjZXMtY2F0ZWdvcmlhJykudmFsdWUsIGNvbnRldWRvOiAkKCcjZXMtY29udGV1ZG8nKS52YWx1ZSB9OwogICAgdHJ5IHsKICAgICAgaWYgKGUpIGF3YWl0IGFwaSgnUFVUJywgJy9lc3R1ZG9zLycgKyBlLmlkLCBjb3Jwbyk7CiAgICAgIGVsc2UgYXdhaXQgYXBpKCdQT1NUJywgJy9lc3R1ZG9zJywgY29ycG8pOwogICAgICBmZWNoYXJNb2RhbCgpOyBhd2FpdCBjYXJyZWdhcigpOyBmbHV0dWFudGUoZSA/ICdFc3R1ZG8gYXR1YWxpemFkby4nIDogJ0VzdHVkbyBwdWJsaWNhZG8gcGFyYSBvIGVmZXRpdm8uJyk7CiAgICB9IGNhdGNoIChlcnIpIHsgZmx1dHVhbnRlKGVyci5tZXNzYWdlLCAnZXJybycpOyB9CiAgfSk7Cn0KCmZ1bmN0aW9uIHJlbmRlckNoYXQoKSB7CiAgY29uc3QgbXNncyA9IFMuZGFkb3MuY2hhdCB8fCBbXTsKICBjb25zdCBib3ggPSAkKCcjY2hhdC1tZW5zYWdlbnMnKTsKICBjb25zdCBlc3RhdmFGaW0gPSBib3guc2Nyb2xsSGVpZ2h0IC0gYm94LnNjcm9sbFRvcCAtIGJveC5jbGllbnRIZWlnaHQgPCA4MDsKICBib3guaW5uZXJIVE1MID0gbXNncy5sZW5ndGggPyBtc2dzLm1hcCgobSkgPT4gewogICAgY29uc3QgbWluaGEgPSBTLmV1ICYmIG0uZGUgPT09IFMuZXUubG9naW47CiAgICByZXR1cm4gYDxkaXYgY2xhc3M9Im1zZyAke21pbmhhID8gJ21pbmhhJyA6ICcnfSI+CiAgICAgIDxkaXYgY2xhc3M9Im1zZy10b3BvIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChtLm5vbWUgfHwgbS5kZSl9PC9zdHJvbmc+PHNtYWxsPiR7ZXNjYXBlSHRtbChtLmNhcmdvIHx8ICcnKX0gwrcgJHt0ZW1wb1JlbChtLmVtKX08L3NtYWxsPjwvZGl2PgogICAgICA8cD4ke2VzY2FwZUh0bWwobS50ZXh0byl9PC9wPgogICAgPC9kaXY+YDsKICB9KS5qb2luKCcnKSA6ICc8ZGl2IGNsYXNzPSJ2YXppbyI+TmVuaHVtYSBtZW5zYWdlbSBhaW5kYS4gRGlnYSBvaSDwn5GLPC9kaXY+JzsKICBpZiAoZXN0YXZhRmltKSBib3guc2Nyb2xsVG9wID0gYm94LnNjcm9sbEhlaWdodDsKfQpmdW5jdGlvbiByb2xhckNoYXQoKSB7CiAgY29uc3QgYm94ID0gJCgnI2NoYXQtbWVuc2FnZW5zJyk7CiAgaWYgKGJveCkgYm94LnNjcm9sbFRvcCA9IGJveC5zY3JvbGxIZWlnaHQ7Cn0KJCgnI2Zvcm0tY2hhdCcpLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGFzeW5jIChldikgPT4gewogIGV2LnByZXZlbnREZWZhdWx0KCk7CiAgY29uc3QgaW5wdXQgPSAkKCcjY2hhdC1pbnB1dCcpOwogIGNvbnN0IHRleHRvID0gaW5wdXQudmFsdWUudHJpbSgpOwogIGlmICghdGV4dG8pIHJldHVybjsKICBpbnB1dC52YWx1ZSA9ICcnOwogIHRyeSB7IGF3YWl0IGFwaSgnUE9TVCcsICcvY2hhdCcsIHsgdGV4dG8gfSk7IGF3YWl0IGNhcnJlZ2FyKCk7IHJvbGFyQ2hhdCgpOyB9CiAgY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQp9KTsKCi8vIOKUgOKUgCBhdWRpdG9yaWEg4pSA4pSACmZ1bmN0aW9uIHJlbmRlckF1ZGl0b3JpYSgpIHsKICBjb25zdCBsb2dzID0gUy5kYWRvcy5hdWRpdCB8fCBbXTsKICAkKCcjbGlzdGEtYXVkaXRvcmlhJykuaW5uZXJIVE1MID0gbG9ncy5sZW5ndGggPyBgCiAgICA8dGFibGU+PHRoZWFkPjx0cj48dGg+UXVhbmRvPC90aD48dGg+UXVlbTwvdGg+PHRoPkHDp8OjbzwvdGg+PHRoPkRldGFsaGU8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAke2xvZ3MubWFwKChsKSA9PiBgPHRyPgogICAgICA8dGQgY2xhc3M9ImxvZ2luLXN1YXZlIj4ke2RhdGFCUihsLmVtKX08L3RkPgogICAgICA8dGQ+QCR7ZXNjYXBlSHRtbChsLmZlaXRvclBvcil9PC90ZD4KICAgICAgPHRkPjxzcGFuIGNsYXNzPSJiYWRnZSBhenVsIj4ke2VzY2FwZUh0bWwobC5hY2FvKX08L3NwYW4+PC90ZD4KICAgICAgPHRkIGNsYXNzPSJsb2dpbi1zdWF2ZSI+JHtlc2NhcGVIdG1sKGwuZGV0YWxoZSl9PC90ZD4KICAgIDwvdHI+YCkuam9pbignJyl9PC90Ym9keT48L3RhYmxlPmAKICAgIDogJzxkaXYgY2xhc3M9InZhemlvIj5TZW0gcmVnaXN0cm9zLjwvZGl2Pic7Cn0KCi8vIOKUgOKUgCBwZXJmaWwg4pSA4pSACmZ1bmN0aW9uIHJlbmRlclBlcmZpbCgpIHsKICBpZiAoIVMuZXUpIHJldHVybjsKICAkKCcjcGVyZmlsLW5vbWUnKS52YWx1ZSA9IFMuZXUubm9tZSB8fCAnJzsKICAkKCcjcGVyZmlsLXJlY2FkbycpLnZhbHVlID0gUy5ldS5yZWNhZG8gfHwgJyc7CiAgY29uc3QgaW1nID0gJCgnI3BlcmZpbC1mb3RvLWltZycpOwogIGlmIChTLmV1LmZvdG8pIHsgaW1nLnNyYyA9IFMuZXUuZm90bzsgaW1nLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpOyAkKCcjcGVyZmlsLXNlbS1mb3RvJykuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7IH0KICBlbHNlIHsgaW1nLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpOyAkKCcjcGVyZmlsLXNlbS1mb3RvJykuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7IH0KICByZW5kZXJQb250b3MoKTsKfQoKJCgnI3BlcmZpbC1mb3RvJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGV2KSA9PiB7CiAgY29uc3QgZmlsZSA9IGV2LnRhcmdldC5maWxlc1swXTsKICBpZiAoIWZpbGUpIHJldHVybjsKICBpZiAoZmlsZS5zaXplID4gNjAwMDAwKSByZXR1cm4gZmx1dHVhbnRlKCdGb3RvIG11aXRvIGdyYW5kZSAobcOheCA2MDBLQikuJywgJ2Vycm8nKTsKICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpOwogIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7ICQoJyNwZXJmaWwtZm90by1pbWcnKS5zcmMgPSByZWFkZXIucmVzdWx0OyAkKCcjcGVyZmlsLWZvdG8taW1nJykuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7ICQoJyNwZXJmaWwtc2VtLWZvdG8nKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsgfTsKICByZWFkZXIucmVhZEFzRGF0YVVSTChmaWxlKTsKfSk7CgokKCcjZm9ybS1wZXJmaWwnKS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBhc3luYyAoZXYpID0+IHsKICBldi5wcmV2ZW50RGVmYXVsdCgpOwogIGNvbnN0IHNyYyA9ICQoJyNwZXJmaWwtZm90by1pbWcnKS5zcmM7CiAgY29uc3Qgbm92YUZvdG8gPSBzcmMgJiYgc3JjLnN0YXJ0c1dpdGgoJ2RhdGE6JykgPyBzcmMgOiB1bmRlZmluZWQ7CiAgY29uc3QgY29ycG8gPSB7IG5vbWU6ICQoJyNwZXJmaWwtbm9tZScpLnZhbHVlLCByZWNhZG86ICQoJyNwZXJmaWwtcmVjYWRvJykudmFsdWUgfTsKICBpZiAobm92YUZvdG8pIGNvcnBvLmZvdG8gPSBub3ZhRm90bzsKICB0cnkgewogICAgY29uc3QgciA9IGF3YWl0IGFwaSgnUFVUJywgJy9tZS9wZXJmaWwnLCBjb3Jwbyk7CiAgICBTLmV1ID0gci51c2VyOwogICAgYXdhaXQgY2FycmVnYXIoKTsKICAgIGZsdXR1YW50ZSgnUGVyZmlsIGF0dWFsaXphZG8uJyk7CiAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9Cn0pOwoKJCgnI2J0bi1yZW1vdmVyLWZvdG8nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHsKICB0cnkgewogICAgY29uc3QgciA9IGF3YWl0IGFwaSgnUFVUJywgJy9tZS9wZXJmaWwnLCB7IGZvdG86ICcnIH0pOwogICAgUy5ldSA9IHIudXNlcjsKICAgIGF3YWl0IGNhcnJlZ2FyKCk7CiAgICBmbHV0dWFudGUoJ0ZvdG8gcmVtb3ZpZGEuJyk7CiAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9Cn0pOwoKJCgnI2Zvcm0tc2VuaGEnKS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBhc3luYyAoZXYpID0+IHsKICBldi5wcmV2ZW50RGVmYXVsdCgpOwogIGlmICgkKCcjc2VuaGEtbm92YScpLnZhbHVlICE9PSAkKCcjc2VuaGEtY29uZicpLnZhbHVlKSByZXR1cm4gZmx1dHVhbnRlKCdBcyBzZW5oYXMgbsOjbyBiYXRlbS4nLCAnZXJybycpOwogIHRyeSB7CiAgICBhd2FpdCBhcGkoJ1BVVCcsICcvbWUvc2VuaGEnLCB7IGF0dWFsOiAkKCcjc2VuaGEtYXR1YWwnKS52YWx1ZSwgbm92YTogJCgnI3NlbmhhLW5vdmEnKS52YWx1ZSB9KTsKICAgICQoJyNmb3JtLXNlbmhhJykucmVzZXQoKTsKICAgIGZsdXR1YW50ZSgnU2VuaGEgYWx0ZXJhZGEuJyk7CiAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9Cn0pOwoKLy8g4pSA4pSAIGFkbWluIC8gYmFja3VwIOKUgOKUgApsZXQgaW5mb0FkbWluVGltZXIgPSBudWxsOwpmdW5jdGlvbiByZW5kZXJBZG1pbigpIHsKICBpZiAoIVMuZGFkb3MpIHJldHVybjsKICBjb25zdCBkID0gUy5kYWRvczsKICBjb25zdCBjID0gZC5jb25maWcgfHwge307CiAgbW9udGFyVGVtYXMoKTsKICBpZiAoIVMuaWRlbnRFZGl0YW5kbykgewogICAgUy5pZGVudCA9IGlkZW50RG9TZXJ2aWRvcihjKTsKICAgIGNvbnN0IGNuID0gJCgnI2NmZy1ub21lJyksIGNjID0gJCgnI2NmZy1jb3JwJyk7CiAgICBpZiAoY24gJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAhPT0gY24pIGNuLnZhbHVlID0gYy5ub21lU2lzdGVtYSB8fCAnJzsKICAgIGlmIChjYyAmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICE9PSBjYykgY2MudmFsdWUgPSBjLm5vbWVDb3Jwb3JhY2FvIHx8ICcnOwogICAgcHJldmlld0lkZW50aWRhZGUoKTsKICB9CiAgJCgnI2FkbWluLWluZm8nKS5pbm5lckhUTUwgPSBgCiAgICA8c3Ryb25nPiR7ZXNjYXBlSHRtbChjLm5vbWVTaXN0ZW1hIHx8ICdTSUdQJyl9PC9zdHJvbmc+JHtjLm5vbWVDb3Jwb3JhY2FvID8gJyDigJQgJyArIGVzY2FwZUh0bWwoYy5ub21lQ29ycG9yYWNhbykgOiAnJ308YnI+CiAgICAke2QudXNlcnMubGVuZ3RofSB1c3XDoXJpb3MgwrcgJHtkLm9jb3JyZW5jaWFzLmxlbmd0aH0gb2NvcnLDqm5jaWFzIMK3ICR7ZC5wb250b3MubGVuZ3RofSBsYW7Dp2FtZW50b3MgZGUgcG9udG9zPGJyPgogICAgU2V1IG7DrXZlbCBkZSBhY2Vzc286IDxzdHJvbmc+JHtkLm1ldU5pdmVsfTwvc3Ryb25nPiAoJHtlc2NhcGVIdG1sKFMuZXUgPyBTLmV1LmNhcmdvIDogJycpfSk8YnI+CiAgICBCYW5jbyBkZSBkYWRvczogJHtkLmJhbmNvTGlnYWRvCiAgICAgID8gJzxzcGFuIGNsYXNzPSJiYWRnZSB2ZXJkZSI+bGlnYWRvIOKAlCBuYWRhIHNlIHBlcmRlIGFvIHJlaW5pY2lhcjwvc3Bhbj4nCiAgICAgIDogJzxzcGFuIGNsYXNzPSJiYWRnZSB2ZXJtZWxobyI+ZGVzbGlnYWRvIOKAlCBvcyBkYWRvcyBwb2RlbSB2b2x0YXIgYW8gcGFkcsOjbzwvc3Bhbj4nfWA7CgogIHJlbmRlckxpbXBlemEoKTsKfQoKLy8g4pSA4pSAIGxpbXBhciBkYWRvcyAoc8OzIEFkbWluIE1hc3Rlcikg4pSA4pSACmNvbnN0IExJTVBFWkEgPSBbCiAgewogICAgYWx2bzogJ2NoYXQnLCB0aXR1bG86ICdDaGF0JywgaWNvbmU6ICfwn5KsJywKICAgIGRlc2M6ICdBcGFnYSB0b2RhcyBhcyBtZW5zYWdlbnMgZG8gY2hhdCBkbyBlZmV0aXZvLicsCiAgICBjb250YTogKGQpID0+IGAkeyhkLmNoYXQgfHwgW10pLmxlbmd0aH0gbWVuc2FnZW0obnMpYCwKICAgIGF2aXNvOiAnQXBhZ2FyIFRPREFTIGFzIG1lbnNhZ2VucyBkbyBjaGF0PycsCiAgfSwKICB7CiAgICBhbHZvOiAnYXVkaXRvcmlhJywgdGl0dWxvOiAnQXVkaXRvcmlhJywgaWNvbmU6ICfwn5OcJywKICAgIGRlc2M6ICdBcGFnYSBvIGhpc3TDs3JpY28gZGUgdHVkbyBvIHF1ZSBmb2kgZmVpdG8gbm8gc2lzdGVtYS4nLAogICAgY29udGE6IChkKSA9PiBgJHsoZC5hdWRpdCB8fCBbXSkubGVuZ3RofSByZWdpc3RybyhzKWAsCiAgICBhdmlzbzogJ0FwYWdhciBUT0RPIG8gaGlzdMOzcmljbyBkZSBhdWRpdG9yaWE/JywKICB9LAogIHsKICAgIGFsdm86ICdwb250bycsIHRpdHVsbzogJ0JhdGUgcG9udG8nLCBpY29uZTogJ/CflZInLAogICAgZGVzYzogJ0FwYWdhIHRvZG9zIG9zIHJlZ2lzdHJvcyBkZSBwb250by4gTyBGdW5jaW9uw6FyaW8gZG8gTcOqcyBlIG8gcmFua2luZyBkbyBtw6pzIHplcmFtIGp1bnRvLicsCiAgICBjb250YTogKGQpID0+IHsKICAgICAgY29uc3QgbiA9ICgoZC5mdW5jaW9uYXJpb01lcyAmJiBkLmZ1bmNpb25hcmlvTWVzLmxpc3RhKSB8fCBbXSkubGVuZ3RoOwogICAgICByZXR1cm4gYCR7KGQucG9udG8gfHwgW10pLmxlbmd0aH0gcmVnaXN0cm8ocykgwrcgcmFua2luZyBjb20gJHtufSBwZXNzb2EocylgOwogICAgfSwKICAgIGF2aXNvOiAnQXBhZ2FyIFRPRE9TIG9zIHJlZ2lzdHJvcyBkZSBwb250bz8gTyBGdW5jaW9uw6FyaW8gZG8gTcOqcyB2b2x0YSBhIHplcm8uJywKICB9LAogIHsKICAgIGFsdm86ICdwb250dWFjYW8nLCB0aXR1bG86ICdQb250dWHDp8OjbycsIGljb25lOiAn4q2QJywKICAgIGRlc2M6ICdBcGFnYSBvIGhpc3TDs3JpY28gZGUgcG9udG9zIGxhbsOnYWRvcyBlIHplcmEgYSBwb250dWHDp8OjbyBkZSB0b2RvcyBvcyBtZW1icm9zLicsCiAgICBjb250YTogKGQpID0+IGAkeyhkLnBvbnRvcyB8fCBbXSkubGVuZ3RofSBsYW7Dp2FtZW50byhzKWAsCiAgICBhdmlzbzogJ0FwYWdhciBUT0RPIG8gaGlzdMOzcmljbyBkZSBwb250b3MgZSB6ZXJhciBhIHBvbnR1YcOnw6NvIGRlIHRvZG9zPycsCiAgfSwKICB7CiAgICBhbHZvOiAnb2NvcnJlbmNpYXMnLCB0aXR1bG86ICdPY29ycsOqbmNpYXMnLCBpY29uZTogJ/Cfk4snLAogICAgZGVzYzogJ0FwYWdhIHRvZGFzIGFzIG9jb3Jyw6puY2lhcyByZWdpc3RyYWRhcywganVudG8gY29tIGFzIGZvdG9zLicsCiAgICBjb250YTogKGQpID0+IGAkeyhkLm9jb3JyZW5jaWFzIHx8IFtdKS5sZW5ndGh9IG9jb3Jyw6puY2lhKHMpYCwKICAgIGF2aXNvOiAnQXBhZ2FyIFRPREFTIGFzIG9jb3Jyw6puY2lhcyAoZSBhcyBmb3Rvcyk/JywKICB9LAogIHsKICAgIGFsdm86ICdwcm92YXMnLCB0aXR1bG86ICdQcm92YXMgZW52aWFkYXMnLCBpY29uZTogJ/Cfjq8nLAogICAgZGVzYzogJ0FwYWdhIGFzIHByb3ZhcyBxdWUgbyBlZmV0aXZvIGVudmlvdSBlIGFzIG5vdGFzLiBBcyBwcm92YXMgY3JpYWRhcyBjb250aW51YW0uJywKICAgIGNvbnRhOiAoZCkgPT4gYCR7KGQuZW50cmVnYXMgfHwgW10pLmxlbmd0aH0gZW52aW8ocylgLAogICAgYXZpc286ICdBcGFnYXIgVE9ET1Mgb3MgZW52aW9zIGUgbm90YXMgZGUgcHJvdmFzPycsCiAgfSwKXTsKCmZ1bmN0aW9uIHJlbmRlckxpbXBlemEoKSB7CiAgY29uc3QgZ3JhZGUgPSAkKCcjZ3JhZGUtbGltcGV6YScpOwogIGlmICghZ3JhZGUpIHJldHVybjsKICBjb25zdCBzb3VBZG1pbiA9IFMuZXUgJiYgUy5ldS5jYXJnbyA9PT0gJ0FkbWluIE1hc3Rlcic7CiAgJCgnI3BhaW5lbC1saW1wZXphJykuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgIXNvdUFkbWluKTsKICBpZiAoIXNvdUFkbWluKSByZXR1cm47CgogIGNvbnN0IGQgPSBTLmRhZG9zOwogIGdyYWRlLmlubmVySFRNTCA9IExJTVBFWkEubWFwKChpdGVtKSA9PiBgCiAgICA8ZGl2IGNsYXNzPSJsaW1wZXphLWNhcmQiPgogICAgICA8ZGl2IGNsYXNzPSJsaW1wZXphLXRvcG8iPjxzcGFuIGNsYXNzPSJsaW1wZXphLWljb25lIj4ke2l0ZW0uaWNvbmV9PC9zcGFuPjxzdHJvbmc+JHtpdGVtLnRpdHVsb308L3N0cm9uZz48L2Rpdj4KICAgICAgPHAgY2xhc3M9ImxpbXBlemEtZGVzYyI+JHtpdGVtLmRlc2N9PC9wPgogICAgICA8ZGl2IGNsYXNzPSJsaW1wZXphLWNvbnRhIj4ke2VzY2FwZUh0bWwoaXRlbS5jb250YShkKSl9PC9kaXY+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wZXJpZ28gc20iIGRhdGEtbGltcGFyPSIke2l0ZW0uYWx2b30iPkxpbXBhciAke2l0ZW0udGl0dWxvLnRvTG93ZXJDYXNlKCl9PC9idXR0b24+CiAgICA8L2Rpdj5gKS5qb2luKCcnKSArIGAKICAgIDxkaXYgY2xhc3M9ImxpbXBlemEtY2FyZCB0dWRvIj4KICAgICAgPGRpdiBjbGFzcz0ibGltcGV6YS10b3BvIj48c3BhbiBjbGFzcz0ibGltcGV6YS1pY29uZSI+8J+nuTwvc3Bhbj48c3Ryb25nPkxpbXBhciB0dWRvPC9zdHJvbmc+PC9kaXY+CiAgICAgIDxwIGNsYXNzPSJsaW1wZXphLWRlc2MiPkZheiB0b2RhcyBhcyBsaW1wZXphcyBhY2ltYSBkZSB1bWEgdmV6OiBjaGF0LCBhdWRpdG9yaWEsIGJhdGUgcG9udG8sIHBvbnR1YcOnw6NvLCBvY29ycsOqbmNpYXMgZSBwcm92YXMgZW52aWFkYXMuCiAgICAgIDxzdHJvbmc+Q29udGFzIGRvcyBtZW1icm9zLCBSZWdyYXMgZG8gUlAsIEVzdHVkb3MgZSBpZGVudGlkYWRlIGNvbnRpbnVhbS48L3N0cm9uZz48L3A+CiAgICAgIDxkaXYgY2xhc3M9ImxpbXBlemEtY29udGEiPnBlZGUgY29uZmlybWHDp8OjbyBkaWdpdGFuZG8gTElNUEFSPC9kaXY+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wZXJpZ28gc20iIGRhdGEtbGltcGFyPSJ0dWRvIj5MaW1wYXIgdHVkbzwvYnV0dG9uPgogICAgPC9kaXY+YDsKCiAgJCQoJ1tkYXRhLWxpbXBhcl0nKS5mb3JFYWNoKChiKSA9PiBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gbGltcGFyRGFkb3MoYi5kYXRhc2V0LmxpbXBhcikpKTsKfQoKYXN5bmMgZnVuY3Rpb24gbGltcGFyRGFkb3MoYWx2bykgewogIGNvbnN0IGl0ZW0gPSBMSU1QRVpBLmZpbmQoKGkpID0+IGkuYWx2byA9PT0gYWx2byk7CiAgY29uc3QgYXZpc28gPSBpdGVtID8gaXRlbS5hdmlzbyA6ICdBcGFnYXIgVFVETyAoY2hhdCwgYXVkaXRvcmlhLCBiYXRlIHBvbnRvLCBwb250dWHDp8Ojbywgb2NvcnLDqm5jaWFzIGUgcHJvdmFzIGVudmlhZGFzKT8nOwogIGlmICghY29uZmlybShhdmlzbyArICdcblxuTsODTyB0ZW0gY29tbyBkZXNmYXplci4nKSkgcmV0dXJuOwogIGlmIChhbHZvID09PSAndHVkbycpIHsKICAgIGNvbnN0IHNlbmhhID0gcHJvbXB0KCdQYXJhIGNvbmZpcm1hciwgZGlnaXRlIExJTVBBUiAoZW0gbWFpw7pzY3VsYXMpOicpOwogICAgaWYgKCFzZW5oYSB8fCBzZW5oYS50cmltKCkudG9VcHBlckNhc2UoKSAhPT0gJ0xJTVBBUicpIHJldHVybiBmbHV0dWFudGUoJ0xpbXBlemEgY2FuY2VsYWRhLicpOwogIH0KICB0cnkgewogICAgY29uc3QgciA9IGF3YWl0IGFwaSgnUE9TVCcsICcvbGltcGFyJywgeyBhbHZvIH0pOwogICAgYXdhaXQgY2FycmVnYXIoKTsKICAgIGZsdXR1YW50ZSgociAmJiByLm1lbnNhZ2VtKSB8fCAnRGFkb3MgbGltcG9zLicpOwogIH0gY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQp9CgpmdW5jdGlvbiBtYXJjYXJJZGVudEVkaXRhbmRvKCkgewogIFMuaWRlbnRFZGl0YW5kbyA9IHRydWU7CiAgY2xlYXJUaW1lb3V0KGluZm9BZG1pblRpbWVyKTsKfQoKaWYgKCQoJyNjZmctbm9tZScpKSB7CiAgJCgnI2NmZy1ub21lJykuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7CiAgICBtYXJjYXJJZGVudEVkaXRhbmRvKCk7CiAgICBTLmlkZW50ID0gUy5pZGVudCB8fCB7fTsKICAgIFMuaWRlbnQubm9tZSA9ICQoJyNjZmctbm9tZScpLnZhbHVlOwogICAgcHJldmlld0lkZW50aWRhZGUoKTsKICB9KTsKICAkKCcjY2ZnLWNvcnAnKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHsKICAgIG1hcmNhcklkZW50RWRpdGFuZG8oKTsKICAgIFMuaWRlbnQgPSBTLmlkZW50IHx8IHt9OwogICAgUy5pZGVudC5jb3JwID0gJCgnI2NmZy1jb3JwJykudmFsdWU7CiAgICBwcmV2aWV3SWRlbnRpZGFkZSgpOwogIH0pOwp9CgppZiAoJCgnI2NmZy1sb2dvJykpIHsKICAkKCcjY2ZnLWxvZ28nKS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZXYpID0+IHsKICAgIGNvbnN0IGZpbGUgPSBldi50YXJnZXQuZmlsZXNbMF07CiAgICBpZiAoIWZpbGUpIHJldHVybjsKICAgIGlmICghL15pbWFnZVwvLy50ZXN0KGZpbGUudHlwZSkpIHJldHVybiBmbHV0dWFudGUoJ0VzY29saGEgdW0gYXJxdWl2byBkZSBpbWFnZW0gKFBORywgSlBHLi4uKS4nLCAnZXJybycpOwogICAgbWFyY2FySWRlbnRFZGl0YW5kbygpOwogICAgbGVySW1hZ2VtKGZpbGUsIDMyMCwgKGRhdGEpID0+IHsKICAgICAgaWYgKCFkYXRhKSByZXR1cm4gZmx1dHVhbnRlKCdOw6NvIGNvbnNlZ3VpIGxlciBlc3NhIGltYWdlbS4nLCAnZXJybycpOwogICAgICBTLmlkZW50ID0gUy5pZGVudCB8fCB7fTsKICAgICAgUy5pZGVudC5sb2dvID0gZGF0YTsKICAgICAgUy5pZGVudC5sb2dvTm92byA9IGRhdGE7CiAgICAgIFMuaWRlbnQucmVtb3ZlckxvZ28gPSBmYWxzZTsKICAgICAgcHJldmlld0lkZW50aWRhZGUoKTsKICAgICAgZmx1dHVhbnRlKCdGb3RvIGNhcnJlZ2FkYS4gQ2xpcXVlIGVtICJTYWx2YXIgaWRlbnRpZGFkZSIuJyk7CiAgICB9KTsKICB9KTsKfQoKaWYgKCQoJyNidG4tcmVtb3Zlci1sb2dvJykpIHsKICAkKCcjYnRuLXJlbW92ZXItbG9nbycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gewogICAgbWFyY2FySWRlbnRFZGl0YW5kbygpOwogICAgUy5pZGVudCA9IFMuaWRlbnQgfHwge307CiAgICBTLmlkZW50LmxvZ28gPSBudWxsOwogICAgUy5pZGVudC5sb2dvTm92byA9IHVuZGVmaW5lZDsKICAgIFMuaWRlbnQucmVtb3ZlckxvZ28gPSB0cnVlOwogICAgJCgnI2NmZy1sb2dvJykudmFsdWUgPSAnJzsKICAgIHByZXZpZXdJZGVudGlkYWRlKCk7CiAgfSk7Cn0KCmNvbnN0IGZvcm1DZmcgPSAkKCcjZm9ybS1jb25maWcnKTsKaWYgKGZvcm1DZmcpIGZvcm1DZmcuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgZXYucHJldmVudERlZmF1bHQoKTsKICBjb25zdCBub21lID0gU3RyaW5nKCQoJyNjZmctbm9tZScpLnZhbHVlIHx8ICcnKS50cmltKCk7CiAgaWYgKCFub21lKSByZXR1cm4gZmx1dHVhbnRlKCdFc2NyZXZhIGEgc2lnbGEgLyBub21lIGN1cnRvLicsICdlcnJvJyk7CiAgY29uc3QgaSA9IFMuaWRlbnQgfHwge307CiAgY29uc3QgY29ycG8gPSB7CiAgICBub21lU2lzdGVtYTogbm9tZSwKICAgIG5vbWVDb3Jwb3JhY2FvOiBTdHJpbmcoJCgnI2NmZy1jb3JwJykudmFsdWUgfHwgJycpLnRyaW0oKSwKICAgIHRlbWE6IGkudGVtYSB8fCBURU1BX1BBRFJBTywKICB9OwogIGlmIChpLmxvZ29Ob3ZvKSBjb3Jwby5sb2dvID0gaS5sb2dvTm92bzsgICAgICAgIC8vIGZvdG8gbm92YSBlc2NvbGhpZGEgYWdvcmEKICBlbHNlIGlmIChpLnJlbW92ZXJMb2dvKSBjb3Jwby5sb2dvID0gJyc7ICAgICAgICAvLyBxdWVyIHRpcmFyIGEgZm90bwogIHRyeSB7CiAgICBjb25zdCByID0gYXdhaXQgYXBpKCdQVVQnLCAnL2NvbmZpZycsIGNvcnBvKTsKICAgIFMuaWRlbnRFZGl0YW5kbyA9IGZhbHNlOwogICAgaWYgKFMuZGFkb3MpIFMuZGFkb3MuY29uZmlnID0gci5jb25maWc7CiAgICBTLmlkZW50ID0gaWRlbnREb1NlcnZpZG9yKHIuY29uZmlnKTsKICAgIGFwbGljYXJJZGVudGlkYWRlKHIuY29uZmlnKTsKICAgIHByZXZpZXdJZGVudGlkYWRlKCk7CiAgICBmbHV0dWFudGUoJ0lkZW50aWRhZGUgYXR1YWxpemFkYTogJyArIHIuY29uZmlnLm5vbWVTaXN0ZW1hKTsKICAgIGF3YWl0IGNhcnJlZ2FyKCk7CiAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9Cn0pOwoKJCgnI2J0bi1iYWNrdXAnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHsKICB0cnkgewogICAgY29uc3QgciA9IGF3YWl0IGFwaSgnR0VUJywgJy9iYWNrdXAnKTsKICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbSlNPTi5zdHJpbmdpZnkociwgbnVsbCwgMildLCB7IHR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTsKICAgIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7CiAgICBhLmhyZWYgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpOwogICAgYS5kb3dubG9hZCA9ICdiYWNrdXAtJyArIG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxOSkucmVwbGFjZSgvWzpUXS9nLCAnLScpICsgJy5qc29uJzsKICAgIGEuY2xpY2soKTsKICAgIFVSTC5yZXZva2VPYmplY3RVUkwoYS5ocmVmKTsKICAgIGZsdXR1YW50ZSgnQmFja3VwIGJhaXhhZG8uJyk7CiAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9Cn0pOwoKJCgnI2luLXJlc3RvcmUnKS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBhc3luYyAoZXYpID0+IHsKICBjb25zdCBmaWxlID0gZXYudGFyZ2V0LmZpbGVzWzBdOwogIGlmICghZmlsZSkgcmV0dXJuOwogIGlmICghY29uZmlybSgnUmVzdGF1cmFyIGVzdGUgYmFja3VwPyBPcyBkYWRvcyBhdHVhaXMgc2Vyw6NvIHN1YnN0aXR1w61kb3MuJykpIHsgZXYudGFyZ2V0LnZhbHVlID0gJyc7IHJldHVybjsgfQogIHRyeSB7CiAgICBjb25zdCB0ZXh0byA9IGF3YWl0IGZpbGUudGV4dCgpOwogICAgY29uc3QgZGFkb3MgPSBKU09OLnBhcnNlKHRleHRvKTsKICAgIGF3YWl0IGFwaSgnUE9TVCcsICcvcmVzdG9yZScsIHsgZGFkb3MgfSk7CiAgICBhd2FpdCBjYXJyZWdhcigpOwogICAgZmx1dHVhbnRlKCdCYWNrdXAgcmVzdGF1cmFkby4nKTsKICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZSgnRmFsaGEgYW8gcmVzdGF1cmFyOiAnICsgZS5tZXNzYWdlLCAnZXJybycpOyB9CiAgZXYudGFyZ2V0LnZhbHVlID0gJyc7Cn0pOwoKLy8g4pSA4pSAIG5vdGlmaWNhw6fDtWVzIOKUgOKUgApmdW5jdGlvbiByZW5kZXJOb3RpZkJhZGdlKCkgewogIGNvbnN0IG5hb0xpZGFzID0gKFMuZGFkb3Mubm90aWZpY2Fjb2VzIHx8IFtdKS5maWx0ZXIoKG4pID0+ICFuLmxpZGEpLmxlbmd0aDsKICBjb25zdCBiID0gJCgnI25vdGlmLWJhZGdlJyk7CiAgYi50ZXh0Q29udGVudCA9IG5hb0xpZGFzOwogIGIuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgbmFvTGlkYXMgPT09IDApOwp9CgokKCcjYnRuLW5vdGlmJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7CiAgY29uc3QgbnMgPSAoUy5kYWRvcy5ub3RpZmljYWNvZXMgfHwgW10pOwogIGFicmlyTW9kYWwoJ05vdGlmaWNhw6fDtWVzJywgbnMubGVuZ3RoID8gbnMubWFwKChuKSA9PiBgCiAgICA8ZGl2IGNsYXNzPSJub3RpZi1pdGVtIj4KICAgICAgPHN0cm9uZz4ke2VzY2FwZUh0bWwobi50aXR1bG8pfTwvc3Ryb25nPgogICAgICA8c21hbGw+JHtkYXRhQlIobi5lbSl9PC9zbWFsbD4KICAgICAgPHA+JHtlc2NhcGVIdG1sKG4udGV4dG8pfTwvcD4KICAgIDwvZGl2PmApLmpvaW4oJycpIDogJzxkaXYgY2xhc3M9InZhemlvIj5OYWRhIHBvciBhcXVpLjwvZGl2PicpOwogIHRyeSB7IGF3YWl0IGFwaSgnUE9TVCcsICcvbm90aWZpY2Fjb2VzL2xlcicpOyBhd2FpdCBjYXJyZWdhcigpOyB9IGNhdGNoIChfKSB7fQp9KTsKCgovLyBsaXN0ZW5lcnMgZml4b3MgZGFzIHRlbGFzIG5vdmFzCiQoJyNidG4tYWJyaXItcHJvdmEnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG1vZGFsTm92YVByb3ZhKTsKJCgnI2J0bi1hYnJpci1lc3R1ZG8nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IG1vZGFsRXN0dWRvKCkpOwokKCcjZm9ybS1yZWdyYXMnKS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBhc3luYyAoZXYpID0+IHsKICBldi5wcmV2ZW50RGVmYXVsdCgpOwogIHRyeSB7CiAgICBhd2FpdCBhcGkoJ1BVVCcsICcvcmVncmFzJywgeyB0ZXh0bzogJCgnI3JlZ3Jhcy10ZXh0by1lZCcpLnZhbHVlIH0pOwogICAgJCgnI3JlZ3Jhcy10ZXh0by1lZCcpLmJsdXIoKTsKICAgIGF3YWl0IGNhcnJlZ2FyKCk7CiAgICBmbHV0dWFudGUoJ1JlZ3JhcyBzYWx2YXMuJyk7CiAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9Cn0pOwoKLy8g4pSA4pSAIGF0dWFsaXphw6fDo28gYXV0b23DoXRpY2Eg4pSA4pSACmxldCBwb2xsaW5nID0gbnVsbDsKZnVuY3Rpb24gaW5pY2lhclBvbGxpbmcoKSB7CiAgY2xlYXJJbnRlcnZhbChwb2xsaW5nKTsKICAvLyBjcm9uw7RtZXRybyBkbyBwb250byBhbyB2aXZvIChhdHVhbGl6YSBhIGNhZGEgc2VndW5kbywgcGFyYSBxdWFuZG8gZXN0w6EgcGF1c2FkbykKICBzZXRJbnRlcnZhbCgoKSA9PiB7CiAgICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwb250by10ZW1wby12aXZvJyk7CiAgICBpZiAoIWVsIHx8ICFTLnBvbnRvQWJlcnRvKSByZXR1cm47CiAgICBlbC50ZXh0Q29udGVudCA9IGNyb25vbWV0cm8obXNUcmFiYWxob1BvbnRvKFMucG9udG9BYmVydG8pKTsKICB9LCAxMDAwKTsKCiAgcG9sbGluZyA9IHNldEludGVydmFsKGFzeW5jICgpID0+IHsKICAgIGlmICghUy50b2tlbiB8fCBkb2N1bWVudC5oaWRkZW4pIHJldHVybjsKICAgIHRyeSB7CiAgICAgIGF3YWl0IGNhcnJlZ2FyKCk7CiAgICB9IGNhdGNoIChfKSB7fQogIH0sIDEwMDAwKTsKfQoKLy8g4pSA4pSAIGJvb3Qg4pSA4pSACmFzeW5jIGZ1bmN0aW9uIGNhcnJlZ2FySWRlbnRpZGFkZVB1YmxpY2EoKSB7CiAgdHJ5IHsKICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKCcvYXBpL2lkZW50aWRhZGUnKTsKICAgIGlmICghcmVzLm9rKSByZXR1cm47CiAgICBhcGxpY2FySWRlbnRpZGFkZShhd2FpdCByZXMuanNvbigpKTsKICB9IGNhdGNoIChfKSB7fQp9CgooYXN5bmMgZnVuY3Rpb24gYm9vdCgpIHsKICBhd2FpdCBjYXJyZWdhcklkZW50aWRhZGVQdWJsaWNhKCk7CiAgbW9udGFyVGVtYXMoKTsKICBpZiAoIVMudG9rZW4pIHJldHVybjsKICB0cnkgewogICAgY29uc3QgciA9IGF3YWl0IGFwaSgnR0VUJywgJy9tZScpOwogICAgUy5ldSA9IHIudXNlcjsKICAgIGF3YWl0IGVudHJhcigpOwogIH0gY2F0Y2ggKF8pIHsgc2FpckxvY2FsKCk7IH0KfSkoKTsK"};
const EMBUTIDOS_BUF = {};
Object.keys(EMBUTIDOS).forEach((k) => { EMBUTIDOS_BUF[k] = Buffer.from(EMBUTIDOS[k], 'base64'); });

function serveEstatico(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  if (EMBUTIDOS_BUF[rel]) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream', 'Content-Length': EMBUTIDOS_BUF[rel].length });
    return res.end(EMBUTIDOS_BUF[rel]);
  }
  const file = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('403'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    return res.end();
  }
  if (url.split('?')[0] === '/logo') {
    const c = db.config || {};
    if (!c.logo) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('sem foto'); }
    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(c.logo);
    if (!m) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('sem foto'); }
    const buf = Buffer.from(m[2], 'base64');
    res.writeHead(200, { 'Content-Type': m[1], 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=31536000, immutable' });
    return res.end(buf);
  }
  if (url.split('?')[0].startsWith('/foto/ocorrencia/')) {
    const id = url.split('?')[0].slice('/foto/ocorrencia/'.length).replace(/\/+$/, '');
    const oc = db.ocorrencias.find((o) => o.id === id);
    const m = oc && /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(oc.foto || '');
    if (!m) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('sem foto'); }
    const buf = Buffer.from(m[2], 'base64');
    res.writeHead(200, {
      'Content-Type': m[1],
      'Content-Length': buf.length,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    });
    return res.end(buf);
  }
  if (url.startsWith('/api')) {
    const seg = url.slice(5).split('?')[0].replace(/^\/+/, '');
    try {
      return await api(req, res, seg);
    } catch (e) {
      console.error('Erro na API:', e.message);
      return json(res, 500, { error: e.message || 'Erro interno.' });
    }
  }
  return serveEstatico(req, res, url);
});

async function iniciar() {
  const temBanco = abrirBanco();
  let carregou = false;
  if (temBanco) {
    try {
      carregou = await carregarDoBanco();
      if (carregou) console.log('Dados carregados do banco de dados (nada se perde ao reiniciar).');
      else console.log('Banco vazio: criando os dados iniciais.');
    } catch (e) {
      console.error('Não consegui acessar o banco (' + e.message + '). Usando data.json por enquanto.');
      pool = null;
    }
  } else {
    console.log('Sem DATABASE_URL: usando data.json (os dados somem quando o Render reinicia).');
  }
  if (!carregou) loadDB();
  migrar();
  seed();
  server.listen(PORT, () => {
    console.log('\n  SIGP rodando em http://localhost:' + PORT);
    if (pool) console.log('  Banco de dados: ligado (persistente).');
    console.log('  Login inicial: admin / admin123  (troque a senha depois)\n');
  });
}
iniciar();
