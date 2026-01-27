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

## Tests

```bash
npm test
```

## Notes
- The repository contains a native Android module under `src/main` (Android source & resources). Remove it if you don't need a mobile client.
- If you removed model fields (for example `businessName`, `operatingHours`, `bookingHistory`), ensure any code or migrations depending on them are updated.

Need further edits or to remove the Android module? Reply and I will continue.

