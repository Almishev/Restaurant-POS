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

### Prerequisites

- Node.js (v14.x or higher)
- MongoDB (local or Atlas connection)
- npm or yarn package manager

### Installation Steps

1. Clone the repository

   ```bash
   git clone https://github.com/YOUR_USERNAME/restaurant-pos-system.git
   cd restaurant-pos-system
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
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   ```

5. Seed the database (optional)

   ```bash
   npm run seed
   ```

6. Start the development server
   ```bash
   npm run dev
   ```
   This will start both the backend server and the React frontend.

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

- Access the application at `http://localhost:3000`
- Default admin login:
  - Email: admin@example.com
  - Password: admin123

## СУПТО Compliance

This POS system is compliant with Bulgarian СУПТО (Software for Managing Sales in Commercial Objects) regulations. Full documentation is available in:

- [README-СУПТО.md](./README-СУПТО.md) - General system description
- [docs/СУПТО-Technical.md](./docs/СУПТО-Technical.md) - Technical documentation
- [docs/СУПТО-Декларация-Приложение-33.md](./docs/СУПТО-Декларация-Приложение-33.md) - Declaration template

## Scripts

- `npm run start`: Start the production server
- `npm run server`: Start the development server with nodemon
- `npm run client`: Start the React development server
- `npm run dev`: Run both server and client concurrently
- `npm run seed`: Seed the database with initial data

## Contact

- **Developer**: [Your Name](https://linkedin.com/in/YOUR_PROFILE)
- **GitHub**: [Your GitHub Profile](https://github.com/YOUR_USERNAME)
- **LinkedIn**: [Your LinkedIn Profile](https://linkedin.com/in/YOUR_PROFILE)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
