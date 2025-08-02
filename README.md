# Miro Auth Server

Simple OAuth token exchange server for Miro integration.

## Deployment to Railway

1. Push this folder to a GitHub repository
2. Go to [Railway](https://railway.app)
3. Create a new project
4. Choose "Deploy from GitHub repo"
5. Select your repository and the `miro-auth-server` folder
6. Railway will automatically detect it's a Node.js app and deploy it

## Environment Variables

No environment variables needed - the client ID and secret are hardcoded for simplicity.

## Endpoints

- `POST /token` - Exchange OAuth code for access token

## CORS

This server allows requests from any origin (`*`) for ease of use.