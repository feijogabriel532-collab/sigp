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
const DB_VAZIO = { users: [], ocorrencias: [], pontos: [], chat: [], audit: [], notificacoes: [], config: {} };
let db = {
  ...DB_VAZIO,
  config: { nomeSistema: 'SIGP', nomeCorporacao: 'Grupamento Municipal de Policiamento' },
};

const SUPA_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPA_KEY = process.env.SUPABASE_KEY || '';
const SUPA_ON = !!(SUPA_URL && SUPA_KEY);

async function supaGet() {
  const r = await fetch(SUPA_URL + '/rest/v1/sigp?id=eq.base&select=dados', {
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
  });
  if (!r.ok) throw new Error('Supabase leitura ' + r.status + ' ' + (await r.text()).slice(0, 160));
  const arr = await r.json();
  return Array.isArray(arr) && arr[0] ? arr[0].dados : null;
}
async function supaPut(dados) {
  const r = await fetch(SUPA_URL + '/rest/v1/sigp', {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([{ id: 'base', dados, atualizado: new Date().toISOString() }]),
  });
  if (!r.ok) throw new Error('Supabase gravação ' + r.status + ' ' + (await r.text()).slice(0, 160));
}

async function loadDB() {
  if (SUPA_ON) {
    try {
      const d = await supaGet();
      if (d && Array.isArray(d.users)) { db = { ...DB_VAZIO, ...d }; console.log('  Banco carregado do Supabase.'); return; }
      console.log('  Banco novo no Supabase (primeira execução).');
    } catch (e) { console.error('  Falha ao ler o Supabase:', e.message); }
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      db = { ...DB_VAZIO, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
    } catch (e) {
      console.error('data.json inválido, criando backup e reiniciando.', e.message);
      try { fs.renameSync(DB_FILE, DB_FILE + '.corrompido-' + Date.now()); } catch (_) {}
    }
  }
}

async function gravaAgora() {
  clearTimeout(saveTimer);
  const copia = db;
  if (SUPA_ON) {
    try { await supaPut(copia); } catch (e) { console.error('  Erro ao salvar no Supabase:', e.message); }
  }
  try {
    if (!SUPA_ON) fs.writeFileSync(DB_FILE, JSON.stringify(copia, null, 2));
  } catch (e) { console.error('  Erro ao gravar arquivo:', e.message); }
}

