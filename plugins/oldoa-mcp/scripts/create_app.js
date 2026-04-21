#!/usr/bin/env node
/**
 * oldoa-mcp — 一键完成全部首次配置
 *
 * [1] 登录 → [2] 创建应用 → [3] 查 appId → [4] 提取 APP_KEY/SECRET → 写 .env
 * [5] 打开浏览器做 OAuth 授权 → [6] 粘 code → 换 access_token → 写 .secrets.json
 *
 * 明文密码只在内存里使用，不落盘不打日志。
 */
'use strict';

// 依赖检查
const [nodeMajor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 18) {
  console.error(`需要 Node.js 18+，当前版本 ${process.version}，请升级后重试`);
  process.exit(1);
}
const { execSync } = require('child_process');
try {
  execSync('python3 -c "import mcp"', { stdio: 'ignore' });
} catch (e) {
  console.error('缺少 Python 依赖，请先运行：pip3 install \'mcp[cli]>=1.0.0\'');
  process.exit(1);
}

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const os = require('os');
const https = require('https');
const readline = require('readline');
const { spawn } = require('child_process');

// 明道前端 login bundle 里提取的 RSA-1024 公钥（和 hap-mcp 同一把）
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC1xzCYtdu8bZEinh6Oh7/p+6xc
ilHgV/ChU3bZXyezLQqf6mzOnLH6GVZMMDafMw3uMtljWyECCqnECy2UhZPa5BFc
qA2xbYH8/WyKTraCRJT3Hn61UrI4Eac4YVxa1CJ8KaTQtIeZBoXHIW0r5XyhBwYe
NkSun+OFN+YBoJvCXwIDAQAB
-----END PUBLIC KEY-----`;

const CONFIG_DIR = process.env.OLDOA_CONFIG_DIR
  ? path.resolve(process.env.OLDOA_CONFIG_DIR.replace(/^~/, os.homedir()))
  : path.join(os.homedir(), '.config', 'oldoa');
const ENV_FILE = path.join(CONFIG_DIR, '.env');
const SECRETS_FILE = path.join(CONFIG_DIR, '.secrets.json');

const DEFAULT_CATEGORY_ID = '1216f3e7-ace7-4ca5-81dc-a390425276c5';
const DEFAULT_CALLBACK_URL = 'http://localhost:9487/callback';
const DEFAULT_APP_NAME = 'Claude';  // 最多 10 字符，脚本自动加短后缀保证唯一
const MINGDAO_API = 'https://api.mingdao.com';
// 明道访问数据字段：1=通讯录 2=消息 3=动态 4=任务 5=日程 6=知识 7=审批 8=考勤
const ALL_MODULES = ',1,2,3,4,5,6,7,8,';

// ── ANSI colors ─────────────────────────────────────────────────────────────
const c = {
  bold: s => `\x1b[1m${s}\x1b[0m`,
  dim:  s => `\x1b[2m${s}\x1b[0m`,
  green:s => `\x1b[32m${s}\x1b[0m`,
  red:  s => `\x1b[31m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
  yellow:s => `\x1b[33m${s}\x1b[0m`,
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function encrypt(plaintext) {
  return crypto.publicEncrypt(
    { key: PUBLIC_KEY, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(plaintext, 'utf-8')
  ).toString('base64');
}

function askVisible(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(prompt, a => { rl.close(); r(a); }));
}

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('', a => { rl.close(); resolve(a); });
      return;
    }
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    let pw = '';
    const onData = ch => {
      if (ch === '\u0003') {
        process.stdout.write('\n');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        reject(new Error('Cancelled'));
      } else if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        process.stdout.write('\n');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        resolve(pw);
      } else if (ch === '\u007f' || ch === '\b') {
        if (pw.length) pw = pw.slice(0, -1);
      } else {
        pw += ch;
      }
    };
    process.stdin.on('data', onData);
  });
}

function httpRequest({ method = 'GET', url, headers = {}, body = null }) {
  const u = new URL(url);
  const opts = {
    method,
    hostname: u.hostname,
    path: u.pathname + u.search,
    headers: { ...headers },
  };
  if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf-8'),
      }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd, args;
  if (platform === 'darwin') { cmd = 'open'; args = [url]; }
  else if (platform === 'win32') { cmd = 'cmd'; args = ['/c', 'start', '', url]; }
  else { cmd = 'xdg-open'; args = [url]; }
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch (e) {
    return false;
  }
}

function waitForCallbackCode(callbackUrl, timeoutMs = 120000) {
  let port, pathname;
  try {
    const u = new URL(callbackUrl);
    port = parseInt(u.port || (u.protocol === 'https:' ? 443 : 80), 10);
    pathname = u.pathname;
  } catch (e) {
    throw new Error(`无法解析回调 URL: ${callbackUrl}`);
  }
  if (port < 1024) throw new Error('端口 < 1024，需要 root');

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('等待授权超时（2 分钟）'));
    }, timeoutMs);

    const server = http.createServer((req, res) => {
      const reqPath = req.url.split('?')[0];
      if (reqPath !== pathname) { res.writeHead(404); res.end(); return; }
      const code = new URL(req.url, callbackUrl).searchParams.get('code');
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px">'
          + '<h2>✅ 授权成功</h2><p>可以关闭此页面，返回终端。</p></body></html>');
        clearTimeout(timer);
        server.close();
        resolve(code);
      } else {
        res.writeHead(400); res.end('missing code');
      }
    });
    server.on('error', e => { clearTimeout(timer); reject(e); });
    server.listen(port, '127.0.0.1');
  });
}

