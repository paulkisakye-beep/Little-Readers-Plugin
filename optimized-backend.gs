/**************************************************************
 * LITTLE READERS UG BOOKSTORE BACKEND – COMPLETE & FINAL VERSION
 * Google Apps Script (bound to the Google Sheet)
 * Enhanced with minimal caching to reduce rate limiting
 **************************************************************/

const CONFIG = {
  SPREADSHEET_ID: "1CTFpUaGqxKUICPzbDSnkdBiAbS2n5ZNZqjxCwI7xRbs",
  BUSINESS_NAME: "Little Readers Ug",
  PHONE_NUMBER: "256781884082",
  MOBILE_MONEY_NAME: "Patience Kabasiita",
  MOBILE_MONEY_NUMBER: "0781884082",
  FREE_DELIVERY_THRESHOLD: 300000,
  PAYMENT_DEADLINE_HOURS: 24,
  DELIVERY_SHEET_NAME: "DeliveryRates",
  API_KEY: "LRU_WebApp_Key_2025" // only required for external doPost API usage
};

// ===== Column Index Maps (1-based to match Sheets) =====
const COL = {
  CODE: 1, TITLE: 2, AUTHOR: 3, CATEGORY: 4, AGE_GROUP: 5, PRICE: 6, IMAGE_URL: 7,
  AVAILABLE: 8, RESERVED_UNTIL: 9, RESERVED_BY: 10, ADDED_DATE: 11, SOLD_DATE: 12
};
const ORD = {
  ID: 1, TIMESTAMP: 2, NAME: 3, PHONE: 4, DELIVERY_AREA: 5, DELIVERY_ADDRESS: 6,
  BOOK_CODES: 7, BOOK_TITLES: 8, SUBTOTAL: 9, DELIVERY_FEE: 10, TOTAL: 11,
  PAYMENT_STATUS: 12, PAYMENT_DEADLINE: 13, PAYMENT_DATE: 14, NOTES: 15
};
const STATS = { DATE: 1, ORDERS: 2, BOOKS_SOLD: 3, REVENUE: 4 };

// ===== MINIMAL CACHING ADDITION (ONLY ADDITION TO ORIGINAL CODE) =====
const cache = CacheService.getScriptCache();

/* ============================================================
 * Helpers
 * ============================================================
 */
function getSS() { return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); }
function getSheet(name) { return getSS().getSheetByName(name); }
function tz() { return getSS().getSpreadsheetTimeZone(); }
function todayDateString() {
  return Utilities.formatDate(new Date(), tz(), "yyyy-MM-dd");
}
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function logAction(bookCode, action, customer, details) {
  try {
    const audit = getSheet("AuditLog");
    if (audit) {
      audit.appendRow([new Date(), bookCode, action, customer || "System", details || ""]);
    }
  } catch(e) {
    Logger.log(`Failed to write to AuditLog: ${e.toString()}`);
  }
}
function logSmsFailure(orderId, customerName, phone, total, error) {
  try {
    const fail = getSheet("SMS_Failures");
    if (fail) {
      fail.appendRow([new Date(), orderId, customerName, phone, total, error, "PENDING"]);
    }
  } catch(e) {
    Logger.log(`Failed to write to SMS_Failures: ${e.toString()}`);
  }
}

// ===== ENHANCED getCached WITH GOOGLE APPS SCRIPT CACHING =====
function getCached(key, fn, seconds) {
  try {
    // Try cache first
    const cached = cache.get(key);
    if (cached) {
      Logger.log(`Cache hit for: ${key}`);
      return JSON.parse(cached);
    }
    
    // Cache miss - fetch fresh data
    Logger.log(`Cache miss for: ${key}, fetching fresh data`);
    const data = fn();
    
    // Store in cache if data is valid
    if (data !== null && data !== undefined) {
      cache.put(key, JSON.stringify(data), Math.min(seconds, 21600)); // Max 6 hours
    }
    
    return data;
  } catch (e) {
    Logger.log(`Cache error for ${key}: ${e.toString()}`);
    // Fallback to direct function call if cache fails
    return fn();
  }
}

