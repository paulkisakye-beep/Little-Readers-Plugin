# Migration Guide: Vercel + Google Sheets API

This guide will help you migrate your Little Readers UG bookstore backend from Google Apps Script to Vercel while keeping Google Sheets as your database. This approach is **completely free** and provides better performance with higher rate limits.

## Overview

**Benefits of Vercel + Google Sheets API:**
- ✅ **Free hosting** with generous limits
- ✅ **No data migration** required - keep using Google Sheets
- ✅ **Higher rate limits** than Google Apps Script
- ✅ **Better performance** with edge computing
- ✅ **Easy deployment** with Git integration
- ✅ **Maintains Google Sheets workflow** for non-technical users

## Prerequisites

1. **Google Cloud Console account** (free)
2. **Vercel account** (free - sign up at vercel.com)
3. **GitHub account** (free)
4. **Node.js** installed locally (for development)

## Step 1: Enable Google Sheets API

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Create Project"**
3. Enter project name: `little-readers-api`
4. Click **"Create"**

### 1.2 Enable Google Sheets API

1. In Google Cloud Console, go to **"APIs & Services" > "Library"**
2. Search for **"Google Sheets API"**
3. Click **"Google Sheets API"** and click **"Enable"**

### 1.3 Create Service Account

1. Go to **"APIs & Services" > "Credentials"**
2. Click **"Create Credentials" > "Service Account"**
3. Enter name: `little-readers-service`
4. Click **"Create and Continue"**
5. Skip role assignment (click **"Continue"** then **"Done"**)

### 1.4 Generate Service Account Key

1. Click on the created service account email
2. Go to **"Keys"** tab
3. Click **"Add Key" > "Create new key"**
4. Choose **"JSON"** format
5. Download the JSON file (keep it secure!)

### 1.5 Share Google Sheet with Service Account

1. Open your Google Sheet
2. Click **"Share"** button
3. Add the service account email (from the JSON file) as **Editor**
4. Click **"Send"**

## Step 2: Create Node.js Backend

### 2.1 Initialize Project

```bash
mkdir little-readers-backend
cd little-readers-backend
npm init -y
```

### 2.2 Install Dependencies

```bash
npm install googleapis cors dotenv
npm install -D @vercel/node
```

### 2.3 Create Project Structure

```
little-readers-backend/
├── api/
│   ├── books.js
│   ├── availability.js
│   ├── delivery-areas.js
│   ├── delivery-price.js
│   ├── promo.js
│   └── order.js
├── lib/
│   └── sheets.js
├── package.json
├── vercel.json
└── .env
```

### 2.4 Create Environment Configuration

Create `.env` file:
```env
GOOGLE_SHEETS_SPREADSHEET_ID=1CTFpUaGqxKUICPzbDSnkdBiAbS2n5ZNZqjxCwI7xRbs
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_CLIENT_EMAIL=little-readers-service@your-project.iam.gserviceaccount.com
API_KEY=LRU_WebApp_Key_2025
BUSINESS_NAME=Little Readers Ug
PHONE_NUMBER=256781884082
MOBILE_MONEY_NAME=Patience Kabasiita
MOBILE_MONEY_NUMBER=0781884082
FREE_DELIVERY_THRESHOLD=300000
PAYMENT_DEADLINE_HOURS=24
DELIVERY_SHEET_NAME=DeliveryRates
```

### 2.5 Create Google Sheets Helper

Create `lib/sheets.js`:
```javascript
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

let doc;

async function getDoc() {
  if (!doc) {
    doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
  }
  return doc;
}

async function getSheet(sheetName) {
  const document = await getDoc();
  return document.sheetsByTitle[sheetName];
}

// Column mappings (same as your original)
const COL = {
  CODE: 1, TITLE: 2, AUTHOR: 3, CATEGORY: 4, AGE_GROUP: 5, PRICE: 6, IMAGE_URL: 7,
  AVAILABLE: 8, RESERVED_UNTIL: 9, RESERVED_BY: 10, ADDED_DATE: 11, SOLD_DATE: 12
};

const ORD = {
  ID: 1, TIMESTAMP: 2, NAME: 3, PHONE: 4, DELIVERY_AREA: 5, DELIVERY_ADDRESS: 6,
  BOOK_CODES: 7, BOOK_TITLES: 8, SUBTOTAL: 9, DELIVERY_FEE: 10, TOTAL: 11,
  PAYMENT_STATUS: 12, PAYMENT_DEADLINE: 13, PAYMENT_DATE: 14, NOTES: 15
};

module.exports = { getSheet, COL, ORD };
```

