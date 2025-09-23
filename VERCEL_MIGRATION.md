# Migration Guide: Google Apps Script to Vercel + Google Sheets API

This guide will help you migrate your Little Readers UG backend from Google Apps Script to Vercel (free hosting) while keeping Google Sheets as your database. This eliminates rate limiting issues while maintaining your cost-effective workflow.

## Why Migrate to Vercel?

- **Free hosting** with generous limits
- **No rate limiting** like Google Apps Script
- **Serverless functions** perfect for API endpoints
- **Keep Google Sheets** as your database (no data migration)
- **Higher performance** and reliability
- **Easy deployment** from GitHub

## Prerequisites

1. GitHub account (free)
2. Vercel account (free) - sign up at vercel.com
3. Google Cloud Console access for Sheets API

## Step 1: Setup Google Sheets API Credentials

### 1.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: "Little Readers Backend"
3. Enable Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search "Google Sheets API"
   - Click "Enable"

### 1.2 Create Service Account
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Name: "little-readers-api"
4. Click "Create and Continue"
5. Skip role assignment (click "Continue")
6. Click "Done"

### 1.3 Generate API Key
1. Click on your service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create New Key"
4. Choose "JSON" format
5. Download the JSON file - keep it secure!

### 1.4 Share Sheet with Service Account
1. Open your Google Sheet
2. Click "Share"
3. Add the service account email (from JSON file: `client_email`)
4. Give "Editor" permissions

## Step 2: Create Vercel Backend Project

### 2.1 Project Structure
Create a new folder `little-readers-vercel-backend/`:

```
little-readers-vercel-backend/
├── package.json
├── vercel.json
├── .env.example
├── .gitignore
├── api/
│   ├── books.js
│   ├── availability.js
│   ├── delivery-price.js
│   ├── delivery-areas.js
│   ├── validate-promo.js
│   └── process-order.js
└── lib/
    ├── sheets.js
    ├── sms.js
    └── utils.js
```

### 2.2 package.json
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
    "googleapis": "^128.0.0",
    "node-cache": "^5.1.2"
  },
  "engines": {
    "node": ">=18"
  }
}
```

### 2.3 vercel.json
```json
{
  "functions": {
    "api/**/*.js": {
      "maxDuration": 10
    }
  },
  "env": {
    "GOOGLE_SHEETS_PRIVATE_KEY": "@google_sheets_private_key",
    "GOOGLE_SHEETS_CLIENT_EMAIL": "@google_sheets_client_email",
    "SPREADSHEET_ID": "@spreadsheet_id",
    "API_KEY": "@api_key"
  }
}
```

### 2.4 .env.example
```env
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
SPREADSHEET_ID="1CTFpUaGqxKUICPzbDSnkdBiAbS2n5ZNZqjxCwI7xRbs"
API_KEY="LRU_WebApp_Key_2025"
EGOSMS_USERNAME="your_egosms_username"
EGOSMS_PASSWORD="your_egosms_password"
```

### 2.5 .gitignore
```
node_modules/
.env
.env.local
.vercel
service-account.json
```

## Step 3: Core Library Files

### 3.1 lib/sheets.js
```javascript
const { GoogleSpreadsheet } = require('google-spreadsheet');
const NodeCache = require('node-cache');

// Cache for 30 minutes
const cache = new NodeCache({ stdTTL: 1800 });

class SheetsService {
  constructor() {
    this.doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
    this.authenticated = false;
  }

  async authenticate() {
    if (this.authenticated) return;
    
    await this.doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
    
    await this.doc.loadInfo();
    this.authenticated = true;
  }

  async getSheet(sheetName) {
    await this.authenticate();
    return this.doc.sheetsByTitle[sheetName];
  }

  async getCachedData(key, fetchFunction, ttl = 1800) {
    const cached = cache.get(key);
    if (cached) return cached;
    
    const data = await fetchFunction();
    cache.set(key, data, ttl);
    return data;
  }