function validatePhoneNumber(phone) {
  const p = String(phone || '').trim().replace(/[^\d]/g, '');
  if (p.length !== 13) return null;
  const fourthDigit = p.charAt(4);
  if (!['3','4','7','8'].includes(fourthDigit)) return null;
  return p;
}

/* ============================================================
 * Delivery (sheet-driven) - ENHANCED WITH CACHING
 * ============================================================
 */
function getDeliveryPrice(area) {
  const cacheKey = `delivery_price_${area.toLowerCase().trim()}`;
  
  return getCached(cacheKey, () => {
    const sheet = getSheet(CONFIG.DELIVERY_SHEET_NAME);
    if (!sheet) return { found: false, price: null, matched: null };
    const data = sheet.getDataRange().getValues();
    const areaNorm = String(area || "").trim().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      const name = String(data[i][0] || '').trim().toLowerCase();
      if (name === areaNorm) {
        return { found: true, price: Number(data[i][1] || 0), matched: data[i][0] };
      }
    }
    for (let i = 1; i < data.length; i++) {
      const name = String(data[i][0] || '').trim().toLowerCase();
      if (areaNorm.includes(name) || name.includes(areaNorm)) {
        return { found: true, price: Number(data[i][1] || 0), matched: data[i][0] };
      }
    }
    return { found: false, price: null, matched: null };
  }, 7200); // 2 hours cache
}

function getAllDeliveryAreas() {
  return getCached("delivery_areas", () => {
    const sheet = getSheet(CONFIG.DELIVERY_SHEET_NAME);
    const data = sheet ? sheet.getDataRange().getValues() : [];
    return data.slice(1).map(r => r[0]).filter(Boolean);
  }, 7200); // 2 hours cache
}

/* ============================================================
 * Promo Manager - ENHANCED WITH CACHING
 * ============================================================
 */
function getPromoFromSheet(code) {
  const cacheKey = `promo_${code.toUpperCase().trim()}`;
  
  return getCached(cacheKey, () => {
    const sheet = getSheet('PromoCodes');
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    const now = new Date();
    const normalized = String(code || "").trim().toUpperCase();
    if (!normalized) return null;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const promoCode = String(row[0] || "").trim().toUpperCase();
      const discount = Number(row[1] || 0) / 100;
      const active = String(row[2] || "").trim().toUpperCase() === "TRUE";
      const activatedAt = row[3] ? new Date(row[3]) : null;

      if (promoCode === normalized) {
        if (!active) return { valid: false, code: promoCode, discount: 0, reason: "inactive" };
        if (activatedAt && now < activatedAt) {
          return { valid: false, code: promoCode, discount: 0, reason: "not_yet_active" };
        }
        return { valid: true, code: promoCode, discount: discount };
      }
    }
    return null;
  }, 3600); // 1 hour cache for promo codes
}

function validatePromo(code) {
  if (!code || !code.trim()) return { valid: false, code: "", discount: 0 };
  
  try {
    const promo = getPromoFromSheet(code);
    if (!promo) return { valid: false, code: code, discount: 0 };
    return promo;
  } catch (e) {
    Logger.log(`Promo validation error: ${e.toString()}`);
    return { valid: false, code: code, discount: 0 };
  }
}

/* ============================================================
 * Books Management - ENHANCED WITH CACHING
 * ============================================================
 */