function extractCode(input) {
  const s = input.trim();
  if (!s) return '';
  if (s.startsWith('http')) {
    try {
      const u = new URL(s);
      return u.searchParams.get('code') || '';
    } catch (e) { return ''; }
  }
  // 也兼容用户粘 "?code=xxx" 或 "code=xxx"
  const m = s.match(/(?:[?&])?code=([^&\s]+)/);
  if (m) return m[1];
  return s;
}

// ── API wrappers ────────────────────────────────────────────────────────────
async function login(account, password) {
  const body = JSON.stringify({
    account: encrypt(account),
    password: encrypt(password),
    isCookie: false,
    captchaType: 0,
  });
  const res = await httpRequest({
    method: 'POST',
    url: 'https://www.mingdao.com/api/Login/MDAccountLogin',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  let json;
  try { json = JSON.parse(res.body); } catch (e) { throw new Error(`Login 响应不是 JSON: ${res.body.slice(0, 200)}`); }
  if (!json?.data?.sessionId) throw new Error(`登录失败: ${JSON.stringify(json).slice(0, 300)}`);
  return json.data.sessionId;
}

async function createApp({ sessionId, appName, callbackUrl }) {
  const fields = {
    AppName: appName,
    AppAbout: `${appName} - created by Claude Code plugin`,
    AppDes: `Mingdao open platform app for oldoa-mcp (post + calendar). App name: ${appName}`,
    IsPersonal: '1', AppCategoryID: DEFAULT_CATEGORY_ID,
    IsPrivate: '1',  // 私有应用（只在开发者所在的网络可见，提交发布后立即可用，不需审核）
    AppUrl: '', IsFree: '1', PricingType: '0', PricingMark: '',
    NoticeUrl: '', SettingUrl: '', CalBackUrl: callbackUrl,
    IosAppid: '', AndroidDownurl: '', AndroidPackage: '', AndroidActivity: '',
    Avatar: '', AppType: '1', ImgList: '', Video_url: '', IsWeb: '1',
    SubscibeUrl: '', appCode: '', appmdConnect: '', appCompanyName: '',
    appContact: '', appEmail: '', urlscheme: '', H5Url: '',
    modules: ALL_MODULES,  // 访问数据字段全选
    webhook_url: '', ProjectID: '',
  };
  const body = new URLSearchParams(fields).toString();
  const res = await httpRequest({
    method: 'POST',
    url: 'https://open.mingdao.com/AppAjax/ApplyApp',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': `md_pss_id=${sessionId}`,
      'Referer': 'https://open.mingdao.com/App/Add',
    },
    body,
  });
  let json;
  try { json = JSON.parse(res.body); } catch (e) { throw new Error(`ApplyApp 响应不是 JSON: ${res.body.slice(0, 200)}`); }
  if (json?.result !== '1' && json?.result !== 1) {
    throw new Error(`ApplyApp 失败: ${JSON.stringify(json).slice(0, 300)}`);
  }
}

async function enableTestMode(sessionId, appId) {
  const ts = Date.now();
  const res = await httpRequest({
    method: 'GET',
    url: `https://open.mingdao.com/AppAjax/UpdateAppStatus?appID=${appId}&status=6&_=${ts}`,
    headers: {
      'Cookie': `md_pss_id=${sessionId}`,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Referer': `https://open.mingdao.com/App/${appId}`,
    },
  });
  if (res.status !== 200) throw new Error(`UpdateAppStatus(test) 失败 status=${res.status}: ${res.body.slice(0, 200)}`);
}

async function installApp(sessionId, appId) {
  const body = `appid=${encodeURIComponent(appId)}`;
  const res = await httpRequest({
    method: 'POST',
    url: 'https://app.mingdao.com/App/Install?format=json',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': `md_pss_id=${sessionId}`,
      'Referer': `https://app.mingdao.com/?appID=${appId}`,
    },
    body,
  });
  let json;
  try { json = JSON.parse(res.body); } catch (e) { throw new Error(`App/Install 响应不是 JSON: ${res.body.slice(0, 200)}`); }
  if (!json?.result) throw new Error(`App/Install 失败: ${JSON.stringify(json).slice(0, 300)}`);
}

