import { JWT } from 'google-auth-library';

export async function getGoogleAccessToken() {
  const client = new JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });

  const credentials = await client.getAccessToken();
  return credentials.token;
}