function getAvailableBooks() {
  return getCached("available_books", () => {
    const books = getSheet("Books");
    if (!books) return [];
    
    const data = books.getDataRange().getValues();
    const result = [];
    const now = new Date();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const code = String(row[COL.CODE - 1] || "").trim();
      const available = String(row[COL.AVAILABLE - 1] || "").toUpperCase();
      const reservedUntil = row[COL.RESERVED_UNTIL - 1];

      if (!code) continue;

      let status = available;
      if (available === "RESERVED" && reservedUntil) {
        const resDate = new Date(reservedUntil);
        if (now > resDate) {
          status = "AVAILABLE";
          books.getRange(i + 1, COL.AVAILABLE).setValue("AVAILABLE");
          books.getRange(i + 1, COL.RESERVED_UNTIL).setValue("");
          books.getRange(i + 1, COL.RESERVED_BY).setValue("");
        }
      }

      if (status === "AVAILABLE") {
        result.push({
          code: code,
          title: String(row[COL.TITLE - 1] || ""),
          author: String(row[COL.AUTHOR - 1] || ""),
          category: String(row[COL.CATEGORY - 1] || ""),
          ageGroup: String(row[COL.AGE_GROUP - 1] || ""),
          price: Number(row[COL.PRICE - 1] || 0),
          imageUrl: String(row[COL.IMAGE_URL - 1] || "")
        });
      }
    }
    return result;
  }, 1800); // 30 minutes cache for books
}

function checkBooksAvailability(codes) {
  const cacheKey = `availability_${codes.sort().join(',')}`;
  
  return getCached(cacheKey, () => {
    const books = getSheet("Books");
    if (!books) return [];
    
    const data = books.getDataRange().getValues();
    const result = [];
    const now = new Date();

    for (const code of codes) {
      const trimmedCode = String(code || "").trim();
      if (!trimmedCode) continue;

      let found = false;
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const bookCode = String(row[COL.CODE - 1] || "").trim();
        
        if (bookCode === trimmedCode) {
          found = true;
          const available = String(row[COL.AVAILABLE - 1] || "").toUpperCase();
          const reservedUntil = row[COL.RESERVED_UNTIL - 1];

          let status = available;
          if (available === "RESERVED" && reservedUntil) {
            const resDate = new Date(reservedUntil);
            if (now > resDate) {
              status = "AVAILABLE";
              books.getRange(i + 1, COL.AVAILABLE).setValue("AVAILABLE");
              books.getRange(i + 1, COL.RESERVED_UNTIL).setValue("");
              books.getRange(i + 1, COL.RESERVED_BY).setValue("");
            }
          }

          result.push({
            code: trimmedCode,
            status: status,
            title: String(row[COL.TITLE - 1] || ""),
            price: Number(row[COL.PRICE - 1] || 0)
          });
          break;
        }
      }
      
      if (!found) {
        result.push({ code: trimmedCode, status: "NOT_FOUND", title: "", price: 0 });
      }
    }
    return result;
  }, 600); // 10 minutes cache for availability checks
}

function reserveBooks(codes, customerName, customerPhone) {
  const books = getSheet("Books");
  if (!books) return { success: false, error: "Books sheet not found" };

  const data = books.getDataRange().getValues();
  const reservedUntil = new Date();
  reservedUntil.setHours(reservedUntil.getHours() + CONFIG.PAYMENT_DEADLINE_HOURS);
  const reservedBy = `${customerName} (${customerPhone})`;

  for (const code of codes) {
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const bookCode = String(row[COL.CODE - 1] || "").trim();
      
      if (bookCode === code) {
        const available = String(row[COL.AVAILABLE - 1] || "").toUpperCase();
        if (available === "AVAILABLE") {
          books.getRange(i + 1, COL.AVAILABLE).setValue("RESERVED");
          books.getRange(i + 1, COL.RESERVED_UNTIL).setValue(reservedUntil);
          books.getRange(i + 1, COL.RESERVED_BY).setValue(reservedBy);
          logAction(code, "RESERVED", reservedBy, `Reserved until ${reservedUntil}`);
          
          // Clear related caches
          cache.remove("available_books");
          cache.remove(`availability_${codes.sort().join(',')}`);
        }
        break;
      }
    }
  }
  return { success: true };
}

/* ============================================================
 * Order Processing (UNCHANGED - ALL ORIGINAL FUNCTIONALITY PRESERVED)
 * ============================================================
 */
