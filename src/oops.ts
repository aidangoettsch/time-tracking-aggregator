import {google} from "googleapis"
import fs from "fs/promises"
import dotenv from "dotenv";

dotenv.config()

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.calendars',
  'https://www.googleapis.com/auth/calendar.events.owned',
];
const TOKEN_PATH = 'token.json';

async function authGoogle() {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET
  ) {
    process.exit(0)
  }

  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )

  const codes = await oAuth2Client.generateCodeVerifierAsync();
  console.log(codes);
}

async function main() {

}

main()
