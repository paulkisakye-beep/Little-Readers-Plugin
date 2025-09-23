# Migration Guide: Vercel + Google Sheets API

## Overview

This guide helps you migrate from Google Apps Script to **Vercel** (free hosting) while keeping **Google Sheets** as your database. This approach:

- **Maintains your workflow**: Non-technical users can still edit data in Google Sheets
- **Eliminates rate limiting**: No more "Too many requests" errors
- **Stays free**: Vercel's free tier is generous for small to medium traffic
- **Easy migration**: Minimal code changes required

## Prerequisites

- Google account (you already have this)
- GitHub account (free)
- Vercel account (free, sign up with GitHub)

## Step 1: Enable Google Sheets API

### 1.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: "Little Readers Backend"
3. Enable Google Sheets API:
   - Go to APIs & Services > Library
   - Search "Google Sheets API"
   - Click Enable

### 1.2 Create Service Account
1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "Service Account"
3. Name: "little-readers-backend"
4. Create and download JSON key file (save securely)

### 1.3 Share Spreadsheet with Service Account
1. Open your Google Sheet
2. Click Share
3. Add service account email (from JSON file)
4. Give Editor permission

## Step 2: Prepare Node.js Backend

### 2.1 Project Structure
```
vercel-backend/
├── api/
│   ├── books.js
│   ├── availability.js
│   ├── delivery.js
│   ├── promo.js
│   └── orders.js
├── lib/
│   ├── sheets.js
│   └── sms.js
├── package.json
└── vercel.json
```

### 2.2 Core Dependencies (package.json)
```json
{
  "name": "little-readers-backend",
  "version": "1.0.0",
  "dependencies": {
    "googleapis": "^113.0.0",
    "node-cache": "^5.1.2"
  },
  "engines": {
    "node": "18.x"
  }
}
```

## Step 3: Backend Implementation

### 3.1 Google Sheets Helper (lib/sheets.js)
```javascript
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

class SheetsService {
  constructor() {
    this.auth = new GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.spreadsheetId = process.env.SPREADSHEET_ID;
  }

  async getBooks() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Books!A2:L',
    });
    
    return response.data.values?.map(row => ({
      code: row[0],
      title: row[1],
      author: row[2],
      category: row[3],
      ageGroup: row[4],
      price: parseInt(row[5]) || 0,
      imageUrl: row[6],
      available: row[7]?.toLowerCase() === 'yes',
      reservedUntil: row[8],
      reservedBy: row[9],
      addedDate: row[10],
      soldDate: row[11]
    })) || [];
  }

  async getDeliveryAreas() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'DeliveryRates!A2:B',
    });
    
    return response.data.values?.map(row => ({
      area: row[0],
      price: parseInt(row[1]) || 0
    })) || [];
  }

  async getPromos() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'PromoCodes!A2:D',
    });
    
    return response.data.values?.map(row => ({
      code: row[0],
      discount: parseFloat(row[1]) / 100,
      active: row[2]?.toLowerCase() === 'yes',
      activatedAt: row[3]
    })) || [];
  }

  async addOrder(orderData) {
    const row = [
      orderData.id,
      new Date().toISOString(),
      orderData.customerName,
      orderData.customerPhone,
      orderData.deliveryArea,
      orderData.deliveryNotes,
      orderData.bookCodes.join(', '),
      orderData.bookTitles.join(', '),
      orderData.subtotal,
      orderData.deliveryFee,
      orderData.total,
      'Pending',
      orderData.paymentDeadline,
      '',
      orderData.promoCode || ''
    ];

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'Orders!A:O',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] }
    });
  }

  async updateBookAvailability(bookCode, status) {
    // Implementation for updating book status
    // This would involve finding the row and updating it
  }
}

module.exports = SheetsService;
```

### 3.2 API Endpoints

#### Books Endpoint (api/books.js)
```javascript
const SheetsService = require('../lib/sheets');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 1800 }); // 30 minutes

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Check cache first
    const cacheKey = 'books';
    let books = cache.get(cacheKey);

    if (!books) {
      const sheets = new SheetsService();
      books = await sheets.getBooks();
      
      // Filter only available books for public API
      books = books.filter(book => book.available);
      
      cache.set(cacheKey, books);
    }

    res.status(200).json({
      success: true,
      books: books
    });

  } catch (error) {
    console.error('Books API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch books'
    });
  }
}
```

