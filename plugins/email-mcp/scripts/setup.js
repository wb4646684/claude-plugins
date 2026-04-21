#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const ACCOUNTS_FILE = process.env.EMAIL_ACCOUNTS_FILE
  || path.join(os.homedir(), '.config', 'email-mcp', 'accounts.json');

const c = {
  bold:  s => `\x1b[1m${s}\x1b[0m`,
  dim:   s => `\x1b[2m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  red:   s => `\x1b[31m${s}\x1b[0m`,
  cyan:  s => `\x1b[36m${s}\x1b[0m`,
  yellow:s => `\x1b[33m${s}\x1b[0m`,
};

const PRESETS = {
  '1': { name: 'QQ 邮箱',        smtp_host: 'smtp.qq.com',           smtp_port: 465, imap_host: 'imap.qq.com',           imap_port: 993, hint: 'mail.qq.com → 设置 → 账户 → POP3/IMAP/SMTP → 生成授权码' },
  '2': { name: '163 邮箱',       smtp_host: 'smtp.163.com',          smtp_port: 465, imap_host: 'imap.163.com',          imap_port: 993, hint: '163 → 设置 → POP3/SMTP/IMAP → 生成客户端授权密码' },
  '3': { name: '企业邮（163）',  smtp_host: 'smtphz.qiye.163.com',  smtp_port: 465, imap_host: 'imaphz.qiye.163.com',  imap_port: 993, hint: '企业邮管理台生成授权密码' },
  '4': { name: 'Gmail',          smtp_host: 'smtp.gmail.com',        smtp_port: 465, imap_host: 'imap.gmail.com',        imap_port: 993, hint: 'Google 账户 → 安全性 → 两步验证 → 应用专用密码' },
  '5': { name: 'Outlook/365',    smtp_host: 'smtp.office365.com',    smtp_port: 587, imap_host: 'outlook.office365.com', imap_port: 993, hint: '使用账户密码或应用专用密码；企业 365 需 IT 开 SMTP AUTH' },
  '6': { name: '自定义',         smtp_host: '', smtp_port: 465, imap_host: '', imap_port: 993, hint: '' },
};

function ask(prompt, defaultVal) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const hint = defaultVal !== undefined ? c.dim(` [默认: ${defaultVal}]`) : '';
  return new Promise(r => rl.question(`${prompt}${hint}: `, a => { rl.close(); r(a.trim() || String(defaultVal ?? '')); }));
}

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt + ': ');
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('', a => { rl.close(); resolve(a.trim()); });
      return;
    }
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    let val = '';
    const onData = ch => {
      if (ch === '') { process.stdout.write('\n'); process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', onData); reject(new Error('Cancelled')); }
      else if (ch === '\r' || ch === '\n' || ch === '') { process.stdout.write('\n'); process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', onData); resolve(val); }
      else if (ch === '' || ch === '\b') { if (val.length) val = val.slice(0, -1); }
      else { val += ch; }
    };
    process.stdin.on('data', onData);
  });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name'         && argv[i+1]) { args.name        = argv[++i]; }
    else if (a === '--user'         && argv[i+1]) { args.user        = argv[++i]; }
    else if (a === '--pass'         && argv[i+1]) { args.pass        = argv[++i]; }
    else if (a === '--preset'       && argv[i+1]) { args.preset      = argv[++i]; }
    else if (a === '--display-name' && argv[i+1]) { args.displayName = argv[++i]; }
    else if (a === '--smtp-host'    && argv[i+1]) { args.smtpHost    = argv[++i]; }
    else if (a === '--smtp-port'    && argv[i+1]) { args.smtpPort    = parseInt(argv[++i]); }
    else if (a === '--imap-host'    && argv[i+1]) { args.imapHost    = argv[++i]; }
    else if (a === '--imap-port'    && argv[i+1]) { args.imapPort    = parseInt(argv[++i]); }
    else if (a === '--delete')                    { args.delete      = true; }
    else if (a === '--list')                      { args.list        = true; }
  }
  return args;
}

function loadAccounts() {
  try { return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8')); } catch (e) { return []; }
}

function saveAccounts(accounts) {
  fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2) + '\n', { mode: 0o600 });
}

(async () => {
  const cli = parseArgs(process.argv.slice(2));

  console.log('');
  console.log(c.bold(c.cyan('◆ email-mcp — 账号管理')));
  console.log(c.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

  const accounts = loadAccounts();

  // --list
  if (cli.list) {
    if (!accounts.length) { console.log('暂无账号'); }
    else { accounts.forEach((a, i) => console.log(`  [${i+1}] ${a.name}  ${a.smtp_user}`)); }
    console.log('');
    process.exit(0);
  }

  // --delete <name>
  if (cli.delete) {
    if (!cli.name) { console.log(c.red('--delete 需要配合 --name 使用')); process.exit(1); }
    const before = accounts.length;
    const filtered = accounts.filter(a => a.name !== cli.name);
    if (filtered.length === before) { console.log(c.red(`账号 "${cli.name}" 不存在`)); process.exit(1); }
    saveAccounts(filtered);
    console.log(c.green(`✔ 账号 "${cli.name}" 已删除`));
    console.log('');
    process.exit(0);
  }

  // 添加 / 更新账号
  const nonInteractive = !!(cli.user && cli.pass);
  let entry;

  if (nonInteractive) {
    const preset = PRESETS[cli.preset] || PRESETS['1'];
    const name = cli.name || cli.user.split('@')[0];
    entry = {
      name,
      display_name: cli.displayName || name,
      smtp_host: cli.smtpHost || preset.smtp_host,
      smtp_port: cli.smtpPort || preset.smtp_port,
      smtp_ssl:  true,
      smtp_user: cli.user,
      smtp_pass: cli.pass,
      imap_host: cli.imapHost || preset.imap_host,
      imap_port: cli.imapPort || preset.imap_port,
      imap_ssl:  true,
      imap_user: cli.user,
      imap_pass: cli.pass,
    };
    console.log(c.dim(`非交互模式：name=${entry.name}，user=${entry.smtp_user}，preset=${cli.preset || '1'} (${preset.name})`));
  } else {
    if (accounts.length) {
      console.log('已有账号：' + accounts.map(a => c.cyan(a.name)).join(', ') + '\n');
    }
    console.log('邮箱类型：');
    for (const [k, v] of Object.entries(PRESETS)) console.log(`  [${k}] ${v.name}`);

    let name, displayName, user, pass, smtpHost, smtpPort, imapHost, imapPort;
    try {
      const choice = await ask('选择类型', '1');
      const preset = PRESETS[choice] || PRESETS['1'];
      if (preset.hint) console.log(c.dim(`  提示：${preset.hint}\n`));

      name        = await ask('账号名称（如 mdmail / nocolymail）');
      displayName = await ask('发件人昵称', name);
      user        = await ask('邮箱地址');
      pass        = await askHidden('授权码 / 应用专用密码（不回显）');
      smtpHost    = await ask('SMTP 服务器', preset.smtp_host);
      smtpPort    = parseInt(await ask('SMTP 端口', String(preset.smtp_port)));
      imapHost    = await ask('IMAP 服务器', preset.imap_host);
      imapPort    = parseInt(await ask('IMAP 端口', String(preset.imap_port)));
    } catch (e) {
      console.log(c.red('\n已取消。'));
      process.exit(1);
    }

    if (!name || !user || !pass) { console.log(c.red('账号名、邮箱地址、授权码均不能为空')); process.exit(1); }
    entry = {
      name, display_name: displayName || name,
      smtp_host: smtpHost, smtp_port: smtpPort, smtp_ssl: true,
      smtp_user: user, smtp_pass: pass,
      imap_host: imapHost, imap_port: imapPort, imap_ssl: true,
      imap_user: user, imap_pass: pass,
    };
  }

  // 追加或更新
  const idx = accounts.findIndex(a => a.name === entry.name);
  const verb = idx >= 0 ? '更新' : '新增';
  if (idx >= 0) { accounts[idx] = entry; } else { accounts.push(entry); }
  saveAccounts(accounts);

  console.log('');
  console.log(c.bold(c.green(`✅ 账号 "${entry.name}" 已${verb}`)));
  console.log(c.dim(`配置文件：${ACCOUNTS_FILE}`));
  console.log(c.dim(`当前账号：${accounts.map(a => a.name).join(', ')}`));
  console.log(c.dim('运行 /reload-plugins 后生效'));
  console.log('');
})().catch(e => { console.error(c.red('\n脚本异常：'), e); process.exit(1); });
