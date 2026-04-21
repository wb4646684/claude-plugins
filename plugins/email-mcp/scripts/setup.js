#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const CRED_DIR  = path.join(os.homedir(), '.config', 'email-mcp');

const c = {
  bold:  s => `\x1b[1m${s}\x1b[0m`,
  dim:   s => `\x1b[2m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  red:   s => `\x1b[31m${s}\x1b[0m`,
  cyan:  s => `\x1b[36m${s}\x1b[0m`,
  yellow:s => `\x1b[33m${s}\x1b[0m`,
};

const PRESETS = {
  '1': { name: 'QQ 邮箱',          smtp_host: 'smtp.qq.com',            smtp_port: '465', imap_host: 'imap.qq.com',            imap_port: '993', hint: '授权码申请：mail.qq.com → 设置 → 账户 → POP3/IMAP/SMTP → 开启并生成授权码' },
  '2': { name: '163 邮箱',         smtp_host: 'smtp.163.com',           smtp_port: '465', imap_host: 'imap.163.com',           imap_port: '993', hint: '授权码申请：163 → 设置 → POP3/SMTP/IMAP → 开启并生成客户端授权密码' },
  '3': { name: '企业邮（163）',    smtp_host: 'smtphz.qiye.163.com',   smtp_port: '465', imap_host: 'imaphz.qiye.163.com',   imap_port: '993', hint: '企业邮使用独立 SMTP/IMAP 地址，授权码在企业邮管理台生成' },
  '4': { name: 'Gmail',            smtp_host: 'smtp.gmail.com',         smtp_port: '465', imap_host: 'imap.gmail.com',         imap_port: '993', hint: '需开两步验证，再生成"应用专用密码"：账户 → 安全性 → 两步验证 → 应用专用密码' },
  '5': { name: 'Outlook/Hotmail',  smtp_host: 'smtp.office365.com',     smtp_port: '587', imap_host: 'outlook.office365.com',  imap_port: '993', hint: '使用账户密码（或应用专用密码）；企业 365 需 IT 开 SMTP AUTH' },
  '6': { name: '自定义',           smtp_host: '', smtp_port: '465', imap_host: '', imap_port: '993', hint: '' },
};

function ask(prompt, defaultVal) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const hint = defaultVal ? c.dim(` [默认: ${defaultVal}]`) : '';
  return new Promise(r => rl.question(`${prompt}${hint}: `, a => { rl.close(); r(a.trim() || defaultVal || ''); }));
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
    if (a === '--user'         && argv[i+1]) { args.user        = argv[++i]; }
    else if (a === '--pass'         && argv[i+1]) { args.pass        = argv[++i]; }
    else if (a === '--preset'       && argv[i+1]) { args.preset      = argv[++i]; }
    else if (a === '--display-name' && argv[i+1]) { args.displayName = argv[++i]; }
    else if (a === '--smtp-host'    && argv[i+1]) { args.smtpHost    = argv[++i]; }
    else if (a === '--smtp-port'    && argv[i+1]) { args.smtpPort    = argv[++i]; }
    else if (a === '--imap-host'    && argv[i+1]) { args.imapHost    = argv[++i]; }
    else if (a === '--imap-port'    && argv[i+1]) { args.imapPort    = argv[++i]; }
  }
  return args;
}

(async () => {
  const cli = parseArgs(process.argv.slice(2));
  const nonInteractive = !!(cli.user && cli.pass);

  console.log('');
  console.log(c.bold(c.cyan('◆ email-mcp — 配置向导')));
  console.log(c.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

  let acct;

  if (nonInteractive) {
    const preset = PRESETS[cli.preset] || PRESETS['1'];
    console.log(c.dim(`非交互模式：${cli.user}，preset=${cli.preset || '1'} (${preset.name})`));
    acct = {
      name:     cli.displayName || cli.user,
      user:     cli.user,
      pass:     cli.pass,
      smtpHost: cli.smtpHost || preset.smtp_host,
      smtpPort: cli.smtpPort || preset.smtp_port,
      imapHost: cli.imapHost || preset.imap_host,
      imapPort: cli.imapPort || preset.imap_port,
    };
  } else {
    console.log('邮箱类型：');
    for (const [k, v] of Object.entries(PRESETS)) console.log(`  [${k}] ${v.name}`);
    const choice = await ask('选择', '1');
    const preset = PRESETS[choice] || PRESETS['1'];
    if (preset.hint) console.log(c.dim(`  提示：${preset.hint}\n`));

    try {
      const name     = await ask('发件人昵称');
      const user     = await ask('邮箱地址');
      const pass     = await askHidden('授权码 / 应用专用密码（不回显）');
      const smtpHost = await ask('SMTP 服务器', preset.smtp_host);
      const smtpPort = await ask('SMTP 端口', preset.smtp_port);
      const imapHost = await ask('IMAP 服务器', preset.imap_host);
      const imapPort = await ask('IMAP 端口', preset.imap_port);
      acct = { name, user, pass, smtpHost, smtpPort, imapHost, imapPort };
    } catch (e) {
      console.log(c.red('\n已取消。'));
      process.exit(1);
    }
  }

  if (!acct.user || !acct.pass) {
    console.log(c.red('邮箱地址和授权码不能为空。'));
    process.exit(1);
  }

  fs.mkdirSync(CRED_DIR, { recursive: true });
  const credFile = path.join(CRED_DIR, 'credentials');
  const content = `# email-mcp credentials — generated by setup.js on ${new Date().toISOString()}\n`
    + `SMTP_HOST=${acct.smtpHost}\n`
    + `SMTP_PORT=${acct.smtpPort}\n`
    + `SMTP_SSL=true\n`
    + `SMTP_USER=${acct.user}\n`
    + `SMTP_PASS=${acct.pass}\n`
    + `DISPLAY_NAME=${acct.name}\n`
    + `IMAP_HOST=${acct.imapHost}\n`
    + `IMAP_PORT=${acct.imapPort}\n`
    + `IMAP_SSL=true\n`
    + `IMAP_USER=${acct.user}\n`
    + `IMAP_PASS=${acct.pass}\n`;
  fs.writeFileSync(credFile, content, { mode: 0o600 });

  console.log('');
  console.log(c.bold(c.green('✅ email-mcp 配置完成')));
  console.log(c.dim(`凭据已写入：${credFile}`));
  console.log(c.dim('运行 /reload-plugins 后 email MCP 即可用'));
  console.log('');
})().catch(e => { console.error(c.red('\n脚本异常：'), e); process.exit(1); });
