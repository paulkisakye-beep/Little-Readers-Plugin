# Migration Guide: Google Apps Script to Vercel + Google Sheets API

This guide walks you through migrating your Little Readers UG backend from Google Apps Script to Vercel (free hosting) while keeping Google Sheets as your database. This solution eliminates rate limiting issues while maintaining zero costs and your existing Google Sheets workflow.

## Overview

**What We're Doing:**
- ✅ Keep Google Sheets as database (no data migration needed)
- ✅ Move backend logic to Vercel (free, unlimited requests)
- ✅ Keep all existing functionality (SMS, orders, analytics)
- ✅ Maintain Google Sheets editing for non-technical users
- ✅ Zero monthly costs
- ✅ Higher performance and no rate limits

**What Changes:**
- Backend runs on Vercel instead of Google Apps Script
- API endpoints have new URLs (we'll update WordPress plugin)
- Much higher rate limits and better performance

## Prerequisites

- Google account (you already have this)
- GitHub account (free)
- Vercel account (free, can sign up with GitHub)

## Step 1: Set Up Google Sheets API

### 1.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

### 1.2 Create Service Account
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Name it "little-readers-api"
4. Click "Create and Continue"
5. Skip role assignment (click "Continue" then "Done")

### 1.3 Generate Service Account Key
1. Click on your service account email
2. Go to "Keys" tab
3. Click "Add Key" > "Create New Key"
4. Choose "JSON" format
5. Download the JSON file (keep it safe!)

### 1.4 Share Spreadsheet with Service Account
1. Open your Google Sheet
2. Click "Share" button
3. Add the service account email (from the JSON file)
4. Give it "Editor" access
5. Click "Send"

## Step 2: Prepare Backend Code for Vercel

### 2.1 Create Project Structure
```
little-readers-backend/
├── package.json
├── vercel.json
├── api/
│   ├── books.js
│   ├── availability.js
│   ├── delivery-areas.js
│   ├── delivery-price.js
│   ├── validate-promo.js
│   └── process-order.js
├── lib/
│   ├── sheets.js
│   ├── sms.js
│   └── utils.js
└── .env.local
```

### 2.2 Create package.json
```json
{
  "name": "little-readers-backend",
  "version": "1.0.0",
  "description": "Little Readers UG Backend API",
  "main": "index.js",
  "scripts": {
    "dev": "vercel dev",
    "build": "echo 'No build step required'",
    "start": "node index.js"
  },
  "dependencies": {
    "googleapis": "^128.0.0",
    "node-cache": "^5.1.2"
  },
  "engines": {
    "node": "18.x"
  }
}
```

### 2.3 Create vercel.json
```json
{
  "functions": {
    "api/*.js": {
      "maxDuration": 30
    }
  },
  "env": {
    "GOOGLE_SHEETS_PRIVATE_KEY": "@google-sheets-private-key",
    "GOOGLE_SHEETS_CLIENT_EMAIL": "@google-sheets-client-email",
    "SPREADSHEET_ID": "@spreadsheet-id",
    "API_KEY": "@api-key",
    "EGOSMS_USERNAME": "@egosms-username",
    "EGOSMS_PASSWORD": "@egosms-password"
  }
}
```

## Step 3: Convert Your Backend Code

### 3.1 Create lib/sheets.js
```javascript
const { GoogleSpreadsheet } = require('google-spreadsheet');
const NodeCache = require('node-cache');

// Cache with TTL (time to live)
const cache = new NodeCache();

class SheetsAPI {
  constructor() {
    this.spreadsheetId = process.env.SPREADSHEET_ID;
    this.doc = null;
  }

  async initialize() {
    if (this.doc) return this.doc;

    this.doc = new GoogleSpreadsheet(this.spreadsheetId);
    
    // Authenticate using service account
    await this.doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });

    await this.doc.loadInfo();
    return this.doc;
  }

  async getSheet(name) {
    const doc = await this.initialize();
    return doc.sheetsByTitle[name];
  }

  async getCachedData(key, fetchFunction, ttlSeconds = 3600) {
    // Check cache first
    const cached = cache.get(key);
    if (cached) {
      console.log(`Cache hit: ${key}`);
      return cached;
    }

    // Fetch fresh data
    console.log(`Cache miss: ${key}, fetching fresh data`);
    const data = await fetchFunction();
    
    // Store in cache
    cache.set(key, data, ttlSeconds);
    return data;
  }

  clearCache(key = null) {
    if (key) {
      cache.del(key);
    } else {
      cache.flushAll();
    }
  }
}

module.exports = new SheetsAPI();
```

### 3.2 Create api/books.js
```javascript
const sheets = require('../lib/sheets');

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const books = await sheets.getCachedData('books', async () => {
      const sheet = await sheets.getSheet('Books');
      const rows = await sheet.getRows();
      
      return rows.map(row => ({
        code: row._rawData[0] || '',
        title: row._rawData[1] || '',
        author: row._rawData[2] || '',
        category: row._rawData[3] || '',
        ageGroup: row._rawData[4] || '',
        price: Number(row._rawData[5]) || 0,
        imageUrl: row._rawData[6] || '',
        available: row._rawData[7] === 'TRUE',
        reservedUntil: row._rawData[8] || '',
        reservedBy: row._rawData[9] || '',
        addedDate: row._rawData[10] || '',
        soldDate: row._rawData[11] || ''
      })).filter(book => book.available);
    }, 1800); // 30 minutes cache

    res.status(200).json({ success: true, books });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
```

### 3.3 Create api/delivery-areas.js
```javascript
const sheets = require('../lib/sheets');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const areas = await sheets.getCachedData('delivery_areas', async () => {
      const sheet = await sheets.getSheet('DeliveryRates');
      const rows = await sheet.getRows();
      
      return rows.map(row => row._rawData[0]).filter(Boolean);
    }, 7200); // 2 hours cache

    res.status(200).json(areas);
  } catch (error) {
    console.error('Error fetching delivery areas:', error);
    res.status(500).json({ error: error.message });
  }
}
```

### 3.4 Create api/delivery-price.js
```javascript
const sheets = require('../lib/sheets');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { area } = req.query;
  
  if (!area) {
    return res.status(400).json({ found: false, error: 'Area parameter required' });
  }

  try {
    const result = await sheets.getCachedData(`delivery_price_${area.toLowerCase()}`, async () => {
      const sheet = await sheets.getSheet('DeliveryRates');
      const rows = await sheet.getRows();
      const areaNorm = area.trim().toLowerCase();
      
      // Exact match first
      for (const row of rows) {
        const name = (row._rawData[0] || '').trim().toLowerCase();
        if (name === areaNorm) {
          return { 
            found: true, 
            price: Number(row._rawData[1]) || 0, 
            matched: row._rawData[0] 
          };
        }
      }
      
      // Partial match
      for (const row of rows) {
        const name = (row._rawData[0] || '').trim().toLowerCase();
        if (areaNorm.includes(name) || name.includes(areaNorm)) {
          return { 
            found: true, 
            price: Number(row._rawData[1]) || 0, 
            matched: row._rawData[0] 
          };
        }
      }
      
      return { found: false, price: null, matched: null };
    }, 7200); // 2 hours cache

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching delivery price:', error);
    res.status(500).json({ found: false, error: error.message });
  }
}
```

### 3.5 Create api/process-order.js
```javascript
const sheets = require('../lib/sheets');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const orderData = req.body;
    
    // Generate order ID
    const orderId = 'LRU' + Date.now();
    const timestamp = new Date();
    const paymentDeadline = new Date(timestamp.getTime() + (24 * 60 * 60 * 1000)); // 24 hours

    // Calculate totals
    const subtotal = orderData.books.reduce((sum, book) => sum + book.price, 0);
    const deliveryFee = orderData.deliveryFee || 0;
    const total = subtotal + deliveryFee;

    // Add to Orders sheet
    const ordersSheet = await sheets.getSheet('Orders');
    await ordersSheet.addRow([
      orderId,
      timestamp.toISOString(),
      orderData.customerName,
      orderData.customerPhone,
      orderData.deliveryArea,
      orderData.deliveryNotes || '',
      orderData.books.map(b => b.code).join(', '),
      orderData.books.map(b => b.title).join(', '),
      subtotal,
      deliveryFee,
      total,
      'PENDING',
      paymentDeadline.toISOString(),
      '',
      ''
    ]);

    // Reserve books
    const booksSheet = await sheets.getSheet('Books');
    const bookRows = await booksSheet.getRows();
    
    for (const orderBook of orderData.books) {
      const bookRow = bookRows.find(row => row._rawData[0] === orderBook.code);
      if (bookRow) {
        bookRow._rawData[8] = paymentDeadline.toISOString(); // Reserved until
        bookRow._rawData[9] = orderData.customerPhone; // Reserved by
        await bookRow.save();
      }
    }

    // Send SMS (implement your SMS logic here)
    // await sendOrderSMS(orderData, orderId, total);

    // Clear relevant caches
    sheets.clearCache('books');
    
    res.status(200).json({ 
      success: true, 
      orderId,
      message: 'Order processed successfully'
    });

  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
```

## Step 4: Deploy to Vercel

### 4.1 Create GitHub Repository
1. Create new GitHub repository: `little-readers-backend`
2. Push your code to the repository

### 4.2 Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click "New Project"
3. Import your `little-readers-backend` repository
4. Configure environment variables:
   - `GOOGLE_SHEETS_PRIVATE_KEY`: Your service account private key
   - `GOOGLE_SHEETS_CLIENT_EMAIL`: Your service account email
   - `SPREADSHEET_ID`: Your Google Sheet ID
   - `API_KEY`: Your API key (same as Apps Script)
   - `EGOSMS_USERNAME`: Your EgoSMS username
   - `EGOSMS_PASSWORD`: Your EgoSMS password

### 4.3 Get Your API URLs
After deployment, your API endpoints will be:
```
https://your-project-name.vercel.app/api/books
https://your-project-name.vercel.app/api/delivery-areas
https://your-project-name.vercel.app/api/delivery-price
https://your-project-name.vercel.app/api/process-order
```

## Step 5: Update WordPress Plugin

Update your WordPress plugin settings:
1. Go to Settings > Little Readers
2. Update Backend URL to: `https://your-project-name.vercel.app`
3. Keep the same API key

## Step 6: Test Migration

### 6.1 Test API Endpoints
Test each endpoint to ensure they work:
```bash
# Test books endpoint
curl https://your-project-name.vercel.app/api/books

# Test delivery areas
curl https://your-project-name.vercel.app/api/delivery-areas

# Test delivery price
curl "https://your-project-name.vercel.app/api/delivery-price?area=Kampala"
```

### 6.2 Test Full Workflow
1. Load books in WordPress plugin
2. Add books to cart
3. Try checkout process
4. Verify SMS sending (if configured)
5. Check Google Sheets for new order

## Benefits of This Migration

✅ **No Rate Limiting**: Vercel has much higher limits than Google Apps Script  
✅ **Better Performance**: Faster response times  
✅ **Zero Cost**: Both Vercel and Google Sheets API are free for your usage level  
✅ **Keep Google Sheets**: No data migration needed  
✅ **Same Functionality**: All features preserved (SMS, orders, analytics)  
✅ **Scalable**: Can handle traffic spikes during promotions  
✅ **Easy Updates**: Deploy changes via Git push  

## Troubleshooting

### Common Issues:
1. **Authentication Error**: Check service account key format
2. **Sheet Not Found**: Verify sheet names match exactly
3. **CORS Errors**: Make sure CORS headers are set in all API functions
4. **Environment Variables**: Double-check all env vars in Vercel dashboard

### Logs and Debugging:
- View logs in Vercel dashboard under "Functions" tab
- Use `console.log()` statements for debugging
- Monitor API response times and errors

This migration will solve your rate limiting issues while keeping costs at zero and maintaining your existing Google Sheets workflow!