# Migration Guide: Google Apps Script to Vercel + Google Sheets API

This guide will help you migrate your Little Readers UG backend from Google Apps Script to Vercel while keeping Google Sheets as your database. This solution is **100% free** and eliminates rate limiting issues.

## Benefits of Migration

- **No Rate Limiting**: Vercel handles much higher traffic than Google Apps Script
- **Better Performance**: Faster response times and better caching
- **Zero Cost**: Both Vercel and Google Sheets API are free
- **Keep Your Workflow**: Non-technical users can still edit Google Sheets directly
- **Easy Migration**: Minimal code changes required

## Prerequisites

1. **Node.js** installed on your computer (download from nodejs.org)
2. **Git** installed (download from git-scm.com)
3. **Google Cloud Project** with Sheets API enabled
4. **Vercel Account** (free at vercel.com)

## Step 1: Set Up Google Sheets API

### 1.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "New Project"
3. Name it "little-readers-backend"
4. Click "Create"

### 1.2 Enable Google Sheets API
1. In your project, go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click "Enable"

### 1.3 Create Service Account
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Name: "sheets-api-service"
4. Click "Create and Continue"
5. Skip role assignment (click "Continue")
6. Click "Done"

### 1.4 Generate Service Account Key
1. Click on your service account email
2. Go to "Keys" tab
3. Click "Add Key" > "Create New Key"
4. Choose "JSON" and click "Create"
5. Save the downloaded JSON file as `credentials.json`

### 1.5 Share Your Google Sheet
1. Open your Google Sheet
2. Click "Share" button
3. Add the service account email (from the JSON file) as Editor
4. Copy your Sheet ID from the URL (the long string between `/d/` and `/edit`)

## Step 2: Create Node.js Backend

### 2.1 Initialize Project
```bash
mkdir little-readers-backend
cd little-readers-backend
npm init -y
```

### 2.2 Install Dependencies
```bash
npm install googleapis cors
npm install -D vercel
```

### 2.3 Create Project Structure
```
little-readers-backend/
├── api/
│   ├── books.js
│   ├── availability.js
│   ├── delivery-areas.js
│   ├── delivery-price.js
│   ├── validate-promo.js
│   └── process-order.js
├── lib/
│   ├── sheets.js
│   └── sms.js
├── credentials.json
├── vercel.json
└── package.json
```

## Step 3: Core Files

### 3.1 Create `lib/sheets.js`
```javascript
const { google } = require('googleapis');

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = 'YOUR_SHEET_ID_HERE'; // Replace with your Sheet ID

// Column mappings (same as your Apps Script)
const COL = {
  CODE: 1, TITLE: 2, AUTHOR: 3, CATEGORY: 4, AGE_GROUP: 5, PRICE: 6, IMAGE_URL: 7,
  AVAILABLE: 8, RESERVED_UNTIL: 9, RESERVED_BY: 10, ADDED_DATE: 11, SOLD_DATE: 12
};

const ORD = {
  ID: 1, TIMESTAMP: 2, NAME: 3, PHONE: 4, DELIVERY_AREA: 5, DELIVERY_ADDRESS: 6,
  BOOK_CODES: 7, BOOK_TITLES: 8, SUBTOTAL: 9, DELIVERY_FEE: 10, TOTAL: 11,
  PAYMENT_STATUS: 12, PAYMENT_DEADLINE: 13, PAYMENT_DATE: 14, NOTES: 15
};

// Helper functions
async function getSheetData(sheetName, range = 'A:Z') {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
    });
    return response.data.values || [];
  } catch (error) {
    console.error('Error reading sheet:', error);
    return [];
  }
}

async function appendToSheet(sheetName, values) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      resource: { values: [values] },
    });
    return true;
  } catch (error) {
    console.error('Error appending to sheet:', error);
    return false;
  }
}

async function updateSheet(sheetName, range, values) {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
      valueInputOption: 'RAW',
      resource: { values },
    });
    return true;
  } catch (error) {
    console.error('Error updating sheet:', error);
    return false;
  }
}

module.exports = {
  getSheetData,
  appendToSheet,
  updateSheet,
  COL,
  ORD,
  SPREADSHEET_ID
};
```