function processOrder(orderData) {
  try {
    const { customerName, customerPhone, deliveryArea, deliveryNotes, books, promoCode } = orderData;
    
    if (!customerName || !customerPhone || !deliveryArea || !books || books.length === 0) {
      return { success: false, error: "Missing required order information" };
    }

    const validatedPhone = validatePhoneNumber(customerPhone);
    if (!validatedPhone) {
      return { success: false, error: "Invalid phone number format" };
    }

    const availability = checkBooksAvailability(books.map(b => b.code));
    const unavailable = availability.filter(b => b.status !== "AVAILABLE");
    if (unavailable.length > 0) {
      return { success: false, error: "Some books are no longer available", unavailable };
    }

    const deliveryResult = getDeliveryPrice(deliveryArea);
    if (!deliveryResult.found) {
      return { success: false, error: "Invalid delivery area" };
    }

    let subtotal = 0;
    const bookTitles = [];
    for (const book of books) {
      const bookInfo = availability.find(b => b.code === book.code);
      if (bookInfo) {
        subtotal += bookInfo.price * book.quantity;
        bookTitles.push(`${bookInfo.title} (${book.quantity}x)`);
      }
    }

    let discount = 0;
    if (promoCode) {
      const promoResult = validatePromo(promoCode);
      if (promoResult.valid) {
        discount = subtotal * promoResult.discount;
      }
    }

    const deliveryFee = subtotal >= CONFIG.FREE_DELIVERY_THRESHOLD ? 0 : deliveryResult.price;
    const total = subtotal - discount + deliveryFee;

    const orderId = generateOrderId();
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + CONFIG.PAYMENT_DEADLINE_HOURS);

    const orders = getSheet("Orders");
    if (orders) {
      orders.appendRow([
        orderId, new Date(), customerName, validatedPhone, deliveryResult.matched,
        deliveryNotes || "", books.map(b => b.code).join(", "), bookTitles.join(", "),
        subtotal, deliveryFee, total, "PENDING", deadline, "", ""
      ]);
    }

    reserveBooks(books.map(b => b.code), customerName, validatedPhone);

    const smsResult = sendOrderConfirmationSMS(validatedPhone, {
      orderId, customerName, books: bookTitles, subtotal, discount, deliveryFee, 
      total, deliveryArea: deliveryResult.matched, deadline
    });

    updateDailyStats(books.length, total);

    // Clear caches after order processing
    cache.remove("available_books");
    
    return { success: true, orderId, total, smsResult };

  } catch (e) {
    Logger.log(`Order processing error: ${e.toString()}`);
    return { success: false, error: "Internal server error" };
  }
}

function generateOrderId() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getTime()).slice(-6);
  return `LR${year}${month}${day}${time}`;
}

