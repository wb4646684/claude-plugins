#!/usr/bin/env node
'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Accounts ──────────────────────────────────────────────────────────────────
const ACCOUNTS_FILE = process.env.EMAIL_ACCOUNTS_FILE
  || path.join(os.homedir(), '.config', 'email-mcp', 'accounts.json');

let accounts = [];
try {
  accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
} catch (e) {
  process.stderr.write(`email-mcp: cannot load ${ACCOUNTS_FILE}: ${e.message}\n`);
  process.exit(1);
}
if (!accounts.length) {
  process.stderr.write(`email-mcp: no accounts configured in ${ACCOUNTS_FILE}\n`);
  process.exit(1);
}

const accountNames = accounts.map(a => a.name);

function getAccount(name) {
  if (!name) return accounts[0];
  const a = accounts.find(a => a.name === name);
  if (!a) throw new Error(`账号 "${name}" 不存在，可用账号：${accountNames.join(', ')}`);
  return a;
}

const accountParam = z.string().optional().describe(
  `邮箱账号名，可用：${accountNames.join(' / ')}；不填默认 ${accounts[0].name}`
);

// ── Transport helpers ─────────────────────────────────────────────────────────
function makeTransport(a) {
  return nodemailer.createTransport({
    host: a.smtp_host,
    port: a.smtp_port || 465,
    secure: a.smtp_ssl !== false,
    auth: { user: a.smtp_user, pass: a.smtp_pass },
    tls: { rejectUnauthorized: false },
  });
}

function makeImap(a) {
  return new ImapFlow({
    host: a.imap_host,
    port: a.imap_port || 993,
    secure: a.imap_ssl !== false,
    auth: { user: a.imap_user, pass: a.imap_pass },
    logger: false,
    tls: { rejectUnauthorized: false },
  });
}

async function fetchRaw(client, folder, uid) {
  const lock = await client.getMailboxLock(folder);
  try {
    const chunks = [];
    for await (const msg of client.fetch(String(uid), { source: true }, { uid: true })) {
      const src = msg.source;
      if (Buffer.isBuffer(src)) {
        chunks.push(src);
      } else {
        for await (const chunk of src) {
          if (Buffer.isBuffer(chunk)) chunks.push(chunk);
          else if (chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk));
          else chunks.push(Buffer.from([chunk]));
        }
      }
    }
    return chunks.length ? Buffer.concat(chunks) : null;
  } finally {
    lock.release();
  }
}

// ── MCP Server ────────────────────────────────────────────────────────────────
const server = new McpServer({ name: 'email', version: '1.0.0' });

// ── send_email ────────────────────────────────────────────────────────────────
server.tool(
  'send_email',
  '发送邮件，支持附件（传本地文件路径）',
  {
    to:      z.string().describe('收件人，多个用英文逗号分隔'),
    subject: z.string().describe('邮件主题'),
    text:    z.string().optional().describe('纯文本正文'),
    html:    z.string().optional().describe('HTML 正文（与 text 二选一或同时提供）'),
    cc:      z.string().optional().describe('抄送'),
    bcc:     z.string().optional().describe('密送'),
    attachments: z.array(z.object({
      path:     z.string().describe('本地文件的绝对路径'),
      filename: z.string().optional().describe('附件显示名称，默认取文件名'),
    })).optional().describe('附件列表'),
    account: accountParam,
  },
  async (args) => {
    try {
      const a = getAccount(args.account);
      const mail = {
        from: `${a.display_name || a.smtp_user} <${a.smtp_user}>`,
        to: args.to,
        subject: args.subject,
        ...(args.text && { text: args.text }),
        ...(args.html && { html: args.html }),
        ...(args.cc  && { cc:  args.cc  }),
        ...(args.bcc && { bcc: args.bcc }),
      };
      if (args.attachments?.length) {
        mail.attachments = args.attachments.map(att => ({
          path: att.path,
          filename: att.filename || path.basename(att.path),
        }));
      }
      const info = await makeTransport(a).sendMail(mail);
      return { content: [{ type: 'text', text: `✅ 发送成功 (${a.name})\nmessageId: ${info.messageId}` }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `❌ 发送失败: ${e.message}` }] };
    }
  }
);

