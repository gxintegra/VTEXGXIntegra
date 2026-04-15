# Global X Freight Hub v0.3.0

Versao limpa para o workspace `gxintegra`.

## O que esta nesta versao
- Cotacao Braspress via `/_v/quote`
- Enriquecimento de peso e dimensoes pelo Catalogo VTEX via SKU
- Leitura do SKU no endpoint `catalog_system/pvt/sku/stockkeepingunitbyid/{skuId}`
- Diagnostico detalhado quando faltar documento, dimensao ou peso
- Suporte a documento do destinatario por `clientProfileData`, payload manual, `braspressDefaultRecipientDocument` e `customData.customApps`

## Importante
Nao inclui customizacao de checkout UI. Primeiro valide o endpoint `/_v/quote` no workspace `gxintegra`.

## Settings obrigatorios
- braspressUser
- braspressPassword
- braspressCnpjRemetente
- braspressCepOrigem
- vtexCatalogAppKey
- vtexCatalogAppToken

## Teste manual
Use o endpoint:
`https://gxintegra--globalx.myvtex.com/_v/quote`
