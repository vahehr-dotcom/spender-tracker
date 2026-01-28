import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Universal transaction format
export function normalizeTransaction(raw) {
  return {
    date: parseDate(raw.date || raw.Date || raw.spent_at || raw['Transaction Date'] || raw.D),
    merchant: cleanMerchant(raw.merchant || raw.Merchant || raw.payee || raw.Payee || raw.Description || raw.description || raw.P || ''),
    amount: parseAmount(raw.amount || raw.Amount || raw.total || raw.Total || raw.Debit || raw.debit || raw.T || '0'),
    category: raw.category || raw.Category || raw.L || null,
    notes: raw.notes || raw.Notes || raw.memo || raw.Memo || raw.M || null
  };
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  
  // Try different date formats
  let date = new Date(dateStr);
  
  // If invalid, try MM/DD/YYYY
  if (isNaN(date)) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      date = new Date(parts[2], parts[0] - 1, parts[1]);
    }
  }
  
  return date.toISOString();
}

function parseAmount(amountStr) {
  if (typeof amountStr === 'number') return Math.abs(amountStr);
  
  // Remove $ and , and convert to number
  const cleaned = String(amountStr).replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  
  return Math.abs(num || 0);
}

function cleanMerchant(merchant) {
  // Remove common transaction prefixes
  let cleaned = merchant
    .replace(/^(AMZN\*|SQ\*|TST\*|POS\s+)/i, '')
    .replace(/\s+\d{10,}$/, '') // Remove trailing transaction IDs
    .trim();
  
  // Capitalize first letter of each word
  return cleaned.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// CSV Parser
export async function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions = results.data.map(normalizeTransaction);
        resolve(transactions);
      },
      error: (error) => reject(error)
    });
  });
}

// Excel Parser
export async function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        const transactions = jsonData.map(normalizeTransaction);
        resolve(transactions);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.readAsArrayBuffer(file);
  });
}

// Quicken QIF Parser (browser-safe, manual parsing)
export async function parseQIF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const qifContent = e.target.result;
        const transactions = [];
        
        // Split by transaction delimiter (^)
        const blocks = qifContent.split('^').filter(b => b.trim());
        
        for (const block of blocks) {
          const lines = block.split('\n').filter(l => l.trim());
          const txn = {};
          
          for (const line of lines) {
            const code = line.charAt(0);
            const value = line.substring(1).trim();
            
            switch (code) {
              case 'D': // Date
                txn.date = value;
                break;
              case 'T': // Amount
                txn.amount = value;
                break;
              case 'P': // Payee
                txn.merchant = value;
                break;
              case 'L': // Category
                txn.category = value;
                break;
              case 'M': // Memo
                txn.notes = value;
                break;
            }
          }
          
          if (txn.date || txn.merchant || txn.amount) {
            transactions.push(normalizeTransaction(txn));
          }
        }
        
        resolve(transactions);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read QIF file'));
    reader.readAsText(file);
  });
}

// PDF Parser (basic table extraction)
export async function parsePDF(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let allText = '';
      
      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        allText += pageText + '\n';
      }
      
      // Try to parse as table (basic detection)
      const lines = allText.split('\n').filter(l => l.trim());
      const transactions = [];
      
      // Look for lines with date, amount pattern
      const dateAmountRegex = /(\d{1,2}\/\d{1,2}\/\d{2,4}).*?\$?([\d,]+\.?\d{0,2})/;
      
      lines.forEach(line => {
        const match = line.match(dateAmountRegex);
        if (match) {
          // Extract merchant (text between date and amount)
          const parts = line.split(match[1])[1]?.split(match[2]);
          const merchant = parts?.[0]?.trim() || 'Unknown';
          
          transactions.push(normalizeTransaction({
            date: match[1],
            merchant: merchant,
            amount: match[2]
          }));
        }
      });
      
      resolve(transactions);
    } catch (error) {
      reject(error);
    }
  });
}

// Main parser dispatcher
export async function parseFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  
  console.log('📄 Parsing file:', file.name, 'Type:', extension);
  
  switch (extension) {
    case 'csv':
      return await parseCSV(file);
    
    case 'xlsx':
    case 'xls':
      return await parseExcel(file);
    
    case 'qif':
    case 'qfx':
      return await parseQIF(file);
    
    case 'pdf':
      return await parsePDF(file);
    
    default:
      throw new Error(`Unsupported file format: .${extension}`);
  }
}
