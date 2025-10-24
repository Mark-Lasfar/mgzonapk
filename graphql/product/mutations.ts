// /home/mark/Music/my-nextjs-project-clean/graphql/product/mutations.ts
import { gql } from '@apollo/client';

export const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: ProductInput!) {
    createProduct(input: $input) {
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

export const UPDATE_PRODUCT = gql`
  mutation UpdateProduct($id: ID!, $input: ProductInput!) {
    updateProduct(id: $id, input: $input) {
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

export const UPLOAD_IMAGE = gql`
  mutation UploadImage($input: UploadImageInput!) {
    uploadImage(input: $input) {
      url
      publicId
    }
  }
`;

export const DELETE_IMAGE = gql`
  mutation DeleteImage($publicId: String!) {
    deleteImage(publicId: $publicId)
  }
`;

export const IMPORT_DROPSHIPPING_PRODUCT = gql`
  mutation ImportDropshippingProduct($providerId: ID!, $externalProductId: String!) {
    importDropshippingProduct(providerId: $providerId, externalProductId: $externalProductId) {
      name
      description
      price
      images
      sku
      currency
      region
      availability
    }
  }
`;