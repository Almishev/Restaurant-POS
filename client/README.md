# Restaurant POS System - Frontend

This is the frontend React application for the Restaurant POS System.

## Features

- **Table Management**: Add, edit, and track tables in the restaurant
- **Order Management**: Create and track orders by table
- **Kitchen/Bar Integration**: Send orders to kitchen/bar display systems
- **Payment Processing**: Generate bills with cash or card payment options
- **Reporting System**: Daily and periodic reports (X and Z reports)
- **Storno Operations**: Full support for cancellations and refunds
- **User Management**: Admin and server roles with different permissions
- **Inventory Management**: Track and manage inventory with recipes
- **Transfer Items**: Move items between tables to correct ordering mistakes

## Technologies Used

### Frontend

- React.js
- Redux for state management
- Ant Design UI framework
- Axios for API requests
- React Router for navigation
- React-to-Print for receipt printing

### Additional Features

- Fiscal device integration
- Responsive design
- Role-based access control

## Getting Started

1. Install dependencies:

   ```
   npm install
   ```

2. Start the development server:

   ```
   npm start
   ```

3. Build for production:
   ```
   npm run build
   ```

## Project Structure

```
src/
├── components/        # Reusable UI components
├── pages/             # Page components
├── redux/             # Redux state management
├── App.js             # Main application component
└── index.js           # Application entry point
```

## See Also

For complete documentation, refer to the main [README.md](../README.md) in the project root directory.
