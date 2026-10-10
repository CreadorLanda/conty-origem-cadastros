# Origem do cadastro no app

Contrato de atribuição que sobrevive ao webview sem referrer: o que viaja no link, o que o app grava no primeiro toque e como o cadastro consome isso para decidir a origem, de forma auditável.

## Contrato

Cada link carrega um toque: `clickId` (único, para deduplicar clique repetido), `channel` (`campaign` | `referral` | `community` | `organic`), e opcionalmente `creatorId`, `source`, `campaign`. O app grava cada toque na primeira abertura (`recordTouch`). A janela de validade é medida a partir do primeiro toque registrado (a primeira abertura do app) e dura `validityMs` (padrão 7 dias).

Exemplos de link:

- Campanha: `app://open?clickId=ck_123&channel=campaign&campaign=verao&source=instagram`
- Indicação: `app://open?clickId=ck_456&channel=referral&creatorId=crt_ana`

## Qual toque vence

A regra está num lugar só, em `decideOrigin` (`src/attribution.ts`): **último toque dentro da janela**, e no empate de horário vence o canal de maior prioridade (`campaign > referral > community > organic`). Toque que ocorre depois do cadastro, ou fora da janela de validade, não concorre. Clique repetido (mesmo `clickId`) não cria origem duplicada.

Sem nenhum toque válido, a origem é `organic` com o motivo gravado — não um dado faltando em silêncio. Depois de resolvido, o cadastro congela: link aberto depois não muda a origem.

## Auditoria

`resolveSignup` devolve a decisão com a janela (`firstOpenAt`, `windowEndsAt`), a origem escolhida e **todos os toques considerados**, cada um com `outcome` (`won` / `after_signup` / `outside_window` / `superseded`) e o motivo em texto. Dá para ler por que aquele cadastro recebeu aquela origem.

## Como rodar

Node 22.

```bash
npm install
npm test
npm run dev   # http://127.0.0.1:3006
```

```bash
curl -s -X POST localhost:3006/devices/dev_1/touches \
  -H 'content-type: application/json' \
  -d '{"clickId":"ck_123","channel":"campaign","occurredAt":"2026-06-01T10:00:00.000Z","creatorId":"crt_ana"}'

curl -s -X POST localhost:3006/devices/dev_1/signup \
  -H 'content-type: application/json' -d '{"signupAt":"2026-06-01T12:00:00.000Z"}'
```

## Uso de IA

Usei o Claude para criar os testes.
