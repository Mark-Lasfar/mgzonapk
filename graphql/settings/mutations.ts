// /home/mark/Music/my-nextjs-project-clean/graphql/settings/mutations.ts
import { gql } from '@apollo/client';

export const UPDATE_SETTINGS = gql`
  mutation UpdateSettings($input: SettingsInput!) {
    updateSettings(input: $input) {
      success
      message
      data {
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
  }
`;