#### Orders Endpoint (api/orders.js)
```javascript
const SheetsService = require('../lib/sheets');

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const orderData = req.body;
    
    // Validate required fields
    if (!orderData.customerName || !orderData.customerPhone || !orderData.books) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Generate order ID
    const orderId = `LRU${Date.now()}`;
    
    // Calculate totals
    const subtotal = orderData.books.reduce((sum, book) => sum + book.price, 0);
    const deliveryFee = orderData.deliveryFee || 0;
    const total = subtotal + deliveryFee;

    // Prepare order data
    const order = {
      id: orderId,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      deliveryArea: orderData.deliveryArea,
      deliveryNotes: orderData.deliveryNotes,
      bookCodes: orderData.books.map(b => b.code),
      bookTitles: orderData.books.map(b => b.title),
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      total: total,
      promoCode: orderData.promoCode,
      paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    // Save to sheets
    const sheets = new SheetsService();
    await sheets.addOrder(order);

    // Send SMS (implement according to your SMS provider)
    // await sendOrderSMS(order);

    res.status(200).json({
      success: true,
      orderId: orderId,
      message: 'Order placed successfully'
    });

  } catch (error) {
    console.error('Order API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process order'
    });
  }
}
```

#### Delivery Areas Endpoint (api/delivery.js)
```javascript
const SheetsService = require('../lib/sheets');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 7200 }); // 2 hours

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { area } = req.query;

    if (area) {
      // Get price for specific area
      const cacheKey = 'delivery-areas';
      let areas = cache.get(cacheKey);

      if (!areas) {
        const sheets = new SheetsService();
        areas = await sheets.getDeliveryAreas();
        cache.set(cacheKey, areas);
      }

      const areaData = areas.find(a => 
        a.area.toLowerCase() === area.toLowerCase() ||
        a.area.toLowerCase().includes(area.toLowerCase()) ||
        area.toLowerCase().includes(a.area.toLowerCase())
      );

      if (areaData) {
        res.status(200).json({
          found: true,
          price: areaData.price,
          matched: areaData.area
        });
      } else {
        res.status(200).json({
          found: false,
          price: null,
          matched: null
        });
      }
    } else {
      // Get all areas
      const cacheKey = 'delivery-areas-list';
      let areasList = cache.get(cacheKey);

      if (!areasList) {
        const sheets = new SheetsService();
        const areas = await sheets.getDeliveryAreas();
        areasList = areas.map(a => a.area);
        cache.set(cacheKey, areasList);
      }

      res.status(200).json(areasList);
    }

  } catch (error) {
    console.error('Delivery API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch delivery data'
    });
  }
}
```

### 3.3 Vercel Configuration (vercel.json)
```json
{
  "functions": {
    "api/*.js": {
      "maxDuration": 30
    }
  },
  "env": {
    "SPREADSHEET_ID": "@spreadsheet-id",
    "GOOGLE_SHEETS_CREDENTIALS": "@google-sheets-credentials"
  }
}
```

## Step 4: Deployment

### 4.1 Setup Repository
1. Create new GitHub repository: "little-readers-backend"
2. Upload your backend code
3. Commit and push

### 4.2 Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Import your repository
4. Configure environment variables:
   - `SPREADSHEET_ID`: Your Google Sheet ID
   - `GOOGLE_SHEETS_CREDENTIALS`: Your service account JSON (as string)

### 4.3 Environment Variables Setup
In Vercel dashboard:
1. Go to Project Settings > Environment Variables
2. Add `SPREADSHEET_ID`: Copy from your Google Sheet URL
3. Add `GOOGLE_SHEETS_CREDENTIALS`: Paste entire JSON service account file

## Step 5: Update WordPress Plugin

### 5.1 Update Plugin Settings
Change your WordPress plugin backend URL to:
```
https://your-project.vercel.app/api
```

### 5.2 Update Endpoint URLs
The new endpoints will be:
- Books: `https://your-project.vercel.app/api/books`
- Orders: `https://your-project.vercel.app/api/orders`
- Delivery: `https://your-project.vercel.app/api/delivery`
- Promo: `https://your-project.vercel.app/api/promo`

## Step 6: Testing

### 6.1 Test Each Endpoint
1. Visit `https://your-project.vercel.app/api/books` 
2. Should return JSON with your books
3. Test all endpoints individually

### 6.2 Test WordPress Integration
1. Update plugin settings with new backend URL
2. Test book loading
3. Test cart functionality
4. Test order submission

## Benefits After Migration

✅ **No more rate limiting**: Vercel has much higher limits than Google Apps Script
✅ **Better performance**: Faster response times
✅ **Same workflow**: Google Sheets editing remains unchanged
✅ **Free hosting**: Vercel free tier handles significant traffic
✅ **Better scalability**: Can handle traffic spikes easily
✅ **Easier debugging**: Better error logs and monitoring

## Troubleshooting

### Common Issues:
1. **CORS errors**: Make sure CORS headers are set correctly
2. **Authentication failed**: Verify service account JSON is correct
3. **Sheet not found**: Check spreadsheet ID and sharing permissions
4. **Function timeout**: Increase timeout in vercel.json if needed

### Debug Steps:
1. Check Vercel function logs in dashboard
2. Test endpoints directly in browser
3. Verify Google Sheets API permissions
4. Check environment variables are set correctly

This migration maintains your cost-effective Google Sheets workflow while eliminating the rate limiting issues you've been experiencing with Google Apps Script.