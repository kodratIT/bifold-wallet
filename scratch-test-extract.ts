export const extractRawCredential = (record: any) => {
  if (!record) return null
  const serialized = typeof record.toJSON === 'function' ? record.toJSON() : record
  
  if (serialized.sdJwtVc) {
    return serialized.sdJwtVc
  }
  
  if (serialized.credentials?.length > 0) {
    return serialized.credentials.length === 1 ? serialized.credentials[0] : serialized.credentials
  }

  if (serialized.credential) {
    return serialized.credential
  }
  
  return serialized
}
