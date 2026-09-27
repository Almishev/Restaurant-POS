# Restaurant POS System

A comprehensive Point of Sale (POS) system for restaurants developed using the MERN Stack (MongoDB, Express.js, React, Node.js). This system provides complete restaurant management capabilities including table management, order processing, payment handling, reporting, and inventory control.

## Features

- **Table Management**: Add, edit, and track tables in the restaurant
- **Order Management**: Create and track orders by table
- **Kitchen/Bar Integration**: Send orders to kitchen/bar display systems
- **Payment Processing**: Generate bills with cash or card payment options
- **Reporting System**: Daily and periodic reports (X and Z reports)
- **Storno Operations**: Full support for cancellations and refunds with proper fiscal integration
- **User Management**: Admin and server roles with different permissions
- **Inventory Management**: Track and manage inventory with recipes
- **Transfer Items**: Move items between tables when orders are placed incorrectly
- **СУПТО Compliance**: Fully compliant with Bulgarian fiscal regulations

## Technology Stack

### Backend

- **Node.js**: JavaScript runtime for server-side code
- **Express.js**: Web application framework for Node.js
- **MongoDB**: NoSQL database for data storage
- **Mongoose**: ODM (Object Data Modeling) library for MongoDB
- **JWT**: Authentication and authorization

### Frontend

- **React.js**: JavaScript library for building user interfaces
- **Redux**: State management for React
- **Ant Design**: UI component library for a clean, professional interface
- **Axios**: Promise-based HTTP client for API requests
- **React Router**: Navigation and routing
- **React-to-Print**: Receipt and report printing functionality

### Development Tools

- **Concurrently**: Run multiple commands concurrently
- **Nodemon**: Monitor for changes and automatically restart server
- **Morgan**: HTTP request logger middleware

## Installation and Setup

### Option A — Docker (recommended for restaurants)

On the restaurant PC/server you only need [Docker](https://docs.docker.com/get-docker/) + Docker Compose.

1. Create a folder and copy the deploy files from this repo (`deploy/docker-compose.yml` and `deploy/.env.example`):

   ```bash
   mkdir restaurant-pos && cd restaurant-pos
   # copy deploy/docker-compose.yml here as docker-compose.yml
   # copy deploy/.env.example here as .env and edit JWT_SECRET
   ```

2. Pull and start:

   ```bash
   docker compose pull
   docker compose up -d
   ```

3. First install only — seed menu + default users:

   ```bash
   docker compose run --rm app node seeder.js
   ```

4. Open in browser / tablets: `http://SERVER-IP:8081`

Default logins after seed:

| User     | Password | Role    |
|----------|----------|---------|
| `admin`  | `0000`   | admin   |
| `bar`    | `0000`   | bar     |
| `kitchen`| `0000`   | kitchen |

Update image later (after GitHub push publishes a new build):

```bash
docker compose pull
docker compose up -d
```

**Docker Hub image:** `antonalmishev/restaurant-pos:latest`

### Option B — Local development (hot reload)

### Prerequisites

- Node.js (v18.x or higher)
- MongoDB (local or Atlas connection)
- npm package manager

### Installation Steps

1. Clone the repository

   ```bash
   git clone https://github.com/Almishev/Restaurant-POS.git
   cd Restaurant-POS
   ```

2. Install server dependencies

   ```bash
   npm install
   ```

3. Install client dependencies

   ```bash
   cd client
   npm install
   cd ..
   ```

4. Create a `.env` file in the root directory with the following variables:

   ```
   PORT=8081
   HOST=0.0.0.0
   MONGO_URI=mongodb://127.0.0.1:27017/restaurant-pos
   JWT_SECRET=your_jwt_secret
   ```

5. Seed the database (optional)

   ```bash
   npm run seed
   ```

6. Start the development server
   ```bash
   npm run server
   ```
   In another terminal:
   ```bash
   npm run client
   ```

### Docker (from source / CI)

```bash
docker compose up -d --build
docker compose run --rm app node seeder.js
```

### GitHub Actions → Docker Hub

On every push to `main`/`master` (and on version tags `v*`), [`.github/workflows/docker-publish.yml`](./.github/workflows/docker-publish.yml) builds the image and pushes it to Docker Hub.

Add these **repository secrets** in GitHub → Settings → Secrets and variables → Actions:

| Secret               | Value                                      |
|----------------------|--------------------------------------------|
| `DOCKERHUB_USERNAME` | `antonalmishev` |
| `DOCKERHUB_TOKEN`    | Docker Hub Access Token (Read & Write) |

Create repository `restaurant-pos` on Docker Hub (Create repository), or let the first Actions push create it.

Image tags published:

- `latest` — from default branch
- `sha-xxxxxx` — short commit SHA
- `1.2.3` / `1.2` — when you push a git tag like `v1.2.3`

## Project Structure

```
restaurant-pos-system/
├── client/                  # React frontend
│   ├── public/              # Static files
│   ├── src/                 # Source files
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── redux/           # Redux store and actions
│   │   ├── App.js           # Main App component
│   │   └── index.js         # Entry point
├── config/                  # Configuration files
├── controllers/             # Route controllers
├── cron/                    # Scheduled tasks
├── docs/                    # Documentation
├── models/                  # Mongoose models
├── routes/                  # API routes
├── services/                # Business logic
├── utils/                   # Utility functions
├── .env                     # Environment variables
├── package.json             # Dependencies
├── README.md                # Project documentation
├── README-СУПТО.md          # СУПТО documentation
└── server.js                # Server entry point
```

## Usage

- Docker / production: `http://SERVER-IP:8081`
- Local frontend (CRA): `http://localhost:3000` (API on `8081`)
- Default admin after seed: `admin` / `0000`
- Station users: `bar` / `0000`, `kitchen` / `0000`
- `/register` is admin-only — create waiters from the Users page

## СУПТО Compliance

This POS system is compliant with Bulgarian СУПТО (Software for Managing Sales in Commercial Objects) regulations. Full documentation is available in:

- [README-СУПТО.md](./README-СУПТО.md) - General system description
- [docs/СУПТО-Technical.md](./docs/СУПТО-Technical.md) - Technical documentation
- [docs/СУПТО-Декларация-Приложение-33.md](./docs/СУПТО-Декларация-Приложение-33.md) - Declaration template

## Scripts

- `npm run start`: Start the production server
- `npm run server`: Start the development server with nodemon
- `npm run client`: Start the React development server
- `npm run seed`: Seed items + default users (`admin`, `bar`, `kitchen`)
- `npm run docker:up`: Build and start Docker Compose stack
- `npm run docker:down`: Stop Docker Compose stack
- `npm run docker:seed`: Seed inside the running Compose app container

## Contact

- **Developer**: [Your Name](https://linkedin.com/in/YOUR_PROFILE)
- **GitHub**: [Your GitHub Profile](https://github.com/YOUR_USERNAME)
- **LinkedIn**: [Your LinkedIn Profile](https://linkedin.com/in/YOUR_PROFILE)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
