import { decode, encode } from 'base-64'

type Base64Global = typeof globalThis & {
  base64ToArrayBuffer?: (value: string) => ArrayBuffer
  base64FromArrayBuffer?: (value: ArrayBuffer) => string
  arrayBufferToBase64?: (value: ArrayBuffer) => string
}

const normalizeBase64 = (value: string): string => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = base64.length % 4

  return padding ? base64 + '='.repeat(4 - padding) : base64
}

const base64ToArrayBuffer = (value: string): ArrayBuffer => {
  const binaryString = decode(normalizeBase64(value))
  const bytes = new Uint8Array(binaryString.length)

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return bytes.buffer
}

const arrayBufferToBase64 = (value: ArrayBuffer): string => {
  const bytes = new Uint8Array(value)
  let binaryString = ''

  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i])
  }

  return encode(binaryString)
}

const base64Global = globalThis as Base64Global

if (typeof base64Global.base64ToArrayBuffer === 'undefined') {
  base64Global.base64ToArrayBuffer = base64ToArrayBuffer
}

if (typeof base64Global.base64FromArrayBuffer === 'undefined') {
  base64Global.base64FromArrayBuffer = arrayBufferToBase64
}

if (typeof base64Global.arrayBufferToBase64 === 'undefined') {
  base64Global.arrayBufferToBase64 = arrayBufferToBase64
}
