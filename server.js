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
  'Agente Oficial':   { nivel: 50,  label: 'Agente Oficial' },
  'Guarda Municipal': { nivel: 40,  label: 'Guarda Municipal' },
  'Civil':            { nivel: 10,  label: 'Civil' },
};
const nivel = (c) => (CARGOS[c] ? CARGOS[c].nivel : 0);

// ───────── banco de dados (arquivo JSON) ─────────
const REGRAS_PADRAO = "***REGRAS DA BÍBLIA RP***\n\n• 4.1 | É proibido a prática de MDM (Mass Deathmatch), que consiste em matar ou causar dano a três ou mais jogadores sem motivo válido dentro do RP.\nPunição: Prisão por 60 minutos, restrição de armas / Banimento de 3 a 7 dias.\n\n• 4.2 | PVP SEM MOTIVO\nÉ proibido iniciar PVP, disparar ou matar outro jogador sem possuir um motivo válido de Roleplay e sem interação prévia. Todo confronto deve possuir contexto e justificativa dentro do RP, sendo proibido iniciar ataques por diversão, vingança sem contexto, conflitos externos ao jogo ou apenas por pertencer a outra organização ou família. O PVP também é proibido em Zonas Seguras, independentemente do motivo.\nPunições:\n• 1ª ocorrência: Jail 60 minutos.\n• 2ª ocorrência no mesmo dia: Jail 120 minutos.\n• 3ª ocorrência: Banimento de 3 dias.\n• PVP em Zona Segura: Banimento de 3 dias.\n\n• 4.3 | É proibido a prática de VDM (Vehicle Deathmatch), que consiste em atropelar jogadores de forma intencional.\nPunição: Prisão por 60 minutos / Banimento de 1 a 5 dias.\n\n• 4.4 | É proibido MG (Metagaming), que consiste em utilizar informações obtidas fora do jogo para benefício próprio ou para prejudicar outro jogador.\nNota: É proibido o uso de emotions/emotes como \"=D\" no chat IC.\nPunição: Prisão por 60 minutos / Banimento de 1 a 3 dias.\n\n• 4.5 | É proibido CL (Combat Log), que consiste em sair do jogo durante uma ação para obter benefício, como evitar ser sequestrado, morto ou preso.\nPunição: Prisão por 60 minutos / Banimento de 1 a 3 dias.\n\n• 4.6 | É expressamente proibido DM (Deathmatch), que consiste em matar ou causar dano a outro jogador sem qualquer motivo válido dentro do RP.\nPunição: Prisão por 60 minutos / Banimento de 1 a 3 dias.\n\n• 4.7 | É proibido RK (Revenge Kill), que consiste em matar ou causar dano a um jogador com o objetivo de vingança por ter sido morto em uma vida anterior.\nPunição: Prisão por 60 minutos / Banimento de 1 a 3 dias.\n\n• 4.8 | É proibido SK (Spawn Kill), que consiste em matar ou causar dano a jogadores no território de qualquer facção ou organização, bem como em locais de spawn do jogador.\nPunição: Prisão por 60 minutos / Banimento de 1 a 5 dias.\n\n• 4.9 | É proibido TK (Team Kill), que consiste em matar ou causar dano a um membro da própria facção ou de facção aliada, sem qualquer motivo válido dentro do RP.\nPunição: Prisão por 40 minutos / Banimento de 1 a 2 dias.\n\n• 4.10 | É extremamente proibido cometer SAAV (Sem Amor à Vida): ato de não se importar com a própria vida no jogo, escolhendo morrer em vez de cooperar com a ação.\nPunição: prisão de 40 minutos / banimento de 1 a 3 dias.\n\n• 4.11 | É proibido Flaming RP\nÉ o uso de ofensas, insultos ou discurso de ódio direcionado a outros jogadores durante o RP.\nPunição: De acordo com a gravidade | Prisão + Mute de 60 minutos / Banimento de 1 a 30 dias.\n\n• 4.12 | É proibido KOS (Kill On Sight / Mate à Vista)\nÉ o ato de matar outro jogador de organização, facção ou família à vista, sem motivo ou contexto de RP.\nExemplo: na vida real, você não mataria uma pessoa apenas por ela pertencer a uma corporação policial.\nPunição: Prisão de 60 minutos / Banimento de 1 a 5 dias.\n\n• 4.13 | É proibido PK (Player Kill)\nRefere-se à morte do personagem, na qual o jogador perde toda a memória relacionada à pessoa que o matou e aos acontecimentos que levaram à sua morte. É proibido utilizar essas informações após o PK.\nPunição: Prisão de 60 minutos / Banimento de 1 a 5 dias.\n\n• 4.14 | É proibido RPFW (Roleplay For The Win)\nÉ o ato de desenvolver um RP visando apenas o próprio benefício, onde o jogador busca sempre \"ganhar\", ignorando consequências ou a lógica da vida real. Na vida real, ninguém vence todas as situações.\nExemplos:\nVenda de vagas ou benefícios em geral.\nIr para zona safe em meio a uma ação.\nTentar utilizar alguma regra para prejudicar outros jogadores ou se beneficiar intencionalmente.\nGuardar veículos de trabalho em locais privados para obter vantagem.\nPunição: Prisão de 60 minutos / Banimento de 1 a 5 dias.\n\n• 4.15 | É proibido MIX\nÉ o ato de misturar assuntos ou informações fora do RP dentro do RP, quebrando a imersão do personagem.\nPunição: Prisão de 60 minutos / Banimento de 1 a 5 dias.\n\n• 4.16 | É proibido a criação de múltiplas contas para transferência de dinheiro\nÉ proibido criar ou utilizar várias contas com o objetivo de transferir dinheiro ou obter vantagens para a conta principal.\nNota:\nÉ estritamente proibido criar e utilizar múltiplas contas com o objetivo de se beneficiar de maneira injusta, prejudicar outros membros do servidor, ou manipular resultados de forma abusiva.\nIsso inclui, mas não se limita a:\n- Utilizar várias contas para obter vantagens indevidas em eventos, guerras ou trocas.\n- Prejudicar intencionalmente outros jogadores com ações coordenadas entre suas contas.\n- Tentar azaralhar ou sabotar servidores, eventos ou a comunidade como um todo.\n- Qualquer violação desta regra será punida com banimento. Não há tolerância para trapaças, manipulação ou ações que comprometam a integridade do servidor.\nPunição: Banimento de 30 dias / Banimento por IP / Permanente\n\n• 4.17 | É proibido AAP (ATRAPALHAR AÇÃO PROPOSITALMENTE), que consiste em interferir de forma intencional em uma ação em andamento.\nExemplo: atrapalhar uma abordagem batendo em outros jogadores, gritando no VOIP, floodando o chat, entre outros.\nPunição: prisão 60 minutos | Ban 1 a 3 dias.\n\n• 4.18 | É proibido DMA (DEATH MATCH AUTO) causar danos a veículos públicos ou pessoais sem motivo.\nPunição: chute | prisão 30 minutos.\n\n• 4.19 | É proibido NRA (NON ROLEPLAY AMBIENTE) utilizar armas em locais públicos, como hospital, delegacia, prefeitura, feirinha, Igreja, leilões, locais de trabalho e praças.\nPunição: prisão 20 minutos.\n\n• 4.20 | É proibido AI (AÇÃO IRREGULAR)\nAto de invadir ou permanecer ao redor de propriedades privadas de outros jogadores, como casas e mansões, com o intuito de forçar uma ação, causando danos diretos ao RP.\nPunição: Banimento de 10 dias. Caso seja família em ação conjunta, sujeito a Aviso de família / Ban IP.";

const DB_VAZIO = { users: [], ocorrencias: [], pontos: [], chat: [], audit: [], notificacoes: [], provas: [], entregas: [], ponto: [], estudos: [], estudosLidos: [], config: {} };
let db = {
  ...DB_VAZIO,
  config: { nomeSistema: 'SIGP', nomeCorporacao: 'Grupamento Municipal de Policiamento', regras: REGRAS_PADRAO },
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
  saveDBNow();
}

