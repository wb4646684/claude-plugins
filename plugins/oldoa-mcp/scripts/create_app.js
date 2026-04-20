#!/usr/bin/env node
/**
 * oldoa-mcp — 一键创建明道开放平台应用 + 写入 .env
 *
 * 用户输入 明道账号/密码/应用名 → 本地 RSA 加密 → 登录 → 创建应用 → 拉 APP_KEY/APP_SECRET →
 * 写入 ~/.config/oldoa/.env。省掉"手动去 open.mingdao.com 注册应用"的 2 分钟 + 抄凭据。
 *
 * 只在首次配置时跑。完事后可选继续跑 OAuth 授权流程 (python3 -m oldoa.server authorize-url)。
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const readline = require('readline');

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

// 「BI 商业智能」——mingdao 全局分类，对任何账号都可用
const DEFAULT_CATEGORY_ID = '1216f3e7-ace7-4ca5-81dc-a390425276c5';
const DEFAULT_CALLBACK_URL = 'http://localhost/callback';
const DEFAULT_APP_NAME = 'Claude-oldoa';

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
  if (body) {
    opts.headers['Content-Length'] = Buffer.byteLength(body);
  }
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf-8'),
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

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
  try { json = JSON.parse(res.body); } catch (e) { throw new Error(`Login response not JSON: ${res.body.slice(0, 200)}`); }
  if (!json?.data?.sessionId) {
    throw new Error(`Login failed: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.data.sessionId;
}

async function createApp({ sessionId, appName, callbackUrl }) {
  const fields = {
    AppName: appName,
    AppAbout: `${appName} - created by Claude Code plugin`,
    AppDes: `Mingdao open platform app for oldoa-mcp (post + calendar). App name: ${appName}`,
    IsPersonal: '1',
    AppCategoryID: DEFAULT_CATEGORY_ID,
    IsPrivate: '0',
    AppUrl: '',
    IsFree: '1',
    PricingType: '0',
    PricingMark: '',
    NoticeUrl: '',
    SettingUrl: '',
    CalBackUrl: callbackUrl,
    IosAppid: '',
    AndroidDownurl: '',
    AndroidPackage: '',
    AndroidActivity: '',
    Avatar: '',
    AppType: '1',
    ImgList: '',
    Video_url: '',
    IsWeb: '1',
    SubscibeUrl: '',
    appCode: '',
    appmdConnect: '',
    appCompanyName: '',
    appContact: '',
    appEmail: '',
    urlscheme: '',
    H5Url: '',
    modules: ',',
    webhook_url: '',
    ProjectID: '',
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
  try { json = JSON.parse(res.body); } catch (e) { throw new Error(`ApplyApp response not JSON: ${res.body.slice(0, 200)}`); }
  if (json?.result !== '1' && json?.result !== 1) {
    throw new Error(`ApplyApp failed: ${JSON.stringify(json).slice(0, 300)}`);
  }
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
  // 响应是双层 encode 的 JSON：外层 JSON 字符串里又嵌了一层 JSON
  let data;
  try {
    let parsed = JSON.parse(res.body);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    data = parsed;
  } catch (e) {
    throw new Error(`GetMyAppList 响应不是 JSON: ${res.body.slice(0, 200)}`);
  }
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
  if (!keyMatch || !secMatch) {
    throw new Error('无法从应用详情页提取 APP_KEY / APP_SECRET（页面结构可能已变）');
  }
  return { appKey: keyMatch[1], appSecret: secMatch[1] };
}

function writeEnv({ appKey, appSecret, callbackUrl }) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const content = `# oldoa-mcp credentials — generated by create_app.js on ${new Date().toISOString()}\n`
    + `MINGDAO_APP_KEY=${appKey}\n`
    + `MINGDAO_APP_SECRET=${appSecret}\n`
    + `MINGDAO_REDIRECT_URI=${callbackUrl}\n`;
  fs.writeFileSync(ENV_FILE, content, { mode: 0o600 });
  return ENV_FILE;
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  console.log('');
  console.log(c.bold(c.cyan('◆ oldoa-mcp — 自动创建明道开放平台应用')));
  console.log(c.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('输入你的明道账号，脚本自动完成：');
  console.log('  1. 本地 RSA 加密 → 登录 mingdao.com');
  console.log('  2. 在 open.mingdao.com 创建一个新应用');
  console.log('  3. 拉取 APP_KEY / APP_SECRET 写入 ~/.config/oldoa/.env');
  console.log(c.dim('\n密码只在内存里使用，不落盘不打日志。\n'));

  if (fs.existsSync(ENV_FILE)) {
    const ans = (await askVisible(c.yellow(`检测到 ${ENV_FILE} 已存在，继续会覆盖。继续？ [y/N] `))).trim().toLowerCase();
    if (ans !== 'y') { console.log('已取消。'); process.exit(0); }
  }

  let account, password, appName, callbackUrl;
  try {
    account = (await askVisible('明道账号（手机/邮箱）: ')).trim();
    password = await askHidden('明道密码（不回显）: ');
    const suggested = `${DEFAULT_APP_NAME}-${Date.now().toString(36)}`;
    appName = (await askVisible(`应用名称 [默认: ${suggested}]: `)).trim() || suggested;
    callbackUrl = (await askVisible(`OAuth 回调 URL [默认: ${DEFAULT_CALLBACK_URL}]: `)).trim() || DEFAULT_CALLBACK_URL;
  } catch (e) {
    console.log(c.red('\n已取消。'));
    process.exit(1);
  }
  if (!account || !password) {
    console.log(c.red('账号或密码为空。'));
    process.exit(1);
  }

  try {
    process.stdout.write(c.dim('[1/4] 登录 mingdao.com ...'));
    const sessionId = await login(account, password);
    process.stdout.write(`\r${c.green('[1/4] ✔')} 登录成功 ${c.dim(`sessionId: ${sessionId.slice(0, 12)}...`)}${' '.repeat(20)}\n`);

    process.stdout.write(c.dim('[2/4] 创建应用 ...'));
    await createApp({ sessionId, appName, callbackUrl });
    process.stdout.write(`\r${c.green('[2/4] ✔')} 应用已创建 ${c.dim(`"${appName}"`)}${' '.repeat(30)}\n`);

    process.stdout.write(c.dim('[3/4] 查询应用 ID ...'));
    const appId = await findAppByName(sessionId, appName);
    process.stdout.write(`\r${c.green('[3/4] ✔')} ${c.dim(`appId: ${appId}`)}${' '.repeat(30)}\n`);

    process.stdout.write(c.dim('[4/4] 提取 APP_KEY / APP_SECRET ...'));
    const { appKey, appSecret } = await fetchAppKeys(sessionId, appId);
    const envPath = writeEnv({ appKey, appSecret, callbackUrl });
    process.stdout.write(`\r${c.green('[4/4] ✔')} 凭据已写入 ${c.dim(envPath)}${' '.repeat(10)}\n`);

    console.log('');
    console.log(c.bold(c.green('✔ 全部完成')));
    console.log('');
    console.log('应用信息：');
    console.log(`  ${c.dim('Name:      ')}${appName}`);
    console.log(`  ${c.dim('App ID:    ')}${appId}`);
    console.log(`  ${c.dim('APP_KEY:   ')}${appKey}`);
    console.log(`  ${c.dim('APP_SECRET:')}${appSecret.slice(0, 6)}${c.dim('...（写入 .env，不回显）')}`);
    console.log(`  ${c.dim('Callback:  ')}${callbackUrl}`);
    console.log('');
    console.log(c.bold('下一步 — 完成 OAuth 授权拿 access_token：'));
    console.log('');
    console.log(c.dim('  export PYTHONPATH=$(find ~/.claude -name oldoa -type d -path "*/server/src/*" | head -1)'));
    console.log(c.dim('  export OLDOA_CONFIG_DIR=~/.config/oldoa'));
    console.log('  python3 -m oldoa.server authorize-url');
    console.log(c.dim('  # 浏览器打开输出的链接 → 点同意 → 从地址栏复制 code= 后面的值'));
    console.log('  python3 -m oldoa.server exchange-code <code>');
    console.log('');
  } catch (e) {
    console.log('');
    console.log(c.red(`✘ ${e.message}`));
    console.log(c.dim('\n如果是登录失败：确认账号密码正确；如触发验证码先去网页登录一次。'));
    console.log(c.dim('如果是 ApplyApp 失败：可能明道改了表单字段，请告诉插件作者。'));
    process.exit(2);
  }
})().catch(e => {
  console.error(c.red('\n脚本异常：'), e);
  process.exit(1);
});