async function findAppByName(sessionId, appName) {
  const res = await httpRequest({
    method: 'GET',
    url: 'https://open.mingdao.com/AppAjax/GetMyAppList?pIndex=1&pSize=50&pSort=0',
    headers: {
      'Cookie': `md_pss_id=${sessionId}`,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
    },
  });
  let data;
  try {
    let parsed = JSON.parse(res.body);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    data = parsed;
  } catch (e) { throw new Error(`GetMyAppList 响应不是 JSON: ${res.body.slice(0, 200)}`); }
  const apps = data.appList || [];
  const hit = apps.find(a => a.AppName === appName);
  if (!hit) throw new Error(`无法在应用列表里找到 "${appName}"（账号下共 ${apps.length} 个应用）`);
  return hit.AppID;
}

async function fetchAppKeys(sessionId, appId) {
  const res = await httpRequest({
    method: 'GET',
    url: `https://open.mingdao.com/App/${appId}`,
    headers: { 'Cookie': `md_pss_id=${sessionId}` },
  });
  const keyMatch = res.body.match(/id="txt_appConsumerKey"[^>]*value="([^"]+)"/);
  const secMatch = res.body.match(/id="txt_appConsumerSecret"[^>]*value="([^"]+)"/);
  if (!keyMatch || !secMatch) throw new Error('无法从应用详情页提取 APP_KEY / APP_SECRET');
  return { appKey: keyMatch[1], appSecret: secMatch[1] };
}

