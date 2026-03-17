# SwasthyaLink Selenium Test Suite

This directory contains automated browser tests for SwasthyaLink using Selenium WebDriver.

## Prerequisites

-   [Node.js](https://nodejs.org/) installed.
-   [Google Chrome](https://www.google.com/chrome/) browser installed.
-   The SwasthyaLink project running on `http://localhost:5174`.

## Installation

```bash
npm install
```

## Running Tests

### Login Test
Verifies the authentication flow and navigation to the admin dashboard.
```bash
npm run test:login
```

### Dashboard Navigation Test
Verifies that the dashboard content is correctly loaded after login.
```bash
npm run test:dashboard
```

## Configuration

-   **Headless Mode**: To run tests without opening a browser window, uncomment the following line in the `.js` test files:
    `// options.addArguments('--headless');`
-   **Credentials**: The tests use default admin credentials (`admin@gmail.com` / `admin123`). You can modify the scripts to use different credentials if needed.
-   **Port**: The tests expect the frontend to be on port `5174`. If your server is on a different port, update the URL in the test scripts.