let saveTimer = null;
function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }, 40);
}
function saveDBNow() {
  clearTimeout(saveTimer);
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
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
      config: db.config,
      cargos: Object.keys(CARGOS).map((c) => ({ nome: c, nivel: CARGOS[c].nivel })),
      users: db.users.map(publico),
      ocorrencias: db.ocorrencias,
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
    const cargo = CARGOS[b.cargo] ? b.cargo : 'Guarda Municipal';
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
  if (seg === 'ocorrencias' && metodo === 'POST') {
    const b = await lerCorpo(req);
    if (!b.titulo && !b.agente) return json(res, 400, { error: 'Informe o agente/título da ocorrência.' });
    const oc = {
      id: uid(),
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
    const podeMexer = nivel(eu.cargo) >= 60 || oc.criadoPor === eu.login;
    if (metodo === 'PUT') {
      if (!podeMexer) return json(res, 403, { error: 'Sem permissão para editar esta ocorrência.' });
      const b = await lerCorpo(req);
      ['titulo', 'agente', 'cargoAgente', 'status', 'responsavel', 'depoimento', 'resposta'].forEach((k) => {
        if (typeof b[k] === 'string') oc[k] = b[k].slice(0, k === 'depoimento' || k === 'resposta' ? 4000 : 120);
      });
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

  // ---- bate ponto ----
  if (seg === 'ponto' && metodo === 'POST') {
    const b = await lerCorpo(req);
    const acao = b.acao === 'saida' ? 'saida' : 'entrada';
    const aberto = db.ponto.find((p) => p.userId === eu.id && !p.saida);
    if (acao === 'entrada') {
      if (aberto) return json(res, 400, { error: 'Você já bateu entrada às ' + horaBR(aberto.entrada) + '. Finalize o ponto primeiro.' });
      const reg = { id: uid(), userId: eu.id, login: eu.login, nome: eu.nome, cargo: eu.cargo, entrada: agora(), saida: null, minutos: null };
      db.ponto.unshift(reg);
      if (db.ponto.length > 5000) db.ponto.length = 5000;
      saveDB();
      log(eu.login, 'PONTO_ENTRADA', 'entrada às ' + horaBR(reg.entrada));
      return json(res, 200, { registro: reg });
    }
    if (!aberto) return json(res, 400, { error: 'Você não tem ponto aberto. Bata a entrada primeiro.' });
    aberto.saida = agora();
    aberto.minutos = Math.max(1, Math.round((new Date(aberto.saida) - new Date(aberto.entrada)) / 60000));
    saveDB();
    log(eu.login, 'PONTO_SAIDA', `saída às ${horaBR(aberto.saida)} | ${aberto.minutos} min`);
    return json(res, 200, { registro: aberto });
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
    if (typeof b.nomeCorporacao === 'string' && b.nomeCorporacao.trim()) db.config.nomeCorporacao = b.nomeCorporacao.trim().slice(0, 80);
    saveDB();
    log(eu.login, 'CONFIG_ALTERADA', `${db.config.nomeSistema} | ${db.config.nomeCorporacao}`);
    return json(res, 200, { config: db.config });
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
const EMBUTIDOS = {"/index.html":"PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9InB0LUJSIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xIj4KPHRpdGxlPlNJR1Ag4oCUIFNpc3RlbWEgSW50ZXJubzwvdGl0bGU+CjxsaW5rIHJlbD0icHJlY29ubmVjdCIgaHJlZj0iaHR0cHM6Ly9mb250cy5nb29nbGVhcGlzLmNvbSI+CjxsaW5rIGhyZWY9Imh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzMj9mYW1pbHk9SW50ZXI6d2dodEA0MDA7NTAwOzYwMDs3MDA7ODAwJmRpc3BsYXk9c3dhcCIgcmVsPSJzdHlsZXNoZWV0Ij4KPGxpbmsgcmVsPSJzdHlsZXNoZWV0IiBocmVmPSJzdHlsZS5jc3MiPgo8L2hlYWQ+Cjxib2R5PgoKPCEtLSDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgTE9HSU4g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIC0tPgo8c2VjdGlvbiBpZD0idGVsYS1sb2dpbiIgY2xhc3M9ImxvZ2luLXdyYXAiPgogIDxkaXYgY2xhc3M9ImxvZ2luLWNhcmQiPgogICAgPGRpdiBjbGFzcz0ibG9naW4tYmFkZ2UiPuKWuDwvZGl2PgogICAgPGgxIGlkPSJsb2dpbi1ub21lIj5TSUdQPC9oMT4KICAgIDxwIGNsYXNzPSJzdWIiIGlkPSJsb2dpbi1zdWIiPkdydXBhbWVudG8gTXVuaWNpcGFsIGRlIFBvbGljaWFtZW50bzwvcD4KICAgIDxwIGNsYXNzPSJ0YWciPkFDRVNTTyBSRVNUUklUTzwvcD4KICAgIDxmb3JtIGlkPSJmb3JtLWxvZ2luIiBhdXRvY29tcGxldGU9Im9mZiI+CiAgICAgIDxsYWJlbD5Vc3XDoXJpbzxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0iaW4tbG9naW4iIHJlcXVpcmVkIGF1dG9jb21wbGV0ZT0idXNlcm5hbWUiPjwvbGFiZWw+CiAgICAgIDxsYWJlbD5TZW5oYQogICAgICAgIDxzcGFuIGNsYXNzPSJzZW5oYS13cmFwIj4KICAgICAgICAgIDxpbnB1dCB0eXBlPSJwYXNzd29yZCIgaWQ9ImluLXNlbmhhIiByZXF1aXJlZCBhdXRvY29tcGxldGU9ImN1cnJlbnQtcGFzc3dvcmQiPgogICAgICAgICAgPGJ1dHRvbiB0eXBlPSJidXR0b24iIGlkPSJidG4tb2xobyIgdGl0bGU9Im1vc3RyYXIgc2VuaGEiPvCfkYE8L2J1dHRvbj4KICAgICAgICA8L3NwYW4+CiAgICAgIDwvbGFiZWw+CiAgICAgIDxkaXYgaWQ9ImxvZ2luLWVycm8iIGNsYXNzPSJlcnJvIGhpZGRlbiI+PC9kaXY+CiAgICAgIDxidXR0b24gdHlwZT0ic3VibWl0IiBjbGFzcz0iYnRuLXByaW1hcmlvIj7ilrggQVVURU5USUNBUjwvYnV0dG9uPgogICAgPC9mb3JtPgogICAgPHAgY2xhc3M9ImF2aXNvIj5Ow6NvIHRlbSBhY2Vzc28/IFPDsyBvIEFkbWluIE1hc3RlciBlIG8gQ2hlZmUgZGUgUG9sw61jaWEgY2FkYXN0cmFtIG5vdm9zIG1lbWJyb3MuPC9wPgogICAgPHAgY2xhc3M9ImF2aXNvIj5BY2Vzc28gbW9uaXRvcmFkby4gTyB1c28gaW5kZXZpZG8gcmVzdWx0YXLDoSBlbSBwdW5pw6fDo28gYWRtaW5pc3RyYXRpdmEuPC9wPgogIDwvZGl2Pgo8L3NlY3Rpb24+Cgo8IS0tIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBURUxBIERFIFNVU1BFTlPDg08g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIC0tPgo8c2VjdGlvbiBpZD0idGVsYS1zdXNwZW5zYW8iIGNsYXNzPSJsb2dpbi13cmFwIGhpZGRlbiI+CiAgPGRpdiBjbGFzcz0ibG9naW4tY2FyZCBzdXNwZW5zbyI+CiAgICA8ZGl2IGNsYXNzPSJzdXNwLWljb25lIj7im5Q8L2Rpdj4KICAgIDxoMT5BQ0VTU08gU1VTUEVOU088L2gxPgogICAgPHAgY2xhc3M9InN1YiI+Vm9jw6ogZXN0w6EgdGVtcG9yYXJpYW1lbnRlIHN1c3BlbnNvIGRvIHNpc3RlbWE8L3A+CiAgICA8ZGl2IGNsYXNzPSJjcm9ub21ldHJvIiBpZD0ic3VzcC10ZW1wbyI+MDA6MDA6MDA8L2Rpdj4KICAgIDxkaXYgY2xhc3M9InN1c3AtaW5mbyI+CiAgICAgIDxkaXY+PHNwYW4+QXBsaWNhZG8gcG9yPC9zcGFuPjxzdHJvbmcgaWQ9InN1c3AtcG9yIj7igJQ8L3N0cm9uZz48L2Rpdj4KICAgICAgPGRpdj48c3Bhbj5Nb3Rpdm88L3NwYW4+PHN0cm9uZyBpZD0ic3VzcC1tb3Rpdm8iPuKAlDwvc3Ryb25nPjwvZGl2PgogICAgICA8ZGl2PjxzcGFuPkV4cGlyYSBlbTwvc3Bhbj48c3Ryb25nIGlkPSJzdXNwLWV4cGlyYSI+4oCUPC9zdHJvbmc+PC9kaXY+CiAgICA8L2Rpdj4KICAgIDxidXR0b24gY2xhc3M9ImJ0bi1zZWN1bmRhcmlvIiBpZD0iYnRuLXZvbHRhci1sb2dpbiI+Vm9sdGFyIGFvIGxvZ2luPC9idXR0b24+CiAgPC9kaXY+Cjwvc2VjdGlvbj4KCjwhLS0g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIEFQUCDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgLS0+CjxkaXYgaWQ9ImFwcCIgY2xhc3M9ImFwcCBoaWRkZW4iPgogIDxhc2lkZSBjbGFzcz0ic2lkZWJhciIgaWQ9InNpZGViYXIiPgogICAgPGRpdiBjbGFzcz0ibWFyY2EiPgogICAgICA8ZGl2IGNsYXNzPSJtYXJjYS1pY29uZSI+4pa4PC9kaXY+CiAgICAgIDxkaXY+PHN0cm9uZyBpZD0ibWFyY2Etbm9tZSI+U0lHUDwvc3Ryb25nPjxzbWFsbCBpZD0ibWFyY2Etc3ViIj5TaXN0ZW1hIEludGVybm88L3NtYWxsPjwvZGl2PgogICAgPC9kaXY+CiAgICA8bmF2IGlkPSJuYXYiPgogICAgICA8YnV0dG9uIGNsYXNzPSJuYXYtaXRlbSBhdGl2byIgZGF0YS10ZWxhPSJkYXNoYm9hcmQiPjxzcGFuPuKWpjwvc3Bhbj4gUGFpbmVsPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9Im5hdi1pdGVtIiBkYXRhLXRlbGE9Im9jb3JyZW5jaWFzIj48c3Bhbj7wn5OLPC9zcGFuPiBPY29ycsOqbmNpYXM8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ibmF2LWl0ZW0iIGRhdGEtdGVsYT0icHJvdmFzIj48c3Bhbj7wn5OdPC9zcGFuPiBQcm92YXM8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ibmF2LWl0ZW0iIGRhdGEtdGVsYT0icG9udG8iPjxzcGFuPvCflZI8L3NwYW4+IEJhdGUgUG9udG88L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ibmF2LWl0ZW0iIGRhdGEtdGVsYT0iaGllcmFycXVpYSI+PHNwYW4+8J+Olu+4jzwvc3Bhbj4gSGllcmFycXVpYTwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJuYXYtaXRlbSIgZGF0YS10ZWxhPSJyZWdyYXMiPjxzcGFuPvCfk5w8L3NwYW4+IFJlZ3JhcyBkbyBSUDwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJuYXYtaXRlbSIgZGF0YS10ZWxhPSJlc3R1ZG9zIj48c3Bhbj7wn5OaPC9zcGFuPiBFc3R1ZG9zPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9Im5hdi1pdGVtIiBkYXRhLXRlbGE9ImVmZXRpdm8iPjxzcGFuPvCfka48L3NwYW4+IEVmZXRpdm88L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ibmF2LWl0ZW0iIGRhdGEtdGVsYT0icG9udG9zIj48c3Bhbj7irZA8L3NwYW4+IFBvbnR1YcOnw6NvPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9Im5hdi1pdGVtIiBkYXRhLXRlbGE9ImNoYXQiPjxzcGFuPvCfkqw8L3NwYW4+IENoYXQ8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ibmF2LWl0ZW0iIGRhdGEtdGVsYT0iYXVkaXRvcmlhIj48c3Bhbj7wn5uh77iPPC9zcGFuPiBBdWRpdG9yaWE8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ibmF2LWl0ZW0iIGRhdGEtdGVsYT0icGVyZmlsIj48c3Bhbj7wn5GkPC9zcGFuPiBNZXUgUGVyZmlsPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9Im5hdi1pdGVtIiBkYXRhLXRlbGE9ImFkbWluIiBpZD0ibmF2LWFkbWluIj48c3Bhbj7impnvuI88L3NwYW4+IEFkbWluaXN0cmHDp8OjbzwvYnV0dG9uPgogICAgPC9uYXY+CiAgICA8ZGl2IGNsYXNzPSJzaWRlYmFyLXBlIj4KICAgICAgPGRpdiBjbGFzcz0iZXUiPgogICAgICAgIDxkaXYgY2xhc3M9ImF2YXRhciIgaWQ9ImV1LWF2YXRhciI+PzwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9ImV1LWluZm8iPjxzdHJvbmcgaWQ9ImV1LW5vbWUiPuKAlDwvc3Ryb25nPjxzbWFsbCBpZD0iZXUtY2FyZ28iPuKAlDwvc21hbGw+PC9kaXY+CiAgICAgIDwvZGl2PgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4tc2FpciIgaWQ9ImJ0bi1zYWlyIj7ij7sgU2FpcjwvYnV0dG9uPgogICAgPC9kaXY+CiAgPC9hc2lkZT4KCiAgPG1haW4gY2xhc3M9ImNvbnRldWRvIj4KICAgIDxoZWFkZXIgY2xhc3M9InRvcGJhciI+CiAgICAgIDxkaXY+CiAgICAgICAgPGgyIGlkPSJ0aXR1bG8tdGVsYSI+UGFpbmVsPC9oMj4KICAgICAgICA8cCBjbGFzcz0idG9wYmFyLXN1YiIgaWQ9InN1YnRpdHVsby10ZWxhIj5WaXPDo28gZ2VyYWwgZG8gZ3J1cGFtZW50bzwvcD4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InRvcGJhci1kaXIiPgogICAgICAgIDxidXR0b24gY2xhc3M9InNpbm8iIGlkPSJidG4tbm90aWYiPvCflJQ8YiBpZD0ibm90aWYtYmFkZ2UiIGNsYXNzPSJoaWRkZW4iPjA8L2I+PC9idXR0b24+CiAgICAgIDwvZGl2PgogICAgPC9oZWFkZXI+CgogICAgPGRpdiBpZD0ibWVuc2FnZW0tZmx1dHVhbnRlIiBjbGFzcz0iZmx1dHVhbnRlIGhpZGRlbiI+PC9kaXY+CgogICAgPCEtLSBQQUlORUwgLS0+CiAgICA8c2VjdGlvbiBjbGFzcz0idGVsYSIgaWQ9InRlbGEtZGFzaGJvYXJkIj4KICAgICAgPGRpdiBjbGFzcz0iY2FyZHMiIGlkPSJjYXJkcy1kYXNoYm9hcmQiPjwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJkdWFzLWNvbHVuYXMiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+PGgzPk9jb3Jyw6puY2lhcyByZWNlbnRlczwvaDM+PC9kaXY+CiAgICAgICAgICA8ZGl2IGlkPSJkYXNoLW9jb3JyZW5jaWFzIj48L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5SYW5raW5nIGRlIHBvbnRvczwvaDM+PC9kaXY+CiAgICAgICAgICA8ZGl2IGlkPSJkYXNoLXJhbmtpbmciPjwvZGl2PgogICAgICAgIDwvZGl2PgogICAgICA8L2Rpdj4KICAgIDwvc2VjdGlvbj4KCiAgICA8IS0tIE9DT1JSw4pOQ0lBUyAtLT4KICAgIDxzZWN0aW9uIGNsYXNzPSJ0ZWxhIGhpZGRlbiIgaWQ9InRlbGEtb2NvcnJlbmNpYXMiPgogICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj4KICAgICAgICAgIDxoMz5SZWdpc3RyYXIgb2NvcnLDqm5jaWE8L2gzPgogICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIiBpZD0iYnRuLWFicmlyLW9jb3JyZW5jaWEiPisgTm92YSBvY29ycsOqbmNpYTwvYnV0dG9uPgogICAgICAgIDwvZGl2PgogICAgICAgIDxkaXYgaWQ9Imxpc3RhLW9jb3JyZW5jaWFzIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L3NlY3Rpb24+CgogICAgPCEtLSBFRkVUSVZPIC0tPgogICAgPHNlY3Rpb24gY2xhc3M9InRlbGEgaGlkZGVuIiBpZD0idGVsYS1lZmV0aXZvIj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+CiAgICAgICAgICA8aDM+RWZldGl2bzwvaDM+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJ0b3BvLWFjb2VzIj4KICAgICAgICAgICAgPGlucHV0IHR5cGU9InNlYXJjaCIgaWQ9ImJ1c2NhLWVmZXRpdm8iIHBsYWNlaG9sZGVyPSJCdXNjYXIgbm9tZSBvdSBsb2dpbi4uLiI+CiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSIgaWQ9ImJ0bi1hYnJpci11c3VhcmlvIj4rIE5vdm8gdXN1w6FyaW88L2J1dHRvbj4KICAgICAgICAgIDwvZGl2PgogICAgICAgIDwvZGl2PgogICAgICAgIDxkaXYgaWQ9InRhYmVsYS1lZmV0aXZvIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L3NlY3Rpb24+CgogICAgPCEtLSBQT05UT1MgLS0+CiAgICA8c2VjdGlvbiBjbGFzcz0idGVsYSBoaWRkZW4iIGlkPSJ0ZWxhLXBvbnRvcyI+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5MYW7Dp2FyIHBvbnRvczwvaDM+PC9kaXY+CiAgICAgICAgPGZvcm0gaWQ9ImZvcm0tcG9udG9zIiBjbGFzcz0iZm9ybS1saW5oYSI+CiAgICAgICAgICA8bGFiZWw+UG9saWNpYWw8c2VsZWN0IGlkPSJwb250b3MtdXNlciIgcmVxdWlyZWQ+PC9zZWxlY3Q+PC9sYWJlbD4KICAgICAgICAgIDxsYWJlbD5Qb250b3MgKCsgb3UgLSk8aW5wdXQgdHlwZT0ibnVtYmVyIiBpZD0icG9udG9zLWRlbHRhIiB2YWx1ZT0iMTAiIHJlcXVpcmVkPjwvbGFiZWw+CiAgICAgICAgICA8bGFiZWw+TW90aXZvPGlucHV0IHR5cGU9InRleHQiIGlkPSJwb250b3MtbW90aXZvIiBwbGFjZWhvbGRlcj0iRXguOiBhYm9yZGFnZW0gYmVtIGZlaXRhIiByZXF1aXJlZD48L2xhYmVsPgogICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIiB0eXBlPSJzdWJtaXQiPkxhbsOnYXI8L2J1dHRvbj4KICAgICAgICA8L2Zvcm0+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj48aDM+SGlzdMOzcmljbyBkZSBwb250dWHDp8OjbzwvaDM+PC9kaXY+CiAgICAgICAgPGRpdiBpZD0iaGlzdG9yaWNvLXBvbnRvcyI+PC9kaXY+CiAgICAgIDwvZGl2PgogICAgPC9zZWN0aW9uPgoKICAgIDwhLS0gQ0hBVCAtLT4KICAgIDxzZWN0aW9uIGNsYXNzPSJ0ZWxhIGhpZGRlbiIgaWQ9InRlbGEtY2hhdCI+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCBjaGF0LXBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5DaGF0IGRvIGVmZXRpdm88L2gzPjwvZGl2PgogICAgICAgIDxkaXYgaWQ9ImNoYXQtbWVuc2FnZW5zIiBjbGFzcz0iY2hhdC1tZW5zYWdlbnMiPjwvZGl2PgogICAgICAgIDxmb3JtIGlkPSJmb3JtLWNoYXQiIGNsYXNzPSJjaGF0LWZvcm0iPgogICAgICAgICAgPGlucHV0IHR5cGU9InRleHQiIGlkPSJjaGF0LWlucHV0IiBwbGFjZWhvbGRlcj0iRXNjcmV2YSB1bWEgbWVuc2FnZW0uLi4iIG1heGxlbmd0aD0iODAwIiBhdXRvY29tcGxldGU9Im9mZiI+CiAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4tcHJpbWFyaW8gc20iIHR5cGU9InN1Ym1pdCI+RW52aWFyPC9idXR0b24+CiAgICAgICAgPC9mb3JtPgogICAgICA8L2Rpdj4KICAgIDwvc2VjdGlvbj4KCiAgICA8IS0tIFBST1ZBUyAtLT4KICAgIDxzZWN0aW9uIGNsYXNzPSJ0ZWxhIGhpZGRlbiIgaWQ9InRlbGEtcHJvdmFzIj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+CiAgICAgICAgICA8aDM+UHJvdmFzPC9oMz4KICAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSBoaWRkZW4iIGlkPSJidG4tYWJyaXItcHJvdmEiPisgTGFuw6dhciBwcm92YTwvYnV0dG9uPgogICAgICAgIDwvZGl2PgogICAgICAgIDxwIGNsYXNzPSJ0ZXh0by1hanVkYSIgaWQ9InByb3Zhcy1hdmlzbyI+QXMgcHJvdmFzIGxhbsOnYWRhcyBhcGFyZWNlbSBhcXVpIHBhcmEgdG9kbyBvIGVmZXRpdm8uIEZhw6dhIGEgc3VhIGUgZW52aWUgcGFyYSBhdmFsaWHDp8Ojby48L3A+CiAgICAgICAgPGRpdiBpZD0ibGlzdGEtcHJvdmFzIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCBoaWRkZW4iIGlkPSJwYWluZWwtZW50cmVnYXMiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj48aDM+UHJvdmFzIGVudHJlZ3VlcyBwYXJhIGF2YWxpYXI8L2gzPjwvZGl2PgogICAgICAgIDxkaXYgaWQ9Imxpc3RhLWVudHJlZ2FzIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L3NlY3Rpb24+CgogICAgPCEtLSBCQVRFIFBPTlRPIC0tPgogICAgPHNlY3Rpb24gY2xhc3M9InRlbGEgaGlkZGVuIiBpZD0idGVsYS1wb250byI+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5NZXUgcG9udG88L2gzPjwvZGl2PgogICAgICAgIDxkaXYgaWQ9InBvbnRvLXN0YXR1cyI+PC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0ibGluaGEtYm90b2VzIiBpZD0icG9udG8tYm90b2VzIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5NZXUgaGlzdMOzcmljbyBkZSBwb250bzwvaDM+PC9kaXY+CiAgICAgICAgPGRpdiBpZD0icG9udG8taGlzdG9yaWNvIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCBoaWRkZW4iIGlkPSJwYWluZWwtcG9udG8tdG9kb3MiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj48aDM+UG9udG8gZGUgdG9kbyBvIGVmZXRpdm88L2gzPjwvZGl2PgogICAgICAgIDxkaXYgaWQ9InBvbnRvLXRvZG9zIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L3NlY3Rpb24+CgogICAgPCEtLSBISUVSQVJRVUlBIC0tPgogICAgPHNlY3Rpb24gY2xhc3M9InRlbGEgaGlkZGVuIiBpZD0idGVsYS1oaWVyYXJxdWlhIj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+PGgzPkNhZGVpYSBkZSBjb21hbmRvPC9oMz48L2Rpdj4KICAgICAgICA8ZGl2IGlkPSJsaXN0YS1oaWVyYXJxdWlhIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L3NlY3Rpb24+CgogICAgPCEtLSBSRUdSQVMgRE8gUlAgLS0+CiAgICA8c2VjdGlvbiBjbGFzcz0idGVsYSBoaWRkZW4iIGlkPSJ0ZWxhLXJlZ3JhcyI+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5SZWdyYXMgZG8gUlA8L2gzPjwvZGl2PgogICAgICAgIDxkaXYgaWQ9InRleHRvLXJlZ3JhcyIgY2xhc3M9InJlZ3Jhcy10ZXh0byI+PC9kaXY+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJwYWluZWwgaGlkZGVuIiBpZD0icGFpbmVsLWVkaXRhci1yZWdyYXMiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj48aDM+RWRpdGFyIHJlZ3JhczwvaDM+PC9kaXY+CiAgICAgICAgPGZvcm0gaWQ9ImZvcm0tcmVncmFzIiBjbGFzcz0iZm9ybS1jb2x1bmEiPgogICAgICAgICAgPHRleHRhcmVhIGlkPSJyZWdyYXMtdGV4dG8tZWQiIHJvd3M9IjE0IiBtYXhsZW5ndGg9IjIwMDAwIiBwbGFjZWhvbGRlcj0iQ29sZSBhcXVpIGFzIHJlZ3JhcyBkbyBSUCAodW1hIHBvciBsaW5oYSkuLi4iPjwvdGV4dGFyZWE+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJsaW5oYS1ib3RvZXMiPjxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSIgdHlwZT0ic3VibWl0Ij5TYWx2YXIgcmVncmFzPC9idXR0b24+PC9kaXY+CiAgICAgICAgPC9mb3JtPgogICAgICA8L2Rpdj4KICAgIDwvc2VjdGlvbj4KCiAgICA8IS0tIEVTVFVET1MgLS0+CiAgICA8c2VjdGlvbiBjbGFzcz0idGVsYSBoaWRkZW4iIGlkPSJ0ZWxhLWVzdHVkb3MiPgogICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj4KICAgICAgICAgIDxoMz5Fc3R1ZG9zPC9oMz4KICAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSBoaWRkZW4iIGlkPSJidG4tYWJyaXItZXN0dWRvIj4rIE5vdm8gZXN0dWRvPC9idXR0b24+CiAgICAgICAgPC9kaXY+CiAgICAgICAgPHAgY2xhc3M9InRleHRvLWFqdWRhIiBpZD0iZXN0dWRvcy1hdmlzbyI+PC9wPgogICAgICAgIDxkaXYgaWQ9Imxpc3RhLWVzdHVkb3MiPjwvZGl2PgogICAgICA8L2Rpdj4KICAgIDwvc2VjdGlvbj4KCiAgICA8IS0tIEFVRElUT1JJQSAtLT4KICAgIDxzZWN0aW9uIGNsYXNzPSJ0ZWxhIGhpZGRlbiIgaWQ9InRlbGEtYXVkaXRvcmlhIj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+PGgzPlJlZ2lzdHJvIGRlIGF1ZGl0b3JpYTwvaDM+PC9kaXY+CiAgICAgICAgPGRpdiBpZD0ibGlzdGEtYXVkaXRvcmlhIj48L2Rpdj4KICAgICAgPC9kaXY+CiAgICA8L3NlY3Rpb24+CgogICAgPCEtLSBQRVJGSUwgLS0+CiAgICA8c2VjdGlvbiBjbGFzcz0idGVsYSBoaWRkZW4iIGlkPSJ0ZWxhLXBlcmZpbCI+CiAgICAgIDxkaXYgY2xhc3M9ImR1YXMtY29sdW5hcyI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj48aDM+TWV1cyBkYWRvczwvaDM+PC9kaXY+CiAgICAgICAgICA8Zm9ybSBpZD0iZm9ybS1wZXJmaWwiIGNsYXNzPSJmb3JtLWNvbHVuYSI+CiAgICAgICAgICAgIDxsYWJlbD5Ob21lPGlucHV0IHR5cGU9InRleHQiIGlkPSJwZXJmaWwtbm9tZSIgbWF4bGVuZ3RoPSI2MCI+PC9sYWJlbD4KICAgICAgICAgICAgPGxhYmVsPlJlY2FkbyAobcOheCAyMDApPHRleHRhcmVhIGlkPSJwZXJmaWwtcmVjYWRvIiBtYXhsZW5ndGg9IjIwMCIgcm93cz0iMyI+PC90ZXh0YXJlYT48L2xhYmVsPgogICAgICAgICAgICA8bGFiZWw+Rm90bwogICAgICAgICAgICAgIDxpbnB1dCB0eXBlPSJmaWxlIiBpZD0icGVyZmlsLWZvdG8iIGFjY2VwdD0iaW1hZ2UvKiI+CiAgICAgICAgICAgIDwvbGFiZWw+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImZvdG8tcHJldmlldyI+PGltZyBpZD0icGVyZmlsLWZvdG8taW1nIiBhbHQ9IiIgY2xhc3M9ImhpZGRlbiI+PHNwYW4gaWQ9InBlcmZpbC1zZW0tZm90byI+c2VtIGZvdG88L3NwYW4+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImxpbmhhLWJvdG9lcyI+CiAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIiB0eXBlPSJzdWJtaXQiPlNhbHZhcjwvYnV0dG9uPgogICAgICAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1zZWN1bmRhcmlvIHNtIiB0eXBlPSJidXR0b24iIGlkPSJidG4tcmVtb3Zlci1mb3RvIj5SZW1vdmVyIGZvdG88L2J1dHRvbj4KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICA8L2Zvcm0+CiAgICAgICAgPC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj48aDM+QWx0ZXJhciBzZW5oYTwvaDM+PC9kaXY+CiAgICAgICAgICA8Zm9ybSBpZD0iZm9ybS1zZW5oYSIgY2xhc3M9ImZvcm0tY29sdW5hIj4KICAgICAgICAgICAgPGxhYmVsPlNlbmhhIGF0dWFsPGlucHV0IHR5cGU9InBhc3N3b3JkIiBpZD0ic2VuaGEtYXR1YWwiIHJlcXVpcmVkPjwvbGFiZWw+CiAgICAgICAgICAgIDxsYWJlbD5Ob3ZhIHNlbmhhPGlucHV0IHR5cGU9InBhc3N3b3JkIiBpZD0ic2VuaGEtbm92YSIgcmVxdWlyZWQgbWlubGVuZ3RoPSI0Ij48L2xhYmVsPgogICAgICAgICAgICA8bGFiZWw+Q29uZmlybWFyIG5vdmEgc2VuaGE8aW5wdXQgdHlwZT0icGFzc3dvcmQiIGlkPSJzZW5oYS1jb25mIiByZXF1aXJlZCBtaW5sZW5ndGg9IjQiPjwvbGFiZWw+CiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSIgdHlwZT0ic3VibWl0Ij5BbHRlcmFyIHNlbmhhPC9idXR0b24+CiAgICAgICAgICA8L2Zvcm0+CiAgICAgICAgPC9kaXY+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJwYWluZWwiPgogICAgICAgIDxkaXYgY2xhc3M9InBhaW5lbC10b3BvIj48aDM+TWV1cyBwb250b3M8L2gzPjwvZGl2PgogICAgICAgIDxkaXYgaWQ9InBlcmZpbC1wb250b3MiPjwvZGl2PgogICAgICA8L2Rpdj4KICAgIDwvc2VjdGlvbj4KCiAgICA8IS0tIEFETUlOIC0tPgogICAgPHNlY3Rpb24gY2xhc3M9InRlbGEgaGlkZGVuIiBpZD0idGVsYS1hZG1pbiI+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5CYWNrdXAgZG8gc2lzdGVtYTwvaDM+PC9kaXY+CiAgICAgICAgPHAgY2xhc3M9InRleHRvLWFqdWRhIj5CYWl4ZSB1bWEgY8OzcGlhIGNvbXBsZXRhIGRvcyBkYWRvcyAodXN1w6FyaW9zLCBvY29ycsOqbmNpYXMsIHBvbnRvcywgY2hhdCBlIGF1ZGl0b3JpYSkuIEd1YXJkZSBvIGFycXVpdm8gZm9yYSBkbyBzZXJ2aWRvci48L3A+CiAgICAgICAgPGRpdiBjbGFzcz0ibGluaGEtYm90b2VzIj4KICAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSIgaWQ9ImJ0bi1iYWNrdXAiPuKsh++4jyBCYWl4YXIgYmFja3VwPC9idXR0b24+CiAgICAgICAgICA8bGFiZWwgY2xhc3M9ImJ0bi1zZWN1bmRhcmlvIHNtIGFycXVpdm8tbGFiZWwiPuKshu+4jyBSZXN0YXVyYXIgYmFja3VwPGlucHV0IHR5cGU9ImZpbGUiIGlkPSJpbi1yZXN0b3JlIiBhY2NlcHQ9ImFwcGxpY2F0aW9uL2pzb24iIGhpZGRlbj48L2xhYmVsPgogICAgICAgIDwvZGl2PgogICAgICA8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0icGFpbmVsIj4KICAgICAgICA8ZGl2IGNsYXNzPSJwYWluZWwtdG9wbyI+PGgzPklkZW50aWRhZGUgZG8gc2lzdGVtYTwvaDM+PC9kaXY+CiAgICAgICAgPGZvcm0gaWQ9ImZvcm0tY29uZmlnIiBjbGFzcz0iZm9ybS1saW5oYSIgc3R5bGU9ImdyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMmZyIGF1dG8iPgogICAgICAgICAgPGxhYmVsPlNpZ2xhIC8gbm9tZSBjdXJ0bzxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0iY2ZnLW5vbWUiIG1heGxlbmd0aD0iMjQiPjwvbGFiZWw+CiAgICAgICAgICA8bGFiZWw+Tm9tZSBkYSBjb3Jwb3Jhw6fDo288aW5wdXQgdHlwZT0idGV4dCIgaWQ9ImNmZy1jb3JwIiBtYXhsZW5ndGg9IjgwIj48L2xhYmVsPgogICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIiB0eXBlPSJzdWJtaXQiPlNhbHZhcjwvYnV0dG9uPgogICAgICAgIDwvZm9ybT4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InBhaW5lbCI+CiAgICAgICAgPGRpdiBjbGFzcz0icGFpbmVsLXRvcG8iPjxoMz5SZXN1bW88L2gzPjwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9InRleHRvLWFqdWRhIiBpZD0iYWRtaW4taW5mbyI+PC9kaXY+CiAgICAgIDwvZGl2PgogICAgPC9zZWN0aW9uPgogIDwvbWFpbj4KPC9kaXY+Cgo8IS0tIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBNT0RBSVMg4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIC0tPgo8ZGl2IGNsYXNzPSJvdmVybGF5IGhpZGRlbiIgaWQ9Im92ZXJsYXkiPgogIDxkaXYgY2xhc3M9Im1vZGFsIiBpZD0ibW9kYWwiPgogICAgPGRpdiBjbGFzcz0ibW9kYWwtdG9wbyI+PGgzIGlkPSJtb2RhbC10aXR1bG8iPuKAlDwvaDM+PGJ1dHRvbiBpZD0ibW9kYWwtZmVjaGFyIj7inJU8L2J1dHRvbj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9Im1vZGFsLWNvcnBvIiBpZD0ibW9kYWwtY29ycG8iPjwvZGl2PgogIDwvZGl2Pgo8L2Rpdj4KCjxzY3JpcHQgc3JjPSJhcHAuanMiPjwvc2NyaXB0Pgo8L2JvZHk+CjwvaHRtbD4K","/style.css":"KiB7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IG1hcmdpbjogMDsgcGFkZGluZzogMDsgfQoKOnJvb3QgewogIC0tYmc6ICMwNzBjMTY7CiAgLS1iZzI6ICMwZDE0MjQ7CiAgLS1jYXJkOiAjMTExYTJjOwogIC0tY2FyZDI6ICMxNjIyMzg0NjsKICAtLWxpbmhhOiAjMWUyYjQ1OwogIC0tdGV4dG86ICNlOGVlZmI7CiAgLS1zdWF2ZTogIzhmYTNjNDsKICAtLWF6dWw6ICMyZjdjZjY7CiAgLS1henVsLWVzYzogIzFkNWVjYjsKICAtLXZlcm1lbGhvOiAjZTQ0ODNmOwogIC0tdmVyZGU6ICMyZmJmNzE7CiAgLS1hbWFyZWxvOiAjZThiMjNhOwp9Cgpib2R5IHsKICBmb250LWZhbWlseTogJ0ludGVyJywgc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmOwogIGJhY2tncm91bmQ6IHJhZGlhbC1ncmFkaWVudCgxMjAwcHggNjAwcHggYXQgMTUlIC0xMCUsICMxMjIwM2EgMCUsIHZhcigtLWJnKSA1NSUpOwogIGNvbG9yOiB2YXIoLS10ZXh0byk7CiAgbWluLWhlaWdodDogMTAwdmg7CiAgLXdlYmtpdC1mb250LXNtb290aGluZzogYW50aWFsaWFzZWQ7Cn0KCi5oaWRkZW4geyBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7IH0KCi8qIOKUgOKUgOKUgOKUgOKUgCBsb2dpbiDilIDilIDilIDilIDilIAgKi8KLmxvZ2luLXdyYXAgeyBtaW4taGVpZ2h0OiAxMDB2aDsgZGlzcGxheTogZ3JpZDsgcGxhY2UtaXRlbXM6IGNlbnRlcjsgcGFkZGluZzogMjRweDsgfQoubG9naW4tY2FyZCB7CiAgd2lkdGg6IDEwMCU7IG1heC13aWR0aDogNDAwcHg7IGJhY2tncm91bmQ6IHZhcigtLWNhcmQpOwogIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsgYm9yZGVyLXJhZGl1czogMThweDsgcGFkZGluZzogMzRweCAyOHB4OwogIGJveC1zaGFkb3c6IDAgMjRweCA3MHB4IHJnYmEoMCwgMCwgMCwgLjU1KTsgdGV4dC1hbGlnbjogY2VudGVyOwp9Ci5sb2dpbi1iYWRnZSB7CiAgd2lkdGg6IDYycHg7IGhlaWdodDogNjJweDsgbWFyZ2luOiAwIGF1dG8gMTZweDsgYm9yZGVyLXJhZGl1czogMTZweDsKICBkaXNwbGF5OiBncmlkOyBwbGFjZS1pdGVtczogY2VudGVyOyBmb250LXNpemU6IDMwcHg7IGZvbnQtd2VpZ2h0OiA4MDA7CiAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDE1MGRlZywgdmFyKC0tYXp1bCksICMwYjNhODYpOwogIGJveC1zaGFkb3c6IDAgMTBweCAzMHB4IHJnYmEoNDcsIDEyNCwgMjQ2LCAuMzUpOwp9Ci5sb2dpbi1jYXJkIGgxIHsgZm9udC1zaXplOiAyNnB4OyBsZXR0ZXItc3BhY2luZzogMnB4OyBmb250LXdlaWdodDogODAwOyB9Ci5sb2dpbi1jYXJkIC5zdWIgeyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDEzcHg7IG1hcmdpbi10b3A6IDRweDsgfQoubG9naW4tY2FyZCAudGFnIHsKICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IG1hcmdpbjogMThweCAwIDIwcHg7IGZvbnQtc2l6ZTogMTBweDsgbGV0dGVyLXNwYWNpbmc6IDIuNXB4OwogIGNvbG9yOiAjN2Y5YWM0OyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7IHBhZGRpbmc6IDVweCAxMnB4OyBib3JkZXItcmFkaXVzOiA5OTlweDsKfQoubG9naW4tY2FyZCBmb3JtIHsgdGV4dC1hbGlnbjogbGVmdDsgfQpsYWJlbCB7IGRpc3BsYXk6IGJsb2NrOyBmb250LXNpemU6IDEycHg7IGNvbG9yOiB2YXIoLS1zdWF2ZSk7IG1hcmdpbi1ib3R0b206IDE0cHg7IGZvbnQtd2VpZ2h0OiA1MDA7IH0KaW5wdXQsIHNlbGVjdCwgdGV4dGFyZWEgewogIHdpZHRoOiAxMDAlOyBtYXJnaW4tdG9wOiA2cHg7IGJhY2tncm91bmQ6ICMwYTEyMjA7IGNvbG9yOiB2YXIoLS10ZXh0byk7CiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBib3JkZXItcmFkaXVzOiAxMHB4OyBwYWRkaW5nOiAxMXB4IDEzcHg7CiAgZm9udC1mYW1pbHk6IGluaGVyaXQ7IGZvbnQtc2l6ZTogMTRweDsgb3V0bGluZTogbm9uZTsgdHJhbnNpdGlvbjogLjE1czsKfQppbnB1dDpmb2N1cywgc2VsZWN0OmZvY3VzLCB0ZXh0YXJlYTpmb2N1cyB7IGJvcmRlci1jb2xvcjogdmFyKC0tYXp1bCk7IGJveC1zaGFkb3c6IDAgMCAwIDNweCAjMmY3Y2Y2MjI7IH0KLnNlbmhhLXdyYXAgeyBwb3NpdGlvbjogcmVsYXRpdmU7IGRpc3BsYXk6IGJsb2NrOyB9Ci5zZW5oYS13cmFwIGJ1dHRvbiB7CiAgcG9zaXRpb246IGFic29sdXRlOyByaWdodDogOHB4OyB0b3A6IDUwJTsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpOwogIGJhY2tncm91bmQ6IG5vbmU7IGJvcmRlcjogbm9uZTsgY29sb3I6IHZhcigtLXN1YXZlKTsgY3Vyc29yOiBwb2ludGVyOyBmb250LXNpemU6IDE1cHg7Cn0KLmJ0bi1wcmltYXJpbyB7CiAgd2lkdGg6IDEwMCU7IGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxODBkZWcsIHZhcigtLWF6dWwpLCB2YXIoLS1henVsLWVzYykpOwogIGNvbG9yOiAjZmZmOyBib3JkZXI6IG5vbmU7IGJvcmRlci1yYWRpdXM6IDEwcHg7IHBhZGRpbmc6IDEycHg7IGZvbnQtd2VpZ2h0OiA3MDA7CiAgZm9udC1zaXplOiAxM3B4OyBsZXR0ZXItc3BhY2luZzogMXB4OyBjdXJzb3I6IHBvaW50ZXI7IHRyYW5zaXRpb246IC4xNXM7Cn0KLmJ0bi1wcmltYXJpbzpob3ZlciB7IGZpbHRlcjogYnJpZ2h0bmVzcygxLjEyKTsgfQouYnRuLXByaW1hcmlvLnNtIHsgd2lkdGg6IGF1dG87IHBhZGRpbmc6IDlweCAxNnB4OyB9Ci5idG4tc2VjdW5kYXJpbyB7CiAgYmFja2dyb3VuZDogIzE2MjIzYTsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBjb2xvcjogdmFyKC0tdGV4dG8pOwogIGJvcmRlci1yYWRpdXM6IDEwcHg7IHBhZGRpbmc6IDlweCAxNnB4OyBmb250LXNpemU6IDEzcHg7IGZvbnQtd2VpZ2h0OiA2MDA7CiAgY3Vyc29yOiBwb2ludGVyOyBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7Cn0KLmJ0bi1zZWN1bmRhcmlvOmhvdmVyIHsgYm9yZGVyLWNvbG9yOiB2YXIoLS1henVsKTsgfQouYXJxdWl2by1sYWJlbCB7IGN1cnNvcjogcG9pbnRlcjsgfQouYXZpc28geyBmb250LXNpemU6IDExcHg7IGNvbG9yOiAjNWY3Mzk3OyBtYXJnaW4tdG9wOiAxOHB4OyBsaW5lLWhlaWdodDogMS41OyB9Ci5lcnJvIHsKICBiYWNrZ3JvdW5kOiAjM2ExNDE0OyBib3JkZXI6IDFweCBzb2xpZCAjNmQyMzIzOyBjb2xvcjogI2ZmYjNhZDsKICBmb250LXNpemU6IDEycHg7IGJvcmRlci1yYWRpdXM6IDlweDsgcGFkZGluZzogOXB4IDEycHg7IG1hcmdpbi1ib3R0b206IDEycHg7Cn0KCi8qIOKUgOKUgOKUgOKUgOKUgCBzdXNwZW5zw6NvIOKUgOKUgOKUgOKUgOKUgCAqLwouc3VzcGVuc28geyBtYXgtd2lkdGg6IDQ0MHB4OyB9Ci5zdXNwLWljb25lIHsgZm9udC1zaXplOiA0NHB4OyBtYXJnaW4tYm90dG9tOiAxMHB4OyB9Ci5jcm9ub21ldHJvIHsKICBmb250LXNpemU6IDQwcHg7IGZvbnQtd2VpZ2h0OiA4MDA7IGxldHRlci1zcGFjaW5nOiAzcHg7IGNvbG9yOiB2YXIoLS12ZXJtZWxobyk7CiAgZm9udC12YXJpYW50LW51bWVyaWM6IHRhYnVsYXItbnVtczsgbWFyZ2luOiAxOHB4IDA7Cn0KLnN1c3AtaW5mbyB7IGRpc3BsYXk6IGdyaWQ7IGdhcDogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0OyBtYXJnaW4tYm90dG9tOiAyMHB4OyB9Ci5zdXNwLWluZm8gPiBkaXYgewogIGRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsgZ2FwOiAxMnB4OwogIGJhY2tncm91bmQ6ICMwYTEyMjA7IGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsgYm9yZGVyLXJhZGl1czogMTBweDsgcGFkZGluZzogMTBweCAxM3B4OwogIGZvbnQtc2l6ZTogMTJweDsKfQouc3VzcC1pbmZvIHNwYW4geyBjb2xvcjogdmFyKC0tc3VhdmUpOyB9Ci5zdXNwLWluZm8gc3Ryb25nIHsgZm9udC13ZWlnaHQ6IDYwMDsgdGV4dC1hbGlnbjogcmlnaHQ7IH0KCi8qIOKUgOKUgOKUgOKUgOKUgCBhcHAg4pSA4pSA4pSA4pSA4pSAICovCi5hcHAgeyBkaXNwbGF5OiBmbGV4OyBtaW4taGVpZ2h0OiAxMDB2aDsgfQoKLnNpZGViYXIgewogIHdpZHRoOiAyNTBweDsgZmxleC1zaHJpbms6IDA7IGJhY2tncm91bmQ6ICMwODBlMWE7IGJvcmRlci1yaWdodDogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsKICBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBwYWRkaW5nOiAyMHB4IDE0cHg7IHBvc2l0aW9uOiBzdGlja3k7IHRvcDogMDsgaGVpZ2h0OiAxMDB2aDsKfQoubWFyY2EgeyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDExcHg7IHBhZGRpbmc6IDAgNnB4IDIycHg7IH0KLm1hcmNhLWljb25lIHsKICB3aWR0aDogNDBweDsgaGVpZ2h0OiA0MHB4OyBib3JkZXItcmFkaXVzOiAxMXB4OyBkaXNwbGF5OiBncmlkOyBwbGFjZS1pdGVtczogY2VudGVyOwogIGZvbnQtc2l6ZTogMjBweDsgZm9udC13ZWlnaHQ6IDgwMDsgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDE1MGRlZywgdmFyKC0tYXp1bCksICMwYjNhODYpOwp9Ci5tYXJjYSBzdHJvbmcgeyBkaXNwbGF5OiBibG9jazsgZm9udC1zaXplOiAxNXB4OyBsZXR0ZXItc3BhY2luZzogLjVweDsgfQoubWFyY2Egc21hbGwgeyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDEwLjVweDsgfQoKI25hdiB7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IGdhcDogM3B4OyBmbGV4OiAxOyB9Ci5uYXYtaXRlbSB7CiAgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiAxMXB4OyB3aWR0aDogMTAwJTsgdGV4dC1hbGlnbjogbGVmdDsKICBiYWNrZ3JvdW5kOiBub25lOyBib3JkZXI6IG5vbmU7IGNvbG9yOiB2YXIoLS1zdWF2ZSk7IGZvbnQtZmFtaWx5OiBpbmhlcml0OwogIGZvbnQtc2l6ZTogMTMuNXB4OyBmb250LXdlaWdodDogNTAwOyBwYWRkaW5nOiAxMXB4IDEycHg7IGJvcmRlci1yYWRpdXM6IDEwcHg7IGN1cnNvcjogcG9pbnRlcjsKICB0cmFuc2l0aW9uOiAuMTVzOwp9Ci5uYXYtaXRlbSBzcGFuIHsgd2lkdGg6IDE4cHg7IHRleHQtYWxpZ246IGNlbnRlcjsgZm9udC1zaXplOiAxNHB4OyB9Ci5uYXYtaXRlbTpob3ZlciB7IGJhY2tncm91bmQ6ICMxMTFiMmQ7IGNvbG9yOiB2YXIoLS10ZXh0byk7IH0KLm5hdi1pdGVtLmF0aXZvIHsgYmFja2dyb3VuZDogIzE0Mjk0YTsgY29sb3I6ICNmZmY7IGJveC1zaGFkb3c6IGluc2V0IDJweCAwIDAgdmFyKC0tYXp1bCk7IH0KCi5zaWRlYmFyLXBlIHsgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsgcGFkZGluZy10b3A6IDE0cHg7IH0KLmV1IHsgZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiAxMHB4OyBtYXJnaW4tYm90dG9tOiAxMnB4OyB9Ci5hdmF0YXIgewogIHdpZHRoOiAzOHB4OyBoZWlnaHQ6IDM4cHg7IGJvcmRlci1yYWRpdXM6IDUwJTsgZmxleC1zaHJpbms6IDA7IG92ZXJmbG93OiBoaWRkZW47CiAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDE1MGRlZywgIzI0NTA3ZiwgIzEyMjMzZCk7IGRpc3BsYXk6IGdyaWQ7IHBsYWNlLWl0ZW1zOiBjZW50ZXI7CiAgZm9udC13ZWlnaHQ6IDcwMDsgZm9udC1zaXplOiAxM3B4OyBjb2xvcjogI2NmZTBmZjsgYmFja2dyb3VuZC1zaXplOiBjb3ZlcjsgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyOwp9Ci5ldS1pbmZvIHN0cm9uZyB7IGRpc3BsYXk6IGJsb2NrOyBmb250LXNpemU6IDEzcHg7IH0KLmV1LWluZm8gc21hbGwgeyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDExcHg7IH0KLmJ0bi1zYWlyIHsKICB3aWR0aDogMTAwJTsgYmFja2dyb3VuZDogIzJhMTQxNDsgYm9yZGVyOiAxcHggc29saWQgIzRhMjAyMDsgY29sb3I6ICNmZjlkOTU7CiAgYm9yZGVyLXJhZGl1czogMTBweDsgcGFkZGluZzogOXB4OyBmb250LWZhbWlseTogaW5oZXJpdDsgZm9udC1zaXplOiAxMi41cHg7CiAgZm9udC13ZWlnaHQ6IDYwMDsgY3Vyc29yOiBwb2ludGVyOwp9Ci5idG4tc2Fpcjpob3ZlciB7IGJhY2tncm91bmQ6ICMzODE4MTg7IH0KCi5jb250ZXVkbyB7IGZsZXg6IDE7IHBhZGRpbmc6IDIycHggMjZweCA2MHB4OyBtaW4td2lkdGg6IDA7IH0KLnRvcGJhciB7IGRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQ7IG1hcmdpbi1ib3R0b206IDIycHg7IGdhcDogMTZweDsgfQoudG9wYmFyIGgyIHsgZm9udC1zaXplOiAyMXB4OyBmb250LXdlaWdodDogNzAwOyB9Ci50b3BiYXItc3ViIHsgY29sb3I6IHZhcigtLXN1YXZlKTsgZm9udC1zaXplOiAxMi41cHg7IG1hcmdpbi10b3A6IDNweDsgfQouc2lubyB7CiAgcG9zaXRpb246IHJlbGF0aXZlOyBiYWNrZ3JvdW5kOiAjMTExYTJjOyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7IGNvbG9yOiB2YXIoLS10ZXh0byk7CiAgd2lkdGg6IDQwcHg7IGhlaWdodDogNDBweDsgYm9yZGVyLXJhZGl1czogMTFweDsgY3Vyc29yOiBwb2ludGVyOyBmb250LXNpemU6IDE1cHg7Cn0KLnNpbm8gYiB7CiAgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IC01cHg7IHJpZ2h0OiAtNXB4OyBiYWNrZ3JvdW5kOiB2YXIoLS12ZXJtZWxobyk7IGNvbG9yOiAjZmZmOwogIGZvbnQtc2l6ZTogMTBweDsgbWluLXdpZHRoOiAxOHB4OyBoZWlnaHQ6IDE4cHg7IGJvcmRlci1yYWRpdXM6IDlweDsgZGlzcGxheTogZ3JpZDsKICBwbGFjZS1pdGVtczogY2VudGVyOyBwYWRkaW5nOiAwIDVweDsKfQoKLyog4pSA4pSA4pSA4pSA4pSAIHBhaW7DqWlzIOKUgOKUgOKUgOKUgOKUgCAqLwouY2FyZHMgeyBkaXNwbGF5OiBncmlkOyBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IHJlcGVhdChhdXRvLWZpdCwgbWlubWF4KDE3MHB4LCAxZnIpKTsgZ2FwOiAxNHB4OyBtYXJnaW4tYm90dG9tOiAxOHB4OyB9Ci5jYXJkIHsKICBiYWNrZ3JvdW5kOiB2YXIoLS1jYXJkKTsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBib3JkZXItcmFkaXVzOiAxNHB4OyBwYWRkaW5nOiAxNnB4IDE4cHg7Cn0KLmNhcmQgc21hbGwgeyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDExLjVweDsgZm9udC13ZWlnaHQ6IDUwMDsgbGV0dGVyLXNwYWNpbmc6IC4zcHg7IH0KLmNhcmQgc3Ryb25nIHsgZGlzcGxheTogYmxvY2s7IGZvbnQtc2l6ZTogMjhweDsgZm9udC13ZWlnaHQ6IDgwMDsgbWFyZ2luLXRvcDogNnB4OyB9Ci5jYXJkLmRlc3RhcXVlIHsgYm9yZGVyLWNvbG9yOiAjMmI0ZjhiOyBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTUwZGVnLCAjMTYyOTRhLCB2YXIoLS1jYXJkKSk7IH0KCi5wYWluZWwgeyBiYWNrZ3JvdW5kOiB2YXIoLS1jYXJkKTsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBib3JkZXItcmFkaXVzOiAxNHB4OyBwYWRkaW5nOiAxOHB4OyBtYXJnaW4tYm90dG9tOiAxNnB4OyB9Ci5wYWluZWwtdG9wbyB7IGRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsgYWxpZ24taXRlbXM6IGNlbnRlcjsgZ2FwOiAxMnB4OyBtYXJnaW4tYm90dG9tOiAxNHB4OyBmbGV4LXdyYXA6IHdyYXA7IH0KLnBhaW5lbC10b3BvIGgzIHsgZm9udC1zaXplOiAxNXB4OyBmb250LXdlaWdodDogNjUwOyB9Ci50b3BvLWFjb2VzIHsgZGlzcGxheTogZmxleDsgZ2FwOiA5cHg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGZsZXgtd3JhcDogd3JhcDsgfQoudG9wby1hY29lcyBpbnB1dFt0eXBlPXNlYXJjaF0geyBtYXJnaW46IDA7IHdpZHRoOiAyMDBweDsgcGFkZGluZzogOHB4IDEycHg7IGZvbnQtc2l6ZTogMTNweDsgfQouZHVhcy1jb2x1bmFzIHsgZGlzcGxheTogZ3JpZDsgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiAxZnIgMWZyOyBnYXA6IDE2cHg7IH0KQG1lZGlhIChtYXgtd2lkdGg6IDk4MHB4KSB7IC5kdWFzLWNvbHVuYXMgeyBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmcjsgfSB9CgovKiDilIDilIDilIDilIDilIAgdGFiZWxhcyDilIDilIDilIDilIDilIAgKi8KdGFibGUgeyB3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgZm9udC1zaXplOiAxM3B4OyB9CnRoIHsKICB0ZXh0LWFsaWduOiBsZWZ0OyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDExcHg7IGZvbnQtd2VpZ2h0OiA2MDA7CiAgbGV0dGVyLXNwYWNpbmc6IC42cHg7IHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7IHBhZGRpbmc6IDlweCAxMHB4OyBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tbGluaGEpOwp9CnRkIHsgcGFkZGluZzogMTFweCAxMHB4OyBib3JkZXItYm90dG9tOiAxcHggc29saWQgIzE2MjIzYTsgdmVydGljYWwtYWxpZ246IG1pZGRsZTsgfQp0cjpsYXN0LWNoaWxkIHRkIHsgYm9yZGVyLWJvdHRvbTogbm9uZTsgfQoubm9tZS1jZWwgeyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDEwcHg7IH0KLm5vbWUtY2VsIC5hdmF0YXIgeyB3aWR0aDogMzBweDsgaGVpZ2h0OiAzMHB4OyBmb250LXNpemU6IDExcHg7IH0KLmxvZ2luLXN1YXZlIHsgY29sb3I6IHZhcigtLXN1YXZlKTsgZm9udC1zaXplOiAxMS41cHg7IH0KCi5iYWRnZSB7CiAgZGlzcGxheTogaW5saW5lLWJsb2NrOyBmb250LXNpemU6IDEwLjVweDsgZm9udC13ZWlnaHQ6IDcwMDsgbGV0dGVyLXNwYWNpbmc6IC40cHg7CiAgcGFkZGluZzogNHB4IDlweDsgYm9yZGVyLXJhZGl1czogOTk5cHg7IGJhY2tncm91bmQ6ICMxYTI3NDA7IGNvbG9yOiAjYThiY2Q4Owp9Ci5iYWRnZS5henVsIHsgYmFja2dyb3VuZDogIzE0MzA1YzsgY29sb3I6ICM4YWI2ZmY7IH0KLmJhZGdlLnZlcmRlIHsgYmFja2dyb3VuZDogIzBmMzUyNDsgY29sb3I6ICM2ZWU3YTM7IH0KLmJhZGdlLnZlcm1lbGhvIHsgYmFja2dyb3VuZDogIzNhMTcxNzsgY29sb3I6ICNmZjlkOTU7IH0KLmJhZGdlLmFtYXJlbG8geyBiYWNrZ3JvdW5kOiAjM2EyZjEyOyBjb2xvcjogI2YzY2Q3NzsgfQoKLmFjb2VzLWxpbmhhIHsgZGlzcGxheTogZmxleDsgZ2FwOiA2cHg7IGZsZXgtd3JhcDogd3JhcDsgfQoubWluaSB7CiAgYmFja2dyb3VuZDogIzE2MjIzYTsgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBjb2xvcjogdmFyKC0tdGV4dG8pOwogIGJvcmRlci1yYWRpdXM6IDhweDsgcGFkZGluZzogNXB4IDlweDsgZm9udC1zaXplOiAxMS41cHg7IGZvbnQtZmFtaWx5OiBpbmhlcml0OwogIGN1cnNvcjogcG9pbnRlcjsgZm9udC13ZWlnaHQ6IDYwMDsKfQoubWluaTpob3ZlciB7IGJvcmRlci1jb2xvcjogdmFyKC0tYXp1bCk7IH0KLm1pbmkucGVyaWdvIHsgY29sb3I6ICNmZjlkOTU7IGJvcmRlci1jb2xvcjogIzRhMjAyMDsgYmFja2dyb3VuZDogIzJhMTQxNDsgfQoubWluaS5wZXJpZ286aG92ZXIgeyBiYWNrZ3JvdW5kOiAjMzgxODE4OyB9CgoudmF6aW8geyB0ZXh0LWFsaWduOiBjZW50ZXI7IGNvbG9yOiAjNWY3Mzk3OyBmb250LXNpemU6IDEzcHg7IHBhZGRpbmc6IDI2cHggMDsgfQoudGV4dG8tYWp1ZGEgeyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDEyLjVweDsgbGluZS1oZWlnaHQ6IDEuNjsgbWFyZ2luLWJvdHRvbTogMTRweDsgfQoKLyog4pSA4pSA4pSA4pSA4pSAIGZvcm11bMOhcmlvcyDilIDilIDilIDilIDilIAgKi8KLmZvcm0tbGluaGEgeyBkaXNwbGF5OiBncmlkOyBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmciAxMzBweCAxLjRmciBhdXRvOyBnYXA6IDEycHg7IGFsaWduLWl0ZW1zOiBlbmQ7IH0KLmZvcm0tbGluaGEgbGFiZWwgeyBtYXJnaW46IDA7IH0KLmZvcm0tY29sdW5hIHsgZGlzcGxheTogZ3JpZDsgZ2FwOiA0cHg7IH0KLmxpbmhhLWJvdG9lcyB7IGRpc3BsYXk6IGZsZXg7IGdhcDogOXB4OyBmbGV4LXdyYXA6IHdyYXA7IG1hcmdpbi10b3A6IDZweDsgfQouZm90by1wcmV2aWV3IHsgbWFyZ2luOiA2cHggMCAxMHB4OyB9Ci5mb3RvLXByZXZpZXcgaW1nIHsgd2lkdGg6IDc0cHg7IGhlaWdodDogNzRweDsgYm9yZGVyLXJhZGl1czogNTAlOyBvYmplY3QtZml0OiBjb3ZlcjsgYm9yZGVyOiAycHggc29saWQgdmFyKC0tbGluaGEpOyB9Ci5mb3RvLXByZXZpZXcgc3BhbiB7IGNvbG9yOiAjNWY3Mzk3OyBmb250LXNpemU6IDEycHg7IH0KQG1lZGlhIChtYXgtd2lkdGg6IDc2MHB4KSB7IC5mb3JtLWxpbmhhIHsgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiAxZnI7IH0gfQoKLyog4pSA4pSA4pSA4pSA4pSAIGNoYXQg4pSA4pSA4pSA4pSA4pSAICovCi5jaGF0LXBhaW5lbCB7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IGhlaWdodDogY2FsYygxMDB2aCAtIDE5MHB4KTsgfQouY2hhdC1tZW5zYWdlbnMgeyBmbGV4OiAxOyBvdmVyZmxvdy15OiBhdXRvOyBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBnYXA6IDEwcHg7IHBhZGRpbmctcmlnaHQ6IDRweDsgfQoubXNnIHsgbWF4LXdpZHRoOiA3MiU7IGJhY2tncm91bmQ6ICMxNjIyM2E7IGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsgYm9yZGVyLXJhZGl1czogMTJweDsgcGFkZGluZzogOXB4IDEycHg7IH0KLm1zZy5taW5oYSB7IGFsaWduLXNlbGY6IGZsZXgtZW5kOyBiYWNrZ3JvdW5kOiAjMTQyOTRhOyBib3JkZXItY29sb3I6ICMyYjRmOGI7IH0KLm1zZy10b3BvIHsgZGlzcGxheTogZmxleDsgZ2FwOiA4cHg7IGFsaWduLWl0ZW1zOiBiYXNlbGluZTsgbWFyZ2luLWJvdHRvbTogM3B4OyB9Ci5tc2ctdG9wbyBzdHJvbmcgeyBmb250LXNpemU6IDEycHg7IH0KLm1zZy10b3BvIHNtYWxsIHsgY29sb3I6IHZhcigtLXN1YXZlKTsgZm9udC1zaXplOiAxMC41cHg7IH0KLm1zZyBwIHsgZm9udC1zaXplOiAxM3B4OyBsaW5lLWhlaWdodDogMS40NTsgd29yZC1icmVhazogYnJlYWstd29yZDsgfQouY2hhdC1mb3JtIHsgZGlzcGxheTogZmxleDsgZ2FwOiA5cHg7IG1hcmdpbi10b3A6IDEycHg7IH0KLmNoYXQtZm9ybSBpbnB1dCB7IG1hcmdpbjogMDsgfQoKLyog4pSA4pSA4pSA4pSA4pSAIGZsdXR1YW50ZSDilIDilIDilIDilIDilIAgKi8KLmZsdXR1YW50ZSB7CiAgcG9zaXRpb246IGZpeGVkOyBib3R0b206IDI0cHg7IHJpZ2h0OiAyNHB4OyB6LWluZGV4OiA2MDsKICBiYWNrZ3JvdW5kOiAjMTQyOTRhOyBib3JkZXI6IDFweCBzb2xpZCAjMmI0ZjhiOyBjb2xvcjogI2RjZThmZjsKICBwYWRkaW5nOiAxMnB4IDE4cHg7IGJvcmRlci1yYWRpdXM6IDExcHg7IGZvbnQtc2l6ZTogMTNweDsgZm9udC13ZWlnaHQ6IDUwMDsKICBib3gtc2hhZG93OiAwIDE2cHggNDBweCByZ2JhKDAsIDAsIDAsIC41KTsgYW5pbWF0aW9uOiBzb2JlIC4ycyBlYXNlOwp9Ci5mbHV0dWFudGUuZXJybyB7IGJhY2tncm91bmQ6ICMzYTE0MTQ7IGJvcmRlci1jb2xvcjogIzZkMjMyMzsgY29sb3I6ICNmZmIzYWQ7IH0KQGtleWZyYW1lcyBzb2JlIHsgZnJvbSB7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSg4cHgpOyBvcGFjaXR5OiAwOyB9IH0KCi8qIOKUgOKUgOKUgOKUgOKUgCBtb2RhbCDilIDilIDilIDilIDilIAgKi8KLm92ZXJsYXkgewogIHBvc2l0aW9uOiBmaXhlZDsgaW5zZXQ6IDA7IGJhY2tncm91bmQ6IHJnYmEoMywgNywgMTQsIC43OCk7IGJhY2tkcm9wLWZpbHRlcjogYmx1cigzcHgpOwogIGRpc3BsYXk6IGdyaWQ7IHBsYWNlLWl0ZW1zOiBjZW50ZXI7IHBhZGRpbmc6IDIwcHg7IHotaW5kZXg6IDgwOwp9Ci5tb2RhbCB7CiAgYmFja2dyb3VuZDogdmFyKC0tY2FyZCk7IGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsgYm9yZGVyLXJhZGl1czogMTZweDsKICB3aWR0aDogMTAwJTsgbWF4LXdpZHRoOiA1MjBweDsgbWF4LWhlaWdodDogODh2aDsgZGlzcGxheTogZmxleDsgZmxleC1kaXJlY3Rpb246IGNvbHVtbjsKICBib3gtc2hhZG93OiAwIDMwcHggODBweCByZ2JhKDAsIDAsIDAsIC42KTsKfQoubW9kYWwtdG9wbyB7CiAgZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuOyBhbGlnbi1pdGVtczogY2VudGVyOwogIHBhZGRpbmc6IDE2cHggMjBweDsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsKfQoubW9kYWwtdG9wbyBoMyB7IGZvbnQtc2l6ZTogMTVweDsgfQoubW9kYWwtdG9wbyBidXR0b24geyBiYWNrZ3JvdW5kOiBub25lOyBib3JkZXI6IG5vbmU7IGNvbG9yOiB2YXIoLS1zdWF2ZSk7IGZvbnQtc2l6ZTogMTZweDsgY3Vyc29yOiBwb2ludGVyOyB9Ci5tb2RhbC1jb3JwbyB7IHBhZGRpbmc6IDIwcHg7IG92ZXJmbG93LXk6IGF1dG87IH0KLm1vZGFsLWNvcnBvIC5idG4tcHJpbWFyaW8geyBtYXJnaW4tdG9wOiA2cHg7IH0KCi5ub3RpZi1pdGVtIHsKICBib3JkZXItYm90dG9tOiAxcHggc29saWQgIzE2MjIzYTsgcGFkZGluZzogMTFweCAwOyBmb250LXNpemU6IDEyLjVweDsKfQoubm90aWYtaXRlbTpsYXN0LWNoaWxkIHsgYm9yZGVyLWJvdHRvbTogbm9uZTsgfQoubm90aWYtaXRlbSBzdHJvbmcgeyBkaXNwbGF5OiBibG9jazsgZm9udC1zaXplOiAxM3B4OyBtYXJnaW4tYm90dG9tOiAycHg7IH0KLm5vdGlmLWl0ZW0gc21hbGwgeyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDExcHg7IH0KLm5vdGlmLWl0ZW0gcCB7IGNvbG9yOiAjYjljOWUyOyBtYXJnaW4tdG9wOiAzcHg7IGxpbmUtaGVpZ2h0OiAxLjQ1OyB9Cgoub2MtY2FyZCB7IGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWxpbmhhKTsgYm9yZGVyLXJhZGl1czogMTJweDsgcGFkZGluZzogMTRweDsgbWFyZ2luLWJvdHRvbTogMTBweDsgYmFja2dyb3VuZDogIzBlMTcyODsgfQoub2MtdG9wbyB7IGRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsgZ2FwOiAxMHB4OyBhbGlnbi1pdGVtczogZmxleC1zdGFydDsgbWFyZ2luLWJvdHRvbTogOHB4OyBmbGV4LXdyYXA6IHdyYXA7IH0KLm9jLXRvcG8gc3Ryb25nIHsgZm9udC1zaXplOiAxMy41cHg7IH0KLm9jLW1ldGEgeyBjb2xvcjogdmFyKC0tc3VhdmUpOyBmb250LXNpemU6IDExLjVweDsgbWFyZ2luLXRvcDogMnB4OyB9Ci5vYy1kZXAgeyBmb250LXNpemU6IDEyLjVweDsgY29sb3I6ICNiOWM5ZTI7IGxpbmUtaGVpZ2h0OiAxLjU7IG1hcmdpbi10b3A6IDZweDsgd2hpdGUtc3BhY2U6IHByZS13cmFwOyB9Ci5vYy1yZXNwIHsgZm9udC1zaXplOiAxMi41cHg7IGNvbG9yOiAjOGFiNmZmOyBtYXJnaW4tdG9wOiA2cHg7IHdoaXRlLXNwYWNlOiBwcmUtd3JhcDsgfQoKQG1lZGlhIChtYXgtd2lkdGg6IDc2MHB4KSB7CiAgLnNpZGViYXIgeyBwb3NpdGlvbjogZml4ZWQ7IHotaW5kZXg6IDcwOyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTEwMCUpOyB0cmFuc2l0aW9uOiAuMnM7IH0KICAuc2lkZWJhci5hYmVydGEgeyB0cmFuc2Zvcm06IG5vbmU7IH0KICAuY29udGV1ZG8geyBwYWRkaW5nOiAxNnB4IDE0cHggNjBweDsgfQp9CgovKiDilIDilIDilIDilIDilIAgcHJvdmFzIC8gcG9udG8gLyBoaWVyYXJxdWlhIC8gcmVncmFzIOKUgOKUgOKUgOKUgOKUgCAqLwoucmVncmFzLXRleHRvIHsKICB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7CiAgbGluZS1oZWlnaHQ6IDEuNzsKICBmb250LXNpemU6IDE0cHg7CiAgY29sb3I6IHZhcigtLXRleHRvKTsKICB3b3JkLWJyZWFrOiBicmVhay13b3JkOwp9Ci5wcm92YS10ZXh0byB7IG1hcmdpbi1ib3R0b206IDE0cHg7IH0KLnBvbnRvLWNhcmQgewogIGJhY2tncm91bmQ6IHZhcigtLWNhcmQyKTsKICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7CiAgYm9yZGVyLXJhZGl1czogMTRweDsKICBwYWRkaW5nOiAxOHB4IDIwcHg7CiAgZGlzcGxheTogZ3JpZDsKICBnYXA6IDZweDsKfQoucG9udG8tY2FyZC5lbS1zZXJ2aWNvIHsgYm9yZGVyLWNvbG9yOiAjMmZiZjcxNTU7IGJveC1zaGFkb3c6IDAgMCAwIDFweCAjMmZiZjcxMjIgaW5zZXQ7IH0KLnBvbnRvLXJvdHVsbyB7IGZvbnQtc2l6ZTogMTFweDsgbGV0dGVyLXNwYWNpbmc6IDJweDsgY29sb3I6IHZhcigtLXN1YXZlKTsgZm9udC13ZWlnaHQ6IDcwMDsgfQoucG9udG8tY2FyZC5lbS1zZXJ2aWNvIC5wb250by1yb3R1bG8geyBjb2xvcjogdmFyKC0tdmVyZGUpOyB9Ci5wb250by1ob3JhIHsgZm9udC1zaXplOiAxNXB4OyB9CgovKiDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgZXN0dWRvcyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgKi8KLmVzdHVkby1jYXJkIHsKICBiYWNrZ3JvdW5kOiAjMGMxNTI2OyBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1saW5oYSk7IGJvcmRlci1yYWRpdXM6IDE0cHg7CiAgcGFkZGluZzogMTZweCAxOHB4OyBtYXJnaW4tYm90dG9tOiAxMnB4Owp9Ci5lc3R1ZG8tdG9wbyB7IGRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsgZ2FwOiAxNHB4OyBhbGlnbi1pdGVtczogZmxleC1zdGFydDsgZmxleC13cmFwOiB3cmFwOyB9Ci5lc3R1ZG8tdGl0dWxvIHsgZm9udC1zaXplOiAxNXB4OyBmb250LXdlaWdodDogNzAwOyBjb2xvcjogdmFyKC0tdGV4dG8pOyBtYXJnaW46IDhweCAwIDRweDsgfQouZXN0dWRvLWRldGFsaGUgeyBtYXJnaW4tdG9wOiAxMnB4OyBib3JkZXItdG9wOiAxcHggc29saWQgdmFyKC0tbGluaGEpOyBwYWRkaW5nLXRvcDogMTBweDsgfQouZXN0dWRvLWRldGFsaGUgc3VtbWFyeSB7CiAgY3Vyc29yOiBwb2ludGVyOyBjb2xvcjogIzhhYjZmZjsgZm9udC1zaXplOiAxMi41cHg7IGZvbnQtd2VpZ2h0OiA2MDA7CiAgbGlzdC1zdHlsZTogbm9uZTsgb3V0bGluZTogbm9uZTsKfQouZXN0dWRvLWRldGFsaGUgc3VtbWFyeTo6LXdlYmtpdC1kZXRhaWxzLW1hcmtlciB7IGRpc3BsYXk6IG5vbmU7IH0KLmVzdHVkby1kZXRhbGhlIHN1bW1hcnk6OmJlZm9yZSB7IGNvbnRlbnQ6ICfilrggJzsgfQouZXN0dWRvLWRldGFsaGVbb3Blbl0gc3VtbWFyeTo6YmVmb3JlIHsgY29udGVudDogJ+KWviAnOyB9Ci5lc3R1ZG8tZGV0YWxoZSAucmVncmFzLXRleHRvIHsgbWFyZ2luLXRvcDogMTBweDsgfQoubWluaS5lc3R1ZGFkbyB7IGNvbG9yOiAjNmVlN2EzOyBib3JkZXItY29sb3I6ICMxZjUxMzg7IGJhY2tncm91bmQ6ICMwZjM1MjQ7IH0K","/app.js":"Ly8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIFNJR1Ag4oCUIGZyb250ZW5kIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkApjb25zdCAkID0gKHNlbCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWwpOwpjb25zdCAkJCA9IChzZWwpID0+IEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWwpKTsKCmNvbnN0IFMgPSB7CiAgdG9rZW46IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdzaWdwX3Rva2VuJykgfHwgbnVsbCwKICBldTogbnVsbCwKICBkYWRvczogbnVsbCwKICB0ZWxhOiAnZGFzaGJvYXJkJywKICBidXNjYTogJycsCiAgc3VzcFRpbWVyOiBudWxsLAp9OwoKY29uc3QgQ0FSR09fQ09SID0gewogICdBZG1pbiBNYXN0ZXInOiAndmVybWVsaG8nLAogICdDaGVmZSBkZSBQb2zDrWNpYSc6ICd2ZXJtZWxobycsCiAgJ0RlbGVnYWRvJzogJ2FtYXJlbG8nLAogICdFc2NyaXbDo28nOiAnYXp1bCcsCiAgJ1TDoXRpY28nOiAnYXp1bCcsCiAgJ0FnZW50ZSBPZmljaWFsJzogJ2F6dWwnLAogICdHdWFyZGEgTXVuaWNpcGFsJzogJycsCiAgJ0NpdmlsJzogJycsCn07CgpmdW5jdGlvbiBlc2NhcGVIdG1sKHQpIHsKICByZXR1cm4gU3RyaW5nKHQgPT0gbnVsbCA/ICcnIDogdCkucmVwbGFjZSgvWyY8PiInXS9nLCAoYykgPT4gKAogICAgeyAnJic6ICcmYW1wOycsICc8JzogJyZsdDsnLCAnPic6ICcmZ3Q7JywgJyInOiAnJnF1b3Q7JywgIiciOiAnJiMzOTsnIH1bY10KICApKTsKfQpmdW5jdGlvbiBkYXRhQlIoaXNvKSB7CiAgaWYgKCFpc28pIHJldHVybiAn4oCUJzsKICBjb25zdCBkID0gbmV3IERhdGUoaXNvKTsKICByZXR1cm4gZC50b0xvY2FsZVN0cmluZygncHQtQlInLCB7IGRheTogJzItZGlnaXQnLCBtb250aDogJzItZGlnaXQnLCB5ZWFyOiAnMi1kaWdpdCcsIGhvdXI6ICcyLWRpZ2l0JywgbWludXRlOiAnMi1kaWdpdCcgfSk7Cn0KZnVuY3Rpb24gdGVtcG9SZWwoaXNvKSB7CiAgY29uc3QgcyA9IE1hdGguZmxvb3IoKERhdGUubm93KCkgLSBuZXcgRGF0ZShpc28pLmdldFRpbWUoKSkgLyAxMDAwKTsKICBpZiAocyA8IDYwKSByZXR1cm4gJ2Fnb3JhJzsKICBpZiAocyA8IDM2MDApIHJldHVybiBNYXRoLmZsb29yKHMgLyA2MCkgKyAnbWluJzsKICBpZiAocyA8IDg2NDAwKSByZXR1cm4gTWF0aC5mbG9vcihzIC8gMzYwMCkgKyAnaCc7CiAgcmV0dXJuIE1hdGguZmxvb3IocyAvIDg2NDAwKSArICdkJzsKfQoKZnVuY3Rpb24gZmx1dHVhbnRlKG1zZywgdGlwbykgewogIGNvbnN0IGVsID0gJCgnI21lbnNhZ2VtLWZsdXR1YW50ZScpOwogIGVsLnRleHRDb250ZW50ID0gbXNnOwogIGVsLmNsYXNzTmFtZSA9ICdmbHV0dWFudGUnICsgKHRpcG8gPT09ICdlcnJvJyA/ICcgZXJybycgOiAnJyk7CiAgY2xlYXJUaW1lb3V0KGVsLl90KTsKICBlbC5fdCA9IHNldFRpbWVvdXQoKCkgPT4gZWwuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyksIDMyMDApOwp9CgovLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgQVBJIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkAphc3luYyBmdW5jdGlvbiBhcGkobWV0b2RvLCBjYW1pbmhvLCBjb3JwbykgewogIGNvbnN0IG9wdHMgPSB7IG1ldGhvZDogbWV0b2RvLCBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSB9OwogIGlmIChTLnRva2VuKSBvcHRzLmhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9ICdCZWFyZXIgJyArIFMudG9rZW47CiAgaWYgKGNvcnBvICE9PSB1bmRlZmluZWQpIG9wdHMuYm9keSA9IEpTT04uc3RyaW5naWZ5KGNvcnBvKTsKICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCgnL2FwaScgKyBjYW1pbmhvLCBvcHRzKTsKICBjb25zdCB0ZXh0byA9IGF3YWl0IHJlcy50ZXh0KCk7CiAgbGV0IGRhZG9zID0ge307CiAgdHJ5IHsgZGFkb3MgPSB0ZXh0byA/IEpTT04ucGFyc2UodGV4dG8pIDoge307IH0gY2F0Y2ggKF8pIHsgdGhyb3cgbmV3IEVycm9yKCdSZXNwb3N0YSBpbnbDoWxpZGEgZG8gc2Vydmlkb3IuJyk7IH0KICBpZiAocmVzLnN0YXR1cyA9PT0gNDAxKSB7IHNhaXJMb2NhbCgpOyB0aHJvdyBuZXcgRXJyb3IoJ1Nlc3PDo28gZXhwaXJhZGEuJyk7IH0KICBpZiAoIXJlcy5vaykgewogICAgY29uc3QgZXJyID0gbmV3IEVycm9yKGRhZG9zLmVycm9yIHx8ICdFcnJvICcgKyByZXMuc3RhdHVzKTsKICAgIGVyci5kYWRvcyA9IGRhZG9zOwogICAgdGhyb3cgZXJyOwogIH0KICByZXR1cm4gZGFkb3M7Cn0KCi8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBsb2dpbiAvIHNlc3PDo28g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQCmZ1bmN0aW9uIHNhaXJMb2NhbCgpIHsKICBTLnRva2VuID0gbnVsbDsgUy5ldSA9IG51bGw7IFMuZGFkb3MgPSBudWxsOwogIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdzaWdwX3Rva2VuJyk7CiAgJCgnI2FwcCcpLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpOwogICQoJyN0ZWxhLXN1c3BlbnNhbycpLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpOwogICQoJyN0ZWxhLWxvZ2luJykuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7Cn0KCiQoJyNmb3JtLWxvZ2luJykuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgZXYucHJldmVudERlZmF1bHQoKTsKICBjb25zdCBlcnJvID0gJCgnI2xvZ2luLWVycm8nKTsKICBlcnJvLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpOwogIHRyeSB7CiAgICBjb25zdCByID0gYXdhaXQgYXBpKCdQT1NUJywgJy9sb2dpbicsIHsgbG9naW46ICQoJyNpbi1sb2dpbicpLnZhbHVlLCBzZW5oYTogJCgnI2luLXNlbmhhJykudmFsdWUgfSk7CiAgICBTLnRva2VuID0gci50b2tlbjsKICAgIFMuZXUgPSByLnVzZXI7CiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnc2lncF90b2tlbicsIHIudG9rZW4pOwogICAgJCgnI2luLXNlbmhhJykudmFsdWUgPSAnJzsKICAgIGF3YWl0IGVudHJhcigpOwogIH0gY2F0Y2ggKGUpIHsKICAgIGlmIChlLmRhZG9zICYmIGUuZGFkb3Muc3VzcGVuc28pIHJldHVybiBtb3N0cmFyU3VzcGVuc2FvKGUuZGFkb3MpOwogICAgZXJyby50ZXh0Q29udGVudCA9IGUubWVzc2FnZTsKICAgIGVycm8uY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7CiAgfQp9KTsKCiQoJyNidG4tb2xobycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gewogIGNvbnN0IGkgPSAkKCcjaW4tc2VuaGEnKTsKICBpLnR5cGUgPSBpLnR5cGUgPT09ICdwYXNzd29yZCcgPyAndGV4dCcgOiAncGFzc3dvcmQnOwp9KTsKCmZ1bmN0aW9uIG1vc3RyYXJTdXNwZW5zYW8oZCkgewogICQoJyN0ZWxhLWxvZ2luJykuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7CiAgJCgnI3RlbGEtc3VzcGVuc2FvJykuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7CiAgJCgnI3N1c3AtcG9yJykudGV4dENvbnRlbnQgPSBkLmFwbGljYWRvUG9yIHx8ICfigJQnOwogICQoJyNzdXNwLW1vdGl2bycpLnRleHRDb250ZW50ID0gZC5tb3Rpdm8gfHwgJ+KAlCc7CiAgJCgnI3N1c3AtZXhwaXJhJykudGV4dENvbnRlbnQgPSBkYXRhQlIoZC5leHBpcmFFbSk7CiAgbGV0IHJlc3RhbnRlID0gTWF0aC5tYXgoMCwgTWF0aC5mbG9vcihkLnJlc3RhbnRlTXMgLyAxMDAwKSk7CiAgY2xlYXJJbnRlcnZhbChTLnN1c3BUaW1lcik7CiAgY29uc3QgZGVzZW5oYSA9ICgpID0+IHsKICAgIGNvbnN0IGggPSBTdHJpbmcoTWF0aC5mbG9vcihyZXN0YW50ZSAvIDM2MDApKS5wYWRTdGFydCgyLCAnMCcpOwogICAgY29uc3QgbSA9IFN0cmluZyhNYXRoLmZsb29yKChyZXN0YW50ZSAlIDM2MDApIC8gNjApKS5wYWRTdGFydCgyLCAnMCcpOwogICAgY29uc3QgcyA9IFN0cmluZyhyZXN0YW50ZSAlIDYwKS5wYWRTdGFydCgyLCAnMCcpOwogICAgJCgnI3N1c3AtdGVtcG8nKS50ZXh0Q29udGVudCA9IGAke2h9OiR7bX06JHtzfWA7CiAgICBpZiAocmVzdGFudGUgPD0gMCkgeyBjbGVhckludGVydmFsKFMuc3VzcFRpbWVyKTsgdm9sdGFyTG9naW4oKTsgcmV0dXJuOyB9CiAgICByZXN0YW50ZS0tOwogIH07CiAgZGVzZW5oYSgpOwogIFMuc3VzcFRpbWVyID0gc2V0SW50ZXJ2YWwoZGVzZW5oYSwgMTAwMCk7Cn0KZnVuY3Rpb24gdm9sdGFyTG9naW4oKSB7CiAgY2xlYXJJbnRlcnZhbChTLnN1c3BUaW1lcik7CiAgJCgnI3RlbGEtc3VzcGVuc2FvJykuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7CiAgJCgnI3RlbGEtbG9naW4nKS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTsKfQokKCcjYnRuLXZvbHRhci1sb2dpbicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdm9sdGFyTG9naW4pOwoKYXN5bmMgZnVuY3Rpb24gZW50cmFyKCkgewogICQoJyN0ZWxhLWxvZ2luJykuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7CiAgJCgnI3RlbGEtc3VzcGVuc2FvJykuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7CiAgJCgnI2FwcCcpLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpOwogIGF3YWl0IGNhcnJlZ2FyKCk7CiAgaXJQYXJhKCdkYXNoYm9hcmQnKTsKICBpbmljaWFyUG9sbGluZygpOwp9Cgphc3luYyBmdW5jdGlvbiBjYXJyZWdhcigpIHsKICBjb25zdCBkID0gYXdhaXQgYXBpKCdHRVQnLCAnL3N0YXRlJyk7CiAgUy5kYWRvcyA9IGQ7CiAgUy5ldSA9IGQudXNlcnMuZmluZCgodSkgPT4gdS5pZCA9PT0gKFMuZXUgJiYgUy5ldS5pZCkpIHx8IFMuZXU7CiAgcGludGFySWRlbnRpZGFkZSgpOwogIHJlbmRlclR1ZG8oKTsKfQoKZnVuY3Rpb24gcGludGFySWRlbnRpZGFkZSgpIHsKICBjb25zdCBldSA9IFMuZXU7CiAgaWYgKCFldSkgcmV0dXJuOwogICQoJyNldS1ub21lJykudGV4dENvbnRlbnQgPSBldS5ub21lOwogICQoJyNldS1jYXJnbycpLnRleHRDb250ZW50ID0gZXUuY2FyZ287CiAgY29uc3QgYXYgPSAkKCcjZXUtYXZhdGFyJyk7CiAgYXYudGV4dENvbnRlbnQgPSAoZXUubm9tZSB8fCAnPycpLnRyaW0oKS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKTsKICBpZiAoZXUuZm90bykgeyBhdi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgdXJsKCR7ZXUuZm90b30pYDsgYXYudGV4dENvbnRlbnQgPSAnJzsgfQogIGVsc2UgYXYuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJ25vbmUnOwogICQoJyNuYXYtYWRtaW4nKS5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCAoUy5kYWRvcyA/IFMuZGFkb3MubWV1Tml2ZWwgOiAwKSA8IDkwKTsKICBpZiAoUy5kYWRvcyAmJiBTLmRhZG9zLmNvbmZpZykgewogICAgJCgnI21hcmNhLW5vbWUnKS50ZXh0Q29udGVudCA9IFMuZGFkb3MuY29uZmlnLm5vbWVTaXN0ZW1hIHx8ICdTSUdQJzsKICAgICQoJyNtYXJjYS1zdWInKS50ZXh0Q29udGVudCA9ICdTaXN0ZW1hIEludGVybm8nOwogICAgJCgnI2xvZ2luLW5vbWUnKS50ZXh0Q29udGVudCA9IFMuZGFkb3MuY29uZmlnLm5vbWVTaXN0ZW1hIHx8ICdTSUdQJzsKICAgICQoJyNsb2dpbi1zdWInKS50ZXh0Q29udGVudCA9IFMuZGFkb3MuY29uZmlnLm5vbWVDb3Jwb3JhY2FvIHx8ICcnOwogIH0KfQoKJCgnI2J0bi1zYWlyJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7CiAgdHJ5IHsgYXdhaXQgYXBpKCdQT1NUJywgJy9sb2dvdXQnKTsgfSBjYXRjaCAoXykge30KICBzYWlyTG9jYWwoKTsKfSk7CgovLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgbmF2ZWdhw6fDo28g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQCmZ1bmN0aW9uIGlyUGFyYSh0ZWxhKSB7CiAgUy50ZWxhID0gdGVsYTsKICAkJCgnLm5hdi1pdGVtJykuZm9yRWFjaCgoYikgPT4gYi5jbGFzc0xpc3QudG9nZ2xlKCdhdGl2bycsIGIuZGF0YXNldC50ZWxhID09PSB0ZWxhKSk7CiAgJCQoJy50ZWxhJykuZm9yRWFjaCgocykgPT4gcy5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKSk7CiAgY29uc3QgZWwgPSAkKCcjdGVsYS0nICsgdGVsYSk7CiAgaWYgKGVsKSBlbC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTsKICBjb25zdCB0aXR1bG9zID0gewogICAgZGFzaGJvYXJkOiBbJ1BhaW5lbCcsICdWaXPDo28gZ2VyYWwgZG8gZ3J1cGFtZW50byddLAogICAgb2NvcnJlbmNpYXM6IFsnT2NvcnLDqm5jaWFzJywgJ1JlZ2lzdHJvIGUgYWNvbXBhbmhhbWVudG8nXSwKICAgIHByb3ZhczogWydQcm92YXMnLCAnUHJvdmFzIGRvIFJQIGUgYXZhbGlhw6fDtWVzJ10sCiAgICBwb250bzogWydCYXRlIFBvbnRvJywgJ0VudHJhZGEsIHNhw61kYSBlIGhvcsOhcmlvIGRlIHNlcnZpw6dvJ10sCiAgICBoaWVyYXJxdWlhOiBbJ0hpZXJhcnF1aWEnLCAnQ2FkZWlhIGRlIGNvbWFuZG8gZG8gZ3J1cGFtZW50byddLAogICAgcmVncmFzOiBbJ1JlZ3JhcyBkbyBSUCcsICdOb3JtYXMgZG8gcm9sZXBsYXknXSwKICAgIGVzdHVkb3M6IFsnRXN0dWRvcycsICdNYXRlcmlhbCBkZSBlc3R1ZG8gZG8gZWZldGl2byddLAogICAgZWZldGl2bzogWydFZmV0aXZvJywgJ1RvZG9zIG9zIGludGVncmFudGVzIGRvIHNpc3RlbWEnXSwKICAgIHBvbnRvczogWydQb250dWHDp8OjbycsICdMYW7Dp2FtZW50byBlIGhpc3TDs3JpY28gZGUgcG9udG9zJ10sCiAgICBjaGF0OiBbJ0NoYXQnLCAnQ29tdW5pY2HDp8OjbyBkbyBlZmV0aXZvJ10sCiAgICBhdWRpdG9yaWE6IFsnQXVkaXRvcmlhJywgJ1R1ZG8gbyBxdWUgYWNvbnRlY2Ugbm8gc2lzdGVtYSddLAogICAgcGVyZmlsOiBbJ01ldSBQZXJmaWwnLCAnU2V1cyBkYWRvcyBlIHN1YSBzZW5oYSddLAogICAgYWRtaW46IFsnQWRtaW5pc3RyYcOnw6NvJywgJ0JhY2t1cCBlIGNvbmZpZ3VyYcOnw6NvJ10sCiAgfTsKICBjb25zdCB0ID0gdGl0dWxvc1t0ZWxhXSB8fCBbJ+KAlCcsICcnXTsKICAkKCcjdGl0dWxvLXRlbGEnKS50ZXh0Q29udGVudCA9IHRbMF07CiAgJCgnI3N1YnRpdHVsby10ZWxhJykudGV4dENvbnRlbnQgPSB0WzFdOwogICQkKCcubmF2LWl0ZW0nKS5mb3JFYWNoKChiKSA9PiBiLmNsYXNzTGlzdC50b2dnbGUoJ2F0aXZvJywgYi5kYXRhc2V0LnRlbGEgPT09IHRlbGEpKTsKICAkKCcjc2lkZWJhcicpLmNsYXNzTGlzdC5yZW1vdmUoJ2FiZXJ0YScpOwogIGlmICh0ZWxhID09PSAnY2hhdCcpIHJvbGFyQ2hhdCgpOwp9CiQkKCcubmF2LWl0ZW0nKS5mb3JFYWNoKChiKSA9PiBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gaXJQYXJhKGIuZGF0YXNldC50ZWxhKSkpOwoKLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIG1vZGFpcyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAKZnVuY3Rpb24gYWJyaXJNb2RhbCh0aXR1bG8sIGh0bWwpIHsKICAkKCcjbW9kYWwtdGl0dWxvJykudGV4dENvbnRlbnQgPSB0aXR1bG87CiAgJCgnI21vZGFsLWNvcnBvJykuaW5uZXJIVE1MID0gaHRtbDsKICAkKCcjb3ZlcmxheScpLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpOwp9CmZ1bmN0aW9uIGZlY2hhck1vZGFsKCkgewogICQoJyNvdmVybGF5JykuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7CiAgJCgnI21vZGFsLWNvcnBvJykuaW5uZXJIVE1MID0gJyc7Cn0KJCgnI21vZGFsLWZlY2hhcicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZmVjaGFyTW9kYWwpOwokKCcjb3ZlcmxheScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHsgaWYgKGUudGFyZ2V0LmlkID09PSAnb3ZlcmxheScpIGZlY2hhck1vZGFsKCk7IH0pOwoKLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIHJlbmRlciBnZXJhbCDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAKZnVuY3Rpb24gcmVuZGVyVHVkbygpIHsKICBpZiAoIVMuZGFkb3MpIHJldHVybjsKICBjb25zdCBldSA9IFMuZGFkb3MudXNlcnMuZmluZCgodSkgPT4gUy5ldSAmJiB1LmlkID09PSBTLmV1LmlkKSB8fCBTLmV1OwogIFMuZXUgPSBldTsKICBwaW50YXJJZGVudGlkYWRlKCk7CiAgcmVuZGVyRGFzaGJvYXJkKCk7CiAgcmVuZGVyT2NvcnJlbmNpYXMoKTsKICByZW5kZXJQcm92YXMoKTsKICByZW5kZXJQb250bygpOwogIHJlbmRlckhpZXJhcnF1aWEoKTsKICByZW5kZXJSZWdyYXMoKTsKICByZW5kZXJFc3R1ZG9zKCk7CiAgcmVuZGVyRWZldGl2bygpOwogIHJlbmRlclBvbnRvcygpOwogIHJlbmRlckNoYXQoKTsKICByZW5kZXJBdWRpdG9yaWEoKTsKICByZW5kZXJQZXJmaWwoKTsKICByZW5kZXJBZG1pbigpOwogIHJlbmRlck5vdGlmQmFkZ2UoKTsKICBpZiAoUy50ZWxhID09PSAnY2hhdCcpIHJvbGFyQ2hhdCgpOwp9CgovLyDilIDilIAgcGFpbmVsIOKUgOKUgApmdW5jdGlvbiByZW5kZXJEYXNoYm9hcmQoKSB7CiAgY29uc3QgZCA9IFMuZGFkb3M7CiAgY29uc3QgcGVuZCA9IGQub2NvcnJlbmNpYXMuZmlsdGVyKChvKSA9PiBvLnN0YXR1cyA9PT0gJ1BlbmRlbnRlJykubGVuZ3RoOwogIGNvbnN0IGFjZWl0YXMgPSBkLm9jb3JyZW5jaWFzLmZpbHRlcigobykgPT4gby5zdGF0dXMgPT09ICdBY2VpdGEnKS5sZW5ndGg7CiAgY29uc3QgYXRpdm9zID0gZC51c2Vycy5maWx0ZXIoKHUpID0+IHUuYXRpdm8pLmxlbmd0aDsKICBjb25zdCBzdXNwZW5zb3MgPSBkLnVzZXJzLmZpbHRlcigodSkgPT4gdS5zdXNwZW5zb0F0ZSAmJiBuZXcgRGF0ZSh1LnN1c3BlbnNvQXRlKSA+IG5ldyBEYXRlKCkpLmxlbmd0aDsKCiAgJCgnI2NhcmRzLWRhc2hib2FyZCcpLmlubmVySFRNTCA9IGAKICAgIDxkaXYgY2xhc3M9ImNhcmQgZGVzdGFxdWUiPjxzbWFsbD5FRkVUSVZPIEFUSVZPPC9zbWFsbD48c3Ryb25nPiR7YXRpdm9zfTwvc3Ryb25nPjwvZGl2PgogICAgPGRpdiBjbGFzcz0iY2FyZCI+PHNtYWxsPk9DT1JSw4pOQ0lBUyBQRU5ERU5URVM8L3NtYWxsPjxzdHJvbmc+JHtwZW5kfTwvc3Ryb25nPjwvZGl2PgogICAgPGRpdiBjbGFzcz0iY2FyZCI+PHNtYWxsPk9DT1JSw4pOQ0lBUyBBQ0VJVEFTPC9zbWFsbD48c3Ryb25nPiR7YWNlaXRhc308L3N0cm9uZz48L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImNhcmQiPjxzbWFsbD5TVVNQRU5TT1M8L3NtYWxsPjxzdHJvbmc+JHtzdXNwZW5zb3N9PC9zdHJvbmc+PC9kaXY+YDsKCiAgY29uc3QgcmVjID0gZC5vY29ycmVuY2lhcy5zbGljZSgwLCA2KTsKICAkKCcjZGFzaC1vY29ycmVuY2lhcycpLmlubmVySFRNTCA9IHJlYy5sZW5ndGgKICAgID8gcmVjLm1hcCgobykgPT4gYAogICAgICA8ZGl2IGNsYXNzPSJvYy1jYXJkIj4KICAgICAgICA8ZGl2IGNsYXNzPSJvYy10b3BvIj4KICAgICAgICAgIDxkaXY+PHN0cm9uZz4ke2VzY2FwZUh0bWwoby50aXR1bG8pfTwvc3Ryb25nPgogICAgICAgICAgPGRpdiBjbGFzcz0ib2MtbWV0YSI+JHtlc2NhcGVIdG1sKG8uYWdlbnRlKX0gwrcgJHtkYXRhQlIoby5jcmlhZG9FbSl9PC9kaXY+PC9kaXY+CiAgICAgICAgICAke2JhZGdlU3RhdHVzKG8uc3RhdHVzKX0KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+YCkuam9pbignJykKICAgIDogJzxkaXYgY2xhc3M9InZhemlvIj5OZW5odW1hIG9jb3Jyw6puY2lhIHJlZ2lzdHJhZGEgYWluZGEuPC9kaXY+JzsKCiAgY29uc3QgcmFuayA9IFsuLi5kLnVzZXJzXS5zb3J0KChhLCBiKSA9PiAoYi5wb250b3MgfHwgMCkgLSAoYS5wb250b3MgfHwgMCkpLnNsaWNlKDAsIDgpOwogICQoJyNkYXNoLXJhbmtpbmcnKS5pbm5lckhUTUwgPSByYW5rLmxlbmd0aAogICAgPyBgPHRhYmxlPjx0aGVhZD48dHI+PHRoPiM8L3RoPjx0aD5Qb2xpY2lhbDwvdGg+PHRoPkNhcmdvPC90aD48dGggc3R5bGU9InRleHQtYWxpZ246cmlnaHQiPlBvbnRvczwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgICAgJHtyYW5rLm1hcCgodSwgaSkgPT4gYDx0cj4KICAgICAgICA8dGQ+JHtpICsgMX3CujwvdGQ+CiAgICAgICAgPHRkPiR7ZXNjYXBlSHRtbCh1Lm5vbWUpfTxkaXYgY2xhc3M9ImxvZ2luLXN1YXZlIj5AJHtlc2NhcGVIdG1sKHUubG9naW4pfTwvZGl2PjwvdGQ+CiAgICAgICAgPHRkPjxzcGFuIGNsYXNzPSJiYWRnZSAke0NBUkdPX0NPUlt1LmNhcmdvXSB8fCAnJ30iPiR7ZXNjYXBlSHRtbCh1LmNhcmdvKX08L3NwYW4+PC90ZD4KICAgICAgICA8dGQgc3R5bGU9InRleHQtYWxpZ246cmlnaHQiPjxzdHJvbmc+JHt1LnBvbnRvcyB8fCAwfTwvc3Ryb25nPjwvdGQ+CiAgICAgIDwvdHI+YCkuam9pbignJyl9PC90Ym9keT48L3RhYmxlPmAKICAgIDogJzxkaXYgY2xhc3M9InZhemlvIj5TZW0gcG9udHVhw6fDo28gbGFuw6dhZGEuPC9kaXY+JzsKfQoKZnVuY3Rpb24gYmFkZ2VTdGF0dXMocykgewogIGNvbnN0IGNvciA9IHsgUGVuZGVudGU6ICdhbWFyZWxvJywgQWNlaXRhOiAndmVyZGUnLCBSZWN1c2FkYTogJ3Zlcm1lbGhvJywgQ2FuY2VsYWRhOiAnJyB9W3NdIHx8ICcnOwogIHJldHVybiBgPHNwYW4gY2xhc3M9ImJhZGdlICR7Y29yfSI+JHtlc2NhcGVIdG1sKHMpfTwvc3Bhbj5gOwp9CgovLyDilIDilIAgb2NvcnLDqm5jaWFzIOKUgOKUgApmdW5jdGlvbiByZW5kZXJPY29ycmVuY2lhcygpIHsKICBjb25zdCBsaXN0YSA9IFMuZGFkb3Mub2NvcnJlbmNpYXM7CiAgY29uc3QgcG9kZUV4Y2x1aXIgPSBTLmRhZG9zLm1ldU5pdmVsID49IDcwOwogICQoJyNsaXN0YS1vY29ycmVuY2lhcycpLmlubmVySFRNTCA9IGxpc3RhLmxlbmd0aAogICAgPyBsaXN0YS5tYXAoKG8pID0+IGAKICAgICAgPGRpdiBjbGFzcz0ib2MtY2FyZCI+CiAgICAgICAgPGRpdiBjbGFzcz0ib2MtdG9wbyI+CiAgICAgICAgICA8ZGl2PgogICAgICAgICAgICA8c3Ryb25nPiR7ZXNjYXBlSHRtbChvLnRpdHVsbyl9PC9zdHJvbmc+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9Im9jLW1ldGEiPiR7ZXNjYXBlSHRtbChvLmFnZW50ZSl9IMK3ICR7ZXNjYXBlSHRtbChvLmNhcmdvQWdlbnRlIHx8ICcnKX0gwrcgJHtkYXRhQlIoby5jcmlhZG9FbSl9JHtvLnJlc3BvbnNhdmVsID8gJyDCtyByZXNwLjogJyArIGVzY2FwZUh0bWwoby5yZXNwb25zYXZlbCkgOiAnJ308L2Rpdj4KICAgICAgICAgIDwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0iYWNvZXMtbGluaGEiPgogICAgICAgICAgICAke2JhZGdlU3RhdHVzKG8uc3RhdHVzKX0KICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz0ibWluaSIgZGF0YS1vYy1lZGl0YXI9IiR7by5pZH0iPkVkaXRhcjwvYnV0dG9uPgogICAgICAgICAgICAke3BvZGVFeGNsdWlyID8gYDxidXR0b24gY2xhc3M9Im1pbmkgcGVyaWdvIiBkYXRhLW9jLWV4Y2x1aXI9IiR7by5pZH0iPkV4Y2x1aXI8L2J1dHRvbj5gIDogJyd9CiAgICAgICAgICA8L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgICAke28uZGVwb2ltZW50byA/IGA8ZGl2IGNsYXNzPSJvYy1kZXAiPiR7ZXNjYXBlSHRtbChvLmRlcG9pbWVudG8pfTwvZGl2PmAgOiAnJ30KICAgICAgICAke28ucmVzcG9zdGEgPyBgPGRpdiBjbGFzcz0ib2MtcmVzcCI+4oazICR7ZXNjYXBlSHRtbChvLnJlc3Bvc3RhKX08L2Rpdj5gIDogJyd9CiAgICAgIDwvZGl2PmApLmpvaW4oJycpCiAgICA6ICc8ZGl2IGNsYXNzPSJ2YXppbyI+TmVuaHVtYSBvY29ycsOqbmNpYSByZWdpc3RyYWRhIGFpbmRhLjwvZGl2Pic7CgogICQkKCdbZGF0YS1vYy1lZGl0YXJdJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IG1vZGFsT2NvcnJlbmNpYShiLmRhdGFzZXQub2NFZGl0YXIpKSk7CiAgJCQoJ1tkYXRhLW9jLWV4Y2x1aXJdJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHsKICAgIGlmICghY29uZmlybSgnRXhjbHVpciBlc3RhIG9jb3Jyw6puY2lhIGRlZmluaXRpdmFtZW50ZT8nKSkgcmV0dXJuOwogICAgdHJ5IHsgYXdhaXQgYXBpKCdERUxFVEUnLCAnL29jb3JyZW5jaWFzLycgKyBiLmRhdGFzZXQub2NFeGNsdWlyKTsgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKCdPY29ycsOqbmNpYSBleGNsdcOtZGEuJyk7IH0KICAgIGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICB9KSk7Cn0KCiQoJyNidG4tYWJyaXItb2NvcnJlbmNpYScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gbW9kYWxPY29ycmVuY2lhKG51bGwpKTsKCmZ1bmN0aW9uIG1vZGFsT2NvcnJlbmNpYShpZCkgewogIGNvbnN0IG9jID0gaWQgPyBTLmRhZG9zLm9jb3JyZW5jaWFzLmZpbmQoKG8pID0+IG8uaWQgPT09IGlkKSA6IG51bGw7CiAgY29uc3QgY2FyZ29zID0gUy5kYWRvcy5jYXJnb3MubWFwKChjKSA9PiBjLm5vbWUpOwogIGNvbnN0IHN0YXR1cyA9IFsnUGVuZGVudGUnLCAnQWNlaXRhJywgJ1JlY3VzYWRhJywgJ0NhbmNlbGFkYSddOwogIGFicmlyTW9kYWwob2MgPyAnRWRpdGFyIG9jb3Jyw6puY2lhJyA6ICdOb3ZhIG9jb3Jyw6puY2lhJywgYAogICAgPGZvcm0gaWQ9ImZvcm0tb2MiPgogICAgICA8bGFiZWw+VMOtdHVsbyAvIGFzc3VudG88aW5wdXQgdHlwZT0idGV4dCIgaWQ9Im9jLXRpdHVsbyIgcmVxdWlyZWQgbWF4bGVuZ3RoPSIxMjAiIHZhbHVlPSIke2VzY2FwZUh0bWwob2MgPyBvYy50aXR1bG8gOiAnJyl9Ij48L2xhYmVsPgogICAgICA8bGFiZWw+QWdlbnRlPGlucHV0IHR5cGU9InRleHQiIGlkPSJvYy1hZ2VudGUiIHJlcXVpcmVkIG1heGxlbmd0aD0iNjAiIHZhbHVlPSIke2VzY2FwZUh0bWwob2MgPyBvYy5hZ2VudGUgOiAoUy5ldSA/IFMuZXUubm9tZSA6ICcnKSl9Ij48L2xhYmVsPgogICAgICA8bGFiZWw+Q2FyZ28gZG8gYWdlbnRlPHNlbGVjdCBpZD0ib2MtY2FyZ28iPgogICAgICAgICR7Y2FyZ29zLm1hcCgoYykgPT4gYDxvcHRpb24gJHtvYyAmJiBvYy5jYXJnb0FnZW50ZSA9PT0gYyA/ICdzZWxlY3RlZCcgOiAoIW9jICYmIFMuZXUgJiYgUy5ldS5jYXJnbyA9PT0gYyA/ICdzZWxlY3RlZCcgOiAnJyl9PiR7Y308L29wdGlvbj5gKS5qb2luKCcnKX0KICAgICAgPC9zZWxlY3Q+PC9sYWJlbD4KICAgICAgPGxhYmVsPlN0YXR1czxzZWxlY3QgaWQ9Im9jLXN0YXR1cyI+JHtzdGF0dXMubWFwKChzKSA9PiBgPG9wdGlvbiAke29jICYmIG9jLnN0YXR1cyA9PT0gcyA/ICdzZWxlY3RlZCcgOiAnJ30+JHtzfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PjwvbGFiZWw+CiAgICAgIDxsYWJlbD5SZXNwb25zw6F2ZWwgKHF1ZW0gYXRlbmRldSk8aW5wdXQgdHlwZT0idGV4dCIgaWQ9Im9jLXJlc3BvbnNhdmVsIiBtYXhsZW5ndGg9IjYwIiB2YWx1ZT0iJHtlc2NhcGVIdG1sKG9jID8gb2MucmVzcG9uc2F2ZWwgfHwgJycgOiAnJyl9Ij48L2xhYmVsPgogICAgICA8bGFiZWw+RGVwb2ltZW50bzx0ZXh0YXJlYSBpZD0ib2MtZGVwb2ltZW50byIgcm93cz0iNCIgbWF4bGVuZ3RoPSI0MDAwIj4ke2VzY2FwZUh0bWwob2MgPyBvYy5kZXBvaW1lbnRvIDogJycpfTwvdGV4dGFyZWE+PC9sYWJlbD4KICAgICAgPGxhYmVsPlJlc3Bvc3RhIC8gb2JzZXJ2YcOnw6NvPHRleHRhcmVhIGlkPSJvYy1yZXNwb3N0YSIgcm93cz0iMyIgbWF4bGVuZ3RoPSI0MDAwIj4ke2VzY2FwZUh0bWwob2MgPyBvYy5yZXNwb3N0YSA6ICcnKX08L3RleHRhcmVhPjwvbGFiZWw+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyIgdHlwZT0ic3VibWl0Ij4ke29jID8gJ1NhbHZhciBhbHRlcmHDp8O1ZXMnIDogJ1JlZ2lzdHJhciBvY29ycsOqbmNpYSd9PC9idXR0b24+CiAgICA8L2Zvcm0+YCk7CgogICQoJyNmb3JtLW9jJykuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgICBldi5wcmV2ZW50RGVmYXVsdCgpOwogICAgY29uc3QgY29ycG8gPSB7CiAgICAgIHRpdHVsbzogJCgnI29jLXRpdHVsbycpLnZhbHVlLCBhZ2VudGU6ICQoJyNvYy1hZ2VudGUnKS52YWx1ZSwgY2FyZ29BZ2VudGU6ICQoJyNvYy1jYXJnbycpLnZhbHVlLAogICAgICBzdGF0dXM6ICQoJyNvYy1zdGF0dXMnKS52YWx1ZSwgcmVzcG9uc2F2ZWw6ICQoJyNvYy1yZXNwb25zYXZlbCcpLnZhbHVlLAogICAgICBkZXBvaW1lbnRvOiAkKCcjb2MtZGVwb2ltZW50bycpLnZhbHVlLCByZXNwb3N0YTogJCgnI29jLXJlc3Bvc3RhJykudmFsdWUsCiAgICB9OwogICAgdHJ5IHsKICAgICAgaWYgKG9jKSBhd2FpdCBhcGkoJ1BVVCcsICcvb2NvcnJlbmNpYXMvJyArIG9jLmlkLCBjb3Jwbyk7CiAgICAgIGVsc2UgYXdhaXQgYXBpKCdQT1NUJywgJy9vY29ycmVuY2lhcycsIGNvcnBvKTsKICAgICAgZmVjaGFyTW9kYWwoKTsgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKCdPY29ycsOqbmNpYSBzYWx2YS4nKTsKICAgIH0gY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQogIH0pOwp9CgovLyDilIDilIAgZWZldGl2byDilIDilIAKJCgnI2J1c2NhLWVmZXRpdm8nKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIChlKSA9PiB7IFMuYnVzY2EgPSBlLnRhcmdldC52YWx1ZS50b0xvd2VyQ2FzZSgpOyByZW5kZXJFZmV0aXZvKCk7IH0pOwokKCcjYnRuLWFicmlyLXVzdWFyaW8nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG1vZGFsTm92b1VzdWFyaW8pOwoKZnVuY3Rpb24gcmVuZGVyRWZldGl2bygpIHsKICBjb25zdCBldSA9IFMuZXUgfHwge307CiAgY29uc3QgbWV1Tml2ZWwgPSBTLmRhZG9zLm1ldU5pdmVsOwogIGNvbnN0IHBvZGVHZXJpciA9IG1ldU5pdmVsID49IDgwOwogIGNvbnN0IGxpc3RhID0gUy5kYWRvcy51c2VycwogICAgLmZpbHRlcigodSkgPT4gIVMuYnVzY2EgfHwgKHUubm9tZSArICcgJyArIHUubG9naW4gKyAnICcgKyB1LmNhcmdvKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKFMuYnVzY2EpKQogICAgLnNvcnQoKGEsIGIpID0+IFMuZGFkb3MuY2FyZ29zLmZpbmRJbmRleCgoYykgPT4gYy5ub21lID09PSBiLmNhcmdvKSAtIFMuZGFkb3MuY2FyZ29zLmZpbmRJbmRleCgoYykgPT4gYy5ub21lID09PSBhLmNhcmdvKSk7CgogICQoJyNidG4tYWJyaXItdXN1YXJpbycpLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsICFwb2RlR2VyaXIpOwoKICAkKCcjdGFiZWxhLWVmZXRpdm8nKS5pbm5lckhUTUwgPSBsaXN0YS5sZW5ndGggPyBgCiAgICA8dGFibGU+PHRoZWFkPjx0cj4KICAgICAgPHRoPlBvbGljaWFsPC90aD48dGg+Q2FyZ288L3RoPjx0aD5TaXR1YcOnw6NvPC90aD48dGggc3R5bGU9InRleHQtYWxpZ246cmlnaHQiPlBvbnRvczwvdGg+PHRoPjwvdGg+CiAgICA8L3RyPjwvdGhlYWQ+PHRib2R5PgogICAgJHtsaXN0YS5tYXAoKHUpID0+IHsKICAgICAgY29uc3Qgc3VzcCA9IHUuc3VzcGVuc29BdGUgJiYgbmV3IERhdGUodS5zdXNwZW5zb0F0ZSkgPiBuZXcgRGF0ZSgpOwogICAgICBjb25zdCBzaXR1YWNhbyA9ICF1LmF0aXZvID8gJzxzcGFuIGNsYXNzPSJiYWRnZSB2ZXJtZWxobyI+RGVzYXRpdmFkbzwvc3Bhbj4nCiAgICAgICAgOiBzdXNwID8gJzxzcGFuIGNsYXNzPSJiYWRnZSBhbWFyZWxvIj5TdXNwZW5zbzwvc3Bhbj4nCiAgICAgICAgOiAnPHNwYW4gY2xhc3M9ImJhZGdlIHZlcmRlIj5BdGl2bzwvc3Bhbj4nOwogICAgICBjb25zdCBzdXBlcmlvciA9IChTLmRhZG9zLmNhcmdvcy5maW5kKChjKSA9PiBjLm5vbWUgPT09IGV1LmNhcmdvKSB8fCB7fSkubml2ZWwgPiAoUy5kYWRvcy5jYXJnb3MuZmluZCgoYykgPT4gYy5ub21lID09PSB1LmNhcmdvKSB8fCB7fSkubml2ZWwgfHwgZXUuY2FyZ28gPT09ICdBZG1pbiBNYXN0ZXInOwogICAgICBjb25zdCBwb2RlQXF1aSA9IHBvZGVHZXJpciAmJiBzdXBlcmlvciAmJiB1LmlkICE9PSBldS5pZDsKICAgICAgcmV0dXJuIGA8dHI+CiAgICAgICAgPHRkPjxkaXYgY2xhc3M9Im5vbWUtY2VsIj48ZGl2IGNsYXNzPSJhdmF0YXIiICR7dS5mb3RvID8gYHN0eWxlPSJiYWNrZ3JvdW5kLWltYWdlOnVybCgke3UuZm90b30pImAgOiAnJ30+JHt1LmZvdG8gPyAnJyA6IGVzY2FwZUh0bWwoKHUubm9tZSB8fCAnPycpLmNoYXJBdCgwKSl9PC9kaXY+CiAgICAgICAgICA8ZGl2PjxzdHJvbmc+JHtlc2NhcGVIdG1sKHUubm9tZSl9PC9zdHJvbmc+PGRpdiBjbGFzcz0ibG9naW4tc3VhdmUiPkAke2VzY2FwZUh0bWwodS5sb2dpbil9PC9kaXY+PC9kaXY+PC9kaXY+PC90ZD4KICAgICAgICA8dGQ+PHNwYW4gY2xhc3M9ImJhZGdlICR7Q0FSR09fQ09SW3UuY2FyZ29dIHx8ICcnfSI+JHtlc2NhcGVIdG1sKHUuY2FyZ28pfTwvc3Bhbj48L3RkPgogICAgICAgIDx0ZD4ke3NpdHVhY2FvfTwvdGQ+CiAgICAgICAgPHRkIHN0eWxlPSJ0ZXh0LWFsaWduOnJpZ2h0Ij48c3Ryb25nPiR7dS5wb250b3MgfHwgMH08L3N0cm9uZz48L3RkPgogICAgICAgIDx0ZD48ZGl2IGNsYXNzPSJhY29lcy1saW5oYSI+CiAgICAgICAgICAke3BvZGVBcXVpID8gYDxidXR0b24gY2xhc3M9Im1pbmkiIGRhdGEtY2FyZ289IiR7dS5pZH0iPkNhcmdvPC9idXR0b24+CiAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJtaW5pIiBkYXRhLXNlbmhhPSIke3UuaWR9Ij5TZW5oYTwvYnV0dG9uPgogICAgICAgICAgPGJ1dHRvbiBjbGFzcz0ibWluaSIgZGF0YS1zdXNwPSIke3UuaWR9Ij4ke3N1c3AgPyAnU3VzcGVuc8OjbycgOiAnU3VzcGVuZGVyJ308L2J1dHRvbj4KICAgICAgICAgIDxidXR0b24gY2xhc3M9Im1pbmkiIGRhdGEtc3RhdHVzPSIke3UuaWR9Ij4ke3UuYXRpdm8gPyAnRGVzYXRpdmFyJyA6ICdBdGl2YXInfTwvYnV0dG9uPgogICAgICAgICAgPGJ1dHRvbiBjbGFzcz0ibWluaSBwZXJpZ28iIGRhdGEtZXhjbHVpcj0iJHt1LmlkfSI+RXhjbHVpcjwvYnV0dG9uPmAgOiAnPHNwYW4gY2xhc3M9ImxvZ2luLXN1YXZlIj7igJQ8L3NwYW4+J30KICAgICAgICA8L2Rpdj48L3RkPgogICAgICA8L3RyPmA7CiAgICB9KS5qb2luKCcnKX08L3Rib2R5PjwvdGFibGU+YAogICAgOiAnPGRpdiBjbGFzcz0idmF6aW8iPk5lbmh1bSBwb2xpY2lhbCBlbmNvbnRyYWRvLjwvZGl2Pic7CgogICQkKCdbZGF0YS1jYXJnb10nKS5mb3JFYWNoKChiKSA9PiBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gbW9kYWxDYXJnbyhiLmRhdGFzZXQuY2FyZ28pKSk7CiAgJCQoJ1tkYXRhLXNlbmhhXScpLmZvckVhY2goKGIpID0+IGIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBtb2RhbFNlbmhhKGIuZGF0YXNldC5zZW5oYSkpKTsKICAkJCgnW2RhdGEtc3VzcF0nKS5mb3JFYWNoKChiKSA9PiBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gbW9kYWxTdXNwZW5zYW8oYi5kYXRhc2V0LnN1c3ApKSk7CiAgJCQoJ1tkYXRhLXN0YXR1c10nKS5mb3JFYWNoKChiKSA9PiBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4gewogICAgY29uc3QgdSA9IFMuZGFkb3MudXNlcnMuZmluZCgoeCkgPT4geC5pZCA9PT0gYi5kYXRhc2V0LnN0YXR1cyk7CiAgICB0cnkgewogICAgICBhd2FpdCBhcGkoJ1BVVCcsIGAvdXNlcnMvJHt1LmlkfS9zdGF0dXNgLCB7IGF0aXZvOiAhdS5hdGl2byB9KTsKICAgICAgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKHUuYXRpdm8gPyAnVXN1w6FyaW8gZGVzYXRpdmFkby4nIDogJ1VzdcOhcmlvIGF0aXZhZG8uJyk7CiAgICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICB9KSk7CiAgJCQoJ1tkYXRhLWV4Y2x1aXJdJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHsKICAgIGNvbnN0IHUgPSBTLmRhZG9zLnVzZXJzLmZpbmQoKHgpID0+IHguaWQgPT09IGIuZGF0YXNldC5leGNsdWlyKTsKICAgIGlmICghY29uZmlybShgRXhjbHVpciAke3Uubm9tZX0gKEAke3UubG9naW59KT8gSXNzbyBuw6NvIHBvZGUgc2VyIGRlc2ZlaXRvLmApKSByZXR1cm47CiAgICB0cnkgeyBhd2FpdCBhcGkoJ0RFTEVURScsICcvdXNlcnMvJyArIHUuaWQpOyBhd2FpdCBjYXJyZWdhcigpOyBmbHV0dWFudGUoJ1VzdcOhcmlvIGV4Y2x1w61kby4nKTsgfQogICAgY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQogIH0pKTsKfQoKZnVuY3Rpb24gbW9kYWxOb3ZvVXN1YXJpbygpIHsKICBjb25zdCBjYXJnb3MgPSBTLmRhZG9zLmNhcmdvcy5maWx0ZXIoKGMpID0+IGMubml2ZWwgPCBTLmRhZG9zLm1ldU5pdmVsIHx8IFMuZXUuY2FyZ28gPT09ICdBZG1pbiBNYXN0ZXInKTsKICBhYnJpck1vZGFsKCdOb3ZvIHVzdcOhcmlvJywgYAogICAgPGZvcm0gaWQ9ImZvcm0tbm92byI+CiAgICAgIDxsYWJlbD5Ob21lIGNvbXBsZXRvPGlucHV0IHR5cGU9InRleHQiIGlkPSJudS1ub21lIiByZXF1aXJlZCBtYXhsZW5ndGg9IjYwIj48L2xhYmVsPgogICAgICA8bGFiZWw+TG9naW4gKMO6bmljbyk8aW5wdXQgdHlwZT0idGV4dCIgaWQ9Im51LWxvZ2luIiByZXF1aXJlZCBtYXhsZW5ndGg9IjI0IiBwbGFjZWhvbGRlcj0iZXg6IHNpbHZhIj48L2xhYmVsPgogICAgICA8bGFiZWw+Q2FyZ288c2VsZWN0IGlkPSJudS1jYXJnbyI+JHtjYXJnb3MubWFwKChjKSA9PiBgPG9wdGlvbj4ke2Mubm9tZX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2xhYmVsPgogICAgICA8bGFiZWw+U2VuaGEgaW5pY2lhbDxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0ibnUtc2VuaGEiIHJlcXVpcmVkIG1pbmxlbmd0aD0iNCIgdmFsdWU9IjEyMzQiPjwvbGFiZWw+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyIgdHlwZT0ic3VibWl0Ij5DcmlhciBhY2Vzc288L2J1dHRvbj4KICAgIDwvZm9ybT5gKTsKICAkKCcjZm9ybS1ub3ZvJykuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgICBldi5wcmV2ZW50RGVmYXVsdCgpOwogICAgdHJ5IHsKICAgICAgYXdhaXQgYXBpKCdQT1NUJywgJy91c2VycycsIHsKICAgICAgICBub21lOiAkKCcjbnUtbm9tZScpLnZhbHVlLCBsb2dpbjogJCgnI251LWxvZ2luJykudmFsdWUudHJpbSgpLAogICAgICAgIGNhcmdvOiAkKCcjbnUtY2FyZ28nKS52YWx1ZSwgc2VuaGE6ICQoJyNudS1zZW5oYScpLnZhbHVlLAogICAgICB9KTsKICAgICAgZmVjaGFyTW9kYWwoKTsgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKCdVc3XDoXJpbyBjcmlhZG8uJyk7CiAgICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICB9KTsKfQoKZnVuY3Rpb24gbW9kYWxDYXJnbyhpZCkgewogIGNvbnN0IHUgPSBTLmRhZG9zLnVzZXJzLmZpbmQoKHgpID0+IHguaWQgPT09IGlkKTsKICBhYnJpck1vZGFsKCdBbHRlcmFyIGNhcmdvJywgYAogICAgPHAgY2xhc3M9InRleHRvLWFqdWRhIj4ke2VzY2FwZUh0bWwodS5ub21lKX0gKEAke2VzY2FwZUh0bWwodS5sb2dpbil9KSBlc3TDoSBjb21vIDxzdHJvbmc+JHtlc2NhcGVIdG1sKHUuY2FyZ28pfTwvc3Ryb25nPi48L3A+CiAgICA8Zm9ybSBpZD0iZm9ybS1jYXJnbyI+CiAgICAgIDxsYWJlbD5Ob3ZvIGNhcmdvPHNlbGVjdCBpZD0iY2ctY2FyZ28iPiR7Uy5kYWRvcy5jYXJnb3MubWFwKChjKSA9PiBgPG9wdGlvbiAke2Mubm9tZSA9PT0gdS5jYXJnbyA/ICdzZWxlY3RlZCcgOiAnJ30+JHtjLm5vbWV9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9sYWJlbD4KICAgICAgPGxhYmVsPk1vdGl2byAodmFpIHBhcmEgYSBhdWRpdG9yaWEpPGlucHV0IHR5cGU9InRleHQiIGlkPSJjZy1tb3Rpdm8iIG1heGxlbmd0aD0iMjAwIiBwbGFjZWhvbGRlcj0iZXg6IHByb21vw6fDo28gcG9yIGRlc2VtcGVuaG8iPjwvbGFiZWw+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyIgdHlwZT0ic3VibWl0Ij5TYWx2YXIgY2FyZ288L2J1dHRvbj4KICAgIDwvZm9ybT5gKTsKICAkKCcjZm9ybS1jYXJnbycpLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGFzeW5jIChldikgPT4gewogICAgZXYucHJldmVudERlZmF1bHQoKTsKICAgIHRyeSB7CiAgICAgIGF3YWl0IGFwaSgnUFVUJywgYC91c2Vycy8ke3UuaWR9L2NhcmdvYCwgeyBjYXJnbzogJCgnI2NnLWNhcmdvJykudmFsdWUsIG1vdGl2bzogJCgnI2NnLW1vdGl2bycpLnZhbHVlIH0pOwogICAgICBmZWNoYXJNb2RhbCgpOyBhd2FpdCBjYXJyZWdhcigpOyBmbHV0dWFudGUoJ0NhcmdvIGF0dWFsaXphZG8uJyk7CiAgICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICB9KTsKfQoKZnVuY3Rpb24gbW9kYWxTZW5oYShpZCkgewogIGNvbnN0IHUgPSBTLmRhZG9zLnVzZXJzLmZpbmQoKHgpID0+IHguaWQgPT09IGlkKTsKICBhYnJpck1vZGFsKCdSZWRlZmluaXIgc2VuaGEnLCBgCiAgICA8cCBjbGFzcz0idGV4dG8tYWp1ZGEiPkRlZmluaXIgbm92YSBzZW5oYSBwYXJhICR7ZXNjYXBlSHRtbCh1Lm5vbWUpfSAoQCR7ZXNjYXBlSHRtbCh1LmxvZ2luKX0pLjwvcD4KICAgIDxmb3JtIGlkPSJmb3JtLXJzIj4KICAgICAgPGxhYmVsPk5vdmEgc2VuaGE8aW5wdXQgdHlwZT0idGV4dCIgaWQ9InJzLW5vdmEiIHJlcXVpcmVkIG1pbmxlbmd0aD0iNCI+PC9sYWJlbD4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIiB0eXBlPSJzdWJtaXQiPlJlZGVmaW5pcjwvYnV0dG9uPgogICAgPC9mb3JtPmApOwogICQoJyNmb3JtLXJzJykuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgICBldi5wcmV2ZW50RGVmYXVsdCgpOwogICAgdHJ5IHsKICAgICAgYXdhaXQgYXBpKCdQVVQnLCBgL3VzZXJzLyR7dS5pZH0vc2VuaGFgLCB7IG5vdmFTZW5oYTogJCgnI3JzLW5vdmEnKS52YWx1ZSB9KTsKICAgICAgZmVjaGFyTW9kYWwoKTsgZmx1dHVhbnRlKCdTZW5oYSByZWRlZmluaWRhLicpOwogICAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9CiAgfSk7Cn0KCmZ1bmN0aW9uIG1vZGFsU3VzcGVuc2FvKGlkKSB7CiAgY29uc3QgdSA9IFMuZGFkb3MudXNlcnMuZmluZCgoeCkgPT4geC5pZCA9PT0gaWQpOwogIGNvbnN0IHN1c3AgPSB1LnN1c3BlbnNvQXRlICYmIG5ldyBEYXRlKHUuc3VzcGVuc29BdGUpID4gbmV3IERhdGUoKTsKICBhYnJpck1vZGFsKCdTdXNwZW5zw6NvJywgYAogICAgJHtzdXNwID8gYDxwIGNsYXNzPSJ0ZXh0by1hanVkYSI+U3VzcGVuc28gYXTDqSA8c3Ryb25nPiR7ZGF0YUJSKHUuc3VzcGVuc29BdGUpfTwvc3Ryb25nPiDigJQgbW90aXZvOiAke2VzY2FwZUh0bWwodS5zdXNwZW5zYW9Nb3Rpdm8gfHwgJ+KAlCcpfTwvcD5gIDogJyd9CiAgICA8Zm9ybSBpZD0iZm9ybS1zdXNwIj4KICAgICAgPGxhYmVsPkR1cmHDp8OjbyBlbSBtaW51dG9zPGlucHV0IHR5cGU9Im51bWJlciIgaWQ9InNwLW1pbiIgbWluPSIxIiBtYXg9IjQzMjAwIiB2YWx1ZT0iJHtzdXNwID8gNjAgOiA2MH0iIHJlcXVpcmVkPjwvbGFiZWw+CiAgICAgIDxsYWJlbD5Nb3Rpdm88aW5wdXQgdHlwZT0idGV4dCIgaWQ9InNwLW1vdGl2byIgcmVxdWlyZWQgbWF4bGVuZ3RoPSIyMDAiPjwvbGFiZWw+CiAgICAgIDxkaXYgY2xhc3M9ImxpbmhhLWJvdG9lcyI+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIiB0eXBlPSJzdWJtaXQiPkFwbGljYXIgc3VzcGVuc8OjbzwvYnV0dG9uPgogICAgICAgICR7c3VzcCA/ICc8YnV0dG9uIGNsYXNzPSJidG4tc2VjdW5kYXJpbyBzbSIgdHlwZT0iYnV0dG9uIiBpZD0ic3AtcmVtb3ZlciI+UmVtb3ZlciBzdXNwZW5zw6NvPC9idXR0b24+JyA6ICcnfQogICAgICA8L2Rpdj4KICAgIDwvZm9ybT5gKTsKICAkKCcjZm9ybS1zdXNwJykuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgICBldi5wcmV2ZW50RGVmYXVsdCgpOwogICAgdHJ5IHsKICAgICAgYXdhaXQgYXBpKCdQVVQnLCBgL3VzZXJzLyR7dS5pZH0vc3VzcGVuc2FvYCwgeyBtaW51dG9zOiBOdW1iZXIoJCgnI3NwLW1pbicpLnZhbHVlKSwgbW90aXZvOiAkKCcjc3AtbW90aXZvJykudmFsdWUgfSk7CiAgICAgIGZlY2hhck1vZGFsKCk7IGF3YWl0IGNhcnJlZ2FyKCk7IGZsdXR1YW50ZSgnU3VzcGVuc8OjbyBhcGxpY2FkYS4nKTsKICAgIH0gY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQogIH0pOwogIGNvbnN0IHJlbSA9ICQoJyNzcC1yZW1vdmVyJyk7CiAgaWYgKHJlbSkgcmVtLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4gewogICAgdHJ5IHsKICAgICAgYXdhaXQgYXBpKCdQVVQnLCBgL3VzZXJzLyR7dS5pZH0vc3VzcGVuc2FvYCwgeyBtaW51dG9zOiAwIH0pOwogICAgICBmZWNoYXJNb2RhbCgpOyBhd2FpdCBjYXJyZWdhcigpOyBmbHV0dWFudGUoJ1N1c3BlbnPDo28gcmVtb3ZpZGEuJyk7CiAgICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICB9KTsKfQoKLy8g4pSA4pSAIHBvbnRvcyDilIDilIAKZnVuY3Rpb24gcmVuZGVyUG9udG9zKCkgewogIGNvbnN0IHBvZGVMYW5jYXIgPSBTLmRhZG9zLm1ldU5pdmVsID49IDYwOwogIGNvbnN0IGZvcm0gPSAkKCcjZm9ybS1wb250b3MnKTsKICBmb3JtLmNsb3Nlc3QoJy5wYWluZWwnKS5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCAhcG9kZUxhbmNhcik7CgogIGNvbnN0IHNlbGVjdCA9ICQoJyNwb250b3MtdXNlcicpOwogIGNvbnN0IGF0dWFsID0gc2VsZWN0LnZhbHVlOwogIHNlbGVjdC5pbm5lckhUTUwgPSAnPG9wdGlvbiB2YWx1ZT0iIj5TZWxlY2lvbmUuLi48L29wdGlvbj4nICsgUy5kYWRvcy51c2VycwogICAgLnNsaWNlKCkuc29ydCgoYSwgYikgPT4gYS5ub21lLmxvY2FsZUNvbXBhcmUoYi5ub21lKSkKICAgIC5tYXAoKHUpID0+IGA8b3B0aW9uIHZhbHVlPSIke3UuaWR9Ij4ke2VzY2FwZUh0bWwodS5ub21lKX0gKEAke2VzY2FwZUh0bWwodS5sb2dpbil9KSDigJQgJHt1LnBvbnRvcyB8fCAwfSBwdHM8L29wdGlvbj5gKS5qb2luKCcnKTsKICBpZiAoYXR1YWwpIHNlbGVjdC52YWx1ZSA9IGF0dWFsOwoKICBjb25zdCBoaXN0ID0gUy5kYWRvcy5wb250b3Muc2xpY2UoMCwgNjApOwogICQoJyNoaXN0b3JpY28tcG9udG9zJykuaW5uZXJIVE1MID0gaGlzdC5sZW5ndGggPyBgCiAgICA8dGFibGU+PHRoZWFkPjx0cj48dGg+UG9saWNpYWw8L3RoPjx0aD5Qb250b3M8L3RoPjx0aD5Nb3Rpdm88L3RoPjx0aD5Qb3I8L3RoPjx0aD5RdWFuZG88L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAke2hpc3QubWFwKChwKSA9PiBgPHRyPgogICAgICA8dGQ+QCR7ZXNjYXBlSHRtbChwLmxvZ2luKX08L3RkPgogICAgICA8dGQ+PHN0cm9uZyBzdHlsZT0iY29sb3I6JHtwLmRlbHRhID4gMCA/ICd2YXIoLS12ZXJkZSknIDogJ3ZhcigtLXZlcm1lbGhvKSd9Ij4ke3AuZGVsdGEgPiAwID8gJysnIDogJyd9JHtwLmRlbHRhfTwvc3Ryb25nPjwvdGQ+CiAgICAgIDx0ZD4ke2VzY2FwZUh0bWwocC5tb3Rpdm8pfTwvdGQ+CiAgICAgIDx0ZCBjbGFzcz0ibG9naW4tc3VhdmUiPkAke2VzY2FwZUh0bWwocC5wb3IpfTwvdGQ+CiAgICAgIDx0ZCBjbGFzcz0ibG9naW4tc3VhdmUiPiR7ZGF0YUJSKHAuZW0pfTwvdGQ+CiAgICA8L3RyPmApLmpvaW4oJycpfTwvdGJvZHk+PC90YWJsZT5gCiAgICA6ICc8ZGl2IGNsYXNzPSJ2YXppbyI+TmVuaHVtIGxhbsOnYW1lbnRvIGFpbmRhLjwvZGl2Pic7CgogIGNvbnN0IG1ldXMgPSBTLmRhZG9zLnBvbnRvcy5maWx0ZXIoKHApID0+IFMuZXUgJiYgcC51c2VySWQgPT09IFMuZXUuaWQpLnNsaWNlKDAsIDQwKTsKICAkKCcjcGVyZmlsLXBvbnRvcycpLmlubmVySFRNTCA9IG1ldXMubGVuZ3RoID8gYAogICAgPHRhYmxlPjx0aGVhZD48dHI+PHRoPlBvbnRvczwvdGg+PHRoPk1vdGl2bzwvdGg+PHRoPlBvcjwvdGg+PHRoPlF1YW5kbzwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4KICAgICR7bWV1cy5tYXAoKHApID0+IGA8dHI+CiAgICAgIDx0ZD48c3Ryb25nIHN0eWxlPSJjb2xvcjoke3AuZGVsdGEgPiAwID8gJ3ZhcigtLXZlcmRlKScgOiAndmFyKC0tdmVybWVsaG8pJ30iPiR7cC5kZWx0YSA+IDAgPyAnKycgOiAnJ30ke3AuZGVsdGF9PC9zdHJvbmc+PC90ZD4KICAgICAgPHRkPiR7ZXNjYXBlSHRtbChwLm1vdGl2byl9PC90ZD48dGQgY2xhc3M9ImxvZ2luLXN1YXZlIj5AJHtlc2NhcGVIdG1sKHAucG9yKX08L3RkPgogICAgICA8dGQgY2xhc3M9ImxvZ2luLXN1YXZlIj4ke2RhdGFCUihwLmVtKX08L3RkPjwvdHI+YCkuam9pbignJyl9PC90Ym9keT48L3RhYmxlPmAKICAgIDogJzxkaXYgY2xhc3M9InZhemlvIj5Wb2PDqiBhaW5kYSBuw6NvIHJlY2ViZXUgcG9udG9zLjwvZGl2Pic7Cn0KCiQoJyNmb3JtLXBvbnRvcycpLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGFzeW5jIChldikgPT4gewogIGV2LnByZXZlbnREZWZhdWx0KCk7CiAgY29uc3QgdXNlcklkID0gJCgnI3BvbnRvcy11c2VyJykudmFsdWU7CiAgaWYgKCF1c2VySWQpIHJldHVybiBmbHV0dWFudGUoJ1NlbGVjaW9uZSBvIHBvbGljaWFsLicsICdlcnJvJyk7CiAgdHJ5IHsKICAgIGF3YWl0IGFwaSgnUE9TVCcsICcvcG9udG9zJywgeyB1c2VySWQsIGRlbHRhOiBOdW1iZXIoJCgnI3BvbnRvcy1kZWx0YScpLnZhbHVlKSwgbW90aXZvOiAkKCcjcG9udG9zLW1vdGl2bycpLnZhbHVlIH0pOwogICAgJCgnI3BvbnRvcy1tb3Rpdm8nKS52YWx1ZSA9ICcnOwogICAgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKCdQb250b3MgbGFuw6dhZG9zLicpOwogIH0gY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQp9KTsKCi8vIOKUgOKUgCBjaGF0IOKUgOKUgAoKLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIHByb3ZhcyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAKZnVuY3Rpb24gZHVyYWNhb0RlKG1pbikgewogIGlmIChtaW4gPT0gbnVsbCkgcmV0dXJuICfigJQnOwogIGNvbnN0IGggPSBNYXRoLmZsb29yKG1pbiAvIDYwKSwgbSA9IG1pbiAlIDYwOwogIHJldHVybiAoaCA/IGggKyAnaCAnIDogJycpICsgbSArICdtaW4nOwp9CmZ1bmN0aW9uIGJhZGdlRW50cmVnYShlKSB7CiAgaWYgKCFlKSByZXR1cm4gJzxzcGFuIGNsYXNzPSJiYWRnZSI+TsOjbyBlbnZpYWRhPC9zcGFuPic7CiAgaWYgKGUuc3RhdHVzID09PSAnQXByb3ZhZGEnKSByZXR1cm4gYDxzcGFuIGNsYXNzPSJiYWRnZSB2ZXJkZSI+QXByb3ZhZGEke2Uubm90YSAhPSBudWxsID8gJyDCtyAnICsgZS5ub3RhIDogJyd9PC9zcGFuPmA7CiAgaWYgKGUuc3RhdHVzID09PSAnUmVwcm92YWRhJykgcmV0dXJuIGA8c3BhbiBjbGFzcz0iYmFkZ2UgdmVybWVsaG8iPlJlcHJvdmFkYSR7ZS5ub3RhICE9IG51bGwgPyAnIMK3ICcgKyBlLm5vdGEgOiAnJ308L3NwYW4+YDsKICByZXR1cm4gJzxzcGFuIGNsYXNzPSJiYWRnZSBhbWFyZWxvIj5BZ3VhcmRhbmRvIGF2YWxpYcOnw6NvPC9zcGFuPic7Cn0KCmZ1bmN0aW9uIHJlbmRlclByb3ZhcygpIHsKICBjb25zdCBkID0gUy5kYWRvczsKICBjb25zdCBtZXVOaXZlbCA9IGQubWV1Tml2ZWw7CiAgY29uc3QgcG9kZUxhbmNhciA9IG1ldU5pdmVsID49IDgwOwogIGNvbnN0IGV1ID0gUy5ldTsKICBjb25zdCBwcm92YXMgPSBkLnByb3ZhcyB8fCBbXTsKICBjb25zdCBlbnRyZWdhcyA9IGQuZW50cmVnYXMgfHwgW107CgogICQoJyNidG4tYWJyaXItcHJvdmEnKS5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCAhcG9kZUxhbmNhcik7CiAgJCgnI3Byb3Zhcy1hdmlzbycpLnRleHRDb250ZW50ID0gcG9kZUxhbmNhcgogICAgPyAnVm9jw6ogcG9kZSBsYW7Dp2FyIHByb3ZhcyBhcXVpLiBRdWFuZG8gYWxndcOpbSBlbnZpYXIgYSBwcm92YSBmZWl0YSwgZWxhIGFwYXJlY2UgbmEgbGlzdGEgZGUgYmFpeG8gcGFyYSBhdmFsaWFyLicKICAgIDogJ0FzIHByb3ZhcyBsYW7Dp2FkYXMgYXBhcmVjZW0gYXF1aS4gRmHDp2EgYSBzdWEsIGVzY3JldmEgYXMgcmVzcG9zdGFzIGUgZW52aWUgcGFyYSBhdmFsaWHDp8OjbyBkbyBjb21hbmRvLic7CgogICQoJyNsaXN0YS1wcm92YXMnKS5pbm5lckhUTUwgPSBwcm92YXMubGVuZ3RoID8gYAogICAgPHRhYmxlPjx0aGVhZD48dHI+CiAgICAgIDx0aD5Qcm92YTwvdGg+PHRoPkxhbsOnYWRhIHBvcjwvdGg+PHRoPlByYXpvPC90aD48dGg+TWluaGEgc2l0dWHDp8OjbzwvdGg+PHRoPjwvdGg+CiAgICA8L3RyPjwvdGhlYWQ+PHRib2R5PgogICAgJHtwcm92YXMubWFwKChwKSA9PiB7CiAgICAgIGNvbnN0IG1pbmhhID0gZW50cmVnYXMuZmluZCgoZSkgPT4gZS5wcm92YUlkID09PSBwLmlkICYmIGUudXNlcklkID09PSBldS5pZCk7CiAgICAgIHJldHVybiBgPHRyPgogICAgICAgIDx0ZD48c3Ryb25nPiR7ZXNjYXBlSHRtbChwLnRpdHVsbyl9PC9zdHJvbmc+CiAgICAgICAgICAke3AuZGVzY3JpY2FvID8gYDxkaXYgY2xhc3M9ImxvZ2luLXN1YXZlIj4ke2VzY2FwZUh0bWwocC5kZXNjcmljYW8pLnNsaWNlKDAsIDE2MCl9PC9kaXY+YCA6ICcnfTwvdGQ+CiAgICAgICAgPHRkPiR7ZXNjYXBlSHRtbChwLmNyaWFkb1Bvck5vbWUgfHwgcC5jcmlhZG9Qb3IpfTxkaXYgY2xhc3M9ImxvZ2luLXN1YXZlIj4ke2RhdGFCUihwLmNyaWFkb0VtKX08L2Rpdj48L3RkPgogICAgICAgIDx0ZD4ke3AucHJhem8gPyBlc2NhcGVIdG1sKHAucHJhem8pIDogJ+KAlCd9PC90ZD4KICAgICAgICA8dGQ+JHtiYWRnZUVudHJlZ2EobWluaGEpfTwvdGQ+CiAgICAgICAgPHRkPjxkaXYgY2xhc3M9ImFjb2VzLWxpbmhhIj4KICAgICAgICAgICR7bWluaGEgPyBgPGJ1dHRvbiBjbGFzcz0ibWluaSIgZGF0YS12ZXItZW50cmVnYT0iJHttaW5oYS5pZH0iPlZlciBlbnZpbzwvYnV0dG9uPmAKICAgICAgICAgICAgICAgICAgOiBgPGJ1dHRvbiBjbGFzcz0ibWluaSIgZGF0YS1mYXplcj0iJHtwLmlkfSI+RmF6ZXIgcHJvdmE8L2J1dHRvbj5gfQogICAgICAgICAgJHtwb2RlTGFuY2FyID8gYDxidXR0b24gY2xhc3M9Im1pbmkgcGVyaWdvIiBkYXRhLWV4Y2x1aXItcHJvdmE9IiR7cC5pZH0iPkV4Y2x1aXI8L2J1dHRvbj5gIDogJyd9CiAgICAgICAgPC9kaXY+PC90ZD4KICAgICAgPC90cj5gOwogICAgfSkuam9pbignJyl9PC90Ym9keT48L3RhYmxlPmAKICAgIDogJzxkaXYgY2xhc3M9InZhemlvIj5OZW5odW1hIHByb3ZhIGxhbsOnYWRhIGFpbmRhLjwvZGl2Pic7CgogIGNvbnN0IHBhaW5lbEVudCA9ICQoJyNwYWluZWwtZW50cmVnYXMnKTsKICBwYWluZWxFbnQuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgIXBvZGVMYW5jYXIpOwogIGlmIChwb2RlTGFuY2FyKSB7CiAgICBjb25zdCBhZ3VhcmRhbmRvID0gZW50cmVnYXMuZmlsdGVyKChlKSA9PiBlLnN0YXR1cyA9PT0gJ0FndWFyZGFuZG8nKTsKICAgIGNvbnN0IG91dHJhcyA9IGVudHJlZ2FzLmZpbHRlcigoZSkgPT4gZS5zdGF0dXMgIT09ICdBZ3VhcmRhbmRvJyk7CiAgICBjb25zdCBsaW5oYSA9IChlKSA9PiBgPHRyPgogICAgICA8dGQ+PHN0cm9uZz4ke2VzY2FwZUh0bWwoZS5ub21lKX08L3N0cm9uZz48ZGl2IGNsYXNzPSJsb2dpbi1zdWF2ZSI+QCR7ZXNjYXBlSHRtbChlLmxvZ2luKX0gwrcgJHtlc2NhcGVIdG1sKGUuY2FyZ28pfTwvZGl2PjwvdGQ+CiAgICAgIDx0ZD4ke2VzY2FwZUh0bWwoZS5wcm92YVRpdHVsbyl9PC90ZD4KICAgICAgPHRkPiR7ZGF0YUJSKGUuZW0pfTwvdGQ+CiAgICAgIDx0ZD4ke2JhZGdlRW50cmVnYShlKX08L3RkPgogICAgICA8dGQ+PGRpdiBjbGFzcz0iYWNvZXMtbGluaGEiPjxidXR0b24gY2xhc3M9Im1pbmkiIGRhdGEtYXZhbGlhcj0iJHtlLmlkfSI+JHtlLnN0YXR1cyA9PT0gJ0FndWFyZGFuZG8nID8gJ0F2YWxpYXInIDogJ1JlYXZhbGlhcid9PC9idXR0b24+PC9kaXY+PC90ZD4KICAgIDwvdHI+YDsKICAgICQoJyNsaXN0YS1lbnRyZWdhcycpLmlubmVySFRNTCA9IGVudHJlZ2FzLmxlbmd0aCA/IGAKICAgICAgPHRhYmxlPjx0aGVhZD48dHI+PHRoPk1lbWJybzwvdGg+PHRoPlByb3ZhPC90aD48dGg+RW52aWFkYSBlbTwvdGg+PHRoPlNpdHVhw6fDo288L3RoPjx0aD48L3RoPjwvdHI+PC90aGVhZD4KICAgICAgPHRib2R5PiR7Wy4uLmFndWFyZGFuZG8sIC4uLm91dHJhc10ubWFwKGxpbmhhKS5qb2luKCcnKX08L3Rib2R5PjwvdGFibGU+YAogICAgICA6ICc8ZGl2IGNsYXNzPSJ2YXppbyI+TmluZ3XDqW0gZW52aW91IHByb3ZhIGFpbmRhLjwvZGl2Pic7CiAgfQoKICAkJCgnW2RhdGEtZmF6ZXJdJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IG1vZGFsRmF6ZXJQcm92YShiLmRhdGFzZXQuZmF6ZXIpKSk7CiAgJCQoJ1tkYXRhLWF2YWxpYXJdJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IG1vZGFsQXZhbGlhcihiLmRhdGFzZXQuYXZhbGlhcikpKTsKICAkJCgnW2RhdGEtdmVyLWVudHJlZ2FdJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IG1vZGFsVmVyRW50cmVnYShiLmRhdGFzZXQudmVyRW50cmVnYSkpKTsKICAkJCgnW2RhdGEtZXhjbHVpci1wcm92YV0nKS5mb3JFYWNoKChiKSA9PiBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4gewogICAgaWYgKCFjb25maXJtKCdFeGNsdWlyIGVzdGEgcHJvdmEgZSB0b2RhcyBhcyBlbnRyZWdhcyBkZWxhPycpKSByZXR1cm47CiAgICB0cnkgeyBhd2FpdCBhcGkoJ0RFTEVURScsICcvcHJvdmFzLycgKyBiLmRhdGFzZXQuZXhjbHVpclByb3ZhKTsgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKCdQcm92YSBleGNsdcOtZGEuJyk7IH0KICAgIGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICB9KSk7Cn0KCmZ1bmN0aW9uIG1vZGFsTm92YVByb3ZhKCkgewogIGFicmlyTW9kYWwoJ0xhbsOnYXIgcHJvdmEnLCBgCiAgICA8Zm9ybSBpZD0iZm9ybS1wcm92YSI+CiAgICAgIDxsYWJlbD5Uw610dWxvPGlucHV0IHR5cGU9InRleHQiIGlkPSJwci10aXR1bG8iIHJlcXVpcmVkIG1heGxlbmd0aD0iMTIwIiBwbGFjZWhvbGRlcj0iRXguOiBQcm92YSBkZSBUw6F0aWNvIOKAlCAxwqogZXRhcGEiPjwvbGFiZWw+CiAgICAgIDxsYWJlbD5EZXNjcmnDp8OjbyAob3BjaW9uYWwpPGlucHV0IHR5cGU9InRleHQiIGlkPSJwci1kZXNjIiBtYXhsZW5ndGg9IjMwMCIgcGxhY2Vob2xkZXI9IkV4LjogUHJvdmEgcHLDoXRpY2EgZGUgYWJvcmRhZ2VtIj48L2xhYmVsPgogICAgICA8bGFiZWw+UGVyZ3VudGFzIC8gaW5zdHJ1w6fDtWVzPHRleHRhcmVhIGlkPSJwci1wZXJndW50YXMiIHJvd3M9IjgiIG1heGxlbmd0aD0iNjAwMCIgcGxhY2Vob2xkZXI9IjEpIC4uLiYjMTA7MikgLi4uJiMxMDszKSAuLi4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICAgICAgPGxhYmVsPlByYXpvIChvcGNpb25hbCk8aW5wdXQgdHlwZT0iZGF0ZSIgaWQ9InByLXByYXpvIj48L2xhYmVsPgogICAgICA8ZGl2IGNsYXNzPSJsaW5oYS1ib3RvZXMiPjxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSIgdHlwZT0ic3VibWl0Ij5MYW7Dp2FyIHBhcmEgbyBlZmV0aXZvPC9idXR0b24+PC9kaXY+CiAgICA8L2Zvcm0+YCk7CiAgJCgnI2Zvcm0tcHJvdmEnKS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBhc3luYyAoZXYpID0+IHsKICAgIGV2LnByZXZlbnREZWZhdWx0KCk7CiAgICB0cnkgewogICAgICBhd2FpdCBhcGkoJ1BPU1QnLCAnL3Byb3ZhcycsIHsKICAgICAgICB0aXR1bG86ICQoJyNwci10aXR1bG8nKS52YWx1ZSwKICAgICAgICBkZXNjcmljYW86ICQoJyNwci1kZXNjJykudmFsdWUsCiAgICAgICAgcGVyZ3VudGFzOiAkKCcjcHItcGVyZ3VudGFzJykudmFsdWUsCiAgICAgICAgcHJhem86ICQoJyNwci1wcmF6bycpLnZhbHVlIHx8IG51bGwsCiAgICAgIH0pOwogICAgICBmZWNoYXJNb2RhbCgpOyBhd2FpdCBjYXJyZWdhcigpOyBmbHV0dWFudGUoJ1Byb3ZhIGxhbsOnYWRhIHBhcmEgbyBlZmV0aXZvLicpOwogICAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9CiAgfSk7Cn0KCmZ1bmN0aW9uIG1vZGFsRmF6ZXJQcm92YShpZCkgewogIGNvbnN0IHAgPSAoUy5kYWRvcy5wcm92YXMgfHwgW10pLmZpbmQoKHgpID0+IHguaWQgPT09IGlkKTsKICBpZiAoIXApIHJldHVybjsKICBhYnJpck1vZGFsKHAudGl0dWxvLCBgCiAgICA8ZGl2IGNsYXNzPSJwcm92YS10ZXh0byI+CiAgICAgICR7cC5kZXNjcmljYW8gPyBgPHAgY2xhc3M9InRleHRvLWFqdWRhIj4ke2VzY2FwZUh0bWwocC5kZXNjcmljYW8pfTwvcD5gIDogJyd9CiAgICAgIDxkaXYgY2xhc3M9InJlZ3Jhcy10ZXh0byI+JHtlc2NhcGVIdG1sKHAucGVyZ3VudGFzIHx8ICdTZW0gcGVyZ3VudGFzIGVzY3JpdGFzLiBSZXNwb25kYSBjb25mb3JtZSBvIHF1ZSBmb2kgcGVkaWRvIG5vIGNoYXQvY29tYW5kby4nKS5yZXBsYWNlKC9cbi9nLCAnPGJyPicpfTwvZGl2PgogICAgPC9kaXY+CiAgICA8Zm9ybSBpZD0iZm9ybS1lbnRyZWdhIj4KICAgICAgPGxhYmVsPlN1YXMgcmVzcG9zdGFzPHRleHRhcmVhIGlkPSJlbi1yZXNwb3N0YXMiIHJvd3M9IjEwIiByZXF1aXJlZCBtYXhsZW5ndGg9IjEwMDAwIiBwbGFjZWhvbGRlcj0iUmVzcG9uZGEgYXF1aSwgbnVtZXJhbmRvIGlndWFsIMOgcyBwZXJndW50YXMuLi4iPjwvdGV4dGFyZWE+PC9sYWJlbD4KICAgICAgPGRpdiBjbGFzcz0ibGluaGEtYm90b2VzIj48YnV0dG9uIGNsYXNzPSJidG4tcHJpbWFyaW8gc20iIHR5cGU9InN1Ym1pdCI+RW52aWFyIHByb3ZhIGZlaXRhPC9idXR0b24+PC9kaXY+CiAgICA8L2Zvcm0+YCk7CiAgJCgnI2Zvcm0tZW50cmVnYScpLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGFzeW5jIChldikgPT4gewogICAgZXYucHJldmVudERlZmF1bHQoKTsKICAgIHRyeSB7CiAgICAgIGF3YWl0IGFwaSgnUE9TVCcsICcvcHJvdmFzLycgKyBwLmlkICsgJy9lbnRyZWdhcicsIHsgcmVzcG9zdGFzOiAkKCcjZW4tcmVzcG9zdGFzJykudmFsdWUgfSk7CiAgICAgIGZlY2hhck1vZGFsKCk7IGF3YWl0IGNhcnJlZ2FyKCk7IGZsdXR1YW50ZSgnUHJvdmEgZW52aWFkYSBwYXJhIGF2YWxpYcOnw6NvLicpOwogICAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9CiAgfSk7Cn0KCmZ1bmN0aW9uIG1vZGFsVmVyRW50cmVnYShpZCkgewogIGNvbnN0IGUgPSAoUy5kYWRvcy5lbnRyZWdhcyB8fCBbXSkuZmluZCgoeCkgPT4geC5pZCA9PT0gaWQpOwogIGlmICghZSkgcmV0dXJuOwogIGFicmlyTW9kYWwoJ01pbmhhIHByb3ZhOiAnICsgZS5wcm92YVRpdHVsbywgYAogICAgPHAgY2xhc3M9InRleHRvLWFqdWRhIj5FbnZpYWRhIGVtICR7ZGF0YUJSKGUuZW0pfSDigJQgJHtiYWRnZUVudHJlZ2EoZSl9PC9wPgogICAgPGRpdiBjbGFzcz0icmVncmFzLXRleHRvIj4ke2VzY2FwZUh0bWwoZS5yZXNwb3N0YXMpLnJlcGxhY2UoL1xuL2csICc8YnI+Jyl9PC9kaXY+CiAgICAke2UuZmVlZGJhY2sgPyBgPHAgY2xhc3M9InRleHRvLWFqdWRhIiBzdHlsZT0ibWFyZ2luLXRvcDoxNHB4Ij48c3Ryb25nPkNvbWVudMOhcmlvIGRvIGNvbWFuZG86PC9zdHJvbmc+ICR7ZXNjYXBlSHRtbChlLmZlZWRiYWNrKX08L3A+YCA6ICcnfWApOwp9CgpmdW5jdGlvbiBtb2RhbEF2YWxpYXIoaWQpIHsKICBjb25zdCBlID0gKFMuZGFkb3MuZW50cmVnYXMgfHwgW10pLmZpbmQoKHgpID0+IHguaWQgPT09IGlkKTsKICBpZiAoIWUpIHJldHVybjsKICBhYnJpck1vZGFsKCdBdmFsaWFyIHByb3ZhJywgYAogICAgPHAgY2xhc3M9InRleHRvLWFqdWRhIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChlLm5vbWUpfTwvc3Ryb25nPiAoQCR7ZXNjYXBlSHRtbChlLmxvZ2luKX0pIOKAlCAke2VzY2FwZUh0bWwoZS5jYXJnbyl9PGJyPgogICAgICAke2VzY2FwZUh0bWwoZS5wcm92YVRpdHVsbyl9IMK3IGVudmlhZGEgZW0gJHtkYXRhQlIoZS5lbSl9PC9wPgogICAgPGRpdiBjbGFzcz0icmVncmFzLXRleHRvIiBzdHlsZT0ibWF4LWhlaWdodDoyNDBweDtvdmVyZmxvdzphdXRvO21hcmdpbjoxMnB4IDAiPiR7ZXNjYXBlSHRtbChlLnJlc3Bvc3RhcykucmVwbGFjZSgvXG4vZywgJzxicj4nKX08L2Rpdj4KICAgIDxmb3JtIGlkPSJmb3JtLWF2YWxpYXIiPgogICAgICA8bGFiZWw+UmVzdWx0YWRvPHNlbGVjdCBpZD0iYXYtc3RhdHVzIj4KICAgICAgICA8b3B0aW9uICR7ZS5zdGF0dXMgPT09ICdBcHJvdmFkYScgPyAnc2VsZWN0ZWQnIDogJyd9PkFwcm92YWRhPC9vcHRpb24+CiAgICAgICAgPG9wdGlvbiAke2Uuc3RhdHVzID09PSAnUmVwcm92YWRhJyA/ICdzZWxlY3RlZCcgOiAnJ30+UmVwcm92YWRhPC9vcHRpb24+CiAgICAgIDwvc2VsZWN0PjwvbGFiZWw+CiAgICAgIDxsYWJlbD5Ob3RhICgwIGEgMTAsIG9wY2lvbmFsKTxpbnB1dCB0eXBlPSJudW1iZXIiIGlkPSJhdi1ub3RhIiBtaW49IjAiIG1heD0iMTAiIHN0ZXA9IjAuNSIgdmFsdWU9IiR7ZS5ub3RhICE9IG51bGwgPyBlLm5vdGEgOiAxMH0iPjwvbGFiZWw+CiAgICAgIDxsYWJlbD5Db21lbnTDoXJpbyAob3BjaW9uYWwpPGlucHV0IHR5cGU9InRleHQiIGlkPSJhdi1mZWVkYmFjayIgbWF4bGVuZ3RoPSIzMDAiIHZhbHVlPSIke2VzY2FwZUh0bWwoZS5mZWVkYmFjayB8fCAnJyl9Ij48L2xhYmVsPgogICAgICA8ZGl2IGNsYXNzPSJsaW5oYS1ib3RvZXMiPjxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSIgdHlwZT0ic3VibWl0Ij5TYWx2YXIgYXZhbGlhw6fDo288L2J1dHRvbj48L2Rpdj4KICAgIDwvZm9ybT5gKTsKICAkKCcjZm9ybS1hdmFsaWFyJykuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgICBldi5wcmV2ZW50RGVmYXVsdCgpOwogICAgdHJ5IHsKICAgICAgYXdhaXQgYXBpKCdQVVQnLCAnL2VudHJlZ2FzLycgKyBlLmlkLCB7CiAgICAgICAgc3RhdHVzOiAkKCcjYXYtc3RhdHVzJykudmFsdWUsCiAgICAgICAgbm90YTogJCgnI2F2LW5vdGEnKS52YWx1ZSwKICAgICAgICBmZWVkYmFjazogJCgnI2F2LWZlZWRiYWNrJykudmFsdWUsCiAgICAgIH0pOwogICAgICBmZWNoYXJNb2RhbCgpOyBhd2FpdCBjYXJyZWdhcigpOyBmbHV0dWFudGUoJ0F2YWxpYcOnw6NvIHNhbHZhLicpOwogICAgfSBjYXRjaCAoZXJyKSB7IGZsdXR1YW50ZShlcnIubWVzc2FnZSwgJ2Vycm8nKTsgfQogIH0pOwp9CgovLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgYmF0ZSBwb250byDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAKZnVuY3Rpb24gcmVuZGVyUG9udG8oKSB7CiAgY29uc3QgZCA9IFMuZGFkb3M7CiAgY29uc3QgZXUgPSBTLmV1OwogIGNvbnN0IHRvZG9zID0gZC5wb250byB8fCBbXTsKICBjb25zdCBtZXVzID0gdG9kb3MuZmlsdGVyKChwKSA9PiBwLnVzZXJJZCA9PT0gZXUuaWQpOwogIGNvbnN0IGFiZXJ0byA9IG1ldXMuZmluZCgocCkgPT4gIXAuc2FpZGEpOwoKICBpZiAoYWJlcnRvKSB7CiAgICBjb25zdCBtaW5zID0gTWF0aC5tYXgoMCwgTWF0aC5yb3VuZCgoRGF0ZS5ub3coKSAtIG5ldyBEYXRlKGFiZXJ0by5lbnRyYWRhKS5nZXRUaW1lKCkpIC8gNjAwMDApKTsKICAgICQoJyNwb250by1zdGF0dXMnKS5pbm5lckhUTUwgPSBgCiAgICAgIDxkaXYgY2xhc3M9InBvbnRvLWNhcmQgZW0tc2VydmljbyI+CiAgICAgICAgPGRpdiBjbGFzcz0icG9udG8tcm90dWxvIj5FTSBTRVJWScOHTzwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9InBvbnRvLWhvcmEiPkVudHJhZGE6IDxzdHJvbmc+JHtkYXRhQlIoYWJlcnRvLmVudHJhZGEpfTwvc3Ryb25nPjwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9InBvbnRvLWhvcmEiPlRlbXBvIGRlIHNlcnZpw6dvOiA8c3Ryb25nPiR7ZHVyYWNhb0RlKG1pbnMpfTwvc3Ryb25nPjwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9ImxvZ2luLXN1YXZlIj5Qb250byBhYmVydG8uIEZpbmFsaXplIHF1YW5kbyBzYWlyIGRvIHNlcnZpw6dvLjwvZGl2PgogICAgICA8L2Rpdj5gOwogICAgJCgnI3BvbnRvLWJvdG9lcycpLmlubmVySFRNTCA9ICc8YnV0dG9uIGNsYXNzPSJidG4tcHJpbWFyaW8gc20iIGlkPSJidG4tcG9udG8tc2FpZGEiPkZpbmFsaXphciBwb250bzwvYnV0dG9uPic7CiAgICAkKCcjYnRuLXBvbnRvLXNhaWRhJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7CiAgICAgIHRyeSB7IGF3YWl0IGFwaSgnUE9TVCcsICcvcG9udG8nLCB7IGFjYW86ICdzYWlkYScgfSk7IGF3YWl0IGNhcnJlZ2FyKCk7IGZsdXR1YW50ZSgnUG9udG8gZmluYWxpemFkby4nKTsgfQogICAgICBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9CiAgICB9KTsKICB9IGVsc2UgewogICAgJCgnI3BvbnRvLXN0YXR1cycpLmlubmVySFRNTCA9IGAKICAgICAgPGRpdiBjbGFzcz0icG9udG8tY2FyZCI+CiAgICAgICAgPGRpdiBjbGFzcz0icG9udG8tcm90dWxvIj5GT1JBIERFIFNFUlZJw4dPPC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0icG9udG8taG9yYSI+Vm9jw6ogbsOjbyB0ZW0gcG9udG8gYWJlcnRvLjwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9ImxvZ2luLXN1YXZlIj5CYXRhIGEgZW50cmFkYSBxdWFuZG8gY29tZcOnYXIgbyBzZXJ2acOnby48L2Rpdj4KICAgICAgPC9kaXY+YDsKICAgICQoJyNwb250by1ib3RvZXMnKS5pbm5lckhUTUwgPSAnPGJ1dHRvbiBjbGFzcz0iYnRuLXByaW1hcmlvIHNtIiBpZD0iYnRuLXBvbnRvLWVudHJhZGEiPkJhdGVyIGVudHJhZGE8L2J1dHRvbj4nOwogICAgJCgnI2J0bi1wb250by1lbnRyYWRhJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7CiAgICAgIHRyeSB7IGF3YWl0IGFwaSgnUE9TVCcsICcvcG9udG8nLCB7IGFjYW86ICdlbnRyYWRhJyB9KTsgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKCdFbnRyYWRhIHJlZ2lzdHJhZGEuJyk7IH0KICAgICAgY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQogICAgfSk7CiAgfQoKICBjb25zdCB0YWJlbGEgPSAobGlzdGEsIGNvbU5vbWUpID0+IGxpc3RhLmxlbmd0aCA/IGAKICAgIDx0YWJsZT48dGhlYWQ+PHRyPgogICAgICAke2NvbU5vbWUgPyAnPHRoPlBvbGljaWFsPC90aD4nIDogJyd9PHRoPkVudHJhZGE8L3RoPjx0aD5TYcOtZGE8L3RoPjx0aD5EdXJhw6fDo288L3RoPjx0aD5TaXR1YcOnw6NvPC90aD4KICAgIDwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAke2xpc3RhLm1hcCgocCkgPT4gYDx0cj4KICAgICAgJHtjb21Ob21lID8gYDx0ZD48c3Ryb25nPiR7ZXNjYXBlSHRtbChwLm5vbWUpfTwvc3Ryb25nPjxkaXYgY2xhc3M9ImxvZ2luLXN1YXZlIj5AJHtlc2NhcGVIdG1sKHAubG9naW4pfSDCtyAke2VzY2FwZUh0bWwocC5jYXJnbyl9PC9kaXY+PC90ZD5gIDogJyd9CiAgICAgIDx0ZD4ke2RhdGFCUihwLmVudHJhZGEpfTwvdGQ+CiAgICAgIDx0ZD4ke3Auc2FpZGEgPyBkYXRhQlIocC5zYWlkYSkgOiAn4oCUJ308L3RkPgogICAgICA8dGQ+JHtwLnNhaWRhID8gZHVyYWNhb0RlKHAubWludXRvcykgOiBkdXJhY2FvRGUoTWF0aC5tYXgoMCwgTWF0aC5yb3VuZCgoRGF0ZS5ub3coKSAtIG5ldyBEYXRlKHAuZW50cmFkYSkuZ2V0VGltZSgpKSAvIDYwMDAwKSkpfTwvdGQ+CiAgICAgIDx0ZD4ke3Auc2FpZGEgPyAnPHNwYW4gY2xhc3M9ImJhZGdlIj5GaW5hbGl6YWRvPC9zcGFuPicgOiAnPHNwYW4gY2xhc3M9ImJhZGdlIHZlcmRlIj5FbSBzZXJ2acOnbzwvc3Bhbj4nfTwvdGQ+CiAgICA8L3RyPmApLmpvaW4oJycpfTwvdGJvZHk+PC90YWJsZT5gCiAgICA6ICc8ZGl2IGNsYXNzPSJ2YXppbyI+TmVuaHVtIHJlZ2lzdHJvIGRlIHBvbnRvLjwvZGl2Pic7CgogICQoJyNwb250by1oaXN0b3JpY28nKS5pbm5lckhUTUwgPSB0YWJlbGEobWV1cy5zbGljZSgwLCA2MCksIGZhbHNlKTsKCiAgY29uc3QgcG9kZVZlclRvZG9zID0gZC5tZXVOaXZlbCA+PSA3MDsKICAkKCcjcGFpbmVsLXBvbnRvLXRvZG9zJykuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgIXBvZGVWZXJUb2Rvcyk7CiAgaWYgKHBvZGVWZXJUb2RvcykgJCgnI3BvbnRvLXRvZG9zJykuaW5uZXJIVE1MID0gdGFiZWxhKHRvZG9zLnNsaWNlKDAsIDIwMCksIHRydWUpOwp9CgovLyDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAgaGllcmFycXVpYSDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAKZnVuY3Rpb24gcmVuZGVySGllcmFycXVpYSgpIHsKICBjb25zdCBkID0gUy5kYWRvczsKICBjb25zdCBjYXJnb3MgPSBbLi4uZC5jYXJnb3NdLnNvcnQoKGEsIGIpID0+IGIubml2ZWwgLSBhLm5pdmVsKTsKICBjb25zdCBsaW5oYXMgPSBjYXJnb3MubWFwKChjKSA9PiB7CiAgICBjb25zdCBtZW1icm9zID0gZC51c2Vycy5maWx0ZXIoKHUpID0+IHUuY2FyZ28gPT09IGMubm9tZSkuc29ydCgoYSwgYikgPT4gKGIucG9udG9zIHx8IDApIC0gKGEucG9udG9zIHx8IDApKTsKICAgIHJldHVybiBgPHRyPgogICAgICA8dGQ+PHNwYW4gY2xhc3M9ImJhZGdlICR7Q0FSR09fQ09SW2Mubm9tZV0gfHwgJyd9Ij4ke2VzY2FwZUh0bWwoYy5ub21lKX08L3NwYW4+PGRpdiBjbGFzcz0ibG9naW4tc3VhdmUiPk7DrXZlbCAke2Mubml2ZWx9PC9kaXY+PC90ZD4KICAgICAgPHRkPiR7bWVtYnJvcy5sZW5ndGh9CiAgICAgICAgPGRpdiBjbGFzcz0ibG9naW4tc3VhdmUiPiR7bWVtYnJvcy5zbGljZSgwLCA2KS5tYXAoKG0pID0+IGVzY2FwZUh0bWwobS5ub21lKSkuam9pbignLCAnKSB8fCAnbmluZ3XDqW0nfTwvZGl2PjwvdGQ+CiAgICA8L3RyPmA7CiAgfSkuam9pbignJyk7CiAgJCgnI2xpc3RhLWhpZXJhcnF1aWEnKS5pbm5lckhUTUwgPSBgCiAgICA8cCBjbGFzcz0idGV4dG8tYWp1ZGEiPlF1YW50byBtYWlvciBvIG7DrXZlbCwgbWFpb3IgYSBhdXRvcmlkYWRlLiBOaW5ndcOpbSBwb2RlIHByb21vdmVyIGFsZ3XDqW0gcGFyYSBvIHByw7NwcmlvIG7DrXZlbCBvdSBhY2ltYS48L3A+CiAgICA8dGFibGU+PHRoZWFkPjx0cj48dGg+Q2FyZ288L3RoPjx0aD5JbnRlZ3JhbnRlczwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4ke2xpbmhhc308L3Rib2R5PjwvdGFibGU+YDsKfQoKLy8g4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIHJlZ3JhcyBkbyBSUCDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAKZnVuY3Rpb24gcmVuZGVyUmVncmFzKCkgewogIGNvbnN0IGQgPSBTLmRhZG9zOwogIGNvbnN0IHRleHRvID0gKGQucmVncmFzIHx8ICcnKS50cmltKCk7CiAgJCgnI3RleHRvLXJlZ3JhcycpLmlubmVySFRNTCA9IHRleHRvCiAgICA/IGVzY2FwZUh0bWwodGV4dG8pLnJlcGxhY2UoL1xuL2csICc8YnI+JykKICAgIDogJzxkaXYgY2xhc3M9InZhemlvIj5BcyByZWdyYXMgZG8gUlAgYWluZGEgbsOjbyBmb3JhbSBjYWRhc3RyYWRhcy4gTyBBZG1pbiBNYXN0ZXIgb3UgbyBDaGVmZSBkZSBQb2zDrWNpYSBwb2RlIGNvbGFyIG8gdGV4dG8gYXF1aSBlbWJhaXhvLjwvZGl2Pic7CiAgY29uc3QgcG9kZUVkaXRhciA9IGQubWV1Tml2ZWwgPj0gOTA7CiAgJCgnI3BhaW5lbC1lZGl0YXItcmVncmFzJykuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgIXBvZGVFZGl0YXIpOwogIGlmIChwb2RlRWRpdGFyKSB7CiAgICBjb25zdCB0YSA9ICQoJyNyZWdyYXMtdGV4dG8tZWQnKTsKICAgIGlmIChkb2N1bWVudC5hY3RpdmVFbGVtZW50ICE9PSB0YSkgdGEudmFsdWUgPSBkLnJlZ3JhcyB8fCAnJzsKICB9Cn0KCi8vIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBlc3R1ZG9zIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkApmdW5jdGlvbiByZW5kZXJFc3R1ZG9zKCkgewogIGNvbnN0IGQgPSBTLmRhZG9zOwogIGNvbnN0IHBvZGVMYW5jYXIgPSBkLm1ldU5pdmVsID49IDkwOwogIGNvbnN0IGVzdHVkb3MgPSBkLmVzdHVkb3MgfHwgW107CiAgY29uc3QgbGlkb3MgPSBkLmVzdHVkb3NMaWRvcyB8fCBbXTsKICBjb25zdCBldSA9IFMuZXUgfHwge307CiAgY29uc3QgYXRpdm9zID0gKGQudXNlcnMgfHwgW10pLmZpbHRlcigodSkgPT4gdS5hdGl2bykubGVuZ3RoOwoKICAkKCcjYnRuLWFicmlyLWVzdHVkbycpLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsICFwb2RlTGFuY2FyKTsKICAkKCcjZXN0dWRvcy1hdmlzbycpLnRleHRDb250ZW50ID0gcG9kZUxhbmNhcgogICAgPyAnVm9jw6ogbGFuw6dhIG9zIGVzdHVkb3MgYXF1aSBlIHRvZG8gbyBlZmV0aXZvIHbDqiBuYSBob3JhLiBDYWRhIHVtIG1hcmNhICJKw6EgZXN0dWRlaSIgZSB2b2PDqiBhY29tcGFuaGEgcXVlbSBsZXUuJwogICAgOiAnTWF0ZXJpYWwgZGUgZXN0dWRvIHB1YmxpY2FkbyBwZWxvIGNvbWFuZG8uIExlaWEgZSBjbGlxdWUgZW0gIk1hcmNhciBjb21vIGVzdHVkYWRvIiBwYXJhIG8gY29tYW5kbyBhY29tcGFuaGFyLic7CgogICQoJyNsaXN0YS1lc3R1ZG9zJykuaW5uZXJIVE1MID0gZXN0dWRvcy5sZW5ndGggPyBlc3R1ZG9zLm1hcCgoZSkgPT4gewogICAgY29uc3QgcXVlbUxldSA9IGxpZG9zLmZpbHRlcigobCkgPT4gbC5lc3R1ZG9JZCA9PT0gZS5pZCk7CiAgICBjb25zdCBldUxpID0gcXVlbUxldS5zb21lKChsKSA9PiBsLnVzZXJJZCA9PT0gZXUuaWQpOwogICAgcmV0dXJuIGA8YXJ0aWNsZSBjbGFzcz0iZXN0dWRvLWNhcmQiPgogICAgICA8ZGl2IGNsYXNzPSJlc3R1ZG8tdG9wbyI+CiAgICAgICAgPGRpdj4KICAgICAgICAgIDxzcGFuIGNsYXNzPSJiYWRnZSBhbWFyZWxvIj4ke2VzY2FwZUh0bWwoZS5jYXRlZ29yaWEgfHwgJ0dlcmFsJyl9PC9zcGFuPgogICAgICAgICAgPGRpdiBjbGFzcz0iZXN0dWRvLXRpdHVsbyI+JHtlc2NhcGVIdG1sKGUudGl0dWxvKX08L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9ImxvZ2luLXN1YXZlIj4ke2VzY2FwZUh0bWwoZS5jcmlhZG9Qb3JOb21lIHx8IGUuY3JpYWRvUG9yKX0gwrcgJHtkYXRhQlIoZS5jcmlhZG9FbSl9IMK3ICR7cXVlbUxldS5sZW5ndGh9IGRlICR7YXRpdm9zfSBlc3R1ZGFyYW08L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJhY29lcy1saW5oYSI+CiAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJtaW5pICR7ZXVMaSA/ICdlc3R1ZGFkbycgOiAnJ30iIGRhdGEtZXN0dWRhcj0iJHtlLmlkfSI+JHtldUxpID8gJ+KclCBKw6EgZXN0dWRlaScgOiAnTWFyY2FyIGNvbW8gZXN0dWRhZG8nfTwvYnV0dG9uPgogICAgICAgICAgJHtwb2RlTGFuY2FyID8gYDxidXR0b24gY2xhc3M9Im1pbmkiIGRhdGEtZWRpdGFyLWVzdHVkbz0iJHtlLmlkfSI+RWRpdGFyPC9idXR0b24+CiAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJtaW5pIHBlcmlnbyIgZGF0YS1leGNsdWlyLWVzdHVkbz0iJHtlLmlkfSI+RXhjbHVpcjwvYnV0dG9uPmAgOiAnJ30KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkZXRhaWxzIGNsYXNzPSJlc3R1ZG8tZGV0YWxoZSI+CiAgICAgICAgPHN1bW1hcnk+TGVyIG8gY29udGXDumRvPC9zdW1tYXJ5PgogICAgICAgIDxkaXYgY2xhc3M9InJlZ3Jhcy10ZXh0byI+JHtlc2NhcGVIdG1sKGUuY29udGV1ZG8pLnJlcGxhY2UoL1xuL2csICc8YnI+Jyl9PC9kaXY+CiAgICAgIDwvZGV0YWlscz4KICAgICAgJHtwb2RlTGFuY2FyICYmIHF1ZW1MZXUubGVuZ3RoID8gYDxkZXRhaWxzIGNsYXNzPSJlc3R1ZG8tZGV0YWxoZSI+CiAgICAgICAgPHN1bW1hcnk+UXVlbSBqw6EgZXN0dWRvdSAoJHtxdWVtTGV1Lmxlbmd0aH0pPC9zdW1tYXJ5PgogICAgICAgICR7cXVlbUxldS5tYXAoKGwpID0+IGA8ZGl2IGNsYXNzPSJsb2dpbi1zdWF2ZSI+JHtlc2NhcGVIdG1sKGwubm9tZSl9IChAJHtlc2NhcGVIdG1sKGwubG9naW4pfSkgwrcgJHtkYXRhQlIobC5lbSl9PC9kaXY+YCkuam9pbignJyl9CiAgICAgIDwvZGV0YWlscz5gIDogJyd9CiAgICA8L2FydGljbGU+YDsKICB9KS5qb2luKCcnKSA6ICc8ZGl2IGNsYXNzPSJ2YXppbyI+TmVuaHVtIGVzdHVkbyBwdWJsaWNhZG8gYWluZGEuIFPDsyBvIEFkbWluIE1hc3RlciBlIG8gQ2hlZmUgZGUgUG9sw61jaWEgcHVibGljYW0uPC9kaXY+JzsKCiAgJCQoJ1tkYXRhLWVzdHVkYXJdJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHsKICAgIHRyeSB7IGF3YWl0IGFwaSgnUE9TVCcsICcvZXN0dWRvcy8nICsgYi5kYXRhc2V0LmVzdHVkYXIgKyAnL2VzdHVkYXInKTsgYXdhaXQgY2FycmVnYXIoKTsgfQogICAgY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQogIH0pKTsKICAkJCgnW2RhdGEtZWRpdGFyLWVzdHVkb10nKS5mb3JFYWNoKChiKSA9PiBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gbW9kYWxFc3R1ZG8oYi5kYXRhc2V0LmVkaXRhckVzdHVkbykpKTsKICAkJCgnW2RhdGEtZXhjbHVpci1lc3R1ZG9dJykuZm9yRWFjaCgoYikgPT4gYi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHsKICAgIGlmICghY29uZmlybSgnRXhjbHVpciBlc3RlIGVzdHVkbz8nKSkgcmV0dXJuOwogICAgdHJ5IHsgYXdhaXQgYXBpKCdERUxFVEUnLCAnL2VzdHVkb3MvJyArIGIuZGF0YXNldC5leGNsdWlyRXN0dWRvKTsgYXdhaXQgY2FycmVnYXIoKTsgZmx1dHVhbnRlKCdFc3R1ZG8gZXhjbHXDrWRvLicpOyB9CiAgICBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9CiAgfSkpOwp9CgpmdW5jdGlvbiBtb2RhbEVzdHVkbyhpZCkgewogIGNvbnN0IGUgPSBpZCA/IChTLmRhZG9zLmVzdHVkb3MgfHwgW10pLmZpbmQoKHgpID0+IHguaWQgPT09IGlkKSA6IG51bGw7CiAgY29uc3QgY2F0ZWdvcmlhcyA9IFsnR2VyYWwnLCAnUmVncmFzIGRvIFJQJywgJ0PDs2RpZ28gUScsICdBYm9yZGFnZW0nLCAnUHJvY2VkaW1lbnRvJywgJ0NyaW1lcyBlIGVzdHJlbGFzJywgJ0hpZXJhcnF1aWEnLCAnT3V0cm8nXTsKICBhYnJpck1vZGFsKGUgPyAnRWRpdGFyIGVzdHVkbycgOiAnTm92byBlc3R1ZG8nLCBgCiAgICA8Zm9ybSBpZD0iZm9ybS1lc3R1ZG8iPgogICAgICA8bGFiZWw+VMOtdHVsbzxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0iZXMtdGl0dWxvIiByZXF1aXJlZCBtYXhsZW5ndGg9IjE0MCIgdmFsdWU9IiR7ZSA/IGVzY2FwZUh0bWwoZS50aXR1bG8pIDogJyd9IiBwbGFjZWhvbGRlcj0iRXguOiBDw7NkaWdvIFEg4oCUIHVzbyBubyByw6FkaW8iPjwvbGFiZWw+CiAgICAgIDxsYWJlbD5DYXRlZ29yaWEKICAgICAgICA8c2VsZWN0IGlkPSJlcy1jYXRlZ29yaWEiPgogICAgICAgICAgJHtjYXRlZ29yaWFzLm1hcCgoYykgPT4gYDxvcHRpb24gdmFsdWU9IiR7Y30iICR7ZSAmJiBlLmNhdGVnb3JpYSA9PT0gYyA/ICdzZWxlY3RlZCcgOiAnJ30+JHtjfTwvb3B0aW9uPmApLmpvaW4oJycpfQogICAgICAgIDwvc2VsZWN0PgogICAgICA8L2xhYmVsPgogICAgICA8bGFiZWw+Q29udGXDumRvCiAgICAgICAgPHRleHRhcmVhIGlkPSJlcy1jb250ZXVkbyIgcm93cz0iMTQiIG1heGxlbmd0aD0iMjAwMDAiIHJlcXVpcmVkIHBsYWNlaG9sZGVyPSJFc2NyZXZhIGFxdWkgbyBtYXRlcmlhbCBkZSBlc3R1ZG8uLi4iPiR7ZSA/IGVzY2FwZUh0bWwoZS5jb250ZXVkbykgOiAnJ308L3RleHRhcmVhPgogICAgICA8L2xhYmVsPgogICAgICA8ZGl2IGNsYXNzPSJsaW5oYS1ib3RvZXMiPjxidXR0b24gY2xhc3M9ImJ0bi1wcmltYXJpbyBzbSIgdHlwZT0ic3VibWl0Ij4ke2UgPyAnU2FsdmFyIGFsdGVyYcOnw7VlcycgOiAnUHVibGljYXIgcGFyYSBvIGVmZXRpdm8nfTwvYnV0dG9uPjwvZGl2PgogICAgPC9mb3JtPmApOwogICQoJyNmb3JtLWVzdHVkbycpLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGFzeW5jIChldikgPT4gewogICAgZXYucHJldmVudERlZmF1bHQoKTsKICAgIGNvbnN0IGNvcnBvID0geyB0aXR1bG86ICQoJyNlcy10aXR1bG8nKS52YWx1ZSwgY2F0ZWdvcmlhOiAkKCcjZXMtY2F0ZWdvcmlhJykudmFsdWUsIGNvbnRldWRvOiAkKCcjZXMtY29udGV1ZG8nKS52YWx1ZSB9OwogICAgdHJ5IHsKICAgICAgaWYgKGUpIGF3YWl0IGFwaSgnUFVUJywgJy9lc3R1ZG9zLycgKyBlLmlkLCBjb3Jwbyk7CiAgICAgIGVsc2UgYXdhaXQgYXBpKCdQT1NUJywgJy9lc3R1ZG9zJywgY29ycG8pOwogICAgICBmZWNoYXJNb2RhbCgpOyBhd2FpdCBjYXJyZWdhcigpOyBmbHV0dWFudGUoZSA/ICdFc3R1ZG8gYXR1YWxpemFkby4nIDogJ0VzdHVkbyBwdWJsaWNhZG8gcGFyYSBvIGVmZXRpdm8uJyk7CiAgICB9IGNhdGNoIChlcnIpIHsgZmx1dHVhbnRlKGVyci5tZXNzYWdlLCAnZXJybycpOyB9CiAgfSk7Cn0KCmZ1bmN0aW9uIHJlbmRlckNoYXQoKSB7CiAgY29uc3QgbXNncyA9IFMuZGFkb3MuY2hhdCB8fCBbXTsKICBjb25zdCBib3ggPSAkKCcjY2hhdC1tZW5zYWdlbnMnKTsKICBjb25zdCBlc3RhdmFGaW0gPSBib3guc2Nyb2xsSGVpZ2h0IC0gYm94LnNjcm9sbFRvcCAtIGJveC5jbGllbnRIZWlnaHQgPCA4MDsKICBib3guaW5uZXJIVE1MID0gbXNncy5sZW5ndGggPyBtc2dzLm1hcCgobSkgPT4gewogICAgY29uc3QgbWluaGEgPSBTLmV1ICYmIG0uZGUgPT09IFMuZXUubG9naW47CiAgICByZXR1cm4gYDxkaXYgY2xhc3M9Im1zZyAke21pbmhhID8gJ21pbmhhJyA6ICcnfSI+CiAgICAgIDxkaXYgY2xhc3M9Im1zZy10b3BvIj48c3Ryb25nPiR7ZXNjYXBlSHRtbChtLm5vbWUgfHwgbS5kZSl9PC9zdHJvbmc+PHNtYWxsPiR7ZXNjYXBlSHRtbChtLmNhcmdvIHx8ICcnKX0gwrcgJHt0ZW1wb1JlbChtLmVtKX08L3NtYWxsPjwvZGl2PgogICAgICA8cD4ke2VzY2FwZUh0bWwobS50ZXh0byl9PC9wPgogICAgPC9kaXY+YDsKICB9KS5qb2luKCcnKSA6ICc8ZGl2IGNsYXNzPSJ2YXppbyI+TmVuaHVtYSBtZW5zYWdlbSBhaW5kYS4gRGlnYSBvaSDwn5GLPC9kaXY+JzsKICBpZiAoZXN0YXZhRmltKSBib3guc2Nyb2xsVG9wID0gYm94LnNjcm9sbEhlaWdodDsKfQpmdW5jdGlvbiByb2xhckNoYXQoKSB7CiAgY29uc3QgYm94ID0gJCgnI2NoYXQtbWVuc2FnZW5zJyk7CiAgaWYgKGJveCkgYm94LnNjcm9sbFRvcCA9IGJveC5zY3JvbGxIZWlnaHQ7Cn0KJCgnI2Zvcm0tY2hhdCcpLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGFzeW5jIChldikgPT4gewogIGV2LnByZXZlbnREZWZhdWx0KCk7CiAgY29uc3QgaW5wdXQgPSAkKCcjY2hhdC1pbnB1dCcpOwogIGNvbnN0IHRleHRvID0gaW5wdXQudmFsdWUudHJpbSgpOwogIGlmICghdGV4dG8pIHJldHVybjsKICBpbnB1dC52YWx1ZSA9ICcnOwogIHRyeSB7IGF3YWl0IGFwaSgnUE9TVCcsICcvY2hhdCcsIHsgdGV4dG8gfSk7IGF3YWl0IGNhcnJlZ2FyKCk7IHJvbGFyQ2hhdCgpOyB9CiAgY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKGUubWVzc2FnZSwgJ2Vycm8nKTsgfQp9KTsKCi8vIOKUgOKUgCBhdWRpdG9yaWEg4pSA4pSACmZ1bmN0aW9uIHJlbmRlckF1ZGl0b3JpYSgpIHsKICBjb25zdCBsb2dzID0gUy5kYWRvcy5hdWRpdCB8fCBbXTsKICAkKCcjbGlzdGEtYXVkaXRvcmlhJykuaW5uZXJIVE1MID0gbG9ncy5sZW5ndGggPyBgCiAgICA8dGFibGU+PHRoZWFkPjx0cj48dGg+UXVhbmRvPC90aD48dGg+UXVlbTwvdGg+PHRoPkHDp8OjbzwvdGg+PHRoPkRldGFsaGU8L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+CiAgICAke2xvZ3MubWFwKChsKSA9PiBgPHRyPgogICAgICA8dGQgY2xhc3M9ImxvZ2luLXN1YXZlIj4ke2RhdGFCUihsLmVtKX08L3RkPgogICAgICA8dGQ+QCR7ZXNjYXBlSHRtbChsLmZlaXRvclBvcil9PC90ZD4KICAgICAgPHRkPjxzcGFuIGNsYXNzPSJiYWRnZSBhenVsIj4ke2VzY2FwZUh0bWwobC5hY2FvKX08L3NwYW4+PC90ZD4KICAgICAgPHRkIGNsYXNzPSJsb2dpbi1zdWF2ZSI+JHtlc2NhcGVIdG1sKGwuZGV0YWxoZSl9PC90ZD4KICAgIDwvdHI+YCkuam9pbignJyl9PC90Ym9keT48L3RhYmxlPmAKICAgIDogJzxkaXYgY2xhc3M9InZhemlvIj5TZW0gcmVnaXN0cm9zLjwvZGl2Pic7Cn0KCi8vIOKUgOKUgCBwZXJmaWwg4pSA4pSACmZ1bmN0aW9uIHJlbmRlclBlcmZpbCgpIHsKICBpZiAoIVMuZXUpIHJldHVybjsKICAkKCcjcGVyZmlsLW5vbWUnKS52YWx1ZSA9IFMuZXUubm9tZSB8fCAnJzsKICAkKCcjcGVyZmlsLXJlY2FkbycpLnZhbHVlID0gUy5ldS5yZWNhZG8gfHwgJyc7CiAgY29uc3QgaW1nID0gJCgnI3BlcmZpbC1mb3RvLWltZycpOwogIGlmIChTLmV1LmZvdG8pIHsgaW1nLnNyYyA9IFMuZXUuZm90bzsgaW1nLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpOyAkKCcjcGVyZmlsLXNlbS1mb3RvJykuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7IH0KICBlbHNlIHsgaW1nLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpOyAkKCcjcGVyZmlsLXNlbS1mb3RvJykuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7IH0KICByZW5kZXJQb250b3MoKTsKfQoKJCgnI3BlcmZpbC1mb3RvJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGV2KSA9PiB7CiAgY29uc3QgZmlsZSA9IGV2LnRhcmdldC5maWxlc1swXTsKICBpZiAoIWZpbGUpIHJldHVybjsKICBpZiAoZmlsZS5zaXplID4gNjAwMDAwKSByZXR1cm4gZmx1dHVhbnRlKCdGb3RvIG11aXRvIGdyYW5kZSAobcOheCA2MDBLQikuJywgJ2Vycm8nKTsKICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpOwogIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7ICQoJyNwZXJmaWwtZm90by1pbWcnKS5zcmMgPSByZWFkZXIucmVzdWx0OyAkKCcjcGVyZmlsLWZvdG8taW1nJykuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7ICQoJyNwZXJmaWwtc2VtLWZvdG8nKS5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTsgfTsKICByZWFkZXIucmVhZEFzRGF0YVVSTChmaWxlKTsKfSk7CgokKCcjZm9ybS1wZXJmaWwnKS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBhc3luYyAoZXYpID0+IHsKICBldi5wcmV2ZW50RGVmYXVsdCgpOwogIGNvbnN0IHNyYyA9ICQoJyNwZXJmaWwtZm90by1pbWcnKS5zcmM7CiAgY29uc3Qgbm92YUZvdG8gPSBzcmMgJiYgc3JjLnN0YXJ0c1dpdGgoJ2RhdGE6JykgPyBzcmMgOiB1bmRlZmluZWQ7CiAgY29uc3QgY29ycG8gPSB7IG5vbWU6ICQoJyNwZXJmaWwtbm9tZScpLnZhbHVlLCByZWNhZG86ICQoJyNwZXJmaWwtcmVjYWRvJykudmFsdWUgfTsKICBpZiAobm92YUZvdG8pIGNvcnBvLmZvdG8gPSBub3ZhRm90bzsKICB0cnkgewogICAgY29uc3QgciA9IGF3YWl0IGFwaSgnUFVUJywgJy9tZS9wZXJmaWwnLCBjb3Jwbyk7CiAgICBTLmV1ID0gci51c2VyOwogICAgYXdhaXQgY2FycmVnYXIoKTsKICAgIGZsdXR1YW50ZSgnUGVyZmlsIGF0dWFsaXphZG8uJyk7CiAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9Cn0pOwoKJCgnI2J0bi1yZW1vdmVyLWZvdG8nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHsKICB0cnkgewogICAgY29uc3QgciA9IGF3YWl0IGFwaSgnUFVUJywgJy9tZS9wZXJmaWwnLCB7IGZvdG86ICcnIH0pOwogICAgUy5ldSA9IHIudXNlcjsKICAgIGF3YWl0IGNhcnJlZ2FyKCk7CiAgICBmbHV0dWFudGUoJ0ZvdG8gcmVtb3ZpZGEuJyk7CiAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9Cn0pOwoKJCgnI2Zvcm0tc2VuaGEnKS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBhc3luYyAoZXYpID0+IHsKICBldi5wcmV2ZW50RGVmYXVsdCgpOwogIGlmICgkKCcjc2VuaGEtbm92YScpLnZhbHVlICE9PSAkKCcjc2VuaGEtY29uZicpLnZhbHVlKSByZXR1cm4gZmx1dHVhbnRlKCdBcyBzZW5oYXMgbsOjbyBiYXRlbS4nLCAnZXJybycpOwogIHRyeSB7CiAgICBhd2FpdCBhcGkoJ1BVVCcsICcvbWUvc2VuaGEnLCB7IGF0dWFsOiAkKCcjc2VuaGEtYXR1YWwnKS52YWx1ZSwgbm92YTogJCgnI3NlbmhhLW5vdmEnKS52YWx1ZSB9KTsKICAgICQoJyNmb3JtLXNlbmhhJykucmVzZXQoKTsKICAgIGZsdXR1YW50ZSgnU2VuaGEgYWx0ZXJhZGEuJyk7CiAgfSBjYXRjaCAoZSkgeyBmbHV0dWFudGUoZS5tZXNzYWdlLCAnZXJybycpOyB9Cn0pOwoKLy8g4pSA4pSAIGFkbWluIC8gYmFja3VwIOKUgOKUgApmdW5jdGlvbiByZW5kZXJBZG1pbigpIHsKICBpZiAoIVMuZGFkb3MpIHJldHVybjsKICBjb25zdCBkID0gUy5kYWRvczsKICBpZiAoUy5kYWRvcy5jb25maWcpIHsKICAgIGNvbnN0IGNuID0gJCgnI2NmZy1ub21lJyksIGNjID0gJCgnI2NmZy1jb3JwJyk7CiAgICBpZiAoY24gJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAhPT0gY24pIGNuLnZhbHVlID0gUy5kYWRvcy5jb25maWcubm9tZVNpc3RlbWEgfHwgJyc7CiAgICBpZiAoY2MgJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAhPT0gY2MpIGNjLnZhbHVlID0gUy5kYWRvcy5jb25maWcubm9tZUNvcnBvcmFjYW8gfHwgJyc7CiAgfQogICQoJyNhZG1pbi1pbmZvJykuaW5uZXJIVE1MID0gYAogICAgJHtlc2NhcGVIdG1sKGQuY29uZmlnLm5vbWVTaXN0ZW1hIHx8ICdTSUdQJyl9IOKAlCAke2VzY2FwZUh0bWwoZC5jb25maWcubm9tZUNvcnBvcmFjYW8gfHwgJycpfTxicj4KICAgICR7ZC51c2Vycy5sZW5ndGh9IHVzdcOhcmlvcyDCtyAke2Qub2NvcnJlbmNpYXMubGVuZ3RofSBvY29ycsOqbmNpYXMgwrcgJHtkLnBvbnRvcy5sZW5ndGh9IGxhbsOnYW1lbnRvcyBkZSBwb250b3M8YnI+CiAgICBTZXUgbsOtdmVsIGRlIGFjZXNzbzogPHN0cm9uZz4ke2QubWV1Tml2ZWx9PC9zdHJvbmc+ICgke2VzY2FwZUh0bWwoUy5ldSA/IFMuZXUuY2FyZ28gOiAnJyl9KWA7Cn0KCmNvbnN0IGZvcm1DZmcgPSAkKCcjZm9ybS1jb25maWcnKTsKaWYgKGZvcm1DZmcpIGZvcm1DZmcuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2KSA9PiB7CiAgZXYucHJldmVudERlZmF1bHQoKTsKICB0cnkgewogICAgYXdhaXQgYXBpKCdQVVQnLCAnL2NvbmZpZycsIHsgbm9tZVNpc3RlbWE6ICQoJyNjZmctbm9tZScpLnZhbHVlLCBub21lQ29ycG9yYWNhbzogJCgnI2NmZy1jb3JwJykudmFsdWUgfSk7CiAgICBhd2FpdCBjYXJyZWdhcigpOwogICAgZmx1dHVhbnRlKCdDb25maWd1cmHDp8OjbyBzYWx2YS4nKTsKICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KfSk7CgokKCcjYnRuLWJhY2t1cCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4gewogIHRyeSB7CiAgICBjb25zdCByID0gYXdhaXQgYXBpKCdHRVQnLCAnL2JhY2t1cCcpOwogICAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKFtKU09OLnN0cmluZ2lmeShyLCBudWxsLCAyKV0sIHsgdHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nIH0pOwogICAgY29uc3QgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTsKICAgIGEuaHJlZiA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7CiAgICBhLmRvd25sb2FkID0gJ2JhY2t1cC0nICsgbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDE5KS5yZXBsYWNlKC9bOlRdL2csICctJykgKyAnLmpzb24nOwogICAgYS5jbGljaygpOwogICAgVVJMLnJldm9rZU9iamVjdFVSTChhLmhyZWYpOwogICAgZmx1dHVhbnRlKCdCYWNrdXAgYmFpeGFkby4nKTsKICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KfSk7CgokKCcjaW4tcmVzdG9yZScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGFzeW5jIChldikgPT4gewogIGNvbnN0IGZpbGUgPSBldi50YXJnZXQuZmlsZXNbMF07CiAgaWYgKCFmaWxlKSByZXR1cm47CiAgaWYgKCFjb25maXJtKCdSZXN0YXVyYXIgZXN0ZSBiYWNrdXA/IE9zIGRhZG9zIGF0dWFpcyBzZXLDo28gc3Vic3RpdHXDrWRvcy4nKSkgeyBldi50YXJnZXQudmFsdWUgPSAnJzsgcmV0dXJuOyB9CiAgdHJ5IHsKICAgIGNvbnN0IHRleHRvID0gYXdhaXQgZmlsZS50ZXh0KCk7CiAgICBjb25zdCBkYWRvcyA9IEpTT04ucGFyc2UodGV4dG8pOwogICAgYXdhaXQgYXBpKCdQT1NUJywgJy9yZXN0b3JlJywgeyBkYWRvcyB9KTsKICAgIGF3YWl0IGNhcnJlZ2FyKCk7CiAgICBmbHV0dWFudGUoJ0JhY2t1cCByZXN0YXVyYWRvLicpOwogIH0gY2F0Y2ggKGUpIHsgZmx1dHVhbnRlKCdGYWxoYSBhbyByZXN0YXVyYXI6ICcgKyBlLm1lc3NhZ2UsICdlcnJvJyk7IH0KICBldi50YXJnZXQudmFsdWUgPSAnJzsKfSk7CgovLyDilIDilIAgbm90aWZpY2HDp8O1ZXMg4pSA4pSACmZ1bmN0aW9uIHJlbmRlck5vdGlmQmFkZ2UoKSB7CiAgY29uc3QgbmFvTGlkYXMgPSAoUy5kYWRvcy5ub3RpZmljYWNvZXMgfHwgW10pLmZpbHRlcigobikgPT4gIW4ubGlkYSkubGVuZ3RoOwogIGNvbnN0IGIgPSAkKCcjbm90aWYtYmFkZ2UnKTsKICBiLnRleHRDb250ZW50ID0gbmFvTGlkYXM7CiAgYi5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCBuYW9MaWRhcyA9PT0gMCk7Cn0KCiQoJyNidG4tbm90aWYnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHsKICBjb25zdCBucyA9IChTLmRhZG9zLm5vdGlmaWNhY29lcyB8fCBbXSk7CiAgYWJyaXJNb2RhbCgnTm90aWZpY2HDp8O1ZXMnLCBucy5sZW5ndGggPyBucy5tYXAoKG4pID0+IGAKICAgIDxkaXYgY2xhc3M9Im5vdGlmLWl0ZW0iPgogICAgICA8c3Ryb25nPiR7ZXNjYXBlSHRtbChuLnRpdHVsbyl9PC9zdHJvbmc+CiAgICAgIDxzbWFsbD4ke2RhdGFCUihuLmVtKX08L3NtYWxsPgogICAgICA8cD4ke2VzY2FwZUh0bWwobi50ZXh0byl9PC9wPgogICAgPC9kaXY+YCkuam9pbignJykgOiAnPGRpdiBjbGFzcz0idmF6aW8iPk5hZGEgcG9yIGFxdWkuPC9kaXY+Jyk7CiAgdHJ5IHsgYXdhaXQgYXBpKCdQT1NUJywgJy9ub3RpZmljYWNvZXMvbGVyJyk7IGF3YWl0IGNhcnJlZ2FyKCk7IH0gY2F0Y2ggKF8pIHt9Cn0pOwoKCi8vIGxpc3RlbmVycyBmaXhvcyBkYXMgdGVsYXMgbm92YXMKJCgnI2J0bi1hYnJpci1wcm92YScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgbW9kYWxOb3ZhUHJvdmEpOwokKCcjYnRuLWFicmlyLWVzdHVkbycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gbW9kYWxFc3R1ZG8oKSk7CiQoJyNmb3JtLXJlZ3JhcycpLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGFzeW5jIChldikgPT4gewogIGV2LnByZXZlbnREZWZhdWx0KCk7CiAgdHJ5IHsKICAgIGF3YWl0IGFwaSgnUFVUJywgJy9yZWdyYXMnLCB7IHRleHRvOiAkKCcjcmVncmFzLXRleHRvLWVkJykudmFsdWUgfSk7CiAgICAkKCcjcmVncmFzLXRleHRvLWVkJykuYmx1cigpOwogICAgYXdhaXQgY2FycmVnYXIoKTsKICAgIGZsdXR1YW50ZSgnUmVncmFzIHNhbHZhcy4nKTsKICB9IGNhdGNoIChlKSB7IGZsdXR1YW50ZShlLm1lc3NhZ2UsICdlcnJvJyk7IH0KfSk7CgovLyDilIDilIAgYXR1YWxpemHDp8OjbyBhdXRvbcOhdGljYSDilIDilIAKbGV0IHBvbGxpbmcgPSBudWxsOwpmdW5jdGlvbiBpbmljaWFyUG9sbGluZygpIHsKICBjbGVhckludGVydmFsKHBvbGxpbmcpOwogIHBvbGxpbmcgPSBzZXRJbnRlcnZhbChhc3luYyAoKSA9PiB7CiAgICBpZiAoIVMudG9rZW4gfHwgZG9jdW1lbnQuaGlkZGVuKSByZXR1cm47CiAgICB0cnkgewogICAgICBhd2FpdCBjYXJyZWdhcigpOwogICAgfSBjYXRjaCAoXykge30KICB9LCAxMDAwMCk7Cn0KCi8vIOKUgOKUgCBib290IOKUgOKUgAooYXN5bmMgZnVuY3Rpb24gYm9vdCgpIHsKICBpZiAoIVMudG9rZW4pIHJldHVybjsKICB0cnkgewogICAgY29uc3QgciA9IGF3YWl0IGFwaSgnR0VUJywgJy9tZScpOwogICAgUy5ldSA9IHIudXNlcjsKICAgIGF3YWl0IGVudHJhcigpOwogIH0gY2F0Y2ggKF8pIHsgc2FpckxvY2FsKCk7IH0KfSkoKTsK"};
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

loadDB();
migrar();
seed();
server.listen(PORT, () => {
  console.log('\n  SIGP rodando em http://localhost:' + PORT);
  console.log('  Login inicial: admin / admin123  (troque a senha depois)\n');
});