// ── list_folders ──────────────────────────────────────────────────────────────
server.tool('list_folders', '列出邮箱所有文件夹', { account: accountParam }, async ({ account }) => {
  const a = getAccount(account);
  const c = makeImap(a);
  await c.connect();
  try {
    const list = await c.list();
    return { content: [{ type: 'text', text: list.map(b => b.path).sort().join('\n') }] };
  } finally {
    await c.logout();
  }
});

// ── list_emails ───────────────────────────────────────────────────────────────
server.tool(
  'list_emails',
  '列出收件箱（或指定文件夹）的邮件，返回 uid/主题/发件人/日期',
  {
    folder:      z.string().default('INBOX'),
    limit:       z.number().int().default(20),
    unread_only: z.boolean().default(false).describe('仅未读邮件'),
    account:     accountParam,
  },
  async ({ folder, limit, unread_only, account }) => {
    const a = getAccount(account);
    const c = makeImap(a);
    await c.connect();
    try {
      const lock = await c.getMailboxLock(folder);
      try {
        const criteria = unread_only ? { seen: false } : { all: true };
        const uids = await c.search(criteria, { uid: true });
        if (!uids.length) return { content: [{ type: 'text', text: '没有邮件' }] };
        const msgs = [];
        for await (const msg of c.fetch(uids.slice(-limit).join(','), { uid: true, envelope: true, flags: true }, { uid: true })) {
          msgs.push({
            uid:     msg.uid,
            subject: msg.envelope?.subject || '(无主题)',
            from:    msg.envelope?.from?.[0]?.address || '',
            date:    msg.envelope?.date?.toISOString().slice(0, 16) || '',
            seen:    msg.flags?.has('\\Seen') ?? false,
          });
        }
        msgs.reverse();
        return { content: [{ type: 'text', text: JSON.stringify(msgs, null, 2) }] };
      } finally {
        lock.release();
      }
    } finally {
      await c.logout();
    }
  }
);

// ── get_email ─────────────────────────────────────────────────────────────────
server.tool(
  'get_email',
  '读取一封邮件的完整内容，返回正文和附件列表',
  {
    uid:     z.number().int(),
    folder:  z.string().default('INBOX'),
    account: accountParam,
  },
  async ({ uid, folder, account }) => {
    const a = getAccount(account);
    const c = makeImap(a);
    await c.connect();
    try {
      const raw = await fetchRaw(c, folder, uid);
      if (!raw) return { content: [{ type: 'text', text: '未找到该邮件' }] };
      const p = await simpleParser(raw);
      return { content: [{ type: 'text', text: JSON.stringify({
        from:    p.from?.text  || '',
        to:      p.to?.text    || '',
        cc:      p.cc?.text    || '',
        subject: p.subject     || '',
        date:    p.date?.toISOString() || '',
        text:    (p.text || '').slice(0, 10000),
        html_available: !!p.html,
        attachments: (p.attachments || []).map((att, i) => ({
          index: i, filename: att.filename || `attachment_${i}`,
          contentType: att.contentType, size: att.size,
        })),
      }, null, 2) }] };
    } finally {
      await c.logout();
    }
  }
);

// ── get_email_html ────────────────────────────────────────────────────────────
server.tool(
  'get_email_html',
  '获取邮件的 HTML 正文',
  { uid: z.coerce.number().int(), folder: z.string().default('INBOX'), account: accountParam },
  async ({ uid, folder, account }) => {
    const a = getAccount(account);
    const c = makeImap(a);
    await c.connect();
    try {
      const raw = await fetchRaw(c, folder, uid);
      if (!raw) return { content: [{ type: 'text', text: '未找到该邮件' }] };
      const p = await simpleParser(raw);
      return { content: [{ type: 'text', text: p.html || '（该邮件无 HTML 正文）' }] };
    } finally {
      await c.logout();
    }
  }
);

