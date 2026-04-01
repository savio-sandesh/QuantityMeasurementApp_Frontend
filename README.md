# Quantity Measurement App Frontend

A responsive frontend for authentication and quantity operations (convert, compare, add, subtract, divide) across multiple measurement categories.

## Overview

This project provides:

- A tabbed authentication experience (Login/Signup)
- A protected dashboard for quantity operations
- Category-based unit handling for Length, Volume, Weight, and Temperature
- Operation history and aggregate operation count

The UI is built with plain HTML, CSS, and JavaScript and integrates with backend APIs using Fetch.

## Core Features

### Authentication

- Signup and login forms with client-side validation
- Password visibility toggles
- JWT token persistence in localStorage (`jwtToken`)
- Auth guard for protected dashboard routes
- Automatic redirect to login on missing or invalid auth state

### Quantity Dashboard

- Categories: Length, Volume, Weight, Temperature
- Operations: Convert, Compare, Add, Subtract, Divide
- Dynamic form behavior based on selected operation
- Category-aware unit dropdown population
- Result card with normalized operation output
- Logout flow that clears local auth state

### History and Metrics

- History table integration via API
- Graceful handling of mixed backend field casing
- Date formatting for readable display
- Empty-state fallback (`No history found`)
- Total operation count card

### API Contract Handling

- DTO-based payload mapping for quantity operations
- Measurement type normalization before request submission
- Unit normalization for backend-compatible enums
- `Authorization: Bearer <jwtToken>` on quantity endpoints
- Centralized response/error handling for common HTTP failures

## Project Structure

```text
.
|-- index.html
|-- converter.html
|-- style.css
|-- script.js
`-- assets
    |-- css
    |   |-- app.css
    |   |-- app.legacy.css
    |   `-- components
    |       |-- auth.css
    |       |-- dashboard.css
    |       `-- responsive.css
    `-- js
        |-- app.js
        |-- app.legacy.js
        |-- core
        |   `-- core.js
        `-- modules
            |-- auth.js
            |-- converter.js
            `-- history.js
```

## How to Run

1. Clone or download the repository.
2. Open `index.html` in your browser.
3. Ensure the backend API is running and reachable from this frontend.

## API Endpoints (Default Local Configuration)

### Auth

- `POST http://localhost:5111/api/v1/auth/register`
- `POST http://localhost:5111/api/v1/auth/login`

### Quantity

- `POST http://localhost:5111/api/v1/quantities/convert`
- `POST http://localhost:5111/api/v1/quantities/compare`
- `POST http://localhost:5111/api/v1/quantities/add`
- `POST http://localhost:5111/api/v1/quantities/subtract`
- `POST http://localhost:5111/api/v1/quantities/divide`
- `GET http://localhost:5111/api/v1/quantities/history`
- `GET http://localhost:5111/api/v1/quantities/count`

Update these URLs in the JavaScript modules as needed for your target environment.

## Technology Stack

- HTML5
- CSS3 (modular component styles)
- Vanilla JavaScript (modular architecture)
- Fetch API with async/await

## Notes

- `style.css` and `script.js` are lightweight entry loaders for modular assets.
- Legacy files (`app.legacy.css`, `app.legacy.js`) are preserved as backups.

## License

This project is intended for learning and internal development usage unless otherwise specified by your organization.