async function exchangeCode({ appKey, appSecret, redirectUri, code }) {
  const params = new URLSearchParams({
    app_key: appKey, app_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri, code, format: 'json',
  });
  const res = await httpRequest({
    method: 'GET',
    url: `${MINGDAO_API}/oauth2/access_token?${params.toString()}`,
  });
  let json;
  try { json = JSON.parse(res.body); } catch (e) { throw new Error(`access_token 响应不是 JSON: ${res.body.slice(0, 200)}`); }
  if (!json?.success || !json?.access_token) {
    throw new Error(`换取 access_token 失败: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

function writeEnv({ appKey, appSecret, callbackUrl }) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const content = `# oldoa-mcp credentials — generated by create_app.js on ${new Date().toISOString()}\n`
    + `MINGDAO_APP_KEY=${appKey}\n`
    + `MINGDAO_APP_SECRET=${appSecret}\n`
    + `MINGDAO_REDIRECT_URI=${callbackUrl}\n`;
  fs.writeFileSync(ENV_FILE, content, { mode: 0o600 });
}

function parseEnvFile(path) {
  if (!fs.existsSync(path)) return null;
  const out = {};
  for (const line of fs.readFileSync(path, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function writeSecrets({ appKey, appSecret, redirectUri, resp }) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = parseInt(resp.expires_in || 0, 10) || 0;
  const data = {
    app_key: appKey,
    app_secret: appSecret,
    redirect_uri: redirectUri,
    access_token: resp.access_token,
    refresh_token: resp.refresh_token || '',
    expires_in: resp.expires_in || '',
    issued_at: now,
    expires_at: now + expiresIn,
  };
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

const PLUGIN_NAME = 'oldoa-mcp';
const PLUGIN_VERSION = '1.3.1';
const PLUGIN_KEY = '249b8cb4-67a6-4a27-82d0-463f5b603709';

// ---- 错误上报（公开表单，经用户确认后提交）----
async function reportError(step, errorMsg) {
  if (!process.stdin.isTTY) return;
  const sanitize = s => String(s)
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '***@***.***')
    .replace(/1[3-9]\d{9}/g, '1**********')
    .replace(/[0-9a-f]{32,}/gi, '[REDACTED]')
    .replace(new RegExp(os.homedir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '~');
  const cleanMsg = sanitize(errorMsg);
  let osVer = 'unknown', aiVer = 'unknown';
  try { osVer = process.platform === 'darwin' ? execSync('sw_vers -productVersion', { timeout: 2000 }).toString().trim() : `${os.type()} ${os.release()}`; } catch {}
  try { aiVer = execSync('claude --version', { timeout: 2000 }).toString().trim().split('\n')[0]; } catch {}
  const osLabel = { darwin: 'macOS', linux: 'Linux', win32: 'Windows' }[process.platform] || process.platform;
  const DIM = s => `\x1b[2m${s}\x1b[0m`, YELLOW = s => `\x1b[33m${s}\x1b[0m`;
  console.log('');
  console.log(YELLOW('  是否提交错误报告帮助改进插件？（不包含账号密码）'));
  console.log(DIM(`  将上报：插件名=${PLUGIN_NAME}  版本=${PLUGIN_VERSION}  系统=${osLabel} ${osVer}  AI=${aiVer}`));
  console.log(DIM(`  报错内容：${cleanMsg}`));
  process.stdout.write('  [y/N] > ');
  const answer = await new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', a => { rl.close(); resolve(a.trim()); });
  });
  if (answer.toLowerCase() !== 'y') { console.log(DIM('  已跳过')); return; }
  const body = JSON.stringify({ worksheetId: '69e7045f9513a27f83d3ccbd', receiveControls: [
    { controlId: '69e7045ff93dd47d496c0ece', type: 2, value: `${PLUGIN_NAME} 安装报错：${step}`, controlName: '标题', dot: 0 },
    { controlId: '69e7045ff93dd47d496c0ecf', type: 9, value: JSON.stringify([PLUGIN_KEY]), controlName: '插件名', dot: 0 },
    { controlId: '69e7045ff93dd47d496c0ed0', type: 2, value: PLUGIN_VERSION, controlName: '版本号', dot: 0 },
    { controlId: '69e7045ff93dd47d496c0ed1', type: 2, value: step, controlName: '步骤', dot: 0 },
    { controlId: '69e7045ff93dd47d496c0ed2', type: 2, value: cleanMsg, controlName: '报错内容', dot: 0 },
    { controlId: '69e7045ff93dd47d496c0ed3', type: 9, value: JSON.stringify([process.platform === 'darwin' ? '2970e8ef-1a7c-4060-b97b-12221ed8919c' : '3ed18664-4e5d-4ff7-9356-3f323d147d21']), controlName: '操作系统', dot: 0 },
    { controlId: '69e7045ff93dd47d496c0ed4', type: 9, value: JSON.stringify(['2c33893a-bbe3-4c18-b678-a847e7e8a43a']), controlName: '类型', dot: 0 },
    { controlId: '69e7063a9513a27f83d3cd09', type: 2, value: aiVer, controlName: 'AI版本', dot: 0 },
    { controlId: '69e7063a9513a27f83d3cd0a', type: 2, value: osVer, controlName: '系统版本', dot: 0 },
  ]});
  await new Promise(resolve => {
    const req = https.request({ hostname: 'www.mingdao.com', path: '/api/PublicWorksheet/AddRow', method: 'POST', timeout: 5000,
      headers: { 'content-type': 'application/json', 'authorization': '', 'clientid': '05a01d0920df02d09d0d10970140db06c0660bb07d0a20a0', 'origin': 'https://d557778d685be9b5.share.mingdao.net', 'x-requested-with': 'XMLHttpRequest' }
    }, () => resolve());
    req.on('error', () => resolve()); req.on('timeout', () => { req.destroy(); resolve(); });
    req.write(body); req.end();
  });
  console.log(DIM('  ✔ 已提交，感谢反馈'));
}
// ---- end reportError ----

// ── CLI arg parsing ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--account' || a === '-u') && argv[i + 1]) { args.account = argv[++i]; }
    else if ((a === '--password' || a === '-p') && argv[i + 1]) { args.password = argv[++i]; }
    else if (a === '--oauth') { args.forceOauth = true; }
    else if (a === '--new') { args.forceNew = true; }
    else if ((a === '--app-name') && argv[i + 1]) { args.appName = argv[++i]; }
  }
  return args;
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const cliArgs = parseArgs(process.argv.slice(2));
  const nonInteractive = !!(cliArgs.account && cliArgs.password);

  console.log('');
  console.log(c.bold(c.cyan('◆ oldoa-mcp — 一键完成全部配置')));
  console.log(c.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('流程：登录 → 建应用 → 拉 APP_KEY/SECRET → 开启测试模式 → 浏览器授权 → 存 access_token');
  console.log(c.dim('明文密码只在内存里使用，不落盘不打日志。\n'));

  // 检测已有凭据 → 提供三种模式
  const existingEnv = parseEnvFile(ENV_FILE);
  const hasValidEnv = existingEnv
    && existingEnv.MINGDAO_APP_KEY
    && existingEnv.MINGDAO_APP_SECRET
    && existingEnv.MINGDAO_REDIRECT_URI;
  const hasSecrets = fs.existsSync(SECRETS_FILE);

  let mode = 'full';   // full | oauth-only
  if (cliArgs.forceOauth) {
    mode = 'oauth-only';
  } else if (cliArgs.forceNew) {
    mode = 'full';
  } else if (hasValidEnv) {
    console.log(c.dim(`检测到已有应用配置：${ENV_FILE}`));
    console.log(c.dim(`  APP_KEY:  ${existingEnv.MINGDAO_APP_KEY}`));
    console.log(c.dim(`  Callback: ${existingEnv.MINGDAO_REDIRECT_URI}`));
    if (hasSecrets) console.log(c.dim(`  已有 access_token，重跑 OAuth 即可续期`));
    console.log('');

    if (nonInteractive) {
      // 非交互模式：有 .secrets.json 就只跑 OAuth，否则新建
      mode = hasSecrets ? 'oauth-only' : 'full';
      console.log(c.dim(`非交互模式，自动选择：${mode === 'oauth-only' ? '只跑 OAuth 续期' : '新建应用'}`));
    } else if (hasSecrets) {
      // 已授权过：默认复用，选 n 才重建应用
      const ans = (await askVisible(c.yellow(
        '选择操作：\n'
        + '  [Enter/o] 只跑 OAuth 授权（续期 token，用现有 APP_KEY）\n'
        + '  [n]       新建应用 + 跑完整流程（会覆盖 .env 和 .secrets.json）\n'
        + '  [q]       取消退出\n'
        + '请选择 [O/n/q]: '
      ))).trim().toLowerCase();
      if (ans === 'q') { console.log('已取消。'); process.exit(0); }
      if (ans === 'n') { mode = 'full'; }
      else { mode = 'oauth-only'; }
    } else {
      // 有 .env 但没授权过：默认新建，选 o 复用
      const ans = (await askVisible(c.yellow(
        '选择操作：\n'
        + '  [Enter/n] 新建应用 + 跑完整流程（会覆盖 .env 和 .secrets.json）\n'
        + '  [o]       跳过建应用，只跑 OAuth 授权（用现有 APP_KEY）\n'
        + '  [q]       取消退出\n'
        + '请选择 [N/o/q]: '
      ))).trim().toLowerCase();
      if (ans === 'q') { console.log('已取消。'); process.exit(0); }
      if (ans === 'o') { mode = 'oauth-only'; }
      else { mode = 'full'; }
    }
  }

  let sessionId, appId, appKey, appSecret, callbackUrl, account, password, appName;

  if (mode === 'full') {
    try {
      if (nonInteractive) {
        account = cliArgs.account;
        password = cliArgs.password;
        const suggested = cliArgs.appName || `${DEFAULT_APP_NAME}-${Date.now().toString(36).slice(-3)}`;
        appName = suggested;
        callbackUrl = DEFAULT_CALLBACK_URL;
        console.log(c.dim(`非交互模式：账号=${account}，应用名=${appName}，回调=${callbackUrl}`));
      } else {
        account = (await askVisible('明道账号（手机/邮箱）: ')).trim();
        password = await askHidden('明道密码（不回显）: ');
        const suggested = `${DEFAULT_APP_NAME}-${Date.now().toString(36).slice(-3)}`;
        appName = (await askVisible(`应用名称（2-10字符）[默认: ${suggested}]: `)).trim() || suggested;
        if (appName.length < 2 || appName.length > 10) {
          console.log(c.red(`应用名称必须 2-10 字符（当前 ${appName.length}）`));
          process.exit(1);
        }
        callbackUrl = (await askVisible(`OAuth 回调 URL [默认: ${DEFAULT_CALLBACK_URL}]: `)).trim() || DEFAULT_CALLBACK_URL;
      }
    } catch (e) {
      console.log(c.red('\n已取消。'));
      process.exit(1);
    }
    if (!account || !password) { console.log(c.red('账号或密码为空。')); process.exit(1); }

    try {
      process.stdout.write(c.dim('[1/7] 登录 mingdao.com ...'));
      sessionId = await login(account, password);
      process.stdout.write(`\r${c.green('[1/7] ✔')} 登录成功${' '.repeat(40)}\n`);

      process.stdout.write(c.dim('[2/7] 创建应用（私有 + 全模块权限）...'));
      await createApp({ sessionId, appName, callbackUrl });
      process.stdout.write(`\r${c.green('[2/7] ✔')} 应用已创建 ${c.dim(`"${appName}"`)}${' '.repeat(15)}\n`);

      process.stdout.write(c.dim('[3/7] 查询应用 ID ...'));
      appId = await findAppByName(sessionId, appName);
      process.stdout.write(`\r${c.green('[3/7] ✔')} ${c.dim(`appId: ${appId}`)}${' '.repeat(20)}\n`);

      process.stdout.write(c.dim('[4/7] 提取 APP_KEY / APP_SECRET ...'));
      ({ appKey, appSecret } = await fetchAppKeys(sessionId, appId));
      writeEnv({ appKey, appSecret, callbackUrl });
      process.stdout.write(`\r${c.green('[4/7] ✔')} 凭据写入 ${c.dim(ENV_FILE)}${' '.repeat(5)}\n`);

      process.stdout.write(c.dim('[5/8] 启用测试模式 ...'));
      await enableTestMode(sessionId, appId);
      process.stdout.write(`\r${c.green('[5/8] ✔')} 测试模式已开启${' '.repeat(20)}\n`);

      process.stdout.write(c.dim('[6/8] 安装应用到当前账号 ...'));
      await installApp(sessionId, appId);
      process.stdout.write(`\r${c.green('[6/8] ✔')} 应用已安装${' '.repeat(30)}\n`);
    } catch (e) {
      console.log('');
      console.log(c.red(`✘ ${e.message}`));
      console.log(c.dim('\n登录失败：确认账号密码正确；触发验证码请先去网页登一次。'));
      process.exit(2);
    }
  } else {
    // oauth-only: 复用现有 .env
    appKey = existingEnv.MINGDAO_APP_KEY;
    appSecret = existingEnv.MINGDAO_APP_SECRET;
    callbackUrl = existingEnv.MINGDAO_REDIRECT_URI;
    console.log(c.green('✔ 复用现有 .env，跳过 [1/8]–[6/8]'));
    console.log('');
  }

  // ── OAuth ────────────────────────────────────────────────────────────
  const authUrl = `${MINGDAO_API}/oauth2/authorize?` + new URLSearchParams({
    app_key: appKey, redirect_uri: callbackUrl, state: 'mcp-auth',
  }).toString();

  console.log('');
  console.log(c.dim('[7/8] 浏览器授权'));

  // 优先启动本地回调服务器自动捕获 code
  let code;
  let autoCapture = false;
  let codePromise;
  try {
    codePromise = waitForCallbackCode(callbackUrl);
    autoCapture = true;
  } catch (e) {
    // 端口 < 1024 等情况，回退到手动粘贴
  }

  const opened = openBrowser(authUrl);
  if (!opened) console.log(c.dim('  无法自动打开浏览器，请手动访问：'));
  console.log('  ' + c.cyan(authUrl));
  console.log('');
  console.log('  浏览器里：登录 → 点 ' + c.bold('"同意授权"') + ' → 页面显示"授权成功"即可');
  console.log('');

  if (autoCapture) {
    process.stdout.write(c.dim('  等待浏览器回调...'));
    try {
      code = await codePromise;
      process.stdout.write(`\r${c.green('  ✔ 已自动捕获 code')}${' '.repeat(20)}\n`);
    } catch (e) {
      process.stdout.write('\n');
      console.log(c.yellow(`  自动捕获失败（${e.message}），切换为手动粘贴`));
      autoCapture = false;
    }
  }

  if (!autoCapture) {
    try {
      const raw = await askVisible(c.bold('粘贴 code（支持直接粘整个 URL）: '));
      code = extractCode(raw);
    } catch (e) {
      console.log(c.red('已取消。'));
      process.exit(1);
    }
    if (!code) { console.log(c.red('code 解析为空，请重试。')); process.exit(1); }
  }

  try {
    process.stdout.write(c.dim('[8/8] 换取 access_token ...'));
    const resp = await exchangeCode({ appKey, appSecret, redirectUri: callbackUrl, code });
    writeSecrets({ appKey, appSecret, redirectUri: callbackUrl, resp });
    const expMin = Math.round((parseInt(resp.expires_in || 0, 10) || 0) / 60);
    process.stdout.write(`\r${c.green('[8/8] ✔')} access_token 已保存 ${c.dim(`(${expMin} 分钟有效，自动 refresh)`)}${' '.repeat(5)}\n`);
  } catch (e) {
    console.log('');
    console.log(c.red(`✘ ${e.message}`));
    console.log(c.dim('\ncode 可能过期（每个 code 只用一次，几分钟内有效）。'));
    console.log(c.dim('重试 OAuth：python3 -m oldoa.server authorize-url && python3 -m oldoa.server exchange-code <code>'));
    process.exit(2);
  }

  console.log('');
  console.log(c.bold(c.green('🎉 oldoa-mcp 全部就绪')));
  console.log('');
  console.log('应用信息：');
  if (appName) console.log(`  ${c.dim('Name:       ')}${appName}`);
  if (appId)   console.log(`  ${c.dim('App ID:     ')}${appId}`);
  console.log(`  ${c.dim('APP_KEY:    ')}${appKey}`);
  console.log(`  ${c.dim('APP_SECRET: ')}${appSecret.slice(0, 6)}${c.dim('...（写入 .env，不回显）')}`);
  console.log(`  ${c.dim('Callback:   ')}${callbackUrl}`);
  console.log('');
  console.log('配置文件：');
  console.log(`  ${c.dim(ENV_FILE)}`);
  console.log(`  ${c.dim(SECRETS_FILE)}`);
  console.log('');
  console.log(c.bold('直接启动 Claude Code，oldoa MCP 就能用了。'));
  console.log('');

  // ── 自检：发动态 → 查详情 → 删动态 ────────────────────────────────
  console.log(c.dim('── 自检 ──────────────────────────────────────────'));
  const secrets = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
  const token = secrets.access_token;

  async function apiPost(endpoint, params) {
    const body = new URLSearchParams({ ...params, access_token: token, format: 'json' }).toString();
    const res = await httpRequest({
      method: 'POST',
      url: `${MINGDAO_API}${endpoint}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return JSON.parse(res.body);
  }

  async function apiGet(endpoint, params) {
    const qs = new URLSearchParams({ ...params, access_token: token, format: 'json' }).toString();
    const res = await httpRequest({ method: 'GET', url: `${MINGDAO_API}${endpoint}?${qs}` });
    return JSON.parse(res.body);
  }

  try {
    process.stdout.write(c.dim('  [1/3] 发布测试动态 ...'));
    const addResp = await apiPost('/v1/post/add_post', {
      post_msg: '[oldoa-mcp 自检] 这条动态由安装脚本自动发出，随即会被删除。',
      post_type: 0,
    });
    if (!addResp?.data?.post_id) throw new Error(`add_post 失败: ${JSON.stringify(addResp)}`);
    const postId = addResp.data.post_id;
    process.stdout.write(`\r${c.green('  [1/3] ✔')} 动态已发布 ${c.dim(`post_id: ${postId}`)}\n`);

    process.stdout.write(c.dim('  [2/3] 查询动态详情 ...'));
    const detailResp = await apiGet('/v1/post/get_post_detail', { post_id: postId });
    if (!detailResp?.data?.post_id) throw new Error(`get_post_detail 失败: ${JSON.stringify(detailResp)}`);
    const acct = detailResp.data.account || {};
    const acctDesc = [acct.full_name, acct.profession, acct.email || acct.mobile_phone].filter(Boolean).join('  ');
    process.stdout.write(`\r${c.green('  [2/3] ✔')} 当前账户：${c.bold(acctDesc || '未知')}\n`);

    process.stdout.write(c.dim('  [3/3] 删除测试动态 ...'));
    const delResp = await apiPost('/v1/post/delete_post', { post_id: postId });
    if (!delResp?.success) throw new Error(`delete_post 失败: ${JSON.stringify(delResp)}`);
    process.stdout.write(`\r${c.green('  [3/3] ✔')} 动态已删除\n`);

    console.log('');
    console.log(c.bold(c.green('✅ 自检通过，oldoa MCP 可以正常使用。')));
  } catch (e) {
    console.log('');
    console.log(c.red(`✘ 自检失败：${e.message}`));
    console.log(c.dim('  MCP 已配置，但 API 调用异常，请检查 token 或权限。'));
  }
  console.log('');
})().catch(async e => {
  console.error(c.red('\n脚本异常：'), e);
  await reportError('未知异常', e.message || String(e));
  process.exit(1);
});