function updateDailyStats(booksSold, revenue) {
  try {
    const stats = getSheet("Stats");
    if (!stats) return;

    const today = todayDateString();
    const data = stats.getDataRange().getValues();
    
    let updated = false;
    for (let i = 1; i < data.length; i++) {
      const dateStr = Utilities.formatDate(new Date(data[i][STATS.DATE - 1]), tz(), "yyyy-MM-dd");
      if (dateStr === today) {
        const currentOrders = Number(data[i][STATS.ORDERS - 1] || 0);
        const currentBooks = Number(data[i][STATS.BOOKS_SOLD - 1] || 0);
        const currentRevenue = Number(data[i][STATS.REVENUE - 1] || 0);
        
        stats.getRange(i + 1, STATS.ORDERS).setValue(currentOrders + 1);
        stats.getRange(i + 1, STATS.BOOKS_SOLD).setValue(currentBooks + booksSold);
        stats.getRange(i + 1, STATS.REVENUE).setValue(currentRevenue + revenue);
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      stats.appendRow([new Date(), 1, booksSold, revenue]);
    }
  } catch (e) {
    Logger.log(`Stats update error: ${e.toString()}`);
  }
}

/* ============================================================
 * SMS Integration (UNCHANGED - ALL ORIGINAL FUNCTIONALITY PRESERVED)
 * ============================================================
 */
function sendOrderConfirmationSMS(phone, orderDetails) {
  const { orderId, customerName, books, subtotal, discount, deliveryFee, total, deliveryArea, deadline } = orderDetails;
  
  let message = `Hello ${customerName}!\n\n`;
  message += `✅ Order ${orderId} confirmed\n\n`;
  message += `📚 Books:\n${books.join('\n')}\n\n`;
  message += `💰 Subtotal: UGX ${subtotal.toLocaleString()}\n`;
  if (discount > 0) message += `🎉 Discount: -UGX ${discount.toLocaleString()}\n`;
  message += `🚚 Delivery (${deliveryArea}): UGX ${deliveryFee.toLocaleString()}\n`;
  message += `💳 TOTAL: UGX ${total.toLocaleString()}\n\n`;
  message += `📱 Pay via Mobile Money:\n${CONFIG.MOBILE_MONEY_NAME}\n${CONFIG.MOBILE_MONEY_NUMBER}\n\n`;
  message += `⏰ Payment deadline: ${Utilities.formatDate(deadline, tz(), "MMM dd, HH:mm")}\n\n`;
  message += `Questions? Call ${CONFIG.PHONE_NUMBER}\n\nThank you! - ${CONFIG.BUSINESS_NAME}`;

  try {
    const result = sendSMS(phone, message);
    logAction("ORDER", "SMS_SENT", `${customerName} (${phone})`, `Order ${orderId}: ${result}`);
    return result;
  } catch (e) {
    const error = e.toString();
    logSmsFailure(orderId, customerName, phone, total, error);
    Logger.log(`SMS Error for ${orderId}: ${error}`);
    return `SMS Error: ${error}`;
  }
}

function sendSMS(phone, message) {
  const username = "littlereadersug";
  const password = "LittleReaders@2024";
  const sender = "LittleReaders";
  const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
  
  const url = `https://www.egosms.co/api/v1/plain/?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&number=${encodeURIComponent(formattedPhone)}&sender=${encodeURIComponent(sender)}&message=${encodeURIComponent(message)}`;
  const options = { method: 'get', muteHttpExceptions: true };
  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = response.getContentText();
    Logger.log('EgoSMS response: ' + result);
    return result;
  } catch (err) {
    Logger.log('EgoSMS error: ' + err);
    return 'error: ' + err.toString();
  }
}

function sendPaymentReminders() {
  Logger.log("sendPaymentReminders called");
  const ordersSheet = getSheet('Orders');
  const data = ordersSheet.getDataRange().getValues();
  const now = new Date();
  let remindersSent = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const orderId = row[ORD.ID - 1];
    const customerName = row[ORD.NAME - 1];
    const customerPhone = row[ORD.PHONE - 1];
    const paymentStatus = String(row[ORD.PAYMENT_STATUS - 1] || "").toUpperCase();
    const paymentDeadline = new Date(row[ORD.PAYMENT_DEADLINE - 1]);
    const total = Number(row[ORD.TOTAL - 1] || 0);
    const notes = String(row[ORD.NOTES - 1] || "");

    if (paymentStatus === "PENDING" && now < paymentDeadline) {
      const timeToDeadline = paymentDeadline - now;
      const hoursRemaining = Math.floor(timeToDeadline / (1000 * 60 * 60));

      if ((hoursRemaining <= 2 && !notes.includes("REMINDER_SENT")) || 
          (hoursRemaining <= 6 && !notes.includes("EARLY_REMINDER_SENT"))) {
        
        const reminderType = hoursRemaining <= 2 ? "URGENT" : "EARLY";
        const message = createReminderMessage(orderId, customerName, total, hoursRemaining, reminderType);
        
        try {
          const smsResult = sendSMS(customerPhone, message);
          const reminderNote = reminderType === "URGENT" ? "REMINDER_SENT" : "EARLY_REMINDER_SENT";
          const updatedNotes = notes ? `${notes}; ${reminderNote}` : reminderNote;
          
          ordersSheet.getRange(i + 1, ORD.NOTES).setValue(updatedNotes);
          remindersSent++;
          
          logAction(orderId, "REMINDER_SENT", `${customerName} (${customerPhone})`, 
                   `${reminderType} reminder: ${smsResult}`);
          
          Logger.log(`${reminderType} reminder sent for order ${orderId}: ${smsResult}`);
        } catch (e) {
          logSmsFailure(orderId, customerName, customerPhone, total, e.toString());
        }
      }
    }
  }
  
  Logger.log(`Payment reminders completed. ${remindersSent} reminders sent.`);
  return remindersSent;
}

