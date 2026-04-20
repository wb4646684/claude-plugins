#!/usr/bin/env node
/**
 * hap-mcp interactive setup
 *
 * 把明文账号密码加密成 payload，并写入 ~/.config/hap-mcp/credentials。
 * 采用和明道前端完全一致的 RSA-1024 PKCS#1 v1.5 加密，加密结果可直接用于 MDAccountLogin API。
 *
 * 只在首次配置、或密码改了、或明道前端 RSA 公钥换了时需要跑。
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const readline = require('readline');

// 明道前端 login bundle 里提取的 RSA-1024 公钥
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC1xzCYtdu8bZEinh6Oh7/p+6xc
ilHgV/ChU3bZXyezLQqf6mzOnLH6GVZMMDafMw3uMtljWyECCqnECy2UhZPa5BFc
qA2xbYH8/WyKTraCRJT3Hn61UrI4Eac4YVxa1CJ8KaTQtIeZBoXHIW0r5XyhBwYe
NkSun+OFN+YBoJvCXwIDAQAB
-----END PUBLIC KEY-----`;

const CRED_DIR = process.env.HAP_MCP_CREDENTIALS
  ? path.dirname(process.env.HAP_MCP_CREDENTIALS)
  : path.join(os.homedir(), '.config', 'hap-mcp');
const CRED_FILE = process.env.HAP_MCP_CREDENTIALS || path.join(CRED_DIR, 'credentials');

// ── ANSI colors ─────────────────────────────────────────────────────────────
const c = {
  bold: s => `\x1b[1m${s}\x1b[0m`,
  dim: s => `\x1b[2m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  red: s => `\x1b[31m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
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
      // Non-TTY (piped stdin): fall back to visible line read
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('', a => { rl.close(); resolve(a); });
      return;
    }
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    let pw = '';
    const onData = ch => {
      switch (ch) {
        case '\u0003':  // Ctrl-C
          process.stdout.write('\n');
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          reject(new Error('Cancelled'));
          return;
        case '\r':
        case '\n':
        case '\u0004':  // Ctrl-D
          process.stdout.write('\n');
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          resolve(pw);
          return;
        case '\u007f':  // Backspace
        case '\b':
          if (pw.length) pw = pw.slice(0, -1);
          return;
        default:
          pw += ch;
      }
    };
    process.stdin.on('data', onData);
  });
}

function postJson(url, body) {
  const u = new URL(url);
  const payload = JSON.stringify(body);
  const opts = {
    method: 'POST',
    hostname: u.hostname,
    path: u.pathname + u.search,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  console.log('');
  console.log(c.bold(c.cyan('◆ hap-mcp setup')));
  console.log(c.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('输入你的明道账号和密码，脚本会本地加密后用公开 API 验证。');
  console.log(c.dim('密码只在内存里使用，不会写入任何文件或日志。\n'));

  let account, password;
  try {
    account = (await askVisible('账号（手机/邮箱）: ')).trim();
    password = await askHidden('密码（输入不回显）: ');
  } catch (e) {
    console.log(c.red('\n已取消。'));
    process.exit(1);
  }
  if (!account || !password) {
    console.log(c.red('账号或密码为空。'));
    process.exit(1);
  }

  process.stdout.write(c.dim('正在加密并验证...'));
  const encAccount = encrypt(account);
  const encPassword = encrypt(password);

  let resp;
  try {
    resp = await postJson('https://www.mingdao.com/api/Login/MDAccountLogin', {
      account: encAccount, password: encPassword, isCookie: false, captchaType: 0,
    });
  } catch (e) {
    console.log(c.red(`\n网络错误：${e.message}`));
    process.exit(1);
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r');

  if (!resp?.data?.sessionId) {
    console.log(c.red('✘ 鉴权失败'));
    console.log(c.dim(`服务器响应：${JSON.stringify(resp)}`));
    console.log('');
    console.log('常见原因：');
    console.log('  • 账号或密码错误');
    console.log('  • 明道前端 RSA 公钥更新（极少发生，需要重新从 login 页提取）');
    console.log('  • 触发验证码（去网页手动登录一次后重试）');
    process.exit(2);
  }

  // 写入凭据文件
  fs.mkdirSync(CRED_DIR, { recursive: true });
  const content = `# hap-mcp credentials — generated by setup.js on ${new Date().toISOString()}\n`
    + `HAP_LOGIN_ACCOUNT='${encAccount}'\n`
    + `HAP_LOGIN_PASSWORD='${encPassword}'\n`;
  fs.writeFileSync(CRED_FILE, content, { mode: 0o600 });

  console.log(c.green('✔ 鉴权成功'));
  console.log(c.dim(`  sessionId: ${resp.data.sessionId.slice(0, 16)}...`));
  console.log(c.dim(`  凭据已写入：${CRED_FILE}`));
  console.log('');
  console.log(c.bold('下一步：'));
  console.log('  • 如果你已经通过 /plugin install 装过本插件，hap MCP 已就绪——直接启动 Claude 会自动');
  console.log('    触发 SessionStart hook 刷新 sessionId。');
  console.log('  • 首次使用建议重启 Claude Code 一次，让 MCP 配置重新加载。');
  console.log('');
})().catch(e => {
  console.error(c.red('\n脚本异常：'), e);
  process.exit(1);
});
