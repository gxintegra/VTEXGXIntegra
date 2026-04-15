# Instalacao limpa no workspace gxintegra

## 1. Limpar testes antigos (opcional, mas recomendado)
No terminal:

```bash
vtex use freightdev
vtex unlink globalx.freight-hub
vtex uninstall globalx.freight-hub -y

vtex use preproddev
vtex unlink globalx.freight-hub
vtex uninstall globalx.freight-hub -y
```

Se existir app de checkout UI de teste, remova tambem:

```bash
vtex uninstall globalx.checkout-freight-ui -y
vtex uninstall vtex.checkout-ui-settings -y
```

## 2. Entrar no workspace novo
```bash
vtex use gxintegra
vtex whoami
```

## 3. Abrir a pasta da app
```bash
cd C:\globalx-freight-hub-clean
```

## 4. Linkar a app
```bash
vtex link
```

## 5. Configurar os settings da app
No Admin do workspace `gxintegra`, abra a app `Global X Freight Hub` e preencha:
- Braspress User
- Braspress Password
- Braspress Remitter CNPJ
- Braspress Origin ZIP Code
- Braspress modal = R
- Braspress freight type = 1
- Checkout SLA display name = Braspress Transportes Urgentes
- VTEX Catalog App Key
- VTEX Catalog App Token
- Optional default recipient document (opcional)

## 6. Validar saude
Abra:
- `https://gxintegra--globalx.myvtex.com/_v/health`

Esperado:
```json
{"ok":true,"service":"globalx.freight-hub"}
```

## 7. Validar cotacao manual
No Postman:
- Metodo: POST
- URL: `https://gxintegra--globalx.myvtex.com/_v/quote`
- Header: `Content-Type: application/json`

Exemplo de body:
```json
{
  "shippingData": {
    "address": {
      "postalCode": "74884092"
    }
  },
  "clientProfileData": {
    "corporateDocument": "01612092000123"
  },
  "items": [
    {
      "id": "1",
      "quantity": 2,
      "sellingPrice": 9645
    }
  ]
}
```

Se o SKU estiver com dimensoes no catalogo e as credenciais do catalogo estiverem corretas, a resposta deve vir com `slas`.

## 8. Validar do checkout
No checkout do workspace `gxintegra`, rode no console:

```javascript
(async function () {
  const orderForm = await vtexjs.checkout.getOrderForm()
  const resp = await fetch('https://gxintegra--globalx.myvtex.com/_v/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderForm)
  })

  console.log('status:', resp.status)
  console.log(await resp.text())
})()
```

## 9. So depois disso
Somente depois que o `/_v/quote` funcionar com `orderForm` real, crie ou reinstale a app de checkout UI.