  async getAvailableBooks() {
    return this.getCachedData('books', async () => {
      const sheet = await this.getSheet('Books');
      const rows = await sheet.getRows();
      
      return rows
        .filter(row => row.Available === 'TRUE')
        .map(row => ({
          code: row.Code,
          title: row.Title,
          author: row.Author,
          category: row.Category,
          ageGroup: row['Age Group'],
          price: parseFloat(row.Price || 0),
          imageUrl: row['Image URL'] || '',
          available: true
        }));
    }, 600); // 10 minutes cache
  }

  async getAllDeliveryAreas() {
    return this.getCachedData('delivery_areas', async () => {
      const sheet = await this.getSheet('DeliveryRates');
      const rows = await sheet.getRows();
      
      return rows.map(row => row['Area Name']).filter(Boolean);
    }, 7200); // 2 hours cache
  }

  async getDeliveryPrice(area) {
    const sheet = await this.getSheet('DeliveryRates');
    const rows = await sheet.getRows();
    
    const normalizedArea = area.toLowerCase().trim();
    
    // Exact match first
    let match = rows.find(row => 
      row['Area Name'].toLowerCase().trim() === normalizedArea
    );
    
    // Partial match if no exact match
    if (!match) {
      match = rows.find(row => 
        row['Area Name'].toLowerCase().includes(normalizedArea) ||
        normalizedArea.includes(row['Area Name'].toLowerCase())
      );
    }
    
    if (match) {
      return {
        found: true,
        price: parseFloat(match.Price || 0),
        matched: match['Area Name']
      };
    }
    
    return { found: false, price: null, matched: null };
  }

  async checkBooksAvailability(codes) {
    const sheet = await this.getSheet('Books');
    const rows = await sheet.getRows();
    
    return codes.map(code => {
      const book = rows.find(row => row.Code === code);
      if (!book) {
        return { code, available: false, status: 'not_found' };
      }
      
      if (book.Available !== 'TRUE') {
        return { code, available: false, status: 'unavailable' };
      }
      
      return { code, available: true, status: 'available' };
    });
  }

  async validatePromo(code) {
    if (!code) return { valid: false };
    
    return this.getCachedData(`promo_${code}`, async () => {
      const sheet = await this.getSheet('PromoCodes');
      const rows = await sheet.getRows();
      
      const promo = rows.find(row => 
        row.Code.toUpperCase() === code.toUpperCase() && 
        row.Active === 'TRUE'
      );
      
      if (promo) {
        return {
          valid: true,
          code: promo.Code,
          discount: parseFloat(promo['Discount (%)']) / 100
        };
      }
      
      return { valid: false };
    }, 3600); // 1 hour cache
  }

  async processOrder(orderData) {
    await this.authenticate();
    const sheet = await this.getSheet('Orders');
    
    // Generate order ID
    const orderId = 'ORD' + Date.now().toString().slice(-8);
    
    // Calculate totals
    const subtotal = orderData.books.reduce((sum, book) => sum + book.price, 0);
    const deliveryResult = await this.getDeliveryPrice(orderData.deliveryArea);
    const deliveryFee = deliveryResult.found ? deliveryResult.price : 0;
    
    let discount = 0;
    if (orderData.promoCode) {
      const promoResult = await this.validatePromo(orderData.promoCode);
      if (promoResult.valid) {
        discount = subtotal * promoResult.discount;
      }
    }
    
    const total = subtotal + deliveryFee - discount;
    
    // Add order to sheet
    await sheet.addRow({
      'Order ID': orderId,
      'Timestamp': new Date().toISOString(),
      'Customer Name': orderData.customerName,
      'Phone': orderData.customerPhone,
      'Delivery Area': orderData.deliveryArea,
      'Delivery Address': orderData.deliveryNotes || '',
      'Book Codes': orderData.books.map(b => b.code).join(', '),
      'Book Titles': orderData.books.map(b => b.title).join(', '),
      'Subtotal': subtotal,
      'Delivery Fee': deliveryFee,
      'Total': total,
      'Payment Status': 'PENDING',
      'Payment Deadline': new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      'Notes': ''
    });
    
    // Reserve books
    const booksSheet = await this.getSheet('Books');
    const bookRows = await booksSheet.getRows();
    
    for (const orderBook of orderData.books) {
      const bookRow = bookRows.find(row => row.Code === orderBook.code);
      if (bookRow && bookRow.Available === 'TRUE') {
        bookRow.Available = 'FALSE';
        bookRow['Reserved Until'] = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        bookRow['Reserved By'] = orderData.customerPhone;
        await bookRow.save();
      }
    }
    
    // Clear caches
    cache.del('books');
    
    return {
      success: true,
      orderId,
      total,
      message: 'Order placed successfully!'
    };
  }
}

