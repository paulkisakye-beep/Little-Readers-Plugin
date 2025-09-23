# Vercel + Google Sheets API Migration Guide

This guide will help you migrate your Little Readers UG backend from Google Apps Script to Vercel (free hosting) while keeping Google Sheets as your database. This approach maintains your existing workflow while eliminating rate limiting issues.

## Why Migrate to Vercel + Google Sheets API?

✅ **Free Hosting**: Vercel's free tier is generous for small businesses
✅ **No Rate Limiting**: Much higher limits than Google Apps Script
✅ **Keep Google Sheets**: Non-technical users can still edit data directly
✅ **Zero Data Migration**: No need to export/import your existing data
✅ **Better Performance**: Faster response times and better caching
✅ **Easy Deployment**: Git-based deployment with automatic updates

## Prerequisites

- GitHub account (free)
- Vercel account (free - sign up with GitHub)
- Google Cloud Console account (free)
- Your existing Google Sheets with data

## Step 1: Enable Google Sheets API

### 1.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" or select existing project
3. Name your project (e.g., "little-readers-api")

### 1.2 Enable Google Sheets API
1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click on it and press "Enable"

### 1.3 Create Service Account
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Name it "little-readers-service" 
4. Skip optional steps and click "Done"

### 1.4 Generate Service Account Key
1. Click on your new service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create New Key" > "JSON"
4. Download the JSON file (keep it secure!)

### 1.5 Share Sheet with Service Account
1. Open your Google Sheet
2. Click "Share" button
3. Add the service account email (from the JSON file) as "Editor"
4. Make sure "Notify people" is unchecked

## Step 2: Prepare Your Node.js Backend

### 2.1 Create Project Structure
Create a new folder for your project:
```bash
mkdir little-readers-vercel
cd little-readers-vercel
```

### 2.2 Initialize Node.js Project
```bash
npm init -y
```

### 2.3 Install Dependencies
```bash
npm install googleapis express cors dotenv
npm install -D vercel
```

### 2.4 Create Project Files

Create the following files in your project:

**package.json** (update the existing one):
```json
{
  "name": "little-readers-api",
  "version": "1.0.0",
  "description": "Little Readers UG API Backend",
  "main": "api/index.js",
  "scripts": {
    "start": "node api/index.js",
    "dev": "vercel dev"
  },
  "dependencies": {
    "googleapis": "^126.0.1",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "vercel": "^32.4.1"
  }
}
```

**vercel.json**:
```json
{
  "functions": {
    "api/*.js": {
      "runtime": "@vercel/node"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

**.env.example**:
```
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
SPREADSHEET_ID=1CTFpUaGqxKUICPzbDSnkdBiAbS2n5ZNZqjxCwI7xRbs
API_KEY=LRU_WebApp_Key_2025
```

## Step 3: Create the Backend Code

### 3.1 Create API Directory
```bash
mkdir api
```

### 3.2 Main API Handler (api/index.js)
```javascript
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const CONFIG = {
  SPREADSHEET_ID: process.env.SPREADSHEET_ID,
  BUSINESS_NAME: "Little Readers Ug",
  PHONE_NUMBER: "256781884082",
  MOBILE_MONEY_NAME: "Patience Kabasiita",
  MOBILE_MONEY_NUMBER: "0781884082",
  FREE_DELIVERY_THRESHOLD: 300000,
  PAYMENT_DEADLINE_HOURS: 24,
  DELIVERY_SHEET_NAME: "DeliveryRates",
  API_KEY: process.env.API_KEY
};

// Column mappings (same as your Google Apps Script)
const COL = {
  CODE: 1, TITLE: 2, AUTHOR: 3, CATEGORY: 4, AGE_GROUP: 5, PRICE: 6, IMAGE_URL: 7,
  AVAILABLE: 8, RESERVED_UNTIL: 9, RESERVED_BY: 10, ADDED_DATE: 11, SOLD_DATE: 12
};

const ORD = {
  ID: 1, TIMESTAMP: 2, NAME: 3, PHONE: 4, DELIVERY_AREA: 5, DELIVERY_ADDRESS: 6,
  BOOK_CODES: 7, BOOK_TITLES: 8, SUBTOTAL: 9, DELIVERY_FEE: 10, TOTAL: 11,
  PAYMENT_STATUS: 12, PAYMENT_DEADLINE: 13, PAYMENT_DATE: 14, NOTES: 15
};

// Google Sheets authentication
const getGoogleSheetsClient = () => {
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n');
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  return google.sheets({ version: 'v4', auth });
};

// Cache system (in-memory for Vercel functions)
const cache = new Map();
const CACHE_TTL = {
  books: 30 * 60 * 1000,        // 30 minutes
  deliveryAreas: 2 * 60 * 60 * 1000,  // 2 hours
  promoValid: 60 * 60 * 1000,   // 1 hour
  promoInvalid: 5 * 60 * 1000   // 5 minutes
};

