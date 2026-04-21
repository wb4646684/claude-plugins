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

// ── Config ──────────────────────────────────────────────────────────────────
function loadCreds(filePath) {
  const creds = {};
  try {
    const lines = require('fs').readFileSync(filePath, 'utf-8').split('\n');
    for (const line of lines) {
      const l = line.trim();
      if (!l || l.startsWith('#')) continue;
      const idx = l.indexOf('=');
      if (idx < 0) continue;
      const k = l.slice(0, idx).trim();
      const v = l.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      creds[k] = v;
    }
  } catch (e) {}
  return creds;
}

const _credFile = process.env.EMAIL_CREDENTIALS_FILE;
const _creds = _credFile ? loadCreds(_credFile) : {};
const _get = (key, def = '') => process.env[key] || _creds[key] || def;

const SMTP_HOST = _get('SMTP_HOST');
const SMTP_PORT = parseInt(_get('SMTP_PORT', '465'));
const SMTP_SSL  = _get('SMTP_SSL', 'true') !== 'false';
const SMTP_USER = _get('SMTP_USER');
const SMTP_PASS = _get('SMTP_PASS');
const DISPLAY_NAME = _get('DISPLAY_NAME') || SMTP_USER;

const IMAP_HOST = _get('IMAP_HOST');
const IMAP_PORT = parseInt(_get('IMAP_PORT', '993'));
const IMAP_SSL  = _get('IMAP_SSL', 'true') !== 'false';
const IMAP_USER = _get('IMAP_USER');
const IMAP_PASS = _get('IMAP_PASS');

function makeTransport() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SSL,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });
}

function makeImap() {
  return new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_SSL,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
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

// ── MCP Server ───────────────────────────────────────────────────────────────
const server = new McpServer({ name: 'email', version: '1.0.0' });

// ── Tool: send_email ─────────────────────────────────────────────────────────
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
  },
  async (args) => {
    try {
      const mail = {
        from: `${DISPLAY_NAME} <${SMTP_USER}>`,
        to: args.to,
        subject: args.subject,
        ...(args.text && { text: args.text }),
        ...(args.html && { html: args.html }),
        ...(args.cc  && { cc:  args.cc  }),
        ...(args.bcc && { bcc: args.bcc }),
      };
      if (args.attachments?.length) {
        mail.attachments = args.attachments.map(a => ({
          path: a.path,
          filename: a.filename || path.basename(a.path),
        }));
      }
      const info = await makeTransport().sendMail(mail);
      return { content: [{ type: 'text', text: `✅ 发送成功\nmessageId: ${info.messageId}` }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `❌ 发送失败: ${e.message}` }] };
    }
  }
);

// ── Tool: list_folders ───────────────────────────────────────────────────────
server.tool('list_folders', '列出邮箱所有文件夹', {}, async () => {
  const c = makeImap();
  await c.connect();
  try {
    const list = await c.list();
    const names = list.map(b => b.path).sort();
    return { content: [{ type: 'text', text: names.join('\n') }] };
  } finally {
    await c.logout();
  }
});