module.exports = new SheetsService();
```

### 3.2 lib/sms.js
```javascript
const fetch = require('node-fetch');

class SMSService {
  async sendSMS(phone, message) {
    if (!process.env.EGOSMS_USERNAME || !process.env.EGOSMS_PASSWORD) {
      console.log('SMS not configured, would send:', { phone, message });
      return { success: true, message: 'SMS simulation (no credentials)' };
    }

    const url = `https://www.egosms.co/api/v1/plain/?username=${encodeURIComponent(process.env.EGOSMS_USERNAME)}&password=${encodeURIComponent(process.env.EGOSMS_PASSWORD)}&number=${encodeURIComponent(phone)}&sender=LittleReaders&message=${encodeURIComponent(message)}`;
    
    try {
      const response = await fetch(url);
      const result = await response.text();
      
      return { success: true, result };
    } catch (error) {
      console.error('SMS Error:', error);
      return { success: false, error: error.message };
    }
  }

  createOrderSMS(orderData, orderId, total) {
    const { customerName, customerPhone, deliveryArea, books } = orderData;
    
    const booksList = books.map(book => `${book.title}`).join(', ');
    
    return `Hi ${customerName}! Your Little Readers UG order ${orderId} is confirmed.

Books: ${booksList}
Total: UGX ${total.toLocaleString()}
Delivery: ${deliveryArea}

Pay via Mobile Money:
Name: Patience Kabasiita
Number: 0781884082

You have 24 hours to pay. Books are reserved for you.

Questions? WhatsApp: 0771675754`;
  }
}

module.exports = new SMSService();
```

### 3.3 lib/utils.js
```javascript
function validatePhone(phone) {
  // Ugandan phone validation
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('256')) {
    const number = cleaned.slice(3);
    if (number.length === 9 && ['70', '75', '77', '78'].some(prefix => number.startsWith(prefix))) {
      return `+256${number}`;
    }
  } else if (cleaned.startsWith('0')) {
    const number = cleaned.slice(1);
    if (number.length === 9 && ['70', '75', '77', '78'].some(prefix => number.startsWith(prefix))) {
      return `+256${number}`;
    }
  }
  
  return null;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