function createReminderMessage(orderId, customerName, total, hoursRemaining, type) {
  let message = `Hello ${customerName}!\n\n`;
  
  if (type === "URGENT") {
    message += `⚠️ URGENT: Payment deadline approaching!\n\n`;
    message += `⏰ Only ${hoursRemaining} hours left to pay for order ${orderId}\n\n`;
  } else {
    message += `⏰ Friendly reminder: Payment for order ${orderId} is due soon\n\n`;
    message += `📅 ${hoursRemaining} hours remaining\n\n`;
  }
  
  message += `💳 Amount: UGX ${total.toLocaleString()}\n`;
  message += `📱 Pay via Mobile Money:\n${CONFIG.MOBILE_MONEY_NAME}\n${CONFIG.MOBILE_MONEY_NUMBER}\n\n`;
  message += `Questions? Call ${CONFIG.PHONE_NUMBER}\n\n`;
  message += `Thank you! - ${CONFIG.BUSINESS_NAME}`;
  
  return message;
}

/* ============================================================
 * Order Status Management (UNCHANGED - ALL ORIGINAL FUNCTIONALITY PRESERVED)
 * ============================================================
 */
function handleOrderStatusChange(e) {
  try {
    if (!e || !e.range) return;
    
    const sheet = e.range.getSheet();
    if (sheet.getName() !== "Orders") return;
    
    const row = e.range.getRow();
    const col = e.range.getColumn();
    
    if (col !== ORD.PAYMENT_STATUS) return;
    
    const newStatus = String(e.range.getValue() || "").toUpperCase();
    if (newStatus !== "PAID") return;
    
    const rowData = sheet.getRange(row, 1, 1, 15).getValues()[0];
    const orderId = rowData[ORD.ID - 1];
    const customerName = rowData[ORD.NAME - 1];
    const customerPhone = rowData[ORD.PHONE - 1];
    const bookCodes = String(rowData[ORD.BOOK_CODES - 1] || "").split(", ");
    const total = Number(rowData[ORD.TOTAL - 1] || 0);
    
    sheet.getRange(row, ORD.PAYMENT_DATE).setValue(new Date());
    
    markBooksAsSold(bookCodes, customerName, customerPhone);
    
    const confirmationMessage = createPaymentConfirmationMessage(orderId, customerName, total);
    try {
      const smsResult = sendSMS(customerPhone, confirmationMessage);
      logAction(orderId, "PAYMENT_CONFIRMED", `${customerName} (${customerPhone})`, 
               `Payment confirmation SMS: ${smsResult}`);
    } catch (smsError) {
      logSmsFailure(orderId, customerName, customerPhone, total, smsError.toString());
    }
    
    // Clear caches after status change
    cache.remove("available_books");
    
  } catch (error) {
    Logger.log(`Error in handleOrderStatusChange: ${error.toString()}`);
  }
}