// ── save_attachment ───────────────────────────────────────────────────────────
server.tool(
  'save_attachment',
  '将邮件附件保存到本地',
  {
    uid:              z.coerce.number().int(),
    attachment_index: z.coerce.number().int(),
    save_path:        z.string(),
    folder:           z.string().default('INBOX'),
    account:          accountParam,
  },
  async ({ uid, attachment_index, save_path, folder, account }) => {
    const a = getAccount(account);
    const c = makeImap(a);
    await c.connect();
    try {
      const raw = await fetchRaw(c, folder, uid);
      if (!raw) return { content: [{ type: 'text', text: '未找到该邮件' }] };
      const p = await simpleParser(raw);
      const att = p.attachments?.[attachment_index];
      if (!att) return { content: [{ type: 'text', text: `未找到附件 ${attachment_index}，共 ${p.attachments?.length || 0} 个` }] };
      fs.mkdirSync(path.dirname(save_path), { recursive: true });
      fs.writeFileSync(save_path, att.content);
      return { content: [{ type: 'text', text: `✅ 附件已保存到 ${save_path}（${att.size} 字节）` }] };
    } finally {
      await c.logout();
    }
  }
);

// ── search_emails ─────────────────────────────────────────────────────────────
server.tool(
  'search_emails',
  '按条件搜索邮件（发件人/主题/日期范围）',
  {
    folder:  z.string().default('INBOX'),
    from:    z.string().optional(),
    subject: z.string().optional(),
    since:   z.string().optional().describe('YYYY-MM-DD'),
    before:  z.string().optional().describe('YYYY-MM-DD'),
    limit:   z.number().int().default(20),
    account: accountParam,
  },
  async ({ folder, from, subject, since, before, limit, account }) => {
    const a = getAccount(account);
    const c = makeImap(a);
    await c.connect();
    try {
      const lock = await c.getMailboxLock(folder);
      try {
        const criteria = {};
        if (from)    criteria.from    = from;
        if (subject) criteria.subject = subject;
        if (since)   criteria.since   = new Date(since);
        if (before)  criteria.before  = new Date(before);
        if (!Object.keys(criteria).length) criteria.all = true;
        const uids = await c.search(criteria, { uid: true });
        if (!uids.length) return { content: [{ type: 'text', text: '未找到匹配邮件' }] };
        const msgs = [];
        for await (const msg of c.fetch(uids.slice(-limit).join(','), { uid: true, envelope: true, flags: true }, { uid: true })) {
          msgs.push({
            uid:     msg.uid,
            subject: msg.envelope?.subject || '(无主题)',
            from:    msg.envelope?.from?.[0]?.address || '',
            date:    msg.envelope?.date?.toISOString().slice(0, 16) || '',
            seen:    msg.flags?.has('\\Seen') ?? false,
          });
        }
        msgs.reverse();
        return { content: [{ type: 'text', text: JSON.stringify(msgs, null, 2) }] };
      } finally {
        lock.release();
      }
    } finally {
      await c.logout();
    }
  }
);

// ── mark_email ────────────────────────────────────────────────────────────────
server.tool(
  'mark_email',
  '标记邮件为已读或未读',
  {
    uid:     z.number().int(),
    folder:  z.string().default('INBOX'),
    action:  z.enum(['read', 'unread']),
    account: accountParam,
  },
  async ({ uid, folder, action, account }) => {
    const a = getAccount(account);
    const c = makeImap(a);
    await c.connect();
    try {
      const lock = await c.getMailboxLock(folder);
      try {
        if (action === 'read') {
          await c.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        } else {
          await c.messageFlagsRemove(String(uid), ['\\Seen'], { uid: true });
        }
        return { content: [{ type: 'text', text: `UID ${uid} 已标记为${action === 'read' ? '已读' : '未读'}` }] };
      } finally {
        lock.release();
      }
    } finally {
      await c.logout();
    }
  }
);

// ── list_accounts ─────────────────────────────────────────────────────────────
server.tool(
  'list_accounts',
  '列出所有已配置的邮箱账号',
  {},
  async () => {
    const list = accounts.map(a => `${a.name}  ${a.smtp_user}  (${a.smtp_host})`).join('\n');
    return { content: [{ type: 'text', text: list }] };
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`email-mcp: ${accountNames.join(', ')} ready\n`);
}
main().catch(e => { console.error(e); process.exit(1); });