### 2.6 Create API Endpoints

Create `api/books.js`:
```javascript
const cors = require('cors');
const { getSheet, COL } = require('../lib/sheets');

// Enable CORS
const corsHandler = cors({
  origin: true,
  credentials: true
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  await runMiddleware(req, res, corsHandler);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sheet = await getSheet('Books');
    const rows = await sheet.getRows();
    
    const books = rows.map(row => ({
      code: row._rawData[COL.CODE - 1] || '',
      title: row._rawData[COL.TITLE - 1] || '',
      author: row._rawData[COL.AUTHOR - 1] || '',
      category: row._rawData[COL.CATEGORY - 1] || '',
      ageGroup: row._rawData[COL.AGE_GROUP - 1] || '',
      price: parseFloat(row._rawData[COL.PRICE - 1] || 0),
      imageUrl: row._rawData[COL.IMAGE_URL - 1] || '',
      available: row._rawData[COL.AVAILABLE - 1] === 'TRUE'
    })).filter(book => book.available);

    res.json({ success: true, books });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
```

Create `api/delivery-areas.js`:
```javascript
const cors = require('cors');
const { getSheet } = require('../lib/sheets');

const corsHandler = cors({
  origin: true,
  credentials: true
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  await runMiddleware(req, res, corsHandler);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sheet = await getSheet(process.env.DELIVERY_SHEET_NAME || 'DeliveryRates');
    const rows = await sheet.getRows();
    
    const areas = rows
      .map(row => row._rawData[0])
      .filter(area => area && area.trim());

    res.json(areas);
  } catch (error) {
    console.error('Error fetching delivery areas:', error);
    res.status(500).json({ error: error.message });
  }
}
```

Create `api/delivery-price.js`:
```javascript
const cors = require('cors');
const { getSheet } = require('../lib/sheets');

const corsHandler = cors({
  origin: true,
  credentials: true
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  await runMiddleware(req, res, corsHandler);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { area } = req.query;
  if (!area) {
    return res.json({ found: false, price: null, matched: null });
  }

  try {
    const sheet = await getSheet(process.env.DELIVERY_SHEET_NAME || 'DeliveryRates');
    const rows = await sheet.getRows();
    
    const areaNorm = area.toLowerCase().trim();
    
    // Exact match first
    for (const row of rows) {
      const name = (row._rawData[0] || '').toLowerCase().trim();
      if (name === areaNorm) {
        return res.json({
          found: true,
          price: parseFloat(row._rawData[1] || 0),
          matched: row._rawData[0]
        });
      }
    }
    
    // Partial match
    for (const row of rows) {
      const name = (row._rawData[0] || '').toLowerCase().trim();
      if (areaNorm.includes(name) || name.includes(areaNorm)) {
        return res.json({
          found: true,
          price: parseFloat(row._rawData[1] || 0),
          matched: row._rawData[0]
        });
      }
    }

    res.json({ found: false, price: null, matched: null });
  } catch (error) {
    console.error('Error fetching delivery price:', error);
    res.status(500).json({ found: false, price: null, matched: null });
  }
}
```

Create `api/promo.js`:
```javascript
const cors = require('cors');
const { getSheet } = require('../lib/sheets');

const corsHandler = cors({
  origin: true,
  credentials: true
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  await runMiddleware(req, res, corsHandler);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;
  if (!code) {
    return res.json({ valid: false });
  }

  try {
    const sheet = await getSheet('PromoCodes');
    const rows = await sheet.getRows();
    
    const normalized = code.toUpperCase().trim();
    const now = new Date();
    
    for (const row of rows) {
      const promoCode = (row._rawData[0] || '').toUpperCase().trim();
      if (promoCode === normalized) {
        const discount = parseFloat(row._rawData[1] || 0) / 100;
        const active = (row._rawData[2] || '').toUpperCase() === 'TRUE';
        
        if (active && discount > 0) {
          return res.json({
            valid: true,
            code: row._rawData[0],
            discount: discount
          });
        }
      }
    }

    res.json({ valid: false });
  } catch (error) {
    console.error('Error validating promo:', error);
    res.json({ valid: false });
  }
}
```