### 3.2 Create `lib/sms.js`
```javascript
// SMS functionality (same as your Apps Script)
async function sendSMS(phone, message) {
  // Replace with your SMS service credentials
  const username = 'YOUR_SMS_USERNAME';
  const password = 'YOUR_SMS_PASSWORD';
  const sender = 'Little Readers';
  
  const formattedPhone = formatUgandanPhone(phone);
  if (!formattedPhone) return 'Invalid phone number';
  
  const url = `https://www.egosms.co/api/v1/plain/?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&number=${encodeURIComponent(formattedPhone)}&sender=${encodeURIComponent(sender)}&message=${encodeURIComponent(message)}`;
  
  try {
    const response = await fetch(url);
    const result = await response.text();
    return result;
  } catch (error) {
    return 'error: ' + error.toString();
  }
}

function formatUgandanPhone(phone) {
  const p = String(phone || '').replace(/[^\d]/g, '');
  if (p.length !== 10 && p.length !== 13) return null;
  if (p.length === 10 && p.charAt(0) !== '0') return null;
  if (p.length === 13 && !p.startsWith('256')) return null;
  
  const normalized = p.length === 10 ? '256' + p.substring(1) : p;
  if (normalized.length !== 13) return null;
  
  const fourthDigit = normalized.charAt(4);
  if (!['3','4','7','8'].includes(fourthDigit)) return null;
  
  return normalized;
}

module.exports = { sendSMS, formatUgandanPhone };
```

### 3.3 Create API Endpoints

#### `api/books.js`
```javascript
const cors = require('cors')();
const { getSheetData, COL } = require('../lib/sheets');

module.exports = async (req, res) => {
  await cors(req, res, async () => {
    try {
      const data = await getSheetData('Books');
      if (!data.length) {
        return res.json({ success: true, books: [] });
      }
      
      const books = data.slice(1)
        .filter(row => row[COL.AVAILABLE - 1] === 'TRUE')
        .map(row => ({
          code: row[COL.CODE - 1] || '',
          title: row[COL.TITLE - 1] || '',
          author: row[COL.AUTHOR - 1] || '',
          category: row[COL.CATEGORY - 1] || '',
          ageGroup: row[COL.AGE_GROUP - 1] || '',
          price: Number(row[COL.PRICE - 1] || 0),
          imageUrl: row[COL.IMAGE_URL - 1] || ''
        }))
        .filter(book => book.code && book.title);
      
      res.json({ success: true, books });
    } catch (error) {
      console.error('Error fetching books:', error);
      res.json({ success: false, error: error.message });
    }
  });
};
```

#### `api/delivery-areas.js`
```javascript
const cors = require('cors')();
const { getSheetData } = require('../lib/sheets');

// Cache for 2 hours
let cachedAreas = null;
let cacheTime = 0;
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

module.exports = async (req, res) => {
  await cors(req, res, async () => {
    try {
      // Check cache
      if (cachedAreas && (Date.now() - cacheTime) < CACHE_DURATION) {
        return res.json(cachedAreas);
      }
      
      const data = await getSheetData('DeliveryRates');
      const areas = data.slice(1)
        .map(row => row[0])
        .filter(Boolean);
      
      // Update cache
      cachedAreas = areas;
      cacheTime = Date.now();
      
      res.json(areas);
    } catch (error) {
      console.error('Error fetching delivery areas:', error);
      res.json([]);
    }
  });
};
```

#### `api/delivery-price.js`
```javascript
const cors = require('cors')();
const { getSheetData } = require('../lib/sheets');

// Cache for 2 hours
let cachedPrices = new Map();
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

