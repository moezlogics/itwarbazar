import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  createPriceListsWorkflow,
  batchPriceListPricesWorkflow,
  deletePriceListsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Per-product discount — a one-screen replacement for the multi-step
 * "create a price list → add the product → set each price" flow.
 *
 * WHY A REAL PRICE LIST (and not just a metadata field):
 * the storefront's sale UI keys off
 * `calculated_price.calculated_price.price_list_type === "sale"`, and —
 * far more importantly — Medusa's pricing engine is what the CART and
 * CHECKOUT charge from. A metadata-only "sale price" would *look*
 * discounted but still bill full price at checkout. So this drives the
 * exact same primitive the manual flow does: a `sale` price list holding
 * this product's variant prices.
 *
 * We go through the CORE WORKFLOWS (not the pricing module directly)
 * because the workflows accept `variant_id` and resolve the
 * variant → price_set link themselves; the raw pricing module only
 * speaks `price_set_id`.
 *
 * Each product owns exactly ONE managed list, its id kept on
 * `product.metadata.discount_price_list_id`, so we never touch price
 * lists an operator built by hand.
 *
 *   GET    → variants with base price + current sale price
 *   POST   → { prices: [{ variant_id, amount }] }  create/replace
 *   DELETE → remove the discount entirely
 */

const META_KEY = "discount_price_list_id"

/** Base (own, non-price-list) price of a variant. */
function basePriceOf(variant: any): { amount: number; currency: string } | null {
  const prices = variant?.prices || []
  if (!prices.length) return null
  const own = prices.find((p: any) => !p.price_list_id) || prices[0]
  const amount =
    typeof own?.amount === "number" ? own.amount : parseFloat(own?.amount)
  if (!Number.isFinite(amount)) return null
  return { amount, currency: String(own.currency_code || "").toLowerCase() }
}

/** Product + variant prices in one graph call. */
async function loadPricing(req: MedusaRequest, id: string) {
  const query = req.scope.resolve("query")
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "metadata",
      "variants.id",
      "variants.title",
      "variants.prices.id",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.prices.price_list_id",
    ],
    filters: { id },
  })
  return data?.[0]
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const product = await loadPricing(req, req.params.id)
  if (!product) return res.status(404).json({ error: "Product not found" })

  const listId = (product.metadata as any)?.[META_KEY] || null

  const variants = (product.variants || []).map((v: any) => {
    const base = basePriceOf(v)
    const sale = listId
      ? (v.prices || []).find((p: any) => p.price_list_id === listId)
      : null
    return {
      variant_id: v.id,
      title: v.title || "Default",
      currency_code: base?.currency || "",
      base_amount: base?.amount ?? 0,
      sale_amount: sale && typeof sale.amount === "number" ? sale.amount : null,
      sale_price_id: sale?.id || null,
    }
  })

  res.json({ price_list_id: listId, variants })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const body = (req.body || {}) as {
    prices?: Array<{ variant_id: string; amount: number }>
  }

  const product = await loadPricing(req, id)
  if (!product) return res.status(404).json({ error: "Product not found" })

  // Only keep prices that are a real number, > 0, and BELOW the base
  // price — a "discount" above list price is always an operator mistake.
  const baseByVariant = new Map<string, { amount: number; currency: string }>()
  for (const v of product.variants || []) {
    const base = basePriceOf(v)
    if (base) baseByVariant.set(v.id, base)
  }

  const prices: Array<{
    variant_id: string
    amount: number
    currency_code: string
  }> = []
  for (const p of body.prices || []) {
    const base = baseByVariant.get(p?.variant_id)
    const amount = Number(p?.amount)
    if (!base || !Number.isFinite(amount) || amount <= 0) continue
    if (amount >= base.amount) continue
    prices.push({
      variant_id: p.variant_id,
      amount,
      currency_code: base.currency,
    })
  }

  if (!prices.length) {
    return res.status(400).json({
      error:
        "No valid discounts. Each sale price must be a positive number below that variant's base price.",
    })
  }

  const productService: any = req.scope.resolve(Modules.PRODUCT)
  const existingId = (product.metadata as any)?.[META_KEY] || null

  if (existingId) {
    // Replace the managed list's prices wholesale — simplest correct way
    // to cover added / removed / changed variants in one save.
    const existingPriceIds = (product.variants || [])
      .flatMap((v: any) => v.prices || [])
      .filter((p: any) => p.price_list_id === existingId)
      .map((p: any) => p.id)

    try {
      await batchPriceListPricesWorkflow(req.scope).run({
        input: {
          data: {
            id: existingId,
            create: prices,
            update: [],
            delete: existingPriceIds,
          },
        },
      })
      return res.json({ price_list_id: existingId, updated: prices.length })
    } catch (e) {
      // List vanished behind our back — fall through and recreate.
    }
  }

  const { result } = await createPriceListsWorkflow(req.scope).run({
    input: {
      price_lists_data: [
        {
          title: `Discount — ${id}`,
          description:
            "Managed by the product Discount widget. Edit it from the product page.",
          type: "sale",
          status: "active",
          prices,
        } as any,
      ],
    },
  })

  const priceListId = (result as any)?.[0]?.id
  await productService.updateProducts(id, {
    metadata: { ...(product.metadata || {}), [META_KEY]: priceListId },
  })

  res.json({ price_list_id: priceListId, updated: prices.length })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const product = await loadPricing(req, id)
  if (!product) return res.status(404).json({ error: "Product not found" })

  const listId = (product.metadata as any)?.[META_KEY]
  if (listId) {
    try {
      await deletePriceListsWorkflow(req.scope).run({ input: { ids: [listId] } })
    } catch {
      /* already gone — still clear the pointer below */
    }
    const nextMeta = { ...(product.metadata || {}) }
    delete nextMeta[META_KEY]
    const productService: any = req.scope.resolve(Modules.PRODUCT)
    await productService.updateProducts(id, { metadata: nextMeta })
  }

  res.json({ deleted: true })
}
