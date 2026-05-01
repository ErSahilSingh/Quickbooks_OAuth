# QuickBooks OAuth

## Environment Variables

Create a .env file inside the server folder and add the following variables:

PORT=5000
CLIENT_ID=your_quickbooks_client_id
CLIENT_SECRET=your_quickbooks_client_secret
REDIRECT_URI=your_redirect_uri
ENVIRONMENT=sandbox
MONGO_URI=your_mongodb_connection_string

## Install and run

```bash
cd server
npm install
cp .env.example .env
# edit .env
npm run dev
```

```bash
cd client
npm install
npm run dev
```
