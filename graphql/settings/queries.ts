// /home/mark/Music/my-nextjs-project-clean/graphql/settings/queries.ts
import { gql } from '@apollo/client';

export const GET_SETTINGS = gql`
  query Settings {
    settings {
      site {
        name
        slogan
        description
        url
        email
        address
        phone
        logo
        keywords
        author
        copyright
      }
      common {
        pageSize
        isMaintenanceMode
        freeShippingMinPrice
        defaultTheme
        defaultColor
        featuredCategories
      }
      points {
        earnRate
        redeemValue
        registrationBonus {
          buyer
          seller
        }
        sellerPointsPerSale
        enabled
        rate
      }
      subscriptions {
        points {
          earnRate
          redeemValue
          registrationBonus {
            buyer
            seller
          }
          sellerPointsPerSale
          enabled
          rate
        }
      }
      availableLanguages {
        name
        code
      }
      defaultLanguage
      availableCurrencies {
        name
        code
        symbol
        convertRate
      }
      defaultCurrency
      availablePaymentMethods {
        name
        commission
      }
      defaultPaymentMethod
      availableDeliveryDates {
        name
        daysToDeliver
        shippingPrice
        freeShippingMinPrice
      }
      defaultDeliveryDate
    }
  }
`;