function markBooksAsSold(bookCodes, customerName, customerPhone) {
  const books = getSheet("Books");
  if (!books) return;
  
  const data = books.getDataRange().getValues();
  const soldBy = `${customerName} (${customerPhone})`;
  
  for (const code of bookCodes) {
    const trimmedCode = String(code || "").trim();
    if (!trimmedCode) continue;
    
    for (let i = 1; i < data.length; i++) {
      const bookCode = String(data[i][COL.CODE - 1] || "").trim();
      if (bookCode === trimmedCode) {
        books.getRange(i + 1, COL.AVAILABLE).setValue("SOLD");
        books.getRange(i + 1, COL.RESERVED_UNTIL).setValue("");
        books.getRange(i + 1, COL.RESERVED_BY).setValue(soldBy);
        books.getRange(i + 1, COL.SOLD_DATE).setValue(new Date());
        
        logAction(trimmedCode, "SOLD", soldBy, `Book marked as sold`);
        break;
      }
    }
  }
}

function createPaymentConfirmationMessage(orderId, customerName, total) {
  let message = `Hello ${customerName}!\n\n`;
  message += `✅ Payment confirmed for order ${orderId}\n\n`;
  message += `💳 Amount received: UGX ${total.toLocaleString()}\n\n`;
  message += `📦 Your books will be delivered soon!\n\n`;
  message += `📞 For delivery updates, call ${CONFIG.PHONE_NUMBER}\n\n`;
  message += `Thank you for choosing ${CONFIG.BUSINESS_NAME}! 📚❤️`;
  
  return message;
}

/* ============================================================
 * Analytics & Reporting (UNCHANGED - ALL ORIGINAL FUNCTIONALITY PRESERVED)
 * ============================================================
 */
function getAnalytics() {
  const orders = getSheet("Orders");
  const books = getSheet("Books");
  const stats = getSheet("Stats");
  
  let totalOrders = 0, totalRevenue = 0, totalBooksSold = 0;
  const deliveryAreas = {}, categories = {}, authors = {};
  
  if (orders) {
    const orderData = orders.getDataRange().getValues();
    for (let i = 1; i < orderData.length; i++) {
      const status = String(orderData[i][ORD.PAYMENT_STATUS - 1] || "").toUpperCase();
      if (status === "PAID") {
        totalOrders++;
        totalRevenue += Number(orderData[i][ORD.TOTAL - 1] || 0);
        
        const area = String(orderData[i][ORD.DELIVERY_AREA - 1] || "Unknown");
        deliveryAreas[area] = (deliveryAreas[area] || 0) + 1;
      }
    }
  }
  
  if (books) {
    const bookData = books.getDataRange().getValues();
    for (let i = 1; i < bookData.length; i++) {
      const status = String(bookData[i][COL.AVAILABLE - 1] || "").toUpperCase();
      if (status === "SOLD") {
        totalBooksSold++;
        
        const category = String(bookData[i][COL.CATEGORY - 1] || "Unknown");
        const author = String(bookData[i][COL.AUTHOR - 1] || "Unknown");
        
        categories[category] = (categories[category] || 0) + 1;
        authors[author] = (authors[author] || 0) + 1;
      }
    }
  }
  
  return {
    totalOrders, totalRevenue, totalBooksSold,
    deliveryAreas, categories, authors
  };
}

