// /home/mark/Music/my-nextjs-project-clean/graphql/bank/queries.ts
import { gql } from '@apollo/client';

export const GET_BANK_INFO = gql`
  query GetBankInfo($sellerId: ID!) {
    getBankInfo(sellerId: $sellerId) {
      accountName
      accountNumber
      bankName
      swiftCode
      routingNumber
      bankDocumentUrl
      isVerified
    }
  }
`;