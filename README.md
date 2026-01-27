## Prerequisites
- Node.js 16+ and npm
- MongoDB (local or hosted)

## Setup
1. Install dependencies:

```bash
npm install
```

2. Create a local environment file (example `.env`):

```
DB_HOST=127.0.0.1
DB_PORT=27017
DB_DATABASE=dev
JWT_SECRET=your_jwt_secret
PORT=3000
```

## Run (development)

```bash
npm run dev
```

## Build & Run (production)

```bash
npm run build
npm start
```