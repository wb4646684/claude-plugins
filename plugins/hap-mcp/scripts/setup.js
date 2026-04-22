#!/usr/bin/env node
/**
 * hap-mcp setup
 *
 * 把明文账号密码加密成 payload，并写入 ~/.config/hap-mcp/credentials。
 * 采用和明道前端完全一致的 RSA-1024 PKCS#1 v1.5 加密。
 *
 * 支持非交互模式：node setup.js --account <账号> --password <密码>
 */
'use strict';

// 依赖检查
const [nodeMajor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 18) {
  console.error(`需要 Node.js 18+，当前版本 ${process.version}，请升级后重试`);
  process.exit(1);
}

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const readline = require('readline');
const { execSync } = require('child_process');

// ---- 错误上报（公开表单，仅交互模式下询问用户后提交）----
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
  console.log(DIM(`  将上报：插件名=hap-mcp  版本=1.1.13  系统=${osLabel} ${osVer}  AI=${aiVer}`));
  console.log(DIM(`  报错内容：${cleanMsg}`));
  process.stdout.write('  [y/N] > ');
  const answer = await new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', a => { rl.close(); resolve(a.trim()); });
  });
  if (answer.toLowerCase() !== 'y') { console.log(DIM('  已跳过')); return; }
  const body = JSON.stringify({ worksheetId: '69e7045f9513a27f83d3ccbd', receiveControls: [
    { controlId: '69e7045ff93dd47d496c0ece', type: 2, value: `hap-mcp 安装报错：${step}`, controlName: '标题', dot: 0 },
    { controlId: '69e7045ff93dd47d496c0ecf', type: 9, value: JSON.stringify(['4ad4726b-2d82-4f22-8f4f-a02cd8489ef8']), controlName: '插件名', dot: 0 },
    { controlId: '69e7045ff93dd47d496c0ed0', type: 2, value: '1.1.13', controlName: '版本号', dot: 0 },
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

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC1xzCYtdu8bZEinh6Oh7/p+6xc
ilHgV/ChU3bZXyezLQqf6mzOnLH6GVZMMDafMw3uMtljWyECCqnECy2UhZPa5BFc
qA2xbYH8/WyKTraCRJT3Hn61UrI4Eac4YVxa1CJ8KaTQtIeZBoXHIW0r5XyhBwYe
NkSun+OFN+YBoJvCXwIDAQAB
-----END PUBLIC KEY-----`;

const CRED_DIR  = process.env.HAP_MCP_CREDENTIALS
  ? path.dirname(process.env.HAP_MCP_CREDENTIALS)
  : path.join(os.homedir(), '.config', 'hap-mcp');
const CRED_FILE = process.env.HAP_MCP_CREDENTIALS || path.join(CRED_DIR, 'credentials');

const c = {
  bold:  s => `\x1b[1m${s}\x1b[0m`,
  dim:   s => `\x1b[2m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  red:   s => `\x1b[31m${s}\x1b[0m`,
  cyan:  s => `\x1b[36m${s}\x1b[0m`,
  yellow:s => `\x1b[33m${s}\x1b[0m`,
};

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
      if (ch === '') { process.stdout.write('\n'); process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', onData); reject(new Error('Cancelled')); }
      else if (ch === '\r' || ch === '\n' || ch === '') { process.stdout.write('\n'); process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', onData); resolve(pw); }
      else if (ch === '' || ch === '\b') { if (pw.length) pw = pw.slice(0, -1); }
      else { pw += ch; }
    };
    process.stdin.on('data', onData);
  });
}

function postJson(url, body) {
  const u = new URL(url);
  const payload = JSON.stringify(body);
  const opts = {
    method: 'POST', hostname: u.hostname, path: u.pathname + u.search,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--account' || a === '-u') && argv[i+1]) { args.account  = argv[++i]; }
    else if ((a === '--password' || a === '-p') && argv[i+1]) { args.password = argv[++i]; }
  }
  return args;
}

const ACCOUNT_RESULT = {
  0:  ['登录失败', '账号或密码有误，请重试'],
  2:  ['账号不存在', '检查账号是否拼写正确'],
  3:  ['密码错误', '密码有误，请重试'],
  4:  ['验证码错误', '前台验证码输入错误'],
  5:  ['需要图形验证码', '登录过于频繁，请先在浏览器登录一次明道云后重试'],
  7:  ['账号不存在', '该账号在 www.mingdao.com 上不存在；若您使用私有部署，请确认域名是否正确'],
  8:  ['账号来源受限', '该账号的登录来源类型被禁止'],
  9:  ['账号已锁定', '账号已被禁用，请联系管理员'],
  10: ['需要两步验证', '账号开启了两步验证，暂不支持通过脚本登录'],
  11: ['验证码已过期', '验证码已失效，请重新操作'],
  12: ['账号被锁定', '登录过于频繁，账号已被临时锁定，请稍后再试'],
  13: ['需要重置密码', '首次登录需要先在浏览器修改密码后再试'],
  14: ['密码已过期', '请先在浏览器修改密码后再试'],
  15: ['账号注销中', '该账号已申请注销'],
  16: ['需集成账号登录', '该账号只能通过 SSO/集成账号登录，不支持密码登录'],
};

(async () => {
  const cli = parseArgs(process.argv.slice(2));
  const nonInteractive = !!(cli.account && cli.password);

  console.log('');
  console.log(c.bold(c.cyan('◆ hap-mcp setup')));
  console.log(c.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('输入你的明道账号和密码，脚本会本地加密后用公开 API 验证。');
  console.log(c.dim('密码只在内存里使用，不会写入任何文件或日志。\n'));

  let account, password;
  if (nonInteractive) {
    account  = cli.account;
    password = cli.password;
    console.log(c.dim(`非交互模式：账号=${account}`));
  } else {
    try {
      account  = (await askVisible('账号（手机/邮箱）: ')).trim();
      password = await askHidden('密码（输入不回显）: ');
    } catch (e) {
      console.log(c.red('\n已取消。'));
      process.exit(1);
    }
  }

  if (!account || !password) {
    console.log(c.red('账号或密码为空。'));
    process.exit(1);
  }

  // 11位手机号自动补 +86
  if (/^1[3-9]\d{9}$/.test(account)) {
    account = '+86' + account;
    console.log(c.dim(`手机号已自动补全：${account}`));
  }

  process.stdout.write(c.dim('正在加密并验证...'));
  const encAccount  = encrypt(account);
  const encPassword = encrypt(password);

  let resp;
  try {
    resp = await postJson('https://www.mingdao.com/api/Login/MDAccountLogin', {
      account: encAccount, password: encPassword, isCookie: false, captchaType: 0,
    });
  } catch (e) {
    console.log(c.red(`\n网络错误：${e.message}`));
    await reportError('网络请求', e.message);
    process.exit(1);
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r');

  if (!resp?.data?.sessionId) {
    const code = resp?.data?.accountResult;
    const [title, hint] = ACCOUNT_RESULT[code] ?? ['鉴权失败', null];
    const rawMsg = resp?.exception || resp?.msg || resp?.message || JSON.stringify(resp);
    console.log(c.red(`✘ ${title}`));
    if (hint) console.log(c.yellow(`  → ${hint}`));
    console.log(c.dim(`  服务器响应：${rawMsg}`));
    await reportError('鉴权', `accountResult=${code} ${rawMsg}`);
    process.exit(2);
  }

  fs.mkdirSync(CRED_DIR, { recursive: true });
  const content = `# hap-mcp credentials — generated by setup.js on ${new Date().toISOString()}\n`
    + `HAP_LOGIN_ACCOUNT='${encAccount}'\n`
    + `HAP_LOGIN_PASSWORD='${encPassword}'\n`;
  fs.writeFileSync(CRED_FILE, content, { mode: 0o600 });

  // 写入初始 token 文件
  const tokenFile = path.join(CRED_DIR, 'token');
  fs.writeFileSync(tokenFile, resp.data.sessionId, { mode: 0o600 });

  console.log(c.green('✔ 鉴权成功'));
  console.log(c.dim(`  sessionId: ${resp.data.sessionId.slice(0, 16)}...`));
  console.log(c.dim(`  凭据已写入：${CRED_FILE}`));
  console.log(c.dim(`  token 已写入：${tokenFile}`));
  console.log('');
  console.log(c.bold(c.green('✅ hap-mcp 配置完成')));
  console.log(c.dim('运行 /reload-plugins 后 hap MCP 即可用，SessionStart hook 会自动刷新 token。'));
  console.log('');
})().catch(async e => { console.error(c.red('\n脚本异常：'), e); await reportError('未知异常', e.message || String(e)); process.exit(1); });
