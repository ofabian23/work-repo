# UBI-K-LO Login Screen

## Overview
A modern, responsive login and signup interface for Linde Gas services built with React, Tailwind CSS, and Heroicons.

## Features

### Login Form
- **Customer Number**: Primary identifier for existing customers
- **Password**: Secure password input with show/hide toggle
- Clean, professional interface following Linde Gas blue color scheme

### Signup Form
- **Email Address**: Business email for account creation
- **Business Address**: Physical address of the business
- **Location**: Business location details
- **Password**: Secure password creation with show/hide toggle
- **Confirm Password**: Password confirmation with validation

## Design Features
- **Color Scheme**: Custom Linde Gas blue palette (`linde-*` classes)
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Modern UI**: Clean, professional interface with subtle shadows and gradients
- **Accessibility**: Proper labels, focus states, and keyboard navigation
- **Password Security**: Toggle visibility for password fields
- **Form Validation**: Password matching validation for signup

## Color Palette
The interface uses a custom Linde Gas inspired blue color palette:
- Primary: `linde-600` (#2563eb)
- Hover: `linde-700` (#1d4ed8)
- Background: `linde-50` to `linde-100` gradient
- Dark Blue: `linde-dark` (#003366)
- Medium Blue: `linde-medium` (#0066cc)
- Light Blue: `linde-light` (#4da6ff)

## Usage
1. Start the development server: `npm start`
2. Navigate to `http://localhost:3000`
3. Toggle between login and signup using the bottom links
4. Fill in the required fields and submit

## Technical Stack
- React 19.1.0
- Tailwind CSS (latest)
- Heroicons React
- Custom color configuration

## File Structure
```
src/
├── components/
│   └── LoginScreen.js    # Main login/signup component
├── App.js               # Main app component
├── App.css              # Minimal app styles
└── index.css            # Tailwind CSS imports
``` 