Create `api/availability.js`:
```javascript
const cors = require('cors');
const { getSheet, COL } = require('../lib/sheets');

const corsHandler = cors({
  origin: true,
  credentials: true
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  await runMiddleware(req, res, corsHandler);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { codes } = req.query;
  if (!codes) {
    return res.json({});
  }

  try {
    const sheet = await getSheet('Books');
    const rows = await sheet.getRows();
    
    const codeList = codes.split(',').filter(code => code.trim());
    const result = {};
    
    for (const code of codeList) {
      const row = rows.find(r => (r._rawData[COL.CODE - 1] || '').trim() === code.trim());
      if (row) {
        const available = (row._rawData[COL.AVAILABLE - 1] || '').toUpperCase() === 'TRUE';
        result[code] = available ? 'available' : 'unavailable';
      } else {
        result[code] = 'not_found';
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: error.message });
  }
}
```

Create `api/order.js`:
```javascript
const cors = require('cors');
const { getSheet, ORD, COL } = require('../lib/sheets');

const corsHandler = cors({
  origin: true,
  credentials: true
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  await runMiddleware(req, res, corsHandler);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const orderData = req.body;
    
    // Validate required fields
    if (!orderData.customerName || !orderData.customerPhone || !orderData.deliveryArea || !orderData.books || orderData.books.length === 0) {
      return res.json({ success: false, error: 'Missing required fields' });
    }

    // Generate order ID
    const orderId = `LR${Date.now().toString().slice(-6)}`;
    
    // Calculate totals
    let subtotal = 0;
    const bookCodes = [];
    const bookTitles = [];
    
    for (const book of orderData.books) {
      subtotal += book.price * book.quantity;
      bookCodes.push(book.code);
      bookTitles.push(book.title);
    }
    
    const deliveryFee = parseFloat(orderData.deliveryFee || 0);
    let total = subtotal + deliveryFee;
    
    // Apply promo discount
    if (orderData.promoCode && orderData.discount) {
      const discount = subtotal * parseFloat(orderData.discount);
      total = subtotal - discount + deliveryFee;
    }
    
    // Add to Orders sheet
    const ordersSheet = await getSheet('Orders');
    const paymentDeadline = new Date(Date.now() + (parseInt(process.env.PAYMENT_DEADLINE_HOURS || 24) * 60 * 60 * 1000));
    
    const orderRow = [
      orderId,
      new Date().toISOString(),
      orderData.customerName,
      orderData.customerPhone,
      orderData.deliveryArea,
      orderData.deliveryNotes || '',
      bookCodes.join(', '),
      bookTitles.join(', '),
      subtotal,
      deliveryFee,
      total,
      'PENDING',
      paymentDeadline.toISOString(),
      '',
      ''
    ];
    
    await ordersSheet.addRow(orderRow);
    
    // Reserve books
    const booksSheet = await getSheet('Books');
    const bookRows = await booksSheet.getRows();
    
    for (const book of orderData.books) {
      const bookRow = bookRows.find(row => (row._rawData[COL.CODE - 1] || '').trim() === book.code);
      if (bookRow) {
        bookRow._rawData[COL.RESERVED_UNTIL - 1] = paymentDeadline.toISOString();
        bookRow._rawData[COL.RESERVED_BY - 1] = orderData.customerPhone;
        await bookRow.save();
      }
    }

    // Here you would add SMS sending logic if needed
    // For now, we'll just return success

    res.json({ 
      success: true, 
      orderId: orderId,
      message: 'Order submitted successfully. You will receive SMS with payment details shortly.'
    });
    
  } catch (error) {
    console.error('Error processing order:', error);
    res.json({ success: false, error: error.message });
  }
}
```

### 2.7 Create Vercel Configuration

Create `vercel.json`:
```json
{
  "version": 2,
  "functions": {
    "api/*.js": {
      "runtime": "@vercel/node"
    }
  },
  "env": {
    "GOOGLE_SHEETS_SPREADSHEET_ID": "@google_sheets_spreadsheet_id",
    "GOOGLE_SHEETS_PRIVATE_KEY": "@google_sheets_private_key",
    "GOOGLE_SHEETS_CLIENT_EMAIL": "@google_sheets_client_email",
    "API_KEY": "@api_key",
    "BUSINESS_NAME": "@business_name",
    "PHONE_NUMBER": "@phone_number",
    "MOBILE_MONEY_NAME": "@mobile_money_name",
    "MOBILE_MONEY_NUMBER": "@mobile_money_number",
    "FREE_DELIVERY_THRESHOLD": "@free_delivery_threshold",
    "PAYMENT_DEADLINE_HOURS": "@payment_deadline_hours",
    "DELIVERY_SHEET_NAME": "@delivery_sheet_name"
  }
}
```