module.exports = async (req, res) => {
  await cors(req, res, async () => {
    try {
      const { area } = req.query;
      if (!area) {
        return res.json({ found: false, price: null, matched: null });
      }
      
      const cacheKey = area.toLowerCase().trim();
      const cached = cachedPrices.get(cacheKey);
      
      // Check cache
      if (cached && (Date.now() - cached.time) < CACHE_DURATION) {
        return res.json(cached.data);
      }
      
      const data = await getSheetData('DeliveryRates');
      const areaNorm = area.toLowerCase().trim();
      
      // Exact match first
      for (let i = 1; i < data.length; i++) {
        const name = String(data[i][0] || '').trim().toLowerCase();
        if (name === areaNorm) {
          const result = { found: true, price: Number(data[i][1] || 0), matched: data[i][0] };
          cachedPrices.set(cacheKey, { data: result, time: Date.now() });
          return res.json(result);
        }
      }
      
      // Partial match
      for (let i = 1; i < data.length; i++) {
        const name = String(data[i][0] || '').trim().toLowerCase();
        if (areaNorm.includes(name) || name.includes(areaNorm)) {
          const result = { found: true, price: Number(data[i][1] || 0), matched: data[i][0] };
          cachedPrices.set(cacheKey, { data: result, time: Date.now() });
          return res.json(result);
        }
      }
      
      const result = { found: false, price: null, matched: null };
      cachedPrices.set(cacheKey, { data: result, time: Date.now() });
      res.json(result);
      
    } catch (error) {
      console.error('Error fetching delivery price:', error);
      res.json({ found: false, price: null, matched: null });
    }
  });
};
```

#### `api/validate-promo.js`
```javascript
const cors = require('cors')();
const { getSheetData } = require('../lib/sheets');

// Cache for promo codes
let promoCache = new Map();
const VALID_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for valid codes
const INVALID_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for invalid codes

module.exports = async (req, res) => {
  await cors(req, res, async () => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.json({ valid: false });
      }
      
      const cacheKey = code.toUpperCase().trim();
      const cached = promoCache.get(cacheKey);
      
      // Check cache
      if (cached && (Date.now() - cached.time) < (cached.valid ? VALID_CACHE_DURATION : INVALID_CACHE_DURATION)) {
        return res.json(cached.data);
      }
      
      const data = await getSheetData('PromoCodes');
      const now = new Date();
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (String(row[0] || '').trim().toUpperCase() === cacheKey) {
          const discount = Number(row[1] || 0) / 100;
          const isActive = String(row[2] || '').toUpperCase() === 'TRUE';
          
          if (isActive && discount > 0) {
            const result = { valid: true, code: cacheKey, discount };
            promoCache.set(cacheKey, { data: result, time: Date.now(), valid: true });
            return res.json(result);
          }
          break;
        }
      }
      
      const result = { valid: false };
      promoCache.set(cacheKey, { data: result, time: Date.now(), valid: false });
      res.json(result);
      
    } catch (error) {
      console.error('Error validating promo:', error);
      res.json({ valid: false });
    }
  });
};
```

#### `api/availability.js`
```javascript
const cors = require('cors')();
const { getSheetData, COL } = require('../lib/sheets');