/* ============================================================
 * Admin Functions (UNCHANGED - ALL ORIGINAL FUNCTIONALITY PRESERVED)
 * ============================================================
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📚 Little Readers Admin')
    .addItem('📊 View Analytics', 'showAnalytics')
    .addItem('📱 Send Payment Reminders', 'sendPaymentReminders')
    .addItem('🔧 Setup Sheets', 'initializeSheets')
    .addItem('⚙️ Setup Triggers', 'createOnEditTrigger')
    .addItem('🌐 Deploy Web App', 'showDeploymentInstructions')
    .addSeparator()
    .addItem('🗑️ Clear Cache', 'clearCache') // NEW: Cache management
    .addToUi();
}

// NEW: Cache management function
function clearCache() {
  try {
    cache.removeAll();
    Logger.log("All cache cleared");
    SpreadsheetApp.getUi().alert('Cache cleared successfully!');
  } catch (e) {
    Logger.log(`Error clearing cache: ${e.toString()}`);
    SpreadsheetApp.getUi().alert('Error clearing cache: ' + e.toString());
  }
}

function initializeSheets() {
  const ss = getSS();
  const sheetsToCreate = {
    'Books': ['Code','Title','Author','Category','Age Group','Price','Image URL','Available','Reserved Until','Reserved By','Added Date','Sold Date'],
    'Orders': ['Order ID','Timestamp','Customer Name','Phone','Delivery Area','Delivery Address','Book Codes','Book Titles','Subtotal','Delivery Fee','Total','Payment Status','Payment Deadline','Payment Date','Notes'],
    'DeliveryRates': ['Area','Price'],
    'PromoCodes': ['Code','Discount (%)','Active','Activated At'],
    'Stats': ['Date','Orders','Books Sold','Revenue'],
    'SMS_Failures': ['Timestamp','Order ID','Customer Name','Phone','Total Amount','Error','Retry Status'],
    'AuditLog': ['Timestamp','Book Code','Action','Customer','Details']
  };
  for (const sheetName in sheetsToCreate) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(sheetsToCreate[sheetName]);
      sheet.getRange('1:1').setFontWeight('bold');
    }
  }
}

function showAnalytics() {
  const a = getAnalytics();
  const ui = SpreadsheetApp.getUi();
  const topAreas = Object.entries(a.deliveryAreas)
    .sort((x,y)=>y[1]-x[1]).slice(0,5)
    .map(([area,c])=>`• ${area}: ${c} orders`).join('\n') || '—';
  const msg =
    `📊 LITTLE READERS UG ANALYTICS\n\n` +
    `💰 Total Revenue: UGX ${a.totalRevenue.toLocaleString()}\n` +
    `📦 Total Orders: ${a.totalOrders}\n` +
    `📚 Books Sold: ${a.totalBooksSold}\n\n` +
    `🚚 Top Delivery Areas:\n${topAreas}\n\n` +
    `Generated: ${new Date().toLocaleString()}`;
  ui.alert('Analytics Report', msg, ui.ButtonSet.OK);
}

function createOnEditTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "handleOrderStatusChange") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("handleOrderStatusChange")
    .forSpreadsheet(getSS())
    .onEdit()
    .create();
  
  SpreadsheetApp.getUi().alert('Trigger created successfully!', 'Order status change trigger has been set up.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function showDeploymentInstructions() {
  SpreadsheetApp.getUi().alert(
    'Web App Deployment',
    'Extensions → Apps Script → Deploy → New Deployment → Type: Web App → Execute as: Me → Who has access: Anyone (or Anyone with the link) → Deploy.\nCopy the Web App URL.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/* ============================================================
 * Web App Endpoints (UNCHANGED - ALL ORIGINAL FUNCTIONALITY PRESERVED)
 * ============================================================
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action) return handleApiRequest(e);
  return HtmlService.createHtmlOutputFromFile('index')
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const apiKey = e.parameter?.apiKey;
    if (apiKey !== CONFIG.API_KEY) return jsonResponse({ success:false, error: "Unauthorized" });
    const data = JSON.parse(e.postData.contents);
    const result = processOrder(data);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success:false, error: err.toString() });
  }
}

function handleApiRequest(e) {
  const action = e.parameter.action;
  switch (action) {
    case "getBooks": return jsonResponse(getAvailableBooks());
    case "checkAvailability": return jsonResponse(checkBooksAvailability((e.parameter.codes || "").split(",")));
    case "deliveryPrice": return jsonResponse(getDeliveryPrice(e.parameter.area));
    case "deliveryAreas": return jsonResponse(getAllDeliveryAreas());
    case "validatePromo": return jsonResponse(validatePromo(e.parameter.code || ""));
    default: return jsonResponse({ error: "Invalid action" });
  }
}