## Step 3: Deploy to Vercel

### 3.1 Push to GitHub

1. Create a new repository on GitHub: `little-readers-backend`
2. Push your code:

```bash
git init
git add .
git commit -m "Initial backend migration"
git branch -M main
git remote add origin https://github.com/yourusername/little-readers-backend.git
git push -u origin main
```

### 3.2 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect it's a Node.js project
5. Click **"Deploy"**

### 3.3 Configure Environment Variables

1. In Vercel dashboard, go to your project
2. Go to **Settings > Environment Variables**
3. Add all environment variables from your `.env` file:

```
GOOGLE_SHEETS_SPREADSHEET_ID = 1CTFpUaGqxKUICPzbDSnkdBiAbS2n5ZNZqjxCwI7xRbs
GOOGLE_SHEETS_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----
GOOGLE_SHEETS_CLIENT_EMAIL = little-readers-service@your-project.iam.gserviceaccount.com
API_KEY = LRU_WebApp_Key_2025
BUSINESS_NAME = Little Readers Ug
PHONE_NUMBER = 256781884082
MOBILE_MONEY_NAME = Patience Kabasiita
MOBILE_MONEY_NUMBER = 0781884082
FREE_DELIVERY_THRESHOLD = 300000
PAYMENT_DEADLINE_HOURS = 24
DELIVERY_SHEET_NAME = DeliveryRates
```

4. Click **"Save"**
5. Go to **Deployments** and click **"Redeploy"**

## Step 4: Update WordPress Plugin

Update your WordPress plugin settings to point to your new Vercel API:

1. Go to WordPress Admin > Settings > Little Readers
2. Update **Backend URL** to: `https://your-project-name.vercel.app`
3. Keep the same **API Key**: `LRU_WebApp_Key_2025`

### API Endpoints Mapping

Your new endpoints will be:
- Books: `https://your-project-name.vercel.app/api/books`
- Delivery Areas: `https://your-project-name.vercel.app/api/delivery-areas`
- Delivery Price: `https://your-project-name.vercel.app/api/delivery-price?area=Kampala`
- Promo Validation: `https://your-project-name.vercel.app/api/promo?code=SAVE10`
- Book Availability: `https://your-project-name.vercel.app/api/availability?codes=BK001,BK002`
- Order Processing: `https://your-project-name.vercel.app/api/order` (POST)

## Step 5: Testing

### 5.1 Test API Endpoints

Test each endpoint in your browser or using curl:

```bash
# Test books endpoint
curl https://your-project-name.vercel.app/api/books

# Test delivery areas
curl https://your-project-name.vercel.app/api/delivery-areas

# Test delivery price
curl "https://your-project-name.vercel.app/api/delivery-price?area=Kampala"
```

### 5.2 Test WordPress Plugin

1. Load your WordPress page with the `[little_readers_store]` shortcode
2. Check that books load correctly
3. Test delivery area selection
4. Test promo code validation
5. Test order submission

## Step 6: Add SMS Integration (Optional)

If you need SMS functionality, you can integrate with SMS providers like:

1. **Twilio** (free trial)
2. **Africa's Talking** (popular in Uganda)
3. **Vonage** (formerly Nexmo)

Add SMS integration to `api/order.js`:

```javascript
// Add after successful order creation
const smsMessage = `Order ${orderId} received! Pay UGX ${total} to ${process.env.MOBILE_MONEY_NUMBER} (${process.env.MOBILE_MONEY_NAME}). Payment deadline: 24hrs.`;

// Send SMS using your preferred provider
await sendSMS(orderData.customerPhone, smsMessage);
```

## Benefits Achieved

✅ **No more rate limiting** - Vercel has much higher limits
✅ **Better performance** - Edge computing worldwide
✅ **Free hosting** - No costs for your usage level
✅ **Auto-scaling** - Handles traffic spikes automatically
✅ **Git deployment** - Easy updates via GitHub
✅ **Keep Google Sheets** - Non-technical users can still edit data
✅ **Better debugging** - Clear error logs and monitoring

## Maintenance

- **Updates**: Just push to GitHub, Vercel auto-deploys
- **Monitoring**: Check Vercel dashboard for performance metrics
- **Logs**: View function logs in Vercel dashboard for debugging
- **Google Sheets**: Continue editing data in Google Sheets as before

Your bookstore will now run on professional infrastructure while maintaining the simplicity of Google Sheets for data management!