'use strict';
/**
 * 插件安装错误上报（公开表单，无需鉴权）
 * 内联到各 setup.js，不作为独立模块安装。
 *
 * reportError(pluginName, version, step, errorMsg) -> Promise<void>
 *   - 脱敏处理 errorMsg
 *   - 展示上报内容，询问用户是否提交（默认 N）
 *   - TTY 不可用（非交互模式）时自动跳过
 */

const https  = require('https');
const os     = require('os');
const { execSync } = require('child_process');
const readline = require('readline');

const FEEDBACK_HOST      = 'www.mingdao.com';
const FEEDBACK_PATH      = '/api/PublicWorksheet/AddRow';
const FEEDBACK_WORKSHEET = '69e7045f9513a27f83d3ccbd';
const FEEDBACK_CLIENT    = '05a01d0920df02d09d0d10970140db06c0660bb07d0a20a0';
const FEEDBACK_ORIGIN    = 'https://d557778d685be9b5.share.mingdao.net';

const PLUGIN_KEYS = {
  'hap-mcp':          '4ad4726b-2d82-4f22-8f4f-a02cd8489ef8',
  'cos-mcp':          '91e88e2a-7e9d-4da8-846d-add419852f4b',
  'email-mcp':        '9683cffe-3c1a-4c57-9c5f-1829ca258f6b',
  'oldoa-mcp':        '249b8cb4-67a6-4a27-82d0-463f5b603709',
  'plugin-builder':   '7f6818de-a11d-48cf-ac7d-c0eeba78a5b0',
  'context-optimize': '10e345d3-0ac9-4f2d-885e-8b6b716c1f1d',
};
const OS_KEYS = {
  darwin: '2970e8ef-1a7c-4060-b97b-12221ed8919c',
  linux:  '3ed18664-4e5d-4ff7-9356-3f323d147d21',
  win32:  '626ea0cd-0727-410b-99b4-f5778806c83e',
};

function sanitize(text, homeDir) {
  return String(text)
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '***@***.***')
    .replace(/1[3-9]\d{9}/g, '1**********')
    .replace(/[0-9a-f]{32,}/gi, '[REDACTED]')
    .replace(new RegExp(homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '~');
}

function getOsVersion() {
  try {
    if (process.platform === 'darwin')
      return execSync('sw_vers -productVersion', { timeout: 2000 }).toString().trim();
    return `${os.type()} ${os.release()}`;
  } catch { return 'unknown'; }
}

function getAiVersion() {
  try { return execSync('claude --version', { timeout: 2000 }).toString().trim().split('\n')[0]; }
  catch { return 'unknown'; }
}

function submitFeedback(pluginName, version, step, cleanMsg, osVer, aiVer) {
  const pluginKey = PLUGIN_KEYS[pluginName];
  if (!pluginKey) return Promise.resolve();
  const osKey = OS_KEYS[process.platform] || OS_KEYS.linux;

  const body = JSON.stringify({
    worksheetId: FEEDBACK_WORKSHEET,
    receiveControls: [
      { controlId: '69e7045ff93dd47d496c0ece', type: 2, value: `${pluginName} 安装报错：${step}`, controlName: '标题', dot: 0 },
      { controlId: '69e7045ff93dd47d496c0ecf', type: 9, value: JSON.stringify([pluginKey]), controlName: '插件名', dot: 0 },
      { controlId: '69e7045ff93dd47d496c0ed0', type: 2, value: version, controlName: '版本号', dot: 0 },
      { controlId: '69e7045ff93dd47d496c0ed1', type: 2, value: step, controlName: '步骤', dot: 0 },
      { controlId: '69e7045ff93dd47d496c0ed2', type: 2, value: cleanMsg, controlName: '报错内容', dot: 0 },
      { controlId: '69e7045ff93dd47d496c0ed3', type: 9, value: JSON.stringify([osKey]), controlName: '操作系统', dot: 0 },
      { controlId: '69e7045ff93dd47d496c0ed4', type: 9, value: JSON.stringify(['2c33893a-bbe3-4c18-b678-a847e7e8a43a']), controlName: '类型', dot: 0 },
      { controlId: '69e7063a9513a27f83d3cd09', type: 2, value: aiVer, controlName: 'AI版本', dot: 0 },
      { controlId: '69e7063a9513a27f83d3cd0a', type: 2, value: osVer, controlName: '系统版本', dot: 0 },
    ],
  });

  return new Promise(resolve => {
    const req = https.request({
      hostname: FEEDBACK_HOST, path: FEEDBACK_PATH, method: 'POST', timeout: 5000,
      headers: {
        'content-type': 'application/json', 'authorization': '',
        'clientid': FEEDBACK_CLIENT, 'origin': FEEDBACK_ORIGIN,
        'x-requested-with': 'XMLHttpRequest',
      },
    }, () => resolve());
    req.on('error', () => resolve());
    req.on('timeout', () => { req.destroy(); resolve(); });
    req.write(body);
    req.end();
  });
}

async function reportError(pluginName, version, step, errorMsg) {
  if (!process.stdin.isTTY) return;   // 非交互模式跳过
  if (!PLUGIN_KEYS[pluginName]) return;

  const homeDir  = os.homedir();
  const cleanMsg = sanitize(errorMsg, homeDir);
  const osVer    = getOsVersion();
  const aiVer    = getAiVersion();
  const osLabel  = { darwin: 'macOS', linux: 'Linux', win32: 'Windows' }[process.platform] || process.platform;

  const DIM    = s => `\x1b[2m${s}\x1b[0m`;
  const YELLOW = s => `\x1b[33m${s}\x1b[0m`;

  console.log('');
  console.log(YELLOW('  是否提交错误报告帮助改进插件？（不包含账号密码）'));
  console.log(DIM(`  将上报：插件名=${pluginName}  版本=${version}  系统=${osLabel} ${osVer}  AI=${aiVer}`));
  console.log(DIM(`  报错内容：${cleanMsg}`));
  process.stdout.write('  [y/N] > ');

  const answer = await new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', a => { rl.close(); resolve(a.trim()); });
  });

  if (answer.toLowerCase() !== 'y') {
    console.log(DIM('  已跳过'));
    return;
  }

  await submitFeedback(pluginName, version, step, cleanMsg, osVer, aiVer);
  console.log(DIM('  ✔ 已提交，感谢反馈'));
}

module.exports = { reportError };
