import axios from 'axios'

function onlyDigits(value: any) {
  return String(value ?? '').replace(/\D/g, '')
}

function num(value: any, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeMoney(value: any) {
  const n = num(value, 0)
  if (n > 100000) return n / 100
  return n
}

function normalizeWeightKg(value: any) {
  const n = num(value, 0)
  if (n > 200) return n / 1000
  return n
}

function normalizeDimensionMeters(value: any) {
  const n = num(value, 0)
  if (n <= 0) return 0
  if (n > 5) return n / 100
  return n
}

function pickFirst(...values: any[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value
  }
  return undefined
}

function extractOrderItems(body: any) {
  if (Array.isArray(body?.items) && body.items.length) return body.items
  if (Array.isArray(body?.dispatchOrder?.packages)) {
    return body.dispatchOrder.packages.flatMap((pkg: any) =>
      Array.isArray(pkg?.items) ? pkg.items : []
    )
  }
  return []
}

function extractDims(item: any) {
  const dims =
    item?.dimensions ||
    item?.additionalInfo?.dimension ||
    item?.additionalInfo?.dimensions ||
    item?.dimension ||
    {}

  return {
    length: pickFirst(dims.length, dims.comprimento, item?.length, item?.comprimento),
    width: pickFirst(dims.width, dims.largura, item?.width, item?.largura),
    height: pickFirst(dims.height, dims.altura, item?.height, item?.altura),
    weight: pickFirst(dims.weight, item?.weight, item?.weightKg, item?.peso),
  }
}

function hasUsableDimensions(item: any) {
  const dims = extractDims(item)
  return (
    normalizeDimensionMeters(dims.length) > 0 &&
    normalizeDimensionMeters(dims.width) > 0 &&
    normalizeDimensionMeters(dims.height) > 0 &&
    normalizeWeightKg(dims.weight) > 0
  )
}

function mergeCatalogIntoItem(item: any, sku: any) {
  const currentDims =
    item?.dimensions ||
    item?.additionalInfo?.dimension ||
    item?.additionalInfo?.dimensions ||
    item?.dimension ||
    {}

  const catalogLength = pickFirst(
    sku?.Dimension?.length,
    sku?.RealDimension?.realLength,
    sku?.PackagedLength,
    sku?.Length,
    sku?.length
  )
  const catalogWidth = pickFirst(
    sku?.Dimension?.width,
    sku?.RealDimension?.realWidth,
    sku?.PackagedWidth,
    sku?.Width,
    sku?.width
  )
  const catalogHeight = pickFirst(
    sku?.Dimension?.height,
    sku?.RealDimension?.realHeight,
    sku?.PackagedHeight,
    sku?.Height,
    sku?.height
  )
  const catalogWeight = pickFirst(
    sku?.Dimension?.weight,
    sku?.RealDimension?.realWeight,
    sku?.PackagedWeightKg,
    sku?.WeightKg,
    sku?.weightKg
  )

  return {
    ...item,
    dimensions: {
      ...currentDims,
      length: pickFirst(currentDims.length, currentDims.comprimento, item?.length, item?.comprimento, catalogLength),
      width: pickFirst(currentDims.width, currentDims.largura, item?.width, item?.largura, catalogWidth),
      height: pickFirst(currentDims.height, currentDims.altura, item?.height, item?.altura, catalogHeight),
      weight: pickFirst(currentDims.weight, item?.weight, item?.weightKg, item?.peso, catalogWeight),
    },
  }
}

function readCustomAppField(body: any, appId: string, fieldName: string) {
  const customApps = body?.customData?.customApps
  if (!Array.isArray(customApps)) return undefined
  const app = customApps.find((entry: any) => entry?.id === appId)
  return app?.fields?.[fieldName]
}

async function fetchSkuWithCatalogCredentials(ctx: any, skuId: string, settings: any) {
  const account = ctx.vtex.account
  return axios.get(
    `https://${account}.vtexcommercestable.com.br/api/catalog_system/pvt/sku/stockkeepingunitbyid/${skuId}`,
    {
      headers: {
        'X-VTEX-API-AppKey': settings.vtexCatalogAppKey,
        'X-VTEX-API-AppToken': settings.vtexCatalogAppToken,
      },
      timeout: 10000,
    }
  )
}

async function enrichItemsFromCatalog(ctx: any, items: any[], settings: any) {
  return Promise.all(
    items.map(async (item: any) => {
      if (hasUsableDimensions(item)) {
        return {
          ...item,
          __catalogDebug: {
            usedExistingDimensions: true,
          },
        }
      }

      const skuId = onlyDigits(pickFirst(item?.skuId, item?.id, item?.itemId, item?.refId))
      if (!skuId) {
        return {
          ...item,
          __catalogDebug: {
            skuId: null,
            lookup: 'no-sku-id',
          },
        }
      }

      try {
        const response = await fetchSkuWithCatalogCredentials(ctx, skuId, settings)
        const sku = response.data
        const merged = mergeCatalogIntoItem(item, sku)
        return {
          ...merged,
          __catalogDebug: {
            skuId,
            lookup: 'success',
            rawDimension: sku?.Dimension || null,
            rawRealDimension: sku?.RealDimension || null,
            mergedDimensions: merged?.dimensions || null,
          },
        }
      } catch (error: any) {
        return {
          ...item,
          __catalogDebug: {
            skuId,
            lookup: 'failed',
            status: error?.response?.status || null,
            data: error?.response?.data || null,
            message: error?.message || null,
          },
        }
      }
    })
  )
}

function mapCubagem(items: any[]) {
  return items
    .map((item: any) => {
      const dims = extractDims(item)
      const quantity = Math.max(1, num(item?.quantity ?? item?.qty, 1))
      return {
        comprimento: normalizeDimensionMeters(dims.length),
        largura: normalizeDimensionMeters(dims.width),
        altura: normalizeDimensionMeters(dims.height),
        volumes: quantity,
      }
    })
    .filter((item: any) => item.comprimento > 0 && item.largura > 0 && item.altura > 0)
}

function calcWeightFromItems(items: any[]) {
  return items.reduce((acc: number, item: any) => {
    const dims = extractDims(item)
    const quantity = Math.max(1, num(item?.quantity ?? item?.qty, 1))
    const weight = normalizeWeightKg(dims.weight)
    return acc + weight * quantity
  }, 0)
}

function calcValueFromItems(items: any[]) {
  return items.reduce((acc: number, item: any) => {
    const quantity = Math.max(1, num(item?.quantity ?? item?.qty, 1))
    const unitPrice = normalizeMoney(
      pickFirst(
        item?.sellingPrice,
        item?.price,
        item?.value,
        item?.priceDefinition?.calculatedSellingPrice,
        item?.priceDefinition?.sellingPrices?.[0]?.value,
        item?.priceDefinition?.total,
        item?.priceTags?.[0]?.value
      )
    )
    return acc + unitPrice * quantity
  }, 0)
}

function extractRecipientDocument(body: any, settings: any) {
  return onlyDigits(
    pickFirst(
      body?.recipient?.document,
      body?.clientProfileData?.corporateDocument,
      body?.clientProfileData?.document,
      readCustomAppField(body, 'orderconfig', 'document'),
      readCustomAppField(body, 'orderconfig', 'corporateDocument'),
      readCustomAppField(body, 'gx-freight', 'recipientDocument'),
      body?.document,
      body?.cnpjDestinatario,
      settings.braspressDefaultRecipientDocument
    )
  )
}

export async function buildBraspressQuote(ctx: any, body: any) {
  const appId = `${ctx.vtex.account}.freight-hub`
  const settings = await ctx.clients.apps.getAppSettings(appId)

  if (!settings || settings.braspressEnabled === false) {
    return { slas: [], diagnostic: { reason: 'braspress_disabled' } }
  }

  const rawItems = extractOrderItems(body)
  const items = await enrichItemsFromCatalog(ctx, rawItems, settings)
  const cubagem = mapCubagem(items)

  if (!cubagem.length) {
    return {
      slas: [],
      diagnostic: {
        reason: 'missing_item_dimensions',
        itemsCount: items.length,
        itemIds: items.map((item: any) => item?.id || item?.skuId || null),
        itemsPreview: items.map((item: any) => ({
          id: item?.id || item?.skuId || null,
          quantity: item?.quantity,
          dimensions:
            item?.dimensions ||
            item?.additionalInfo?.dimension ||
            item?.additionalInfo?.dimensions ||
            item?.dimension ||
            null,
          catalogDebug: item?.__catalogDebug || null,
        })),
        bodyKeys: Object.keys(body || {}),
      },
    }
  }

  const destinationPostalCode = onlyDigits(
    pickFirst(
      body?.shippingData?.address?.postalCode,
      body?.shippingData?.selectedAddresses?.[0]?.postalCode,
      body?.destination?.postalCode,
      body?.postalCode,
      body?.cepDestino,
      body?.selectedAddresses?.[0]?.postalCode,
      body?.address?.postalCode
    )
  )

  const recipientDocument = extractRecipientDocument(body, settings)
  const totalValue = normalizeMoney(
    pickFirst(body?.totalValue, body?.value, body?.vlrMercadoria, calcValueFromItems(items))
  )
  const totalWeight = normalizeWeightKg(
    pickFirst(body?.weightKg, body?.weight, body?.peso, calcWeightFromItems(items))
  )

  if (!totalWeight) {
    return {
      slas: [],
      diagnostic: {
        reason: 'missing_item_weight',
        itemsCount: items.length,
        bodyKeys: Object.keys(body || {}),
      },
    }
  }

  const volumes =
    cubagem.reduce((acc: number, item: any) => acc + Math.max(1, num(item.volumes, 1)), 0) ||
    Math.max(1, items.length)

  const payload: any = {
    cnpjRemetente: onlyDigits(settings.braspressCnpjRemetente),
    modal: settings.braspressModal || 'R',
    tipoFrete: settings.braspressTipoFrete || '1',
    cepOrigem: onlyDigits(settings.braspressCepOrigem),
    cepDestino: destinationPostalCode,
    vlrMercadoria: totalValue,
    peso: totalWeight,
    volumes,
    cubagem,
  }

  if (recipientDocument) payload.cnpjDestinatario = recipientDocument

  if (!payload.cepDestino || !payload.cnpjRemetente || !payload.vlrMercadoria || !payload.peso) {
    return {
      slas: [],
      diagnostic: {
        reason: 'missing_required_quote_inputs',
        payload,
      },
    }
  }

  try {
    const auth = Buffer.from(`${settings.braspressUser}:${settings.braspressPassword}`).toString('base64')
    const response = await axios.post('https://api.braspress.com/v1/cotacao/calcular/json', payload, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    const prazo = num(response.data?.prazo, 0)
    const totalFrete = Math.max(num(response.data?.totalFrete, 0), num(settings.minimumPrice, 0))
    const markupPercent = num(settings.markupPercent, 0)
    const finalPrice = totalFrete * (1 + markupPercent / 100)
    const name = settings.braspressPolicyName || 'Braspress Transportes Urgentes'

    return {
      slas: [
        {
          id: String(response.data?.id || 'braspress'),
          name,
          price: Math.round(finalPrice * 100),
          shippingEstimate: `${prazo}d`,
          deliveryChannel: 'delivery',
          pickupStoreInfo: null,
        },
      ],
      provider: {
        id: response.data?.id,
        prazo,
        totalFrete,
      },
      requestPayload: payload,
    }
  } catch (error: any) {
    ctx.vtex.logger.error({
      message: 'braspress_quote_failed',
      status: error?.response?.status,
      data: error?.response?.data,
      payload,
    })

    return {
      slas: [],
      diagnostic: {
        reason: 'provider_failed',
        status: error?.response?.status || null,
        data: error?.response?.data || null,
        payload,
      },
    }
  }
}
