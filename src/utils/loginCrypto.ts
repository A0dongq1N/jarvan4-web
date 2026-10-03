/**
 * 登录密码 RSA-OAEP(SHA-256) 加密（与 Master logincrypto 约定一致）。
 *
 * 安全上下文（HTTPS / localhost）走原生 Web Crypto；
 * 明文 HTTP + IP 访问时 window.crypto.subtle 不存在，回退到 node-forge。
 */

const SEP = '\u001e'

export interface LoginKeyData {
  keyId: string
  publicKeyPem: string
  nonce: string
  expireAt: number
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const raw = atob(b64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf.buffer
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function hasWebCrypto(): boolean {
  return typeof window !== 'undefined' && !!window.crypto?.subtle
}

async function encryptWithWebCrypto(
  publicKeyPem: string,
  plaintext: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKeyPem),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  const plain = new TextEncoder().encode(plaintext)
  const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, plain)
  return bufToBase64(cipher)
}

async function encryptWithForge(publicKeyPem: string, plaintext: string): Promise<string> {
  const forge = (await import('node-forge')).default
  const pub = forge.pki.publicKeyFromPem(publicKeyPem)
  const cipher = pub.encrypt(forge.util.encodeUtf8(plaintext), 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  })
  return forge.util.encode64(cipher)
}

/** 加密载荷：nonce + 0x1e + password → base64 密文 */
export async function encryptLoginPassword(
  publicKeyPem: string,
  nonce: string,
  password: string,
): Promise<string> {
  const plaintext = `${nonce}${SEP}${password}`
  if (hasWebCrypto()) {
    return encryptWithWebCrypto(publicKeyPem, plaintext)
  }
  return encryptWithForge(publicKeyPem, plaintext)
}
