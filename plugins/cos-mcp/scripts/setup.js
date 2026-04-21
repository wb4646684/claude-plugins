#!/usr/bin/env node
'use strict';

// 依赖检查
const [nodeMajor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 18) {
  console.error(`需要 Node.js 18+，当前版本 ${process.version}，请升级后重试`);
  process.exit(1);
}

const { execSync } = require('child_process');
try {
  execSync('python3 -c "import qcloud_cos"', { stdio: 'ignore' });
} catch (e) {
  console.error('缺少 Python 依赖，请先运行：pip3 install mcp cos-python-sdk-v5');
  process.exit(1);
}

const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const readline = require('readline');

const CRED_DIR  = path.join(os.homedir(), '.config', 'cos-mcp');
const CRED_FILE = path.join(CRED_DIR, 'credentials');

const c = {
  bold:  s => `\x1b[1m${s}\x1b[0m`,
  dim:   s => `\x1b[2m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  red:   s => `\x1b[31m${s}\x1b[0m`,
  cyan:  s => `\x1b[36m${s}\x1b[0m`,
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
      if (ch === '') { process.stdout.write('\n'); process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', onData); reject(new Error('Cancelled')); }
      else if (ch === '\r' || ch === '\n' || ch === '') { process.stdout.write('\n'); process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', onData); resolve(val); }
      else if (ch === '' || ch === '\b') { if (val.length) val = val.slice(0, -1); }
      else { val += ch; }
    };
    process.stdin.on('data', onData);
  });
}

const PLUGIN_NAME = 'cos-mcp';
const PLUGIN_VERSION = '1.0.4';
const PLUGIN_KEY = '91e88e2a-7e9d-4da8-846d-add419852f4b';

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

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--secret-id'  && argv[i+1]) { args.secretId  = argv[++i]; }
    else if (a === '--secret-key' && argv[i+1]) { args.secretKey = argv[++i]; }
    else if (a === '--bucket'     && argv[i+1]) { args.bucket    = argv[++i]; }
    else if (a === '--region'     && argv[i+1]) { args.region    = argv[++i]; }
  }
  return args;
}

(async () => {
  const cli = parseArgs(process.argv.slice(2));
  const nonInteractive = !!(cli.secretId && cli.secretKey && cli.bucket);

  console.log('');
  console.log(c.bold(c.cyan('◆ cos-mcp — 配置向导')));
  console.log(c.dim('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('需要：腾讯云子账号 SecretId / SecretKey + COS bucket 名称\n');

  let secretId, secretKey, bucket, region;
  if (nonInteractive) {
    secretId  = cli.secretId;
    secretKey = cli.secretKey;
    bucket    = cli.bucket;
    region    = cli.region || 'ap-shanghai';
    console.log(c.dim(`非交互模式：bucket=${bucket}，region=${region}`));
  } else {
    try {
      secretId  = await askHidden('COS_SECRET_ID  （子账号 SecretId）');
      secretKey = await askHidden('COS_SECRET_KEY （子账号 SecretKey）');
      bucket    = await ask('COS_BUCKET     （如 my-bucket-1256981397）');
      region    = await ask('COS_REGION', 'ap-shanghai');
    } catch (e) {
      console.log(c.red('\n已取消。'));
      process.exit(1);
    }
  }

  if (!secretId || !secretKey || !bucket) {
    console.log(c.red('SecretId / SecretKey / Bucket 均不能为空。'));
    process.exit(1);
  }

  fs.mkdirSync(CRED_DIR, { recursive: true });
  const content = `# cos-mcp credentials — generated by setup.js on ${new Date().toISOString()}\n`
    + `COS_SECRET_ID=${secretId}\n`
    + `COS_SECRET_KEY=${secretKey}\n`
    + `COS_BUCKET=${bucket}\n`
    + `COS_REGION=${region}\n`
    + `COS_PREFIX=tmp\n`;
  fs.writeFileSync(CRED_FILE, content, { mode: 0o600 });

  console.log('');
  console.log(c.bold(c.green('✅ cos-mcp 配置完成')));
  console.log(c.dim(`凭据已写入：${CRED_FILE}`));
  console.log(c.dim('运行 /reload-plugins 后 cos MCP 即可用'));
  console.log('');
})().catch(async e => { console.error(c.red('\n脚本异常：'), e); await reportError('未知异常', e.message || String(e)); process.exit(1); });