module.exports = async (req, res) => {
  await cors(req, res, async () => {
    try {
      const { codes } = req.query;
      if (!codes) {
        return res.json({});
      }
      
      const bookCodes = codes.split(',').map(c => c.trim()).filter(Boolean);
      const data = await getSheetData('Books');
      const result = {};
      
      bookCodes.forEach(code => {
        result[code] = { status: 'unavailable' };
      });
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const bookCode = row[COL.CODE - 1];
        
        if (bookCodes.includes(bookCode)) {
          const available = row[COL.AVAILABLE - 1] === 'TRUE';
          const reservedUntil = row[COL.RESERVED_UNTIL - 1];
          const reservedBy = row[COL.RESERVED_BY - 1];
          
          if (available) {
            result[bookCode] = { status: 'available' };
          } else if (reservedUntil && reservedBy) {
            const reservedDate = new Date(reservedUntil);
            if (reservedDate > new Date()) {
              result[bookCode] = { status: 'reserved', until: reservedUntil };
            } else {
              result[bookCode] = { status: 'available' };
            }
          } else {
            result[bookCode] = { status: 'sold' };
          }
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error checking availability:', error);
      res.json({});
    }
  });
};
```

#### `api/process-order.js`
```javascript
const cors = require('cors')();
const { getSheetData, appendToSheet, updateSheet, COL, ORD } = require('../lib/sheets');
const { sendSMS } = require('../lib/sms');

const CONFIG = {
  BUSINESS_NAME: "Little Readers Ug",
  PHONE_NUMBER: "256781884082",
  MOBILE_MONEY_NAME: "Patience Kabasiita",
  MOBILE_MONEY_NUMBER: "0781884082",
  FREE_DELIVERY_THRESHOLD: 300000,
  PAYMENT_DEADLINE_HOURS: 24
};

module.exports = async (req, res) => {
  await cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }
      
      const orderData = req.body;
      const { customerName, customerPhone, deliveryArea, deliveryNotes, books, promoCode } = orderData;
      
      // Validate input
      if (!customerName || !customerPhone || !deliveryArea || !books?.length) {
        return res.json({ success: false, error: 'Missing required fields' });
      }
      
      // Generate order ID
      const orderId = 'LRU' + Date.now().toString().slice(-6);
      
      // Calculate totals
      let subtotal = 0;
      const bookTitles = [];
      const bookCodes = [];
      
      for (const book of books) {
        subtotal += book.price * book.quantity;
        bookTitles.push(`${book.title} (${book.quantity})`);
        bookCodes.push(book.code);
      }
      
      // Apply promo discount if valid
      let discount = 0;
      if (promoCode) {
        const promoData = await getSheetData('PromoCodes');
        for (let i = 1; i < promoData.length; i++) {
          const row = promoData[i];
          if (String(row[0] || '').trim().toUpperCase() === promoCode.toUpperCase()) {
            const discountPercent = Number(row[1] || 0);
            const isActive = String(row[2] || '').toUpperCase() === 'TRUE';
            if (isActive) {
              discount = subtotal * (discountPercent / 100);
              break;
            }
          }
        }
      }
      
      // Get delivery fee
      const deliveryData = await getSheetData('DeliveryRates');
      let deliveryFee = 0;
      for (let i = 1; i < deliveryData.length; i++) {
        const row = deliveryData[i];
        const area = String(row[0] || '').trim().toLowerCase();
        if (area === deliveryArea.toLowerCase().trim()) {
          deliveryFee = Number(row[1] || 0);
          break;
        }
      }
      
      // Free delivery threshold
      const finalSubtotal = subtotal - discount;
      if (finalSubtotal >= CONFIG.FREE_DELIVERY_THRESHOLD) {
        deliveryFee = 0;
      }
      
      const total = finalSubtotal + deliveryFee;
      
      // Calculate payment deadline
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + CONFIG.PAYMENT_DEADLINE_HOURS);
      
      // Add to Orders sheet
      const orderRow = [
        orderId,
        new Date().toISOString(),
        customerName,
        customerPhone,
        deliveryArea,
        deliveryNotes || '',
        bookCodes.join(', '),
        bookTitles.join(', '),
        subtotal,
        deliveryFee,
        total,
        'Pending',
        deadline.toISOString(),
        '',
        promoCode ? `Promo: ${promoCode} (-${discount})` : ''
      ];
      
      await appendToSheet('Orders', orderRow);
      
      // Reserve books
      const booksData = await getSheetData('Books');
      for (const book of books) {
        for (let i = 1; i < booksData.length; i++) {
          if (booksData[i][COL.CODE - 1] === book.code) {
            await updateSheet('Books', `I${i + 1}:J${i + 1}`, [[deadline.toISOString(), orderId]]);
            break;
          }
        }
      }
      
      // Send SMS
      const smsMessage = `${CONFIG.BUSINESS_NAME} Order Confirmation\n\nOrder ID: ${orderId}\nTotal: UGX ${total.toLocaleString()}\nBooks: ${bookTitles.join(', ')}\nDelivery: ${deliveryArea} (UGX ${deliveryFee.toLocaleString()})\n\nPay via Mobile Money:\nName: ${CONFIG.MOBILE_MONEY_NAME}\nNumber: ${CONFIG.MOBILE_MONEY_NUMBER}\nReference: ${orderId}\n\nPayment due: ${deadline.toLocaleDateString()} ${deadline.toLocaleTimeString()}\n\nCall/WhatsApp: ${CONFIG.PHONE_NUMBER}`;
      
      await sendSMS(customerPhone, smsMessage);
      
      res.json({ success: true, orderId });
      
    } catch (error) {
      console.error('Error processing order:', error);
      res.json({ success: false, error: error.message });
    }
  });
};
```

### 3.4 Create `vercel.json`
```json
{
  "functions": {
    "api/*.js": {
      "maxDuration": 10
    }
  },
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 3.5 Update `package.json`
```json
{
  "name": "little-readers-backend",
  "version": "1.0.0",
  "description": "Little Readers UG Backend API",
  "main": "index.js",
  "scripts": {
    "dev": "vercel dev",
    "deploy": "vercel --prod"
  },
  "dependencies": {
    "googleapis": "^108.0.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "vercel": "^32.0.0"
  }
}
```

## Step 4: Deploy to Vercel

### 4.1 Install Vercel CLI
```bash
npm install -g vercel
```

### 4.2 Login to Vercel
```bash
vercel login
```

### 4.3 Configure Environment
1. Place your `credentials.json` file in the project root
2. Update `SPREADSHEET_ID` in `lib/sheets.js` with your Sheet ID
3. Update SMS credentials in `lib/sms.js`

### 4.4 Deploy
```bash
vercel --prod
```

Vercel will give you a URL like `https://little-readers-backend.vercel.app`

## Step 5: Update WordPress Plugin

Update your WordPress plugin settings to use the new Vercel URL:

- **Backend URL**: `https://your-vercel-app.vercel.app`
- **API Endpoints**:
  - Books: `/api/books`
  - Availability: `/api/availability`
  - Delivery Areas: `/api/delivery-areas`
  - Delivery Price: `/api/delivery-price`
  - Validate Promo: `/api/validate-promo`
  - Process Order: `/api/process-order`

## Benefits After Migration

✅ **No More Rate Limiting**: Vercel can handle thousands of requests
✅ **Better Performance**: Faster API responses
✅ **Free Forever**: Both Vercel and Google Sheets API are free
✅ **Keep Your Workflow**: Continue editing Google Sheets as before
✅ **Better Caching**: Built-in caching reduces database calls
✅ **Scalability**: Can handle traffic spikes during promos

## Troubleshooting

**Common Issues:**
1. **403 Forbidden**: Make sure service account has access to your Sheet
2. **Sheet not found**: Double-check your Sheet ID
3. **API not working**: Check Vercel function logs in dashboard
4. **CORS errors**: Ensure cors middleware is properly configured

**Testing Your API:**
```bash
# Test books endpoint
curl https://your-vercel-app.vercel.app/api/books

# Test delivery areas
curl https://your-vercel-app.vercel.app/api/delivery-areas

# Test promo validation
curl "https://your-vercel-app.vercel.app/api/validate-promo?code=TEST10"
```

This migration eliminates all rate limiting issues while maintaining your cost-effective Google Sheets workflow!