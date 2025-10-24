// graphql/product/fragments.ts

import { gql } from '@apollo/client';

export const PRODUCT_FRAGMENT = gql`
  fragment ProductFragment on Product {
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
      markup
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
`;