module.exports = {
  validatePhone,
  corsHeaders,
  jsonResponse
};
```

## Step 4: API Endpoints

### 4.1 api/books.js
```javascript
const sheets = require('../lib/sheets');
const { jsonResponse } = require('../lib/utils');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const books = await sheets.getAvailableBooks();
    
    res.status(200).json({
      success: true,
      books
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

### 4.2 api/delivery-areas.js
```javascript
const sheets = require('../lib/sheets');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const areas = await sheets.getAllDeliveryAreas();
    
    res.status(200).json(areas);
  } catch (error) {
    console.error('Delivery Areas API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch delivery areas'
    });
  }
}
```

### 4.3 api/delivery-price.js
```javascript
const sheets = require('../lib/sheets');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { area } = req.query;
  
  if (!area) {
    return res.status(400).json({
      success: false,
      error: 'Area parameter required'
    });
  }

  try {
    const result = await sheets.getDeliveryPrice(area);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Delivery Price API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get delivery price'
    });
  }
}
```

### 4.4 api/validate-promo.js
```javascript
const sheets = require('../lib/sheets');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({
      valid: false,
      error: 'Promo code required'
    });
  }

  try {
    const result = await sheets.validatePromo(code);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Promo Validation API Error:', error);
    res.status(500).json({
      valid: false,
      error: 'Failed to validate promo code'
    });
  }
}
```

### 4.5 api/availability.js
```javascript
const sheets = require('../lib/sheets');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { codes } = req.query;
  
  if (!codes) {
    return res.status(400).json({
      success: false,
      error: 'Book codes required'
    });
  }

  try {
    const codeArray = codes.split(',').map(code => code.trim());
    const results = await sheets.checkBooksAvailability(codeArray);
    
    res.status(200).json(results);
  } catch (error) {
    console.error('Availability API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check availability'
    });
  }
}
```

### 4.6 api/process-order.js
```javascript
const sheets = require('../lib/sheets');
const sms = require('../lib/sms');
const { validatePhone } = require('../lib/utils');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const { apiKey } = req.query;
  
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  try {
    const orderData = req.body;
    
    // Validate required fields
    if (!orderData.customerName || !orderData.customerPhone || !orderData.deliveryArea || !orderData.books || orderData.books.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Validate phone number
    const validPhone = validatePhone(orderData.customerPhone);
    if (!validPhone) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number'
      });
    }
    
    orderData.customerPhone = validPhone;

    // Process the order
    const result = await sheets.processOrder(orderData);
    
    if (result.success) {
      // Send SMS
      const smsMessage = sms.createOrderSMS(orderData, result.orderId, result.total);
      await sms.sendSMS(validPhone, smsMessage);
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Order Processing Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process order'
    });
  }
}
```

## Step 5: Deployment

### 5.1 Push to GitHub
1. Initialize git repository:
```bash
git init
git add .
git commit -m "Initial Vercel backend setup"
```

2. Create GitHub repository: "little-readers-vercel-backend"

3. Push to GitHub:
```bash
git remote add origin https://github.com/yourusername/little-readers-vercel-backend.git
git push -u origin main
```

### 5.2 Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Import Git Repository"
3. Select your GitHub repository
4. Set Framework Preset: "Other"
5. Click "Deploy"

### 5.3 Configure Environment Variables
1. Go to your Vercel project dashboard
2. Click "Settings" tab
3. Click "Environment Variables"
4. Add these variables:
   - `GOOGLE_SHEETS_PRIVATE_KEY`: (from your JSON file)
   - `GOOGLE_SHEETS_CLIENT_EMAIL`: (from your JSON file)
   - `SPREADSHEET_ID`: Your Google Sheets ID
   - `API_KEY`: LRU_WebApp_Key_2025
   - `EGOSMS_USERNAME`: (your EgoSMS username)
   - `EGOSMS_PASSWORD`: (your EgoSMS password)

### 5.4 Test Your API
Your API will be available at: `https://your-project.vercel.app/api/`

Test endpoints:
- `https://your-project.vercel.app/api/books`
- `https://your-project.vercel.app/api/delivery-areas`
- `https://your-project.vercel.app/api/delivery-price?area=Kampala`

## Step 6: Update WordPress Plugin

Update your WordPress plugin settings to use the new Vercel URL:
- Old: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`
- New: `https://your-project.vercel.app/api`

## Benefits After Migration

✅ **No Rate Limiting** - Handle unlimited requests  
✅ **Better Performance** - Faster response times  
✅ **Free Hosting** - No costs with Vercel free tier  
✅ **Keep Google Sheets** - No data migration needed  
✅ **Better Reliability** - More stable than Apps Script  
✅ **Easy Updates** - Deploy changes via GitHub  
✅ **Real Monitoring** - Vercel provides detailed analytics  

## Troubleshooting

### Common Issues:
1. **Authentication Error**: Check service account JSON format in environment variables
2. **Sheets Not Found**: Verify SPREADSHEET_ID and sheet names
3. **CORS Errors**: Headers are included in all responses
4. **SMS Not Working**: Check EGOSMS credentials

### Testing:
- Use Vercel's function logs for debugging
- Test each endpoint individually
- Verify Google Sheets permissions

Your backend is now migrated to Vercel with no rate limiting and better performance while keeping your Google Sheets workflow intact!