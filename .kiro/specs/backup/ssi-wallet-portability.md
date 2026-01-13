# SSI Digital Wallet Portability

> Ringkasan dari artikel [Trinsic Leads SSI Digital Wallet Portability](https://trinsic.id/ssi-digital-wallet-portability/) beserta referensi GitHub dan resources untuk pembelajaran.

## Apa itu Wallet Portability?

**Wallet Portability** adalah kemampuan untuk **export** wallet dari satu aplikasi dan **import** ke aplikasi lain, tanpa kehilangan credentials atau terkunci pada satu vendor (vendor lock-in).

"Portable" adalah salah satu dari [10 prinsip Self-Sovereign Identity (SSI)](http://www.lifewithalacrity.com/2016/04/the-path-to-self-soverereign-identity.html). Untuk mencapai self-sovereignty, individu **harus** dapat mengontrol di mana informasi identitas dan credentials mereka disimpan.

---

## Cara Kerja

### Arsitektur High-Level

```
┌─────────────────┐     Export (encrypted)     ┌─────────────────┐
│  Trinsic Wallet │ ──────────────────────────▶│   Backup File   │
│                 │     + Recovery Phrase      │   (.zip/json)   │
└─────────────────┘                            └────────┬────────┘
                                                        │
                                                        ▼ Import
                                               ┌─────────────────┐
                                               │   Lissi Wallet  │
                                               │   atau esatus   │
                                               └─────────────────┘
```

### Langkah-langkah Export/Import

#### Export dari Trinsic Wallet

1. Buka **Settings** → klik tab **Export Wallet**
2. Catat **recovery phrase** (12-24 kata)
3. Klik tombol **Export Wallet**
4. Simpan file wallet ke lokasi yang aman

#### Import ke Wallet Lain (contoh: Lissi)

1. Buka aplikasi Lissi → **Settings** → **Recover Account**
2. Klik **Open File** dan pilih file wallet dari Trinsic
3. Masukkan **recovery phrase**
4. Klik **Recover Backup**

---

## Technology Stack

| Layer | Teknologi | Deskripsi |
|-------|-----------|-----------|
| **Framework** | Hyperledger Aries | Agent-to-agent communication protocol |
| **Storage** | Aries Askar | Secure encrypted wallet storage |
| **Ledger** | Hyperledger Indy | Decentralized identity registry (DIDs) |
| **Crypto** | Hyperledger Ursa | Cryptographic primitives library |
| **Format** | W3C Verifiable Credentials | Standard format untuk credentials |
| **Messaging** | DIDComm | Secure messaging protocol |

### Wallet yang Mendukung Portability

- [Trinsic Wallet](https://trinsic.id/trinsic-wallet/)
- [Lissi Wallet](https://lissi.id/mobile)
- [esatus Wallet](https://play.google.com/store/apps/details?id=com.esatus.wallet)

> Semua wallet ini dibangun di atas **Aries Framework .NET**

---

## Keterbatasan Saat Ini

| Keterbatasan | Penjelasan |
|--------------|------------|
| **Connections tidak ikut transfer** | Karena mediator agent berbeda tiap vendor, persistent connections tidak bisa dipindahkan seamlessly |
| **Duplikasi wallet** | File export bisa di-import ke multiple devices, menimbulkan security concern |
| **Hanya mobile wallets** | Enterprise dan cloud wallets belum didukung |
| **Framework dependent** | Perlu testing lebih lanjut untuk interoperability antar Aries frameworks |

---

## GitHub Repositories

### Core Frameworks (Hyperledger Aries)

| Repository | Deskripsi | Status |
|------------|-----------|--------|
| [hyperledger/aries-framework-dotnet](https://github.com/hyperledger/aries-framework-dotnet) | Framework .NET yang digunakan Trinsic, Lissi, esatus | Archived → pindah ke OWF |
| [openwallet-foundation-labs/wallet-framework-dotnet](https://github.com/openwallet-foundation-labs/wallet-framework-dotnet) | Successor dari Aries Framework .NET | Active |
| [openwallet-foundation/askar](https://github.com/openwallet-foundation/askar) | Secure storage dengan fitur import/export | Active |
| [openwallet-foundation/credo-ts](https://github.com/openwallet-foundation/credo-ts) | Aries Framework JavaScript/TypeScript | Active |
| [hyperledger/aries-framework-go](https://github.com/hyperledger/aries-framework-go) | Aries Framework untuk Go | Archived |

### Wallet Implementations

| Repository | Deskripsi | Tech Stack |
|------------|-----------|------------|
| [trustbloc/wallet-sdk](https://github.com/trustbloc/wallet-sdk) | Verifiable Credential Wallet SDK | Go, GoMobile, Android, iOS |
| [openwallet-foundation-labs/learner-credential-wallet](https://github.com/openwallet-foundation-labs/learner-credential-wallet) | Educational credential wallet | React Native |

### Trinsic Repositories

| Repository | Deskripsi |
|------------|-----------|
| [trinsic-id/sdk](https://github.com/trinsic-id/sdk) | SDK multi-language untuk Trinsic platform |
| [trinsic-id/sdk-examples](https://github.com/trinsic-id/sdk-examples) | Contoh implementasi di berbagai bahasa |
| [trinsic-id/issuer-reference-app](https://github.com/trinsic-id/issuer-reference-app) | Reference app untuk credential issuer (Archived) |
| [trinsic-id/verifier-reference-app](https://github.com/trinsic-id/verifier-reference-app) | Reference app untuk credential verifier (Archived) |

---

## Standards & Specifications

### W3C Universal Wallet

Spesifikasi untuk portable, extensible, JSON-LD wallet yang mendukung digital currencies dan credentials.

- **Specification**: [Universal Wallet 2020](https://w3c-ccg.github.io/universal-wallet-interop-spec/)
- **GitHub**: [w3c-ccg/universal-wallet-interop-spec](https://github.com/w3c-ccg/universal-wallet-interop-spec)
- **Reference Implementation**: [packages/universal-wallet](https://github.com/w3c-ccg/universal-wallet-interop-spec/tree/master/packages/universal-wallet)

### Aries RFCs

| RFC | Deskripsi | Link |
|-----|-----------|------|
| RFC 0050 | Wallet concepts dan interfaces | [GitHub](https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0050-wallets/README.md) |

### W3C Verifiable Credentials

- **Data Model v2.0**: [W3C Recommendation](https://www.w3.org/TR/vc-data-model-2.0/)
- **Test Suite**: [vc-data-model-2.0-test-suite](https://w3c.github.io/vc-data-model-2.0-test-suite/)

### Decentralized Identifiers (DIDs)

- **DID Core Spec**: [W3C DID Core](https://w3c.github.io/did-core/)

---

## Learning Path

### 1. Pahami Konsep Dasar

1. Baca [What is Self-Sovereign Identity?](https://trinsic.id/what-is-self-sovereign-identity/)
2. Pelajari [10 Principles of SSI](http://www.lifewithalacrity.com/2016/04/the-path-to-self-soverereign-identity.html)
3. Baca [Aries RFC 0050 - Wallets](https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0050-wallets/README.md)

### 2. Pelajari Standards

1. [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model-2.0/)
2. [W3C Decentralized Identifiers](https://w3c.github.io/did-core/)
3. [Universal Wallet Specification](https://w3c-ccg.github.io/universal-wallet-interop-spec/)

### 3. Hands-On Development

**Untuk .NET developers:**
```bash
git clone https://github.com/openwallet-foundation-labs/wallet-framework-dotnet
```

**Untuk TypeScript/JavaScript developers:**
```bash
git clone https://github.com/openwallet-foundation/credo-ts
```

**Untuk Mobile (React Native):**
```bash
git clone https://github.com/openwallet-foundation-labs/learner-credential-wallet
```

### 4. Join Community

- [Aries Working Group](https://wiki.hyperledger.org/display/ARIES/Aries+Working+Group) - Weekly calls
- [OpenWallet Foundation](https://openwallet.foundation/)
- [Hyperledger Discord](https://discord.gg/hyperledger)

---

## Resources Tambahan

### Documentation

- [Trinsic Documentation](https://docs.trinsic.id/docs/overview)
- [Aries Cloud Agent Python Docs](https://aries-cloud-agent-python.readthedocs.io/)
- [iGrant.io SSI Docs](https://docs.igrant.io/ssi)

### Articles & Blog Posts

- [Open Source SSI Codebases](https://trinsic.id/open-source-ssi-codebases/) - Trinsic
- [SSI Wallets: 3 Decisions](https://trinsic.id/ssi-wallets-3-decisions/) - Trinsic

### Videos

- [Wallet Portability Demo](https://trinsic.id/ssi-digital-wallet-portability/) - Video di artikel asli menunjukkan transfer wallet antara Trinsic dan Lissi

---

## Glossary

| Term | Definition |
|------|------------|
| **SSI** | Self-Sovereign Identity - model identitas di mana individu mengontrol data mereka sendiri |
| **DID** | Decentralized Identifier - identifier yang tidak bergantung pada registry terpusat |
| **VC** | Verifiable Credential - credential digital yang bisa diverifikasi secara kriptografis |
| **Wallet** | Aplikasi untuk menyimpan dan mengelola DIDs dan VCs |
| **Agent** | Software yang bertindak atas nama holder untuk komunikasi dengan pihak lain |
| **Mediator** | Agent perantara yang membantu routing pesan antar agents |
| **Recovery Phrase** | Kata-kata (biasanya 12-24) untuk mengenkripsi/dekripsi wallet backup |

---

## Referensi

1. [Trinsic Leads SSI Digital Wallet Portability](https://trinsic.id/ssi-digital-wallet-portability/) - Artikel asli (August 2020)
2. [The Path to Self-Sovereign Identity](http://www.lifewithalacrity.com/2016/04/the-path-to-self-soverereign-identity.html) - Christopher Allen
3. [W3C Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/)
4. [Universal Wallet 2020 Specification](https://w3c-ccg.github.io/universal-wallet-interop-spec/)