const getCachedData = (key, fetchFunction, ttl) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const data = fetchFunction();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};

// Helper functions
const getSheetData = async (sheetName, range = null) => {
  try {
    const sheets = getGoogleSheetsClient();
    const fullRange = range ? `${sheetName}!${range}` : sheetName;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: fullRange,
    });
    
    return response.data.values || [];
  } catch (error) {
    console.error('Error getting sheet data:', error);
    return [];
  }
};

const updateSheetData = async (sheetName, range, values) => {
  try {
    const sheets = getGoogleSheetsClient();
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error updating sheet:', error);
    return false;
  }
};

const appendSheetData = async (sheetName, values) => {
  try {
    const sheets = getGoogleSheetsClient();
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [values]
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error appending to sheet:', error);
    return false;
  }
};

// API Routes

// Get available books
app.get('/api/books', async (req, res) => {
  try {
    const books = getCachedData('books', async () => {
      const data = await getSheetData('Books');
      if (!data || data.length < 2) return [];
      
      const headers = data[0];
      return data.slice(1).map(row => {
        const book = {};
        headers.forEach((header, index) => {
          book[header.toLowerCase().replace(/ /g, '_')] = row[index] || '';
        });
        return book;
      }).filter(book => book.available === 'TRUE');
    }, CACHE_TTL.books);
    
    res.json({ success: true, books });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check book availability
app.post('/api/availability', async (req, res) => {
  try {
    const { codes } = req.body;
    if (!codes || !Array.isArray(codes)) {
      return res.status(400).json({ success: false, error: 'Invalid book codes' });
    }
    
    const data = await getSheetData('Books');
    const availability = {};
    
    codes.forEach(code => {
      const bookRow = data.find(row => row[COL.CODE - 1] === code);
      if (bookRow) {
        availability[code] = {
          available: bookRow[COL.AVAILABLE - 1] === 'TRUE',
          status: bookRow[COL.AVAILABLE - 1] === 'TRUE' ? 'available' : 'unavailable'
        };
      } else {
        availability[code] = { available: false, status: 'not_found' };
      }
    });
    
    res.json({ success: true, availability });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get delivery areas
app.get('/api/delivery-areas', async (req, res) => {
  try {
    const areas = getCachedData('deliveryAreas', async () => {
      const data = await getSheetData(CONFIG.DELIVERY_SHEET_NAME);
      return data.slice(1).map(row => row[0]).filter(Boolean);
    }, CACHE_TTL.deliveryAreas);
    
    res.json({ success: true, areas });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get delivery price
app.get('/api/delivery-price', async (req, res) => {
  try {
    const { area } = req.query;
    if (!area) {
      return res.status(400).json({ success: false, error: 'Area parameter required' });
    }
    
    const data = await getSheetData(CONFIG.DELIVERY_SHEET_NAME);
    const areaNorm = area.toLowerCase().trim();
    
    // Exact match first
    for (let i = 1; i < data.length; i++) {
      const name = (data[i][0] || '').toLowerCase().trim();
      if (name === areaNorm) {
        return res.json({
          success: true,
          found: true,
          price: Number(data[i][1]) || 0,
          matched: data[i][0]
        });
      }
    }
    
    // Partial match
    for (let i = 1; i < data.length; i++) {
      const name = (data[i][0] || '').toLowerCase().trim();
      if (areaNorm.includes(name) || name.includes(areaNorm)) {
        return res.json({
          success: true,
          found: true,
          price: Number(data[i][1]) || 0,
          matched: data[i][0]
        });
      }
    }
    
    res.json({ success: true, found: false, price: null, matched: null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validate promo code
app.post('/api/validate-promo', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Promo code required' });
    }
    
    const cacheKey = `promo_${code.toUpperCase()}`;
    const cachedResult = cache.get(cacheKey);
    
    if (cachedResult) {
      const age = Date.now() - cachedResult.timestamp;
      const ttl = cachedResult.data.valid ? CACHE_TTL.promoValid : CACHE_TTL.promoInvalid;
      
      if (age < ttl) {
        return res.json(cachedResult.data);
      }
    }
    
    const data = await getSheetData('PromoCodes');
    const normalized = code.toUpperCase().trim();
    const now = new Date();
    
    for (let i = 1; i < data.length; i++) {
      const promoCode = (data[i][0] || '').toUpperCase().trim();
      if (promoCode === normalized) {
        const discount = Number(data[i][1]) / 100; // Convert percentage to decimal
        const isActive = (data[i][2] || '').toString().toLowerCase() === 'true';
        
        const result = {
          success: true,
          valid: isActive,
          code: data[i][0],
          discount: isActive ? discount : 0
        };
        
        cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return res.json(result);
      }
    }
    
    const result = { success: true, valid: false };
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process order
app.post('/api/process-order', async (req, res) => {
  try {
    const orderData = req.body;
    
    // Validate required fields
    if (!orderData.customerName || !orderData.customerPhone || !orderData.books) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required order information' 
      });
    }
    
    // Generate order ID
    const orderId = `LR${Date.now().toString().slice(-8)}`;
    
    // Calculate totals (implement your pricing logic here)
    const subtotal = orderData.books.reduce((sum, book) => sum + (book.price || 0), 0);
    const deliveryFee = orderData.deliveryFee || 0;
    const total = subtotal + deliveryFee;
    
    // Prepare order row
    const orderRow = [
      orderId,
      new Date().toISOString(),
      orderData.customerName,
      orderData.customerPhone,
      orderData.deliveryArea,
      orderData.deliveryNotes || '',
      orderData.books.map(b => b.code).join(', '),
      orderData.books.map(b => b.title).join(', '),
      subtotal,
      deliveryFee,
      total,
      'Pending',
      new Date(Date.now() + CONFIG.PAYMENT_DEADLINE_HOURS * 60 * 60 * 1000).toISOString(),
      '',
      ''
    ];
    
    // Save order to sheet
    const success = await appendSheetData('Orders', orderRow);
    
    if (success) {
      // Clear books cache since availability might have changed
      cache.delete('books');
      
      res.json({
        success: true,
        orderId,
        message: 'Order placed successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to save order'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// Handle GET requests (for backward compatibility with your current setup)
app.get('/api', (req, res) => {
  const action = req.query.action;
  
  switch (action) {
    case 'getBooks':
      return app.get('/api/books')(req, res);
    case 'deliveryAreas':
      return app.get('/api/delivery-areas')(req, res);
    case 'deliveryPrice':
      return app.get('/api/delivery-price')(req, res);
    default:
      res.status(400).json({ error: 'Invalid action' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Little Readers API running on port ${port}`);
});

module.exports = app;
```

## Step 4: Deploy to Vercel

### 4.1 Create GitHub Repository
1. Create a new repository on GitHub
2. Push your code:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/little-readers-api.git
git push -u origin main
```

### 4.2 Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Import Project"
4. Select your repository
5. Vercel will auto-detect it's a Node.js project

### 4.3 Add Environment Variables
In Vercel dashboard:
1. Go to your project settings
2. Click "Environment Variables"
3. Add these variables:
   - `GOOGLE_SHEETS_PRIVATE_KEY`: Your service account private key
   - `GOOGLE_SHEETS_CLIENT_EMAIL`: Your service account email
   - `SPREADSHEET_ID`: Your Google Sheets ID
   - `API_KEY`: Your API key

### 4.4 Deploy
1. Click "Deploy"
2. Wait for deployment to complete
3. You'll get a URL like: `https://your-project.vercel.app`

## Step 5: Update WordPress Plugin

Update your WordPress plugin settings:
1. Go to WordPress Admin > Settings > Little Readers
2. Change the backend URL to: `https://your-project.vercel.app/api`
3. Keep the same API key

## Step 6: Test Everything

### 6.1 Test API Endpoints
Visit these URLs to test:
- `https://your-project.vercel.app/api/health`
- `https://your-project.vercel.app/api/books`
- `https://your-project.vercel.app/api/delivery-areas`

### 6.2 Test WordPress Integration
1. Load your WordPress page with the store
2. Verify books load correctly
3. Test cart functionality
4. Test checkout process

## Benefits of This Migration

✅ **No More Rate Limiting**: Vercel has much higher limits
✅ **Better Performance**: Faster response times
✅ **Scalability**: Can handle traffic spikes
✅ **Keep Google Sheets**: Your workflow stays the same
✅ **Free Hosting**: No ongoing costs
✅ **Easy Updates**: Push to GitHub = automatic deployment

## Maintenance

- **Updating Code**: Push changes to GitHub, Vercel auto-deploys
- **Monitoring**: Check Vercel dashboard for function invocations
- **Logs**: View logs in Vercel dashboard for debugging
- **Cache**: The in-memory cache resets with each function call (consider upgrading to Redis for persistent caching if needed)

## Troubleshooting

### Common Issues:
1. **"Sheets not found"**: Check service account has access to sheet
2. **"Private key error"**: Ensure newlines are properly escaped in environment variable
3. **"CORS errors"**: CORS is enabled, check if request format matches expectations
4. **"Function timeout"**: Optimize queries or increase Vercel timeout limits

### Getting Help:
- Check Vercel function logs for errors
- Test API endpoints directly in browser
- Verify environment variables are set correctly
- Ensure Google Sheets API is enabled

This migration will eliminate your rate limiting issues while keeping your existing Google Sheets workflow intact and completely free!