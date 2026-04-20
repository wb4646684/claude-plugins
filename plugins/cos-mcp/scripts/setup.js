#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const CLAUDE_JSON = path.join(os.homedir(), '.claude.json');

const c = {
  bold:  s => `\x1b[1m${s}\x1b[0m`,
  dim:   s => `\x1b[2m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  red:   s => `\x1b[31m${s}\x1b[0m`,
  cyan:  s => `\x1b[36m${s}\x1b[0m`,
  yellow:s => `\x1b[33m${s}\x1b[0m`,
};

function ask(prompt, defaultVal) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const hint = defaultVal ? ` [默认: ${defaultVal}]` : '';
  return new Promise(r => rl.question(`${prompt}${hint}: `, a => {
    rl.close();
    r(a.trim() || defaultVal || '');
  }));
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
      if (ch === '\u0003') { process.stdout.write('\n'); process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', onData); reject(new Error('Cancelled')); }
      else if (ch === '\r' || ch === '\n' || ch === '\u0004') { process.stdout.write('\n'); process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', onData); resolve(val); }
      else if (ch === '\u007f' || ch === '\b') { if (val.length) val = val.slice(0, -1); }
      else { val += ch; }
    };
    process.stdin.on('data', onData);
  });
}

(async () => {
  console.log('');
  console.log(c.bold(c.cyan('◆ cos-mcp — 配置向导')));
  console.log(c.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('需要：腾讯云子账号 SecretId / SecretKey + COS bucket 名称\n');

  let secretId, secretKey, bucket, region;
  try {
    secretId  = await askHidden('COS_SECRET_ID  （子账号 SecretId）');
    secretKey = await askHidden('COS_SECRET_KEY （子账号 SecretKey）');
    bucket    = await ask('COS_BUCKET     （如 my-bucket-1256981397）');
    region    = await ask('COS_REGION', 'ap-shanghai');
  } catch (e) {
    console.log(c.red('\n已取消。'));
    process.exit(1);
  }
  if (!secretId || !secretKey || !bucket) {
    console.log(c.red('SecretId / SecretKey / Bucket 均不能为空。'));
    process.exit(1);
  }

  // 写入 ~/.claude.json
  process.stdout.write(c.dim('写入 ~/.claude.json ...'));
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CLAUDE_JSON, 'utf-8')); } catch (e) {}
  cfg.mcpServers = cfg.mcpServers || {};
  cfg.mcpServers.cos = {
    type: 'stdio',
    command: 'python3',
    args: [
      (process.env.CLAUDE_PLUGIN_ROOT
        ? path.join(process.env.CLAUDE_PLUGIN_ROOT, 'server/server.py')
        : path.join(__dirname, '../server/server.py')),
    ],
    env: {
      COS_SECRET_ID:  secretId,
      COS_SECRET_KEY: secretKey,
      COS_BUCKET:     bucket,
      COS_REGION:     region,
      COS_PREFIX:     'tmp',
    },
  };
  fs.writeFileSync(CLAUDE_JSON, JSON.stringify(cfg, null, 2));
  console.log(c.green(' ✔'));

  console.log('');
  console.log(c.bold(c.green('✅ cos-mcp 配置完成')));
  console.log(c.dim('重启 Claude Code 后 /mcp 应显示 cos: connected'));
  console.log('');
})().catch(e => { console.error(c.red('\n脚本异常：'), e); process.exit(1); });