let saveTimer = null;
function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { gravaAgora(); }, 250);
}
function saveDBNow() {
  clearTimeout(saveTimer);
  return gravaAgora();
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
    if (nivel(eu.cargo) < 80) return json(res, 403, { error: 'Sem permissão para criar usuários.' });
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
const ASSETS = {"/": {"t": "text/html; charset=utf-8", "b": "<!DOCTYPE html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>SIGP — Sistema Interno</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap\" rel=\"stylesheet\">\n<link rel=\"stylesheet\" href=\"style.css\">\n</head>\n<body>\n\n<!-- ══════════ LOGIN ══════════ -->\n<section id=\"tela-login\" class=\"login-wrap\">\n  <div class=\"login-card\">\n    <div class=\"login-badge\">▸</div>\n    <h1 id=\"login-nome\">SIGP</h1>\n    <p class=\"sub\" id=\"login-sub\">Grupamento Municipal de Policiamento</p>\n    <p class=\"tag\">ACESSO RESTRITO</p>\n    <form id=\"form-login\" autocomplete=\"off\">\n      <label>Usuário<input type=\"text\" id=\"in-login\" required autocomplete=\"username\"></label>\n      <label>Senha\n        <span class=\"senha-wrap\">\n          <input type=\"password\" id=\"in-senha\" required autocomplete=\"current-password\">\n          <button type=\"button\" id=\"btn-olho\" title=\"mostrar senha\">👁</button>\n        </span>\n      </label>\n      <div id=\"login-erro\" class=\"erro hidden\"></div>\n      <button type=\"submit\" class=\"btn-primario\">▸ AUTENTICAR</button>\n    </form>\n    <p class=\"aviso\">Acesso monitorado. O uso indevido resultará em punição administrativa.</p>\n  </div>\n</section>\n\n<!-- ══════════ TELA DE SUSPENSÃO ══════════ -->\n<section id=\"tela-suspensao\" class=\"login-wrap hidden\">\n  <div class=\"login-card suspenso\">\n    <div class=\"susp-icone\">⛔</div>\n    <h1>ACESSO SUSPENSO</h1>\n    <p class=\"sub\">Você está temporariamente suspenso do sistema</p>\n    <div class=\"cronometro\" id=\"susp-tempo\">00:00:00</div>\n    <div class=\"susp-info\">\n      <div><span>Aplicado por</span><strong id=\"susp-por\">—</strong></div>\n      <div><span>Motivo</span><strong id=\"susp-motivo\">—</strong></div>\n      <div><span>Expira em</span><strong id=\"susp-expira\">—</strong></div>\n    </div>\n    <button class=\"btn-secundario\" id=\"btn-voltar-login\">Voltar ao login</button>\n  </div>\n</section>\n\n<!-- ══════════ APP ══════════ -->\n<div id=\"app\" class=\"app hidden\">\n  <aside class=\"sidebar\" id=\"sidebar\">\n    <div class=\"marca\">\n      <div class=\"marca-icone\">▸</div>\n      <div><strong id=\"marca-nome\">SIGP</strong><small id=\"marca-sub\">Sistema Interno</small></div>\n    </div>\n    <nav id=\"nav\">\n      <button class=\"nav-item ativo\" data-tela=\"dashboard\"><span>▦</span> Painel</button>\n      <button class=\"nav-item\" data-tela=\"ocorrencias\"><span>📋</span> Ocorrências</button>\n      <button class=\"nav-item\" data-tela=\"efetivo\"><span>👮</span> Efetivo</button>\n      <button class=\"nav-item\" data-tela=\"pontos\"><span>⭐</span> Pontuação</button>\n      <button class=\"nav-item\" data-tela=\"chat\"><span>💬</span> Chat</button>\n      <button class=\"nav-item\" data-tela=\"auditoria\"><span>🛡️</span> Auditoria</button>\n      <button class=\"nav-item\" data-tela=\"perfil\"><span>👤</span> Meu Perfil</button>\n      <button class=\"nav-item\" data-tela=\"admin\" id=\"nav-admin\"><span>⚙️</span> Administração</button>\n    </nav>\n    <div class=\"sidebar-pe\">\n      <div class=\"eu\">\n        <div class=\"avatar\" id=\"eu-avatar\">?</div>\n        <div class=\"eu-info\"><strong id=\"eu-nome\">—</strong><small id=\"eu-cargo\">—</small></div>\n      </div>\n      <button class=\"btn-sair\" id=\"btn-sair\">⏻ Sair</button>\n    </div>\n  </aside>\n\n  <main class=\"conteudo\">\n    <header class=\"topbar\">\n      <div>\n        <h2 id=\"titulo-tela\">Painel</h2>\n        <p class=\"topbar-sub\" id=\"subtitulo-tela\">Visão geral do grupamento</p>\n      </div>\n      <div class=\"topbar-dir\">\n        <button class=\"sino\" id=\"btn-notif\">🔔<b id=\"notif-badge\" class=\"hidden\">0</b></button>\n      </div>\n    </header>\n\n    <div id=\"mensagem-flutuante\" class=\"flutuante hidden\"></div>\n\n    <!-- PAINEL -->\n    <section class=\"tela\" id=\"tela-dashboard\">\n      <div class=\"cards\" id=\"cards-dashboard\"></div>\n      <div class=\"duas-colunas\">\n        <div class=\"painel\">\n          <div class=\"painel-topo\"><h3>Ocorrências recentes</h3></div>\n          <div id=\"dash-ocorrencias\"></div>\n        </div>\n        <div class=\"painel\">\n          <div class=\"painel-topo\"><h3>Ranking de pontos</h3></div>\n          <div id=\"dash-ranking\"></div>\n        </div>\n      </div>\n    </section>\n\n    <!-- OCORRÊNCIAS -->\n    <section class=\"tela hidden\" id=\"tela-ocorrencias\">\n      <div class=\"painel\">\n        <div class=\"painel-topo\">\n          <h3>Registrar ocorrência</h3>\n          <button class=\"btn-primario sm\" id=\"btn-abrir-ocorrencia\">+ Nova ocorrência</button>\n        </div>\n        <div id=\"lista-ocorrencias\"></div>\n      </div>\n    </section>\n\n    <!-- EFETIVO -->\n    <section class=\"tela hidden\" id=\"tela-efetivo\">\n      <div class=\"painel\">\n        <div class=\"painel-topo\">\n          <h3>Efetivo</h3>\n          <div class=\"topo-acoes\">\n            <input type=\"search\" id=\"busca-efetivo\" placeholder=\"Buscar nome ou login...\">\n            <button class=\"btn-primario sm\" id=\"btn-abrir-usuario\">+ Novo usuário</button>\n          </div>\n        </div>\n        <div id=\"tabela-efetivo\"></div>\n      </div>\n    </section>\n\n    <!-- PONTOS -->\n    <section class=\"tela hidden\" id=\"tela-pontos\">\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Lançar pontos</h3></div>\n        <form id=\"form-pontos\" class=\"form-linha\">\n          <label>Policial<select id=\"pontos-user\" required></select></label>\n          <label>Pontos (+ ou -)<input type=\"number\" id=\"pontos-delta\" value=\"10\" required></label>\n          <label>Motivo<input type=\"text\" id=\"pontos-motivo\" placeholder=\"Ex.: abordagem bem feita\" required></label>\n          <button class=\"btn-primario sm\" type=\"submit\">Lançar</button>\n        </form>\n      </div>\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Histórico de pontuação</h3></div>\n        <div id=\"historico-pontos\"></div>\n      </div>\n    </section>\n\n    <!-- CHAT -->\n    <section class=\"tela hidden\" id=\"tela-chat\">\n      <div class=\"painel chat-painel\">\n        <div class=\"painel-topo\"><h3>Chat do efetivo</h3></div>\n        <div id=\"chat-mensagens\" class=\"chat-mensagens\"></div>\n        <form id=\"form-chat\" class=\"chat-form\">\n          <input type=\"text\" id=\"chat-input\" placeholder=\"Escreva uma mensagem...\" maxlength=\"800\" autocomplete=\"off\">\n          <button class=\"btn-primario sm\" type=\"submit\">Enviar</button>\n        </form>\n      </div>\n    </section>\n\n    <!-- AUDITORIA -->\n    <section class=\"tela hidden\" id=\"tela-auditoria\">\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Registro de auditoria</h3></div>\n        <div id=\"lista-auditoria\"></div>\n      </div>\n    </section>\n\n    <!-- PERFIL -->\n    <section class=\"tela hidden\" id=\"tela-perfil\">\n      <div class=\"duas-colunas\">\n        <div class=\"painel\">\n          <div class=\"painel-topo\"><h3>Meus dados</h3></div>\n          <form id=\"form-perfil\" class=\"form-coluna\">\n            <label>Nome<input type=\"text\" id=\"perfil-nome\" maxlength=\"60\"></label>\n            <label>Recado (máx 200)<textarea id=\"perfil-recado\" maxlength=\"200\" rows=\"3\"></textarea></label>\n            <label>Foto\n              <input type=\"file\" id=\"perfil-foto\" accept=\"image/*\">\n            </label>\n            <div class=\"foto-preview\"><img id=\"perfil-foto-img\" alt=\"\" class=\"hidden\"><span id=\"perfil-sem-foto\">sem foto</span></div>\n            <div class=\"linha-botoes\">\n              <button class=\"btn-primario sm\" type=\"submit\">Salvar</button>\n              <button class=\"btn-secundario sm\" type=\"button\" id=\"btn-remover-foto\">Remover foto</button>\n            </div>\n          </form>\n        </div>\n        <div class=\"painel\">\n          <div class=\"painel-topo\"><h3>Alterar senha</h3></div>\n          <form id=\"form-senha\" class=\"form-coluna\">\n            <label>Senha atual<input type=\"password\" id=\"senha-atual\" required></label>\n            <label>Nova senha<input type=\"password\" id=\"senha-nova\" required minlength=\"4\"></label>\n            <label>Confirmar nova senha<input type=\"password\" id=\"senha-conf\" required minlength=\"4\"></label>\n            <button class=\"btn-primario sm\" type=\"submit\">Alterar senha</button>\n          </form>\n        </div>\n      </div>\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Meus pontos</h3></div>\n        <div id=\"perfil-pontos\"></div>\n      </div>\n    </section>\n\n    <!-- ADMIN -->\n    <section class=\"tela hidden\" id=\"tela-admin\">\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Backup do sistema</h3></div>\n        <p class=\"texto-ajuda\">Baixe uma cópia completa dos dados (usuários, ocorrências, pontos, chat e auditoria). Guarde o arquivo fora do servidor.</p>\n        <div class=\"linha-botoes\">\n          <button class=\"btn-primario sm\" id=\"btn-backup\">⬇️ Baixar backup</button>\n          <label class=\"btn-secundario sm arquivo-label\">⬆️ Restaurar backup<input type=\"file\" id=\"in-restore\" accept=\"application/json\" hidden></label>\n        </div>\n      </div>\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Identidade do sistema</h3></div>\n        <form id=\"form-config\" class=\"form-linha\" style=\"grid-template-columns:1fr 2fr auto\">\n          <label>Sigla / nome curto<input type=\"text\" id=\"cfg-nome\" maxlength=\"24\"></label>\n          <label>Nome da corporação<input type=\"text\" id=\"cfg-corp\" maxlength=\"80\"></label>\n          <button class=\"btn-primario sm\" type=\"submit\">Salvar</button>\n        </form>\n      </div>\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Resumo</h3></div>\n        <div class=\"texto-ajuda\" id=\"admin-info\"></div>\n      </div>\n    </section>\n  </main>\n</div>\n\n<!-- ══════════ MODAIS ══════════ -->\n<div class=\"overlay hidden\" id=\"overlay\">\n  <div class=\"modal\" id=\"modal\">\n    <div class=\"modal-topo\"><h3 id=\"modal-titulo\">—</h3><button id=\"modal-fechar\">✕</button></div>\n    <div class=\"modal-corpo\" id=\"modal-corpo\"></div>\n  </div>\n</div>\n\n<script src=\"app.js\"></script>\n</body>\n</html>\n"}, "/index.html": {"t": "text/html; charset=utf-8", "b": "<!DOCTYPE html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>SIGP — Sistema Interno</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap\" rel=\"stylesheet\">\n<link rel=\"stylesheet\" href=\"style.css\">\n</head>\n<body>\n\n<!-- ══════════ LOGIN ══════════ -->\n<section id=\"tela-login\" class=\"login-wrap\">\n  <div class=\"login-card\">\n    <div class=\"login-badge\">▸</div>\n    <h1 id=\"login-nome\">SIGP</h1>\n    <p class=\"sub\" id=\"login-sub\">Grupamento Municipal de Policiamento</p>\n    <p class=\"tag\">ACESSO RESTRITO</p>\n    <form id=\"form-login\" autocomplete=\"off\">\n      <label>Usuário<input type=\"text\" id=\"in-login\" required autocomplete=\"username\"></label>\n      <label>Senha\n        <span class=\"senha-wrap\">\n          <input type=\"password\" id=\"in-senha\" required autocomplete=\"current-password\">\n          <button type=\"button\" id=\"btn-olho\" title=\"mostrar senha\">👁</button>\n        </span>\n      </label>\n      <div id=\"login-erro\" class=\"erro hidden\"></div>\n      <button type=\"submit\" class=\"btn-primario\">▸ AUTENTICAR</button>\n    </form>\n    <p class=\"aviso\">Acesso monitorado. O uso indevido resultará em punição administrativa.</p>\n  </div>\n</section>\n\n<!-- ══════════ TELA DE SUSPENSÃO ══════════ -->\n<section id=\"tela-suspensao\" class=\"login-wrap hidden\">\n  <div class=\"login-card suspenso\">\n    <div class=\"susp-icone\">⛔</div>\n    <h1>ACESSO SUSPENSO</h1>\n    <p class=\"sub\">Você está temporariamente suspenso do sistema</p>\n    <div class=\"cronometro\" id=\"susp-tempo\">00:00:00</div>\n    <div class=\"susp-info\">\n      <div><span>Aplicado por</span><strong id=\"susp-por\">—</strong></div>\n      <div><span>Motivo</span><strong id=\"susp-motivo\">—</strong></div>\n      <div><span>Expira em</span><strong id=\"susp-expira\">—</strong></div>\n    </div>\n    <button class=\"btn-secundario\" id=\"btn-voltar-login\">Voltar ao login</button>\n  </div>\n</section>\n\n<!-- ══════════ APP ══════════ -->\n<div id=\"app\" class=\"app hidden\">\n  <aside class=\"sidebar\" id=\"sidebar\">\n    <div class=\"marca\">\n      <div class=\"marca-icone\">▸</div>\n      <div><strong id=\"marca-nome\">SIGP</strong><small id=\"marca-sub\">Sistema Interno</small></div>\n    </div>\n    <nav id=\"nav\">\n      <button class=\"nav-item ativo\" data-tela=\"dashboard\"><span>▦</span> Painel</button>\n      <button class=\"nav-item\" data-tela=\"ocorrencias\"><span>📋</span> Ocorrências</button>\n      <button class=\"nav-item\" data-tela=\"efetivo\"><span>👮</span> Efetivo</button>\n      <button class=\"nav-item\" data-tela=\"pontos\"><span>⭐</span> Pontuação</button>\n      <button class=\"nav-item\" data-tela=\"chat\"><span>💬</span> Chat</button>\n      <button class=\"nav-item\" data-tela=\"auditoria\"><span>🛡️</span> Auditoria</button>\n      <button class=\"nav-item\" data-tela=\"perfil\"><span>👤</span> Meu Perfil</button>\n      <button class=\"nav-item\" data-tela=\"admin\" id=\"nav-admin\"><span>⚙️</span> Administração</button>\n    </nav>\n    <div class=\"sidebar-pe\">\n      <div class=\"eu\">\n        <div class=\"avatar\" id=\"eu-avatar\">?</div>\n        <div class=\"eu-info\"><strong id=\"eu-nome\">—</strong><small id=\"eu-cargo\">—</small></div>\n      </div>\n      <button class=\"btn-sair\" id=\"btn-sair\">⏻ Sair</button>\n    </div>\n  </aside>\n\n  <main class=\"conteudo\">\n    <header class=\"topbar\">\n      <div>\n        <h2 id=\"titulo-tela\">Painel</h2>\n        <p class=\"topbar-sub\" id=\"subtitulo-tela\">Visão geral do grupamento</p>\n      </div>\n      <div class=\"topbar-dir\">\n        <button class=\"sino\" id=\"btn-notif\">🔔<b id=\"notif-badge\" class=\"hidden\">0</b></button>\n      </div>\n    </header>\n\n    <div id=\"mensagem-flutuante\" class=\"flutuante hidden\"></div>\n\n    <!-- PAINEL -->\n    <section class=\"tela\" id=\"tela-dashboard\">\n      <div class=\"cards\" id=\"cards-dashboard\"></div>\n      <div class=\"duas-colunas\">\n        <div class=\"painel\">\n          <div class=\"painel-topo\"><h3>Ocorrências recentes</h3></div>\n          <div id=\"dash-ocorrencias\"></div>\n        </div>\n        <div class=\"painel\">\n          <div class=\"painel-topo\"><h3>Ranking de pontos</h3></div>\n          <div id=\"dash-ranking\"></div>\n        </div>\n      </div>\n    </section>\n\n    <!-- OCORRÊNCIAS -->\n    <section class=\"tela hidden\" id=\"tela-ocorrencias\">\n      <div class=\"painel\">\n        <div class=\"painel-topo\">\n          <h3>Registrar ocorrência</h3>\n          <button class=\"btn-primario sm\" id=\"btn-abrir-ocorrencia\">+ Nova ocorrência</button>\n        </div>\n        <div id=\"lista-ocorrencias\"></div>\n      </div>\n    </section>\n\n    <!-- EFETIVO -->\n    <section class=\"tela hidden\" id=\"tela-efetivo\">\n      <div class=\"painel\">\n        <div class=\"painel-topo\">\n          <h3>Efetivo</h3>\n          <div class=\"topo-acoes\">\n            <input type=\"search\" id=\"busca-efetivo\" placeholder=\"Buscar nome ou login...\">\n            <button class=\"btn-primario sm\" id=\"btn-abrir-usuario\">+ Novo usuário</button>\n          </div>\n        </div>\n        <div id=\"tabela-efetivo\"></div>\n      </div>\n    </section>\n\n    <!-- PONTOS -->\n    <section class=\"tela hidden\" id=\"tela-pontos\">\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Lançar pontos</h3></div>\n        <form id=\"form-pontos\" class=\"form-linha\">\n          <label>Policial<select id=\"pontos-user\" required></select></label>\n          <label>Pontos (+ ou -)<input type=\"number\" id=\"pontos-delta\" value=\"10\" required></label>\n          <label>Motivo<input type=\"text\" id=\"pontos-motivo\" placeholder=\"Ex.: abordagem bem feita\" required></label>\n          <button class=\"btn-primario sm\" type=\"submit\">Lançar</button>\n        </form>\n      </div>\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Histórico de pontuação</h3></div>\n        <div id=\"historico-pontos\"></div>\n      </div>\n    </section>\n\n    <!-- CHAT -->\n    <section class=\"tela hidden\" id=\"tela-chat\">\n      <div class=\"painel chat-painel\">\n        <div class=\"painel-topo\"><h3>Chat do efetivo</h3></div>\n        <div id=\"chat-mensagens\" class=\"chat-mensagens\"></div>\n        <form id=\"form-chat\" class=\"chat-form\">\n          <input type=\"text\" id=\"chat-input\" placeholder=\"Escreva uma mensagem...\" maxlength=\"800\" autocomplete=\"off\">\n          <button class=\"btn-primario sm\" type=\"submit\">Enviar</button>\n        </form>\n      </div>\n    </section>\n\n    <!-- AUDITORIA -->\n    <section class=\"tela hidden\" id=\"tela-auditoria\">\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Registro de auditoria</h3></div>\n        <div id=\"lista-auditoria\"></div>\n      </div>\n    </section>\n\n    <!-- PERFIL -->\n    <section class=\"tela hidden\" id=\"tela-perfil\">\n      <div class=\"duas-colunas\">\n        <div class=\"painel\">\n          <div class=\"painel-topo\"><h3>Meus dados</h3></div>\n          <form id=\"form-perfil\" class=\"form-coluna\">\n            <label>Nome<input type=\"text\" id=\"perfil-nome\" maxlength=\"60\"></label>\n            <label>Recado (máx 200)<textarea id=\"perfil-recado\" maxlength=\"200\" rows=\"3\"></textarea></label>\n            <label>Foto\n              <input type=\"file\" id=\"perfil-foto\" accept=\"image/*\">\n            </label>\n            <div class=\"foto-preview\"><img id=\"perfil-foto-img\" alt=\"\" class=\"hidden\"><span id=\"perfil-sem-foto\">sem foto</span></div>\n            <div class=\"linha-botoes\">\n              <button class=\"btn-primario sm\" type=\"submit\">Salvar</button>\n              <button class=\"btn-secundario sm\" type=\"button\" id=\"btn-remover-foto\">Remover foto</button>\n            </div>\n          </form>\n        </div>\n        <div class=\"painel\">\n          <div class=\"painel-topo\"><h3>Alterar senha</h3></div>\n          <form id=\"form-senha\" class=\"form-coluna\">\n            <label>Senha atual<input type=\"password\" id=\"senha-atual\" required></label>\n            <label>Nova senha<input type=\"password\" id=\"senha-nova\" required minlength=\"4\"></label>\n            <label>Confirmar nova senha<input type=\"password\" id=\"senha-conf\" required minlength=\"4\"></label>\n            <button class=\"btn-primario sm\" type=\"submit\">Alterar senha</button>\n          </form>\n        </div>\n      </div>\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Meus pontos</h3></div>\n        <div id=\"perfil-pontos\"></div>\n      </div>\n    </section>\n\n    <!-- ADMIN -->\n    <section class=\"tela hidden\" id=\"tela-admin\">\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Backup do sistema</h3></div>\n        <p class=\"texto-ajuda\">Baixe uma cópia completa dos dados (usuários, ocorrências, pontos, chat e auditoria). Guarde o arquivo fora do servidor.</p>\n        <div class=\"linha-botoes\">\n          <button class=\"btn-primario sm\" id=\"btn-backup\">⬇️ Baixar backup</button>\n          <label class=\"btn-secundario sm arquivo-label\">⬆️ Restaurar backup<input type=\"file\" id=\"in-restore\" accept=\"application/json\" hidden></label>\n        </div>\n      </div>\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Identidade do sistema</h3></div>\n        <form id=\"form-config\" class=\"form-linha\" style=\"grid-template-columns:1fr 2fr auto\">\n          <label>Sigla / nome curto<input type=\"text\" id=\"cfg-nome\" maxlength=\"24\"></label>\n          <label>Nome da corporação<input type=\"text\" id=\"cfg-corp\" maxlength=\"80\"></label>\n          <button class=\"btn-primario sm\" type=\"submit\">Salvar</button>\n        </form>\n      </div>\n      <div class=\"painel\">\n        <div class=\"painel-topo\"><h3>Resumo</h3></div>\n        <div class=\"texto-ajuda\" id=\"admin-info\"></div>\n      </div>\n    </section>\n  </main>\n</div>\n\n<!-- ══════════ MODAIS ══════════ -->\n<div class=\"overlay hidden\" id=\"overlay\">\n  <div class=\"modal\" id=\"modal\">\n    <div class=\"modal-topo\"><h3 id=\"modal-titulo\">—</h3><button id=\"modal-fechar\">✕</button></div>\n    <div class=\"modal-corpo\" id=\"modal-corpo\"></div>\n  </div>\n</div>\n\n<script src=\"app.js\"></script>\n</body>\n</html>\n"}, "/style.css": {"t": "text/css; charset=utf-8", "b": "* { box-sizing: border-box; margin: 0; padding: 0; }\n\n:root {\n  --bg: #070c16;\n  --bg2: #0d1424;\n  --card: #111a2c;\n  --card2: #16223846;\n  --linha: #1e2b45;\n  --texto: #e8eefb;\n  --suave: #8fa3c4;\n  --azul: #2f7cf6;\n  --azul-esc: #1d5ecb;\n  --vermelho: #e4483f;\n  --verde: #2fbf71;\n  --amarelo: #e8b23a;\n}\n\nbody {\n  font-family: 'Inter', system-ui, -apple-system, sans-serif;\n  background: radial-gradient(1200px 600px at 15% -10%, #12203a 0%, var(--bg) 55%);\n  color: var(--texto);\n  min-height: 100vh;\n  -webkit-font-smoothing: antialiased;\n}\n\n.hidden { display: none !important; }\n\n/* ───── login ───── */\n.login-wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }\n.login-card {\n  width: 100%; max-width: 400px; background: var(--card);\n  border: 1px solid var(--linha); border-radius: 18px; padding: 34px 28px;\n  box-shadow: 0 24px 70px rgba(0, 0, 0, .55); text-align: center;\n}\n.login-badge {\n  width: 62px; height: 62px; margin: 0 auto 16px; border-radius: 16px;\n  display: grid; place-items: center; font-size: 30px; font-weight: 800;\n  background: linear-gradient(150deg, var(--azul), #0b3a86);\n  box-shadow: 0 10px 30px rgba(47, 124, 246, .35);\n}\n.login-card h1 { font-size: 26px; letter-spacing: 2px; font-weight: 800; }\n.login-card .sub { color: var(--suave); font-size: 13px; margin-top: 4px; }\n.login-card .tag {\n  display: inline-block; margin: 18px 0 20px; font-size: 10px; letter-spacing: 2.5px;\n  color: #7f9ac4; border: 1px solid var(--linha); padding: 5px 12px; border-radius: 999px;\n}\n.login-card form { text-align: left; }\nlabel { display: block; font-size: 12px; color: var(--suave); margin-bottom: 14px; font-weight: 500; }\ninput, select, textarea {\n  width: 100%; margin-top: 6px; background: #0a1220; color: var(--texto);\n  border: 1px solid var(--linha); border-radius: 10px; padding: 11px 13px;\n  font-family: inherit; font-size: 14px; outline: none; transition: .15s;\n}\ninput:focus, select:focus, textarea:focus { border-color: var(--azul); box-shadow: 0 0 0 3px #2f7cf622; }\n.senha-wrap { position: relative; display: block; }\n.senha-wrap button {\n  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);\n  background: none; border: none; color: var(--suave); cursor: pointer; font-size: 15px;\n}\n.btn-primario {\n  width: 100%; background: linear-gradient(180deg, var(--azul), var(--azul-esc));\n  color: #fff; border: none; border-radius: 10px; padding: 12px; font-weight: 700;\n  font-size: 13px; letter-spacing: 1px; cursor: pointer; transition: .15s;\n}\n.btn-primario:hover { filter: brightness(1.12); }\n.btn-primario.sm { width: auto; padding: 9px 16px; }\n.btn-secundario {\n  background: #16223a; border: 1px solid var(--linha); color: var(--texto);\n  border-radius: 10px; padding: 9px 16px; font-size: 13px; font-weight: 600;\n  cursor: pointer; display: inline-block;\n}\n.btn-secundario:hover { border-color: var(--azul); }\n.arquivo-label { cursor: pointer; }\n.aviso { font-size: 11px; color: #5f7397; margin-top: 18px; line-height: 1.5; }\n.erro {\n  background: #3a1414; border: 1px solid #6d2323; color: #ffb3ad;\n  font-size: 12px; border-radius: 9px; padding: 9px 12px; margin-bottom: 12px;\n}\n\n/* ───── suspensão ───── */\n.suspenso { max-width: 440px; }\n.susp-icone { font-size: 44px; margin-bottom: 10px; }\n.cronometro {\n  font-size: 40px; font-weight: 800; letter-spacing: 3px; color: var(--vermelho);\n  font-variant-numeric: tabular-nums; margin: 18px 0;\n}\n.susp-info { display: grid; gap: 8px; text-align: left; margin-bottom: 20px; }\n.susp-info > div {\n  display: flex; justify-content: space-between; gap: 12px;\n  background: #0a1220; border: 1px solid var(--linha); border-radius: 10px; padding: 10px 13px;\n  font-size: 12px;\n}\n.susp-info span { color: var(--suave); }\n.susp-info strong { font-weight: 600; text-align: right; }\n\n/* ───── app ───── */\n.app { display: flex; min-height: 100vh; }\n\n.sidebar {\n  width: 250px; flex-shrink: 0; background: #080e1a; border-right: 1px solid var(--linha);\n  display: flex; flex-direction: column; padding: 20px 14px; position: sticky; top: 0; height: 100vh;\n}\n.marca { display: flex; align-items: center; gap: 11px; padding: 0 6px 22px; }\n.marca-icone {\n  width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center;\n  font-size: 20px; font-weight: 800; background: linear-gradient(150deg, var(--azul), #0b3a86);\n}\n.marca strong { display: block; font-size: 15px; letter-spacing: .5px; }\n.marca small { color: var(--suave); font-size: 10.5px; }\n\n#nav { display: flex; flex-direction: column; gap: 3px; flex: 1; }\n.nav-item {\n  display: flex; align-items: center; gap: 11px; width: 100%; text-align: left;\n  background: none; border: none; color: var(--suave); font-family: inherit;\n  font-size: 13.5px; font-weight: 500; padding: 11px 12px; border-radius: 10px; cursor: pointer;\n  transition: .15s;\n}\n.nav-item span { width: 18px; text-align: center; font-size: 14px; }\n.nav-item:hover { background: #111b2d; color: var(--texto); }\n.nav-item.ativo { background: #14294a; color: #fff; box-shadow: inset 2px 0 0 var(--azul); }\n\n.sidebar-pe { border-top: 1px solid var(--linha); padding-top: 14px; }\n.eu { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }\n.avatar {\n  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; overflow: hidden;\n  background: linear-gradient(150deg, #24507f, #12233d); display: grid; place-items: center;\n  font-weight: 700; font-size: 13px; color: #cfe0ff; background-size: cover; background-position: center;\n}\n.eu-info strong { display: block; font-size: 13px; }\n.eu-info small { color: var(--suave); font-size: 11px; }\n.btn-sair {\n  width: 100%; background: #2a1414; border: 1px solid #4a2020; color: #ff9d95;\n  border-radius: 10px; padding: 9px; font-family: inherit; font-size: 12.5px;\n  font-weight: 600; cursor: pointer;\n}\n.btn-sair:hover { background: #381818; }\n\n.conteudo { flex: 1; padding: 22px 26px 60px; min-width: 0; }\n.topbar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; gap: 16px; }\n.topbar h2 { font-size: 21px; font-weight: 700; }\n.topbar-sub { color: var(--suave); font-size: 12.5px; margin-top: 3px; }\n.sino {\n  position: relative; background: #111a2c; border: 1px solid var(--linha); color: var(--texto);\n  width: 40px; height: 40px; border-radius: 11px; cursor: pointer; font-size: 15px;\n}\n.sino b {\n  position: absolute; top: -5px; right: -5px; background: var(--vermelho); color: #fff;\n  font-size: 10px; min-width: 18px; height: 18px; border-radius: 9px; display: grid;\n  place-items: center; padding: 0 5px;\n}\n\n/* ───── painéis ───── */\n.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 18px; }\n.card {\n  background: var(--card); border: 1px solid var(--linha); border-radius: 14px; padding: 16px 18px;\n}\n.card small { color: var(--suave); font-size: 11.5px; font-weight: 500; letter-spacing: .3px; }\n.card strong { display: block; font-size: 28px; font-weight: 800; margin-top: 6px; }\n.card.destaque { border-color: #2b4f8b; background: linear-gradient(150deg, #16294a, var(--card)); }\n\n.painel { background: var(--card); border: 1px solid var(--linha); border-radius: 14px; padding: 18px; margin-bottom: 16px; }\n.painel-topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }\n.painel-topo h3 { font-size: 15px; font-weight: 650; }\n.topo-acoes { display: flex; gap: 9px; align-items: center; flex-wrap: wrap; }\n.topo-acoes input[type=search] { margin: 0; width: 200px; padding: 8px 12px; font-size: 13px; }\n.duas-colunas { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }\n@media (max-width: 980px) { .duas-colunas { grid-template-columns: 1fr; } }\n\n/* ───── tabelas ───── */\ntable { width: 100%; border-collapse: collapse; font-size: 13px; }\nth {\n  text-align: left; color: var(--suave); font-size: 11px; font-weight: 600;\n  letter-spacing: .6px; text-transform: uppercase; padding: 9px 10px; border-bottom: 1px solid var(--linha);\n}\ntd { padding: 11px 10px; border-bottom: 1px solid #16223a; vertical-align: middle; }\ntr:last-child td { border-bottom: none; }\n.nome-cel { display: flex; align-items: center; gap: 10px; }\n.nome-cel .avatar { width: 30px; height: 30px; font-size: 11px; }\n.login-suave { color: var(--suave); font-size: 11.5px; }\n\n.badge {\n  display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: .4px;\n  padding: 4px 9px; border-radius: 999px; background: #1a2740; color: #a8bcd8;\n}\n.badge.azul { background: #14305c; color: #8ab6ff; }\n.badge.verde { background: #0f3524; color: #6ee7a3; }\n.badge.vermelho { background: #3a1717; color: #ff9d95; }\n.badge.amarelo { background: #3a2f12; color: #f3cd77; }\n\n.acoes-linha { display: flex; gap: 6px; flex-wrap: wrap; }\n.mini {\n  background: #16223a; border: 1px solid var(--linha); color: var(--texto);\n  border-radius: 8px; padding: 5px 9px; font-size: 11.5px; font-family: inherit;\n  cursor: pointer; font-weight: 600;\n}\n.mini:hover { border-color: var(--azul); }\n.mini.perigo { color: #ff9d95; border-color: #4a2020; background: #2a1414; }\n.mini.perigo:hover { background: #381818; }\n\n.vazio { text-align: center; color: #5f7397; font-size: 13px; padding: 26px 0; }\n.texto-ajuda { color: var(--suave); font-size: 12.5px; line-height: 1.6; margin-bottom: 14px; }\n\n/* ───── formulários ───── */\n.form-linha { display: grid; grid-template-columns: 1fr 130px 1.4fr auto; gap: 12px; align-items: end; }\n.form-linha label { margin: 0; }\n.form-coluna { display: grid; gap: 4px; }\n.linha-botoes { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 6px; }\n.foto-preview { margin: 6px 0 10px; }\n.foto-preview img { width: 74px; height: 74px; border-radius: 50%; object-fit: cover; border: 2px solid var(--linha); }\n.foto-preview span { color: #5f7397; font-size: 12px; }\n@media (max-width: 760px) { .form-linha { grid-template-columns: 1fr; } }\n\n/* ───── chat ───── */\n.chat-painel { display: flex; flex-direction: column; height: calc(100vh - 190px); }\n.chat-mensagens { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; }\n.msg { max-width: 72%; background: #16223a; border: 1px solid var(--linha); border-radius: 12px; padding: 9px 12px; }\n.msg.minha { align-self: flex-end; background: #14294a; border-color: #2b4f8b; }\n.msg-topo { display: flex; gap: 8px; align-items: baseline; margin-bottom: 3px; }\n.msg-topo strong { font-size: 12px; }\n.msg-topo small { color: var(--suave); font-size: 10.5px; }\n.msg p { font-size: 13px; line-height: 1.45; word-break: break-word; }\n.chat-form { display: flex; gap: 9px; margin-top: 12px; }\n.chat-form input { margin: 0; }\n\n/* ───── flutuante ───── */\n.flutuante {\n  position: fixed; bottom: 24px; right: 24px; z-index: 60;\n  background: #14294a; border: 1px solid #2b4f8b; color: #dce8ff;\n  padding: 12px 18px; border-radius: 11px; font-size: 13px; font-weight: 500;\n  box-shadow: 0 16px 40px rgba(0, 0, 0, .5); animation: sobe .2s ease;\n}\n.flutuante.erro { background: #3a1414; border-color: #6d2323; color: #ffb3ad; }\n@keyframes sobe { from { transform: translateY(8px); opacity: 0; } }\n\n/* ───── modal ───── */\n.overlay {\n  position: fixed; inset: 0; background: rgba(3, 7, 14, .78); backdrop-filter: blur(3px);\n  display: grid; place-items: center; padding: 20px; z-index: 80;\n}\n.modal {\n  background: var(--card); border: 1px solid var(--linha); border-radius: 16px;\n  width: 100%; max-width: 520px; max-height: 88vh; display: flex; flex-direction: column;\n  box-shadow: 0 30px 80px rgba(0, 0, 0, .6);\n}\n.modal-topo {\n  display: flex; justify-content: space-between; align-items: center;\n  padding: 16px 20px; border-bottom: 1px solid var(--linha);\n}\n.modal-topo h3 { font-size: 15px; }\n.modal-topo button { background: none; border: none; color: var(--suave); font-size: 16px; cursor: pointer; }\n.modal-corpo { padding: 20px; overflow-y: auto; }\n.modal-corpo .btn-primario { margin-top: 6px; }\n\n.notif-item {\n  border-bottom: 1px solid #16223a; padding: 11px 0; font-size: 12.5px;\n}\n.notif-item:last-child { border-bottom: none; }\n.notif-item strong { display: block; font-size: 13px; margin-bottom: 2px; }\n.notif-item small { color: var(--suave); font-size: 11px; }\n.notif-item p { color: #b9c9e2; margin-top: 3px; line-height: 1.45; }\n\n.oc-card { border: 1px solid var(--linha); border-radius: 12px; padding: 14px; margin-bottom: 10px; background: #0e1728; }\n.oc-topo { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; }\n.oc-topo strong { font-size: 13.5px; }\n.oc-meta { color: var(--suave); font-size: 11.5px; margin-top: 2px; }\n.oc-dep { font-size: 12.5px; color: #b9c9e2; line-height: 1.5; margin-top: 6px; white-space: pre-wrap; }\n.oc-resp { font-size: 12.5px; color: #8ab6ff; margin-top: 6px; white-space: pre-wrap; }\n\n@media (max-width: 760px) {\n  .sidebar { position: fixed; z-index: 70; transform: translateX(-100%); transition: .2s; }\n  .sidebar.aberta { transform: none; }\n  .conteudo { padding: 16px 14px 60px; }\n}\n"}, "/app.js": {"t": "application/javascript; charset=utf-8", "b": "// ══════════ SIGP — frontend ══════════\nconst $ = (sel) => document.querySelector(sel);\nconst $$ = (sel) => Array.from(document.querySelectorAll(sel));\n\nconst S = {\n  token: localStorage.getItem('sigp_token') || null,\n  eu: null,\n  dados: null,\n  tela: 'dashboard',\n  busca: '',\n  suspTimer: null,\n};\n\nconst CARGO_COR = {\n  'Admin Master': 'vermelho',\n  'Chefe de Polícia': 'vermelho',\n  'Delegado': 'amarelo',\n  'Escrivão': 'azul',\n  'Tático': 'azul',\n  'Agente Oficial': 'azul',\n  'Guarda Municipal': '',\n  'Civil': '',\n};\n\nfunction escapeHtml(t) {\n  return String(t == null ? '' : t).replace(/[&<>\"']/g, (c) => (\n    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c]\n  ));\n}\nfunction dataBR(iso) {\n  if (!iso) return '—';\n  const d = new Date(iso);\n  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });\n}\nfunction tempoRel(iso) {\n  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);\n  if (s < 60) return 'agora';\n  if (s < 3600) return Math.floor(s / 60) + 'min';\n  if (s < 86400) return Math.floor(s / 3600) + 'h';\n  return Math.floor(s / 86400) + 'd';\n}\n\nfunction flutuante(msg, tipo) {\n  const el = $('#mensagem-flutuante');\n  el.textContent = msg;\n  el.className = 'flutuante' + (tipo === 'erro' ? ' erro' : '');\n  clearTimeout(el._t);\n  el._t = setTimeout(() => el.classList.add('hidden'), 3200);\n}\n\n// ══════════ API ══════════\nasync function api(metodo, caminho, corpo) {\n  const opts = { method: metodo, headers: { 'Content-Type': 'application/json' } };\n  if (S.token) opts.headers['Authorization'] = 'Bearer ' + S.token;\n  if (corpo !== undefined) opts.body = JSON.stringify(corpo);\n  const res = await fetch('/api' + caminho, opts);\n  const texto = await res.text();\n  let dados = {};\n  try { dados = texto ? JSON.parse(texto) : {}; } catch (_) { throw new Error('Resposta inválida do servidor.'); }\n  if (res.status === 401) { sairLocal(); throw new Error('Sessão expirada.'); }\n  if (!res.ok) {\n    const err = new Error(dados.error || 'Erro ' + res.status);\n    err.dados = dados;\n    throw err;\n  }\n  return dados;\n}\n\n// ══════════ login / sessão ══════════\nfunction sairLocal() {\n  S.token = null; S.eu = null; S.dados = null;\n  localStorage.removeItem('sigp_token');\n  $('#app').classList.add('hidden');\n  $('#tela-suspensao').classList.add('hidden');\n  $('#tela-login').classList.remove('hidden');\n}\n\n$('#form-login').addEventListener('submit', async (ev) => {\n  ev.preventDefault();\n  const erro = $('#login-erro');\n  erro.classList.add('hidden');\n  try {\n    const r = await api('POST', '/login', { login: $('#in-login').value, senha: $('#in-senha').value });\n    S.token = r.token;\n    S.eu = r.user;\n    localStorage.setItem('sigp_token', r.token);\n    $('#in-senha').value = '';\n    await entrar();\n  } catch (e) {\n    if (e.dados && e.dados.suspenso) return mostrarSuspensao(e.dados);\n    erro.textContent = e.message;\n    erro.classList.remove('hidden');\n  }\n});\n\n$('#btn-olho').addEventListener('click', () => {\n  const i = $('#in-senha');\n  i.type = i.type === 'password' ? 'text' : 'password';\n});\n\nfunction mostrarSuspensao(d) {\n  $('#tela-login').classList.add('hidden');\n  $('#tela-suspensao').classList.remove('hidden');\n  $('#susp-por').textContent = d.aplicadoPor || '—';\n  $('#susp-motivo').textContent = d.motivo || '—';\n  $('#susp-expira').textContent = dataBR(d.expiraEm);\n  let restante = Math.max(0, Math.floor(d.restanteMs / 1000));\n  clearInterval(S.suspTimer);\n  const desenha = () => {\n    const h = String(Math.floor(restante / 3600)).padStart(2, '0');\n    const m = String(Math.floor((restante % 3600) / 60)).padStart(2, '0');\n    const s = String(restante % 60).padStart(2, '0');\n    $('#susp-tempo').textContent = `${h}:${m}:${s}`;\n    if (restante <= 0) { clearInterval(S.suspTimer); voltarLogin(); return; }\n    restante--;\n  };\n  desenha();\n  S.suspTimer = setInterval(desenha, 1000);\n}\nfunction voltarLogin() {\n  clearInterval(S.suspTimer);\n  $('#tela-suspensao').classList.add('hidden');\n  $('#tela-login').classList.remove('hidden');\n}\n$('#btn-voltar-login').addEventListener('click', voltarLogin);\n\nasync function entrar() {\n  $('#tela-login').classList.add('hidden');\n  $('#tela-suspensao').classList.add('hidden');\n  $('#app').classList.remove('hidden');\n  await carregar();\n  irPara('dashboard');\n  iniciarPolling();\n}\n\nasync function carregar() {\n  const d = await api('GET', '/state');\n  S.dados = d;\n  S.eu = d.users.find((u) => u.id === (S.eu && S.eu.id)) || S.eu;\n  pintarIdentidade();\n  renderTudo();\n}\n\nfunction pintarIdentidade() {\n  const eu = S.eu;\n  if (!eu) return;\n  $('#eu-nome').textContent = eu.nome;\n  $('#eu-cargo').textContent = eu.cargo;\n  const av = $('#eu-avatar');\n  av.textContent = (eu.nome || '?').trim().charAt(0).toUpperCase();\n  if (eu.foto) { av.style.backgroundImage = `url(${eu.foto})`; av.textContent = ''; }\n  else av.style.backgroundImage = 'none';\n  $('#nav-admin').classList.toggle('hidden', (S.dados ? S.dados.meuNivel : 0) < 90);\n  if (S.dados && S.dados.config) {\n    $('#marca-nome').textContent = S.dados.config.nomeSistema || 'SIGP';\n    $('#marca-sub').textContent = 'Sistema Interno';\n    $('#login-nome').textContent = S.dados.config.nomeSistema || 'SIGP';\n    $('#login-sub').textContent = S.dados.config.nomeCorporacao || '';\n  }\n}\n\n$('#btn-sair').addEventListener('click', async () => {\n  try { await api('POST', '/logout'); } catch (_) {}\n  sairLocal();\n});\n\n// ══════════ navegação ══════════\nfunction irPara(tela) {\n  S.tela = tela;\n  $$('.nav-item').forEach((b) => b.classList.toggle('ativo', b.dataset.tela === tela));\n  $$('.tela').forEach((s) => s.classList.add('hidden'));\n  const el = $('#tela-' + tela);\n  if (el) el.classList.remove('hidden');\n  const titulos = {\n    dashboard: ['Painel', 'Visão geral do grupamento'],\n    ocorrencias: ['Ocorrências', 'Registro e acompanhamento'],\n    efetivo: ['Efetivo', 'Todos os integrantes do sistema'],\n    pontos: ['Pontuação', 'Lançamento e histórico de pontos'],\n    chat: ['Chat', 'Comunicação do efetivo'],\n    auditoria: ['Auditoria', 'Tudo o que acontece no sistema'],\n    perfil: ['Meu Perfil', 'Seus dados e sua senha'],\n    admin: ['Administração', 'Backup e configuração'],\n  };\n  const t = titulos[tela] || ['—', ''];\n  $('#titulo-tela').textContent = t[0];\n  $('#subtitulo-tela').textContent = t[1];\n  $$('.nav-item').forEach((b) => b.classList.toggle('ativo', b.dataset.tela === tela));\n  $('#sidebar').classList.remove('aberta');\n  if (tela === 'chat') rolarChat();\n}\n$$('.nav-item').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.tela)));\n\n// ══════════ modais ══════════\nfunction abrirModal(titulo, html) {\n  $('#modal-titulo').textContent = titulo;\n  $('#modal-corpo').innerHTML = html;\n  $('#overlay').classList.remove('hidden');\n}\nfunction fecharModal() {\n  $('#overlay').classList.add('hidden');\n  $('#modal-corpo').innerHTML = '';\n}\n$('#modal-fechar').addEventListener('click', fecharModal);\n$('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') fecharModal(); });\n\n// ══════════ render geral ══════════\nfunction renderTudo() {\n  if (!S.dados) return;\n  const eu = S.dados.users.find((u) => S.eu && u.id === S.eu.id) || S.eu;\n  S.eu = eu;\n  pintarIdentidade();\n  renderDashboard();\n  renderOcorrencias();\n  renderEfetivo();\n  renderPontos();\n  renderChat();\n  renderAuditoria();\n  renderPerfil();\n  renderAdmin();\n  renderNotifBadge();\n  if (S.tela === 'chat') rolarChat();\n}\n\n// ── painel ──\nfunction renderDashboard() {\n  const d = S.dados;\n  const pend = d.ocorrencias.filter((o) => o.status === 'Pendente').length;\n  const aceitas = d.ocorrencias.filter((o) => o.status === 'Aceita').length;\n  const ativos = d.users.filter((u) => u.ativo).length;\n  const suspensos = d.users.filter((u) => u.suspensoAte && new Date(u.suspensoAte) > new Date()).length;\n\n  $('#cards-dashboard').innerHTML = `\n    <div class=\"card destaque\"><small>EFETIVO ATIVO</small><strong>${ativos}</strong></div>\n    <div class=\"card\"><small>OCORRÊNCIAS PENDENTES</small><strong>${pend}</strong></div>\n    <div class=\"card\"><small>OCORRÊNCIAS ACEITAS</small><strong>${aceitas}</strong></div>\n    <div class=\"card\"><small>SUSPENSOS</small><strong>${suspensos}</strong></div>`;\n\n  const rec = d.ocorrencias.slice(0, 6);\n  $('#dash-ocorrencias').innerHTML = rec.length\n    ? rec.map((o) => `\n      <div class=\"oc-card\">\n        <div class=\"oc-topo\">\n          <div><strong>${escapeHtml(o.titulo)}</strong>\n          <div class=\"oc-meta\">${escapeHtml(o.agente)} · ${dataBR(o.criadoEm)}</div></div>\n          ${badgeStatus(o.status)}\n        </div>\n      </div>`).join('')\n    : '<div class=\"vazio\">Nenhuma ocorrência registrada ainda.</div>';\n\n  const rank = [...d.users].sort((a, b) => (b.pontos || 0) - (a.pontos || 0)).slice(0, 8);\n  $('#dash-ranking').innerHTML = rank.length\n    ? `<table><thead><tr><th>#</th><th>Policial</th><th>Cargo</th><th style=\"text-align:right\">Pontos</th></tr></thead><tbody>\n      ${rank.map((u, i) => `<tr>\n        <td>${i + 1}º</td>\n        <td>${escapeHtml(u.nome)}<div class=\"login-suave\">@${escapeHtml(u.login)}</div></td>\n        <td><span class=\"badge ${CARGO_COR[u.cargo] || ''}\">${escapeHtml(u.cargo)}</span></td>\n        <td style=\"text-align:right\"><strong>${u.pontos || 0}</strong></td>\n      </tr>`).join('')}</tbody></table>`\n    : '<div class=\"vazio\">Sem pontuação lançada.</div>';\n}\n\nfunction badgeStatus(s) {\n  const cor = { Pendente: 'amarelo', Aceita: 'verde', Recusada: 'vermelho', Cancelada: '' }[s] || '';\n  return `<span class=\"badge ${cor}\">${escapeHtml(s)}</span>`;\n}\n\n// ── ocorrências ──\nfunction renderOcorrencias() {\n  const lista = S.dados.ocorrencias;\n  const podeExcluir = S.dados.meuNivel >= 70;\n  $('#lista-ocorrencias').innerHTML = lista.length\n    ? lista.map((o) => `\n      <div class=\"oc-card\">\n        <div class=\"oc-topo\">\n          <div>\n            <strong>${escapeHtml(o.titulo)}</strong>\n            <div class=\"oc-meta\">${escapeHtml(o.agente)} · ${escapeHtml(o.cargoAgente || '')} · ${dataBR(o.criadoEm)}${o.responsavel ? ' · resp.: ' + escapeHtml(o.responsavel) : ''}</div>\n          </div>\n          <div class=\"acoes-linha\">\n            ${badgeStatus(o.status)}\n            <button class=\"mini\" data-oc-editar=\"${o.id}\">Editar</button>\n            ${podeExcluir ? `<button class=\"mini perigo\" data-oc-excluir=\"${o.id}\">Excluir</button>` : ''}\n          </div>\n        </div>\n        ${o.depoimento ? `<div class=\"oc-dep\">${escapeHtml(o.depoimento)}</div>` : ''}\n        ${o.resposta ? `<div class=\"oc-resp\">↳ ${escapeHtml(o.resposta)}</div>` : ''}\n      </div>`).join('')\n    : '<div class=\"vazio\">Nenhuma ocorrência registrada ainda.</div>';\n\n  $$('[data-oc-editar]').forEach((b) => b.addEventListener('click', () => modalOcorrencia(b.dataset.ocEditar)));\n  $$('[data-oc-excluir]').forEach((b) => b.addEventListener('click', async () => {\n    if (!confirm('Excluir esta ocorrência definitivamente?')) return;\n    try { await api('DELETE', '/ocorrencias/' + b.dataset.ocExcluir); await carregar(); flutuante('Ocorrência excluída.'); }\n    catch (e) { flutuante(e.message, 'erro'); }\n  }));\n}\n\n$('#btn-abrir-ocorrencia').addEventListener('click', () => modalOcorrencia(null));\n\nfunction modalOcorrencia(id) {\n  const oc = id ? S.dados.ocorrencias.find((o) => o.id === id) : null;\n  const cargos = S.dados.cargos.map((c) => c.nome);\n  const status = ['Pendente', 'Aceita', 'Recusada', 'Cancelada'];\n  abrirModal(oc ? 'Editar ocorrência' : 'Nova ocorrência', `\n    <form id=\"form-oc\">\n      <label>Título / assunto<input type=\"text\" id=\"oc-titulo\" required maxlength=\"120\" value=\"${escapeHtml(oc ? oc.titulo : '')}\"></label>\n      <label>Agente<input type=\"text\" id=\"oc-agente\" required maxlength=\"60\" value=\"${escapeHtml(oc ? oc.agente : (S.eu ? S.eu.nome : ''))}\"></label>\n      <label>Cargo do agente<select id=\"oc-cargo\">\n        ${cargos.map((c) => `<option ${oc && oc.cargoAgente === c ? 'selected' : (!oc && S.eu && S.eu.cargo === c ? 'selected' : '')}>${c}</option>`).join('')}\n      </select></label>\n      <label>Status<select id=\"oc-status\">${status.map((s) => `<option ${oc && oc.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>\n      <label>Responsável (quem atendeu)<input type=\"text\" id=\"oc-responsavel\" maxlength=\"60\" value=\"${escapeHtml(oc ? oc.responsavel || '' : '')}\"></label>\n      <label>Depoimento<textarea id=\"oc-depoimento\" rows=\"4\" maxlength=\"4000\">${escapeHtml(oc ? oc.depoimento : '')}</textarea></label>\n      <label>Resposta / observação<textarea id=\"oc-resposta\" rows=\"3\" maxlength=\"4000\">${escapeHtml(oc ? oc.resposta : '')}</textarea></label>\n      <button class=\"btn-primario\" type=\"submit\">${oc ? 'Salvar alterações' : 'Registrar ocorrência'}</button>\n    </form>`);\n\n  $('#form-oc').addEventListener('submit', async (ev) => {\n    ev.preventDefault();\n    const corpo = {\n      titulo: $('#oc-titulo').value, agente: $('#oc-agente').value, cargoAgente: $('#oc-cargo').value,\n      status: $('#oc-status').value, responsavel: $('#oc-responsavel').value,\n      depoimento: $('#oc-depoimento').value, resposta: $('#oc-resposta').value,\n    };\n    try {\n      if (oc) await api('PUT', '/ocorrencias/' + oc.id, corpo);\n      else await api('POST', '/ocorrencias', corpo);\n      fecharModal(); await carregar(); flutuante('Ocorrência salva.');\n    } catch (e) { flutuante(e.message, 'erro'); }\n  });\n}\n\n// ── efetivo ──\n$('#busca-efetivo').addEventListener('input', (e) => { S.busca = e.target.value.toLowerCase(); renderEfetivo(); });\n$('#btn-abrir-usuario').addEventListener('click', modalNovoUsuario);\n\nfunction renderEfetivo() {\n  const eu = S.eu || {};\n  const meuNivel = S.dados.meuNivel;\n  const podeGerir = meuNivel >= 80;\n  const lista = S.dados.users\n    .filter((u) => !S.busca || (u.nome + ' ' + u.login + ' ' + u.cargo).toLowerCase().includes(S.busca))\n    .sort((a, b) => S.dados.cargos.findIndex((c) => c.nome === b.cargo) - S.dados.cargos.findIndex((c) => c.nome === a.cargo));\n\n  $('#btn-abrir-usuario').classList.toggle('hidden', !podeGerir);\n\n  $('#tabela-efetivo').innerHTML = lista.length ? `\n    <table><thead><tr>\n      <th>Policial</th><th>Cargo</th><th>Situação</th><th style=\"text-align:right\">Pontos</th><th></th>\n    </tr></thead><tbody>\n    ${lista.map((u) => {\n      const susp = u.suspensoAte && new Date(u.suspensoAte) > new Date();\n      const situacao = !u.ativo ? '<span class=\"badge vermelho\">Desativado</span>'\n        : susp ? '<span class=\"badge amarelo\">Suspenso</span>'\n        : '<span class=\"badge verde\">Ativo</span>';\n      const superior = (S.dados.cargos.find((c) => c.nome === eu.cargo) || {}).nivel > (S.dados.cargos.find((c) => c.nome === u.cargo) || {}).nivel || eu.cargo === 'Admin Master';\n      const podeAqui = podeGerir && superior && u.id !== eu.id;\n      return `<tr>\n        <td><div class=\"nome-cel\"><div class=\"avatar\" ${u.foto ? `style=\"background-image:url(${u.foto})\"` : ''}>${u.foto ? '' : escapeHtml((u.nome || '?').charAt(0))}</div>\n          <div><strong>${escapeHtml(u.nome)}</strong><div class=\"login-suave\">@${escapeHtml(u.login)}</div></div></div></td>\n        <td><span class=\"badge ${CARGO_COR[u.cargo] || ''}\">${escapeHtml(u.cargo)}</span></td>\n        <td>${situacao}</td>\n        <td style=\"text-align:right\"><strong>${u.pontos || 0}</strong></td>\n        <td><div class=\"acoes-linha\">\n          ${podeAqui ? `<button class=\"mini\" data-cargo=\"${u.id}\">Cargo</button>\n          <button class=\"mini\" data-senha=\"${u.id}\">Senha</button>\n          <button class=\"mini\" data-susp=\"${u.id}\">${susp ? 'Suspensão' : 'Suspender'}</button>\n          <button class=\"mini\" data-status=\"${u.id}\">${u.ativo ? 'Desativar' : 'Ativar'}</button>\n          <button class=\"mini perigo\" data-excluir=\"${u.id}\">Excluir</button>` : '<span class=\"login-suave\">—</span>'}\n        </div></td>\n      </tr>`;\n    }).join('')}</tbody></table>`\n    : '<div class=\"vazio\">Nenhum policial encontrado.</div>';\n\n  $$('[data-cargo]').forEach((b) => b.addEventListener('click', () => modalCargo(b.dataset.cargo)));\n  $$('[data-senha]').forEach((b) => b.addEventListener('click', () => modalSenha(b.dataset.senha)));\n  $$('[data-susp]').forEach((b) => b.addEventListener('click', () => modalSuspensao(b.dataset.susp)));\n  $$('[data-status]').forEach((b) => b.addEventListener('click', async () => {\n    const u = S.dados.users.find((x) => x.id === b.dataset.status);\n    try {\n      await api('PUT', `/users/${u.id}/status`, { ativo: !u.ativo });\n      await carregar(); flutuante(u.ativo ? 'Usuário desativado.' : 'Usuário ativado.');\n    } catch (e) { flutuante(e.message, 'erro'); }\n  }));\n  $$('[data-excluir]').forEach((b) => b.addEventListener('click', async () => {\n    const u = S.dados.users.find((x) => x.id === b.dataset.excluir);\n    if (!confirm(`Excluir ${u.nome} (@${u.login})? Isso não pode ser desfeito.`)) return;\n    try { await api('DELETE', '/users/' + u.id); await carregar(); flutuante('Usuário excluído.'); }\n    catch (e) { flutuante(e.message, 'erro'); }\n  }));\n}\n\nfunction modalNovoUsuario() {\n  const cargos = S.dados.cargos.filter((c) => c.nivel < S.dados.meuNivel || S.eu.cargo === 'Admin Master');\n  abrirModal('Novo usuário', `\n    <form id=\"form-novo\">\n      <label>Nome completo<input type=\"text\" id=\"nu-nome\" required maxlength=\"60\"></label>\n      <label>Login (único)<input type=\"text\" id=\"nu-login\" required maxlength=\"24\" placeholder=\"ex: silva\"></label>\n      <label>Cargo<select id=\"nu-cargo\">${cargos.map((c) => `<option>${c.nome}</option>`).join('')}</select></label>\n      <label>Senha inicial<input type=\"text\" id=\"nu-senha\" required minlength=\"4\" value=\"1234\"></label>\n      <button class=\"btn-primario\" type=\"submit\">Criar acesso</button>\n    </form>`);\n  $('#form-novo').addEventListener('submit', async (ev) => {\n    ev.preventDefault();\n    try {\n      await api('POST', '/users', {\n        nome: $('#nu-nome').value, login: $('#nu-login').value.trim(),\n        cargo: $('#nu-cargo').value, senha: $('#nu-senha').value,\n      });\n      fecharModal(); await carregar(); flutuante('Usuário criado.');\n    } catch (e) { flutuante(e.message, 'erro'); }\n  });\n}\n\nfunction modalCargo(id) {\n  const u = S.dados.users.find((x) => x.id === id);\n  abrirModal('Alterar cargo', `\n    <p class=\"texto-ajuda\">${escapeHtml(u.nome)} (@${escapeHtml(u.login)}) está como <strong>${escapeHtml(u.cargo)}</strong>.</p>\n    <form id=\"form-cargo\">\n      <label>Novo cargo<select id=\"cg-cargo\">${S.dados.cargos.map((c) => `<option ${c.nome === u.cargo ? 'selected' : ''}>${c.nome}</option>`).join('')}</select></label>\n      <label>Motivo (vai para a auditoria)<input type=\"text\" id=\"cg-motivo\" maxlength=\"200\" placeholder=\"ex: promoção por desempenho\"></label>\n      <button class=\"btn-primario\" type=\"submit\">Salvar cargo</button>\n    </form>`);\n  $('#form-cargo').addEventListener('submit', async (ev) => {\n    ev.preventDefault();\n    try {\n      await api('PUT', `/users/${u.id}/cargo`, { cargo: $('#cg-cargo').value, motivo: $('#cg-motivo').value });\n      fecharModal(); await carregar(); flutuante('Cargo atualizado.');\n    } catch (e) { flutuante(e.message, 'erro'); }\n  });\n}\n\nfunction modalSenha(id) {\n  const u = S.dados.users.find((x) => x.id === id);\n  abrirModal('Redefinir senha', `\n    <p class=\"texto-ajuda\">Definir nova senha para ${escapeHtml(u.nome)} (@${escapeHtml(u.login)}).</p>\n    <form id=\"form-rs\">\n      <label>Nova senha<input type=\"text\" id=\"rs-nova\" required minlength=\"4\"></label>\n      <button class=\"btn-primario\" type=\"submit\">Redefinir</button>\n    </form>`);\n  $('#form-rs').addEventListener('submit', async (ev) => {\n    ev.preventDefault();\n    try {\n      await api('PUT', `/users/${u.id}/senha`, { novaSenha: $('#rs-nova').value });\n      fecharModal(); flutuante('Senha redefinida.');\n    } catch (e) { flutuante(e.message, 'erro'); }\n  });\n}\n\nfunction modalSuspensao(id) {\n  const u = S.dados.users.find((x) => x.id === id);\n  const susp = u.suspensoAte && new Date(u.suspensoAte) > new Date();\n  abrirModal('Suspensão', `\n    ${susp ? `<p class=\"texto-ajuda\">Suspenso até <strong>${dataBR(u.suspensoAte)}</strong> — motivo: ${escapeHtml(u.suspensaoMotivo || '—')}</p>` : ''}\n    <form id=\"form-susp\">\n      <label>Duração em minutos<input type=\"number\" id=\"sp-min\" min=\"1\" max=\"43200\" value=\"${susp ? 60 : 60}\" required></label>\n      <label>Motivo<input type=\"text\" id=\"sp-motivo\" required maxlength=\"200\"></label>\n      <div class=\"linha-botoes\">\n        <button class=\"btn-primario sm\" type=\"submit\">Aplicar suspensão</button>\n        ${susp ? '<button class=\"btn-secundario sm\" type=\"button\" id=\"sp-remover\">Remover suspensão</button>' : ''}\n      </div>\n    </form>`);\n  $('#form-susp').addEventListener('submit', async (ev) => {\n    ev.preventDefault();\n    try {\n      await api('PUT', `/users/${u.id}/suspensao`, { minutos: Number($('#sp-min').value), motivo: $('#sp-motivo').value });\n      fecharModal(); await carregar(); flutuante('Suspensão aplicada.');\n    } catch (e) { flutuante(e.message, 'erro'); }\n  });\n  const rem = $('#sp-remover');\n  if (rem) rem.addEventListener('click', async () => {\n    try {\n      await api('PUT', `/users/${u.id}/suspensao`, { minutos: 0 });\n      fecharModal(); await carregar(); flutuante('Suspensão removida.');\n    } catch (e) { flutuante(e.message, 'erro'); }\n  });\n}\n\n// ── pontos ──\nfunction renderPontos() {\n  const podeLancar = S.dados.meuNivel >= 60;\n  const form = $('#form-pontos');\n  form.closest('.painel').classList.toggle('hidden', !podeLancar);\n\n  const select = $('#pontos-user');\n  const atual = select.value;\n  select.innerHTML = '<option value=\"\">Selecione...</option>' + S.dados.users\n    .slice().sort((a, b) => a.nome.localeCompare(b.nome))\n    .map((u) => `<option value=\"${u.id}\">${escapeHtml(u.nome)} (@${escapeHtml(u.login)}) — ${u.pontos || 0} pts</option>`).join('');\n  if (atual) select.value = atual;\n\n  const hist = S.dados.pontos.slice(0, 60);\n  $('#historico-pontos').innerHTML = hist.length ? `\n    <table><thead><tr><th>Policial</th><th>Pontos</th><th>Motivo</th><th>Por</th><th>Quando</th></tr></thead><tbody>\n    ${hist.map((p) => `<tr>\n      <td>@${escapeHtml(p.login)}</td>\n      <td><strong style=\"color:${p.delta > 0 ? 'var(--verde)' : 'var(--vermelho)'}\">${p.delta > 0 ? '+' : ''}${p.delta}</strong></td>\n      <td>${escapeHtml(p.motivo)}</td>\n      <td class=\"login-suave\">@${escapeHtml(p.por)}</td>\n      <td class=\"login-suave\">${dataBR(p.em)}</td>\n    </tr>`).join('')}</tbody></table>`\n    : '<div class=\"vazio\">Nenhum lançamento ainda.</div>';\n\n  const meus = S.dados.pontos.filter((p) => S.eu && p.userId === S.eu.id).slice(0, 40);\n  $('#perfil-pontos').innerHTML = meus.length ? `\n    <table><thead><tr><th>Pontos</th><th>Motivo</th><th>Por</th><th>Quando</th></tr></thead><tbody>\n    ${meus.map((p) => `<tr>\n      <td><strong style=\"color:${p.delta > 0 ? 'var(--verde)' : 'var(--vermelho)'}\">${p.delta > 0 ? '+' : ''}${p.delta}</strong></td>\n      <td>${escapeHtml(p.motivo)}</td><td class=\"login-suave\">@${escapeHtml(p.por)}</td>\n      <td class=\"login-suave\">${dataBR(p.em)}</td></tr>`).join('')}</tbody></table>`\n    : '<div class=\"vazio\">Você ainda não recebeu pontos.</div>';\n}\n\n$('#form-pontos').addEventListener('submit', async (ev) => {\n  ev.preventDefault();\n  const userId = $('#pontos-user').value;\n  if (!userId) return flutuante('Selecione o policial.', 'erro');\n  try {\n    await api('POST', '/pontos', { userId, delta: Number($('#pontos-delta').value), motivo: $('#pontos-motivo').value });\n    $('#pontos-motivo').value = '';\n    await carregar(); flutuante('Pontos lançados.');\n  } catch (e) { flutuante(e.message, 'erro'); }\n});\n\n// ── chat ──\nfunction renderChat() {\n  const msgs = S.dados.chat || [];\n  const box = $('#chat-mensagens');\n  const estavaFim = box.scrollHeight - box.scrollTop - box.clientHeight < 80;\n  box.innerHTML = msgs.length ? msgs.map((m) => {\n    const minha = S.eu && m.de === S.eu.login;\n    return `<div class=\"msg ${minha ? 'minha' : ''}\">\n      <div class=\"msg-topo\"><strong>${escapeHtml(m.nome || m.de)}</strong><small>${escapeHtml(m.cargo || '')} · ${tempoRel(m.em)}</small></div>\n      <p>${escapeHtml(m.texto)}</p>\n    </div>`;\n  }).join('') : '<div class=\"vazio\">Nenhuma mensagem ainda. Diga oi 👋</div>';\n  if (estavaFim) box.scrollTop = box.scrollHeight;\n}\nfunction rolarChat() {\n  const box = $('#chat-mensagens');\n  if (box) box.scrollTop = box.scrollHeight;\n}\n$('#form-chat').addEventListener('submit', async (ev) => {\n  ev.preventDefault();\n  const input = $('#chat-input');\n  const texto = input.value.trim();\n  if (!texto) return;\n  input.value = '';\n  try { await api('POST', '/chat', { texto }); await carregar(); rolarChat(); }\n  catch (e) { flutuante(e.message, 'erro'); }\n});\n\n// ── auditoria ──\nfunction renderAuditoria() {\n  const logs = S.dados.audit || [];\n  $('#lista-auditoria').innerHTML = logs.length ? `\n    <table><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>\n    ${logs.map((l) => `<tr>\n      <td class=\"login-suave\">${dataBR(l.em)}</td>\n      <td>@${escapeHtml(l.feitorPor)}</td>\n      <td><span class=\"badge azul\">${escapeHtml(l.acao)}</span></td>\n      <td class=\"login-suave\">${escapeHtml(l.detalhe)}</td>\n    </tr>`).join('')}</tbody></table>`\n    : '<div class=\"vazio\">Sem registros.</div>';\n}\n\n// ── perfil ──\nfunction renderPerfil() {\n  if (!S.eu) return;\n  $('#perfil-nome').value = S.eu.nome || '';\n  $('#perfil-recado').value = S.eu.recado || '';\n  const img = $('#perfil-foto-img');\n  if (S.eu.foto) { img.src = S.eu.foto; img.classList.remove('hidden'); $('#perfil-sem-foto').classList.add('hidden'); }\n  else { img.classList.add('hidden'); $('#perfil-sem-foto').classList.remove('hidden'); }\n  renderPontos();\n}\n\n$('#perfil-foto').addEventListener('change', (ev) => {\n  const file = ev.target.files[0];\n  if (!file) return;\n  if (file.size > 600000) return flutuante('Foto muito grande (máx 600KB).', 'erro');\n  const reader = new FileReader();\n  reader.onload = () => { $('#perfil-foto-img').src = reader.result; $('#perfil-foto-img').classList.remove('hidden'); $('#perfil-sem-foto').classList.add('hidden'); };\n  reader.readAsDataURL(file);\n});\n\n$('#form-perfil').addEventListener('submit', async (ev) => {\n  ev.preventDefault();\n  const src = $('#perfil-foto-img').src;\n  const novaFoto = src && src.startsWith('data:') ? src : undefined;\n  const corpo = { nome: $('#perfil-nome').value, recado: $('#perfil-recado').value };\n  if (novaFoto) corpo.foto = novaFoto;\n  try {\n    const r = await api('PUT', '/me/perfil', corpo);\n    S.eu = r.user;\n    await carregar();\n    flutuante('Perfil atualizado.');\n  } catch (e) { flutuante(e.message, 'erro'); }\n});\n\n$('#btn-remover-foto').addEventListener('click', async () => {\n  try {\n    const r = await api('PUT', '/me/perfil', { foto: '' });\n    S.eu = r.user;\n    await carregar();\n    flutuante('Foto removida.');\n  } catch (e) { flutuante(e.message, 'erro'); }\n});\n\n$('#form-senha').addEventListener('submit', async (ev) => {\n  ev.preventDefault();\n  if ($('#senha-nova').value !== $('#senha-conf').value) return flutuante('As senhas não batem.', 'erro');\n  try {\n    await api('PUT', '/me/senha', { atual: $('#senha-atual').value, nova: $('#senha-nova').value });\n    $('#form-senha').reset();\n    flutuante('Senha alterada.');\n  } catch (e) { flutuante(e.message, 'erro'); }\n});\n\n// ── admin / backup ──\nfunction renderAdmin() {\n  if (!S.dados) return;\n  const d = S.dados;\n  if (S.dados.config) {\n    const cn = $('#cfg-nome'), cc = $('#cfg-corp');\n    if (cn && document.activeElement !== cn) cn.value = S.dados.config.nomeSistema || '';\n    if (cc && document.activeElement !== cc) cc.value = S.dados.config.nomeCorporacao || '';\n  }\n  $('#admin-info').innerHTML = `\n    ${escapeHtml(d.config.nomeSistema || 'SIGP')} — ${escapeHtml(d.config.nomeCorporacao || '')}<br>\n    ${d.users.length} usuários · ${d.ocorrencias.length} ocorrências · ${d.pontos.length} lançamentos de pontos<br>\n    Seu nível de acesso: <strong>${d.meuNivel}</strong> (${escapeHtml(S.eu ? S.eu.cargo : '')})`;\n}\n\nconst formCfg = $('#form-config');\nif (formCfg) formCfg.addEventListener('submit', async (ev) => {\n  ev.preventDefault();\n  try {\n    await api('PUT', '/config', { nomeSistema: $('#cfg-nome').value, nomeCorporacao: $('#cfg-corp').value });\n    await carregar();\n    flutuante('Configuração salva.');\n  } catch (e) { flutuante(e.message, 'erro'); }\n});\n\n$('#btn-backup').addEventListener('click', async () => {\n  try {\n    const r = await api('GET', '/backup');\n    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });\n    const a = document.createElement('a');\n    a.href = URL.createObjectURL(blob);\n    a.download = 'backup-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';\n    a.click();\n    URL.revokeObjectURL(a.href);\n    flutuante('Backup baixado.');\n  } catch (e) { flutuante(e.message, 'erro'); }\n});\n\n$('#in-restore').addEventListener('change', async (ev) => {\n  const file = ev.target.files[0];\n  if (!file) return;\n  if (!confirm('Restaurar este backup? Os dados atuais serão substituídos.')) { ev.target.value = ''; return; }\n  try {\n    const texto = await file.text();\n    const dados = JSON.parse(texto);\n    await api('POST', '/restore', { dados });\n    await carregar();\n    flutuante('Backup restaurado.');\n  } catch (e) { flutuante('Falha ao restaurar: ' + e.message, 'erro'); }\n  ev.target.value = '';\n});\n\n// ── notificações ──\nfunction renderNotifBadge() {\n  const naoLidas = (S.dados.notificacoes || []).filter((n) => !n.lida).length;\n  const b = $('#notif-badge');\n  b.textContent = naoLidas;\n  b.classList.toggle('hidden', naoLidas === 0);\n}\n\n$('#btn-notif').addEventListener('click', async () => {\n  const ns = (S.dados.notificacoes || []);\n  abrirModal('Notificações', ns.length ? ns.map((n) => `\n    <div class=\"notif-item\">\n      <strong>${escapeHtml(n.titulo)}</strong>\n      <small>${dataBR(n.em)}</small>\n      <p>${escapeHtml(n.texto)}</p>\n    </div>`).join('') : '<div class=\"vazio\">Nada por aqui.</div>');\n  try { await api('POST', '/notificacoes/ler'); await carregar(); } catch (_) {}\n});\n\n// ── atualização automática ──\nlet polling = null;\nfunction iniciarPolling() {\n  clearInterval(polling);\n  polling = setInterval(async () => {\n    if (!S.token || document.hidden) return;\n    try {\n      await carregar();\n    } catch (_) {}\n  }, 10000);\n}\n\n// ── boot ──\n(async function boot() {\n  if (!S.token) return;\n  try {\n    const r = await api('GET', '/me');\n    S.eu = r.user;\n    await entrar();\n  } catch (_) { sairLocal(); }\n})();\n"}};

function serveEstatico(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (!ASSETS[rel]) rel = '/index.html';
  const a = ASSETS[rel];
  res.writeHead(200, { 'Content-Type': a.t, 'Cache-Control': 'no-cache' });
  res.end(a.b);
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

(async () => {
  await loadDB();
  await seed();
  server.listen(PORT, () => {
    console.log('\n  SIGP online na porta ' + PORT + (SUPA_ON ? ' | banco: Supabase' : ' | banco: arquivo local'));
    console.log('  Login inicial: admin / admin123  (troque a senha depois)\n');
  });
})();