// ── Tool: list_emails ────────────────────────────────────────────────────────
server.tool(
  'list_emails',
  '列出收件箱（或指定文件夹）的邮件，返回 uid/主题/发件人/日期',
  {
    folder:      z.string().default('INBOX').describe('文件夹，默认 INBOX'),
    limit:       z.number().int().default(20).describe('返回最新 N 封，默认 20'),
    unread_only: z.boolean().default(false).describe('仅未读邮件'),
  },
  async ({ folder, limit, unread_only }) => {
    const c = makeImap();
    await c.connect();
    try {
      const lock = await c.getMailboxLock(folder);
      try {
        const criteria = unread_only ? { seen: false } : { all: true };
        const uids = await c.search(criteria, { uid: true });
        if (!uids.length) return { content: [{ type: 'text', text: '没有邮件' }] };
        const recent = uids.slice(-limit);
        const msgs = [];
        for await (const msg of c.fetch(recent.join(','), { uid: true, envelope: true, flags: true }, { uid: true })) {
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

// ── Tool: get_email ──────────────────────────────────────────────────────────
server.tool(
  'get_email',
  '读取一封邮件的完整内容，返回正文和附件列表（附件序号用于 save_attachment）',
  {
    uid:    z.number().int().describe('邮件 uid，来自 list_emails 或 search_emails'),
    folder: z.string().default('INBOX').describe('文件夹'),
  },
  async ({ uid, folder }) => {
    const c = makeImap();
    await c.connect();
    try {
      const raw = await fetchRaw(c, folder, uid);
      if (!raw) return { content: [{ type: 'text', text: '未找到该邮件' }] };
      const p = await simpleParser(raw);
      const result = {
        from:    p.from?.text  || '',
        to:      p.to?.text    || '',
        cc:      p.cc?.text    || '',
        subject: p.subject     || '',
        date:    p.date?.toISOString() || '',
        text:    (p.text || '').slice(0, 10000),
        html_available: !!p.html,
        attachments: (p.attachments || []).map((a, i) => ({
          index:       i,
          filename:    a.filename || `attachment_${i}`,
          contentType: a.contentType,
          size:        a.size,
        })),
      };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } finally {
      await c.logout();
    }
  }
);

// ── Tool: get_email_html ─────────────────────────────────────────────────────
server.tool(
  'get_email_html',
  '获取邮件的 HTML 正文（用于富文本邮件）',
  {
    uid:    z.coerce.number().int().describe('邮件 uid'),
    folder: z.string().default('INBOX'),
  },
  async ({ uid, folder }) => {
    const c = makeImap();
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

// ── Tool: save_attachment ────────────────────────────────────────────────────
server.tool(
  'save_attachment',
  '将邮件附件保存到本地文件系统',
  {
    uid:              z.coerce.number().int().describe('邮件 uid'),
    attachment_index: z.coerce.number().int().describe('附件序号，来自 get_email 的 attachments[].index'),
    save_path:        z.string().describe('保存的完整本地路径，如 /Users/xxx/Downloads/report.pdf'),
    folder:           z.string().default('INBOX').describe('文件夹'),
  },
  async ({ uid, attachment_index, save_path, folder }) => {
    const c = makeImap();
    await c.connect();
    try {
      const raw = await fetchRaw(c, folder, uid);
      if (!raw) return { content: [{ type: 'text', text: '未找到该邮件' }] };
      const p = await simpleParser(raw);
      const att = p.attachments?.[attachment_index];
      if (!att) return { content: [{ type: 'text', text: `未找到附件序号 ${attachment_index}，共 ${p.attachments?.length || 0} 个附件` }] };
      fs.mkdirSync(path.dirname(save_path), { recursive: true });
      fs.writeFileSync(save_path, att.content);
      return { content: [{ type: 'text', text: `✅ 附件已保存到 ${save_path}（${att.size} 字节，${att.contentType}）` }] };
    } finally {
      await c.logout();
    }
  }
);

// ── Tool: search_emails ──────────────────────────────────────────────────────
server.tool(
  'search_emails',
  '按条件搜索邮件（发件人/主题/日期范围）',
  {
    folder:  z.string().default('INBOX'),
    from:    z.string().optional().describe('发件人包含（模糊）'),
    subject: z.string().optional().describe('主题包含（模糊）'),
    since:   z.string().optional().describe('日期起，格式 YYYY-MM-DD'),
    before:  z.string().optional().describe('日期止，格式 YYYY-MM-DD'),
    limit:   z.number().int().default(20),
  },
  async ({ folder, from, subject, since, before, limit }) => {
    const c = makeImap();
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
        const recent = uids.slice(-limit);
        const msgs = [];
        for await (const msg of c.fetch(recent.join(','), { uid: true, envelope: true, flags: true }, { uid: true })) {
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

// ── Tool: mark_email ─────────────────────────────────────────────────────────
server.tool(
  'mark_email',
  '标记邮件为已读或未读',
  {
    uid:    z.number().int().describe('邮件 uid'),
    folder: z.string().default('INBOX'),
    action: z.enum(['read', 'unread']).describe('read=已读  unread=未读'),
  },
  async ({ uid, folder, action }) => {
    const c = makeImap();
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

// ── Start ────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Email MCP (${SMTP_USER}) running`);
}
main().catch(e => { console.error(e); process.exit(1); });
