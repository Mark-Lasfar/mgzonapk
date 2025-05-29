export class PrintfulService {
    private apiKey: string
    private apiUrl: string
  
    constructor(config: { apiKey: string; apiUrl: string }) {
      this.apiKey = config.apiKey
      this.apiUrl = config.apiUrl
    }
  
    private async fetchApi(endpoint: string, options: RequestInit = {}) {
      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
  
      if (!response.ok) {
        throw new Error(`Printful API error: ${response.statusText}`)
      }
  
      return response.json()
    }
  
    async createProduct(data: {
      name: string
      design: {
        url: string
        position: string
      }
      productType: string
      variantId: number
    }) {
      return this.fetchApi('/products', {
        method: 'POST',
        body: JSON.stringify({
          sync_product: {
            name: data.name,
            thumbnail: data.design.url,
          },
          sync_variants: [
            {
              variant_id: data.variantId,
              files: [
                {
                  url: data.design.url,
                  position: data.design.position,
                },
              ],
            },
          ],
        }),
      })
    }
  
    async createOrder(data: {
      external_id: string
      recipient: {
        name: string
        address1: string
        city: string
        state_code: string
        country_code: string
        zip: string
      }
      items: {
        sync_variant_id: number
        quantity: number
      }[]
    }) {
      return this.fetchApi('/orders', {
        method: 'POST',
        body: JSON.stringify({
          external_id: data.external_id,
          recipient: data.recipient,
          items: data.items,
        }),
      })
    }
  
    async getShippingRates(data: {
      recipient: {
        country_code: string
        state_code: string
        zip: string
      }
      items: {
        variant_id: number
        quantity: number
      }[]
    }) {
      return this.fetchApi('/shipping/rates', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    }
  
    async getProductVariants(productId: string) {
      return this.fetchApi(`/products/${productId}/variants`)
    }
  }