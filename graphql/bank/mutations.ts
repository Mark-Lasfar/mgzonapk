// /home/mark/Music/my-nextjs-project-clean/graphql/bank/mutations.ts
import { gql } from '@apollo/client';

export const UPDATE_BANK_INFO = gql`
  mutation UpdateBankInfo($input: BankInfoInput!) {
    updateBankInfo(input: $input) {
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