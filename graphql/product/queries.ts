// /home/mark/Music/my-nextjs-project-clean/graphql/product/queries.ts
import { gql } from '@apollo/client';

export const GET_PRODUCTS = gql`
  query GetProducts($sellerId: ID!, $excludeProductId: ID) {
    products(sellerId: $sellerId, excludeProductId: $excludeProductId) {
      _id
      name
      slug
      description
      price
      listPrice
      countInStock
      category
      brand
      featured
      isPublished
      pricing {
        basePrice
        markup
        profit
        commission
        finalPrice
        currency
        discount {
          type
          value
          startDate
          endDate
        }
      }
      warehouseData {
        warehouseId
        provider
        location
        sku
        quantity
        minimumStock
        reorderPoint
        variants {
          id
          sku
          barcode
          attributes {
            color
            size
          }
          priceAdjustment
          stock
        }
      }
      images
      relatedProducts {
        _id
        name
      }
      dropshipping {
        provider
        externalProductId
        externalSku
      }
      translations {
        locale
        name
        description
      }
      sections {
        id
        type
        content {
          text
          url
          label
          endDate
          images
          reviews {
            id
            rating
            comment
          }
        }
        position
      }
      layout
      tags
      sellerId
      createdAt
      updatedAt
    }
  }
`;

export const GET_CAMPAIGN_PRODUCTS = gql`
  query GetCampaignProducts($sellerId: ID!, $campaignId: ID!) {
    products(sellerId: $sellerId) {
      _id
      name
      pricing {
        currency
        finalPrice
      }
      availability
    }
  }
`;



export const CALCULATE_PRICING = gql`
  mutation CalculatePricing($basePrice: Float!, $listPrice: Float!, $markup: Float, $discount: DiscountInput, $currency: String!) {
    calculatePricing(basePrice: $basePrice, listPrice: $listPrice, markup: $markup, discount: $discount, currency: $currency) {
      currency
      commission
      suggestedMarkup
      finalPrice
      profit
    }
  }
`;