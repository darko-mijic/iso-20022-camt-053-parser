import * as fs from 'fs';
import * as path from 'path';
import { parseStringPromise } from 'xml2js';
import { Camt053Statement, Camt053Transaction } from './types';
import * as libxmljs from 'libxmljs2';

/**
 * Supported CAMT.053 Namespaces mapped to XSD filenames.
 */
const NAMESPACE_TO_XSD: Record<string, string> = {
  'urn:iso:std:iso:20022:tech:xsd:camt.053.001.02': 'camt.053.001.02.xsd',
  'urn:iso:std:iso:20022:tech:xsd:camt.053.001.08': 'camt.053.001.08.xsd',
  'urn:iso:std:iso:20022:tech:xsd:camt.053.001.13': 'camt.053.001.13.xsd'
};

export class Camt053ParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Camt053ParserError';
  }
}

/**
 * Detects the CAMT.053 namespace from the root <Document> element.
 */
function detectNamespace(xml: string): string | null {
  const match = xml.match(/<Document[^>]+xmlns="([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Validates the XML string against the appropriate XSD schema using libxmljs2.
 * Throws Camt053ParserError if validation fails.
 */
function validateXmlWithXsd(xml: string, xsdPath: string): void {
  const xsdContent = fs.readFileSync(xsdPath, 'utf8');
  let xmlDoc, xsdDoc;
  try {
    xmlDoc = libxmljs.parseXml(xml);
  } catch (e: any) {
    throw new Camt053ParserError('Invalid XML: ' + e.message);
  }
  try {
    xsdDoc = libxmljs.parseXml(xsdContent);
  } catch (e: any) {
    throw new Camt053ParserError('Invalid XSD: ' + e.message);
  }
  const isValid = xmlDoc.validate(xsdDoc);
  if (!isValid) {
    const errors = xmlDoc.validationErrors.map((err: any) => err.message).join('; ');
    throw new Camt053ParserError('XSD validation failed: ' + errors);
  }
}

/**
 * Helper to safely get nested properties.
 */
function get(obj: any, path: string[], fallback: any = null): any {
  return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj) ?? fallback;
}

/**
 * Helper to extract date in YYYY-MM-DD from a string or object.
 */
function extractDate(obj: any): string | null {
  if (!obj) return null;
  if (typeof obj === 'string') {
    // Try to extract YYYY-MM-DD
    const m = obj.match(/\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : null;
  }
  if (obj.Dt) return extractDate(obj.Dt);
  if (obj.DtTm) return extractDate(obj.DtTm);
  return null;
}

/**
 * Helper to extract amount as number.
 */
function extractAmount(obj: any): number | null {
  if (!obj) return null;
  if (typeof obj === 'string') return parseFloat(obj);
  if (obj._) return parseFloat(obj._);
  return null;
}

/**
 * Main parser function.
 */
export async function parseCamt053(xml: string): Promise<Camt053Statement[]> {
  // 1. Detect namespace/version
  const namespace = detectNamespace(xml);
  if (!namespace || !(namespace in NAMESPACE_TO_XSD)) {
    throw new Camt053ParserError('Unsupported or missing CAMT.053 namespace');
  }

  // 2. Validate XML against XSD
  const xsdFile = NAMESPACE_TO_XSD[namespace];
  const xsdPath = path.join(__dirname, '..', 'schemas', xsdFile);
  validateXmlWithXsd(xml, xsdPath);

  // 3. Parse XML to JS object
  const xmlObj = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });

  // 4. Find the statement array
  let stmts: any[] = [];
  let docRoot = xmlObj.Document;
  if (!docRoot) throw new Camt053ParserError('Missing <Document> root');
  // Find the statement container (BkToCstmrStmt or BankToCustomerStatementV13)
  let stmtContainer = docRoot.BkToCstmrStmt || docRoot.BankToCustomerStatementV13;
  if (!stmtContainer) throw new Camt053ParserError('Missing statement container');
  // Stmt can be array or single object
  if (Array.isArray(stmtContainer.Stmt)) {
    stmts = stmtContainer.Stmt;
  } else if (stmtContainer.Stmt) {
    stmts = [stmtContainer.Stmt];
  } else {
    throw new Camt053ParserError('No <Stmt> found');
  }

  // 5. Map each statement
  const result: Camt053Statement[] = stmts.map((stmt, idx) => {
    // Account holder
    let accountHolder = get(stmt, ['Acct', 'Ownr', 'Nm']) 
      ?? get(stmt, ['Acct', 'Ownr', 'Id', 'OrgId', 'Othr', 'Id']) // fallback: org id
      ?? null;
    // IBAN or Othr/Id
    const accountIBAN = get(stmt, ['Acct', 'Id', 'IBAN'])
      ?? get(stmt, ['Acct', 'Id', 'Othr', 'Id'])
      ?? null;
    // Currency
    let currencyVal = get(stmt, ['Acct', 'Ccy']);
    let currency: string = '';
    if (typeof currencyVal === 'string') {
      currency = currencyVal;
    } else if (currencyVal && typeof currencyVal._ === 'string') {
      currency = currencyVal._;
    } else {
      currency = '';
    }
    // Sequence Number (LglSeqNb or ElctrncSeqNb)
    const sequenceNumberRaw = get(stmt, ['LglSeqNb']) ?? get(stmt, ['ElctrncSeqNb']);
    const sequenceNumber = sequenceNumberRaw ? parseInt(sequenceNumberRaw, 10) : null;
    // Statement date
    let statementDate: string =
      extractDate(get(stmt, ['FrToDt', 'ToDtTm'])) // ISO standard: ToDtTm
      ?? extractDate(get(stmt, ['FrToDt', 'ToDt'])) // fallback: ToDt
      ?? extractDate(get(stmt, ['CreDtTm'])) // fallback: statement creation date
      ?? (() => {
        // fallback: latest Bal/Dt/Dt
        if (stmt.Bal) {
          const bals = Array.isArray(stmt.Bal) ? stmt.Bal : [stmt.Bal];
          const dates = bals.map((bal: any) => extractDate(get(bal, ['Dt', 'Dt']))).filter(Boolean);
          if (dates.length) return dates[dates.length - 1];
        }
        return null;
      })()
      ?? (() => {
        // fallback: first transaction date
        if (stmt.Ntry) {
          const ntries = Array.isArray(stmt.Ntry) ? stmt.Ntry : [stmt.Ntry];
          for (const ntry of ntries) {
            const ntryDtls = get(ntry, ['NtryDtls']);
            if (ntryDtls && ntryDtls.TxDtls) {
              const txDtlsArr = Array.isArray(ntryDtls.TxDtls) ? ntryDtls.TxDtls : [ntryDtls.TxDtls];
              for (const txDtls of txDtlsArr) {
                const txDate = extractDate(get(txDtls, ['BookgDt'])) ?? extractDate(get(ntry, ['BookgDt']));
                if (txDate) return txDate;
              }
            }
            // fallback: Ntry-level BookgDt
            const ntryDate = extractDate(get(ntry, ['BookgDt']));
            if (ntryDate) return ntryDate;
          }
        }
        return null;
      })()
      ?? '';
    // Opening/Closing balances
    let openingBalance: number | null = null;
    let closingBalance: number | null = null;
    if (stmt.Bal) {
      const bals = Array.isArray(stmt.Bal) ? stmt.Bal : [stmt.Bal];
      for (const bal of bals) {
        const code = get(bal, ['Tp', 'CdOrPrtry', 'Cd']);
        if (code === 'OPBD') openingBalance = extractAmount(bal.Amt);
        if (code === 'CLBD') closingBalance = extractAmount(bal.Amt);
      }
    }
    // Credit/Debit summary
    let numberOfCredits: number | null = null;
    let totalCredits: number | null = null;
    let numberOfDebits: number | null = null;
    let totalDebits: number | null = null;
    if (stmt.TxsSummry) {
      if (stmt.TxsSummry.TtlCdtNtries) {
        numberOfCredits = parseInt(get(stmt, ['TxsSummry', 'TtlCdtNtries', 'NbOfNtries']) ?? '0', 10);
        totalCredits = extractAmount(get(stmt, ['TxsSummry', 'TtlCdtNtries', 'Sum']));
      }
      if (stmt.TxsSummry.TtlDbtNtries) {
        numberOfDebits = parseInt(get(stmt, ['TxsSummry', 'TtlDbtNtries', 'NbOfNtries']) ?? '0', 10);
        totalDebits = extractAmount(get(stmt, ['TxsSummry', 'TtlDbtNtries', 'Sum']));
      }
    }
    // Transactions
    let ntries = [];
    if (stmt.Ntry) {
      ntries = Array.isArray(stmt.Ntry) ? stmt.Ntry : [stmt.Ntry];
    }
    // Improved: flatten all TxDtls, or fallback to Ntry-level if missing
    const transactions: Camt053Transaction[] = ntries.flatMap((ntry: any) => {
      // Date, Amount, Type from Ntry
      const ntryDate = extractDate(get(ntry, ['BookgDt'])) ?? null;
      const ntryAmount = extractAmount(get(ntry, ['Amt']));
      const ntryTypeRaw = get(ntry, ['CdtDbtInd']);
      const ntryType = ntryTypeRaw === 'CRDT' ? 'credit' : ntryTypeRaw === 'DBIT' ? 'debit' : null;
      // Currency fallback: Amt/@Ccy if Acct.Ccy missing
      let ntryCurrency = currency;
      const amtObj = get(ntry, ['Amt']);
      if (!currency && amtObj && typeof amtObj === 'object' && amtObj.Ccy) {
        ntryCurrency = amtObj.Ccy;
      }
      // NtryDtls/TxDtls may be array, object, or missing
      const ntryDtls = get(ntry, ['NtryDtls']);
      let txDtlsArr: any[] = [];
      if (ntryDtls && ntryDtls.TxDtls) {
        txDtlsArr = Array.isArray(ntryDtls.TxDtls) ? ntryDtls.TxDtls : [ntryDtls.TxDtls];
      }
      // If no TxDtls, treat Ntry as a single transaction
      if (txDtlsArr.length === 0) {
        txDtlsArr = [null];
      }
      return txDtlsArr.map((txDtls: any) => {
        // Counterparty
        let counterpartyName: string | null = null;
        let counterpartyAccountIBAN: string | null = null;
        if (txDtls && txDtls.RltdPties) {
          if (ntryType === 'credit') {
            counterpartyName = get(txDtls, ['RltdPties', 'Dbtr', 'Nm'])
              ?? get(txDtls, ['RltdPties', 'Dbtr', 'Pty', 'Nm'])
              ?? null;
            counterpartyAccountIBAN = get(txDtls, ['RltdPties', 'DbtrAcct', 'Id', 'IBAN'])
              ?? get(txDtls, ['RltdPties', 'DbtrAcct', 'Id', 'Othr', 'Id'])
              ?? null;
          } else if (ntryType === 'debit') {
            counterpartyName = get(txDtls, ['RltdPties', 'Cdtr', 'Nm'])
              ?? get(txDtls, ['RltdPties', 'Cdtr', 'Pty', 'Nm'])
              ?? null;
            counterpartyAccountIBAN = get(txDtls, ['RltdPties', 'CdtrAcct', 'Id', 'IBAN'])
              ?? get(txDtls, ['RltdPties', 'CdtrAcct', 'Id', 'Othr', 'Id'])
              ?? null;
          }
        }
        // Fallbacks for counterparty
        if (!counterpartyName) {
          // Try AcctSvcrRef, NtryRef, or Refs/Prtry/Ref as a generic reference
          counterpartyName = get(ntry, ['AcctSvcrRef'])
            ?? get(ntry, ['NtryRef'])
            ?? (txDtls ? get(txDtls, ['Refs', 'Prtry', 'Ref']) : null)
            ?? null;
        }
        if (!counterpartyAccountIBAN) {
          // Try Refs/Prtry/Ref or NtryRef as a generic account reference
          counterpartyAccountIBAN = (txDtls ? get(txDtls, ['Refs', 'Prtry', 'Ref']) : null)
            ?? get(ntry, ['NtryRef'])
            ?? null;
        }
        // EndToEnd Reference
        let endToEndReference = txDtls ? (get(txDtls, ['Refs', 'EndToEndId']) ?? null) : null;
        // Fallbacks for endToEndReference
        if (!endToEndReference) {
          endToEndReference = (txDtls ? get(txDtls, ['Refs', 'ClrSysRef']) : null)
            ?? (txDtls ? get(txDtls, ['Refs', 'Prtry', 'Ref']) : null)
            ?? get(ntry, ['NtryRef'])
            ?? null;
        }
        // Remittance Reference (Creditor Reference)
        let remittanceReference: string | null = null;
        const strd = txDtls ? get(txDtls, ['RmtInf', 'Strd']) : null;
        if (strd && strd.CdtrRefInf && strd.CdtrRefInf.Ref) {
          remittanceReference = strd.CdtrRefInf.Ref;
        }
        // Fallbacks for remittanceReference
        if (!remittanceReference && strd) {
          remittanceReference = get(strd, ['RfrdDocInf', 'Nb'])
            ?? get(strd, ['RfrdDocInf', 'Tp', 'CdOrPrtry', 'Cd'])
            ?? null;
        }
        // Purpose
        const purpose = txDtls ? (get(txDtls, ['Purp', 'Cd']) ?? null) : null;
        // Description aggregation (exclude remittanceReference and purpose)
        let descriptionParts: string[] = [];
        // RmtInf/Ustrd
        const ustrd = txDtls ? get(txDtls, ['RmtInf', 'Ustrd']) : null;
        if (ustrd) descriptionParts.push(ustrd);
        // RmtInf/Strd/...
        if (strd) {
          if (strd.AddtlRmtInf) descriptionParts.push(strd.AddtlRmtInf);
        }
        // AddtlNtryInf
        const addtlNtryInf = get(ntry, ['AddtlNtryInf']);
        if (addtlNtryInf) descriptionParts.push(addtlNtryInf);
        // AddtlTxInf
        const addtlTxInf = txDtls ? get(txDtls, ['AddtlTxInf']) : null;
        if (addtlTxInf) descriptionParts.push(addtlTxInf);
        // Fallbacks for missing fields
        if (!descriptionParts.length) {
          // Use AcctSvcrRef, InstrId, MsgId, etc. as description fallback
          const fallbackDesc = get(ntry, ['AcctSvcrRef']) ?? (txDtls ? get(txDtls, ['Refs', 'InstrId']) : null) ?? get(stmt, ['Id']) ?? null;
          if (fallbackDesc) descriptionParts.push(fallbackDesc);
        }
        let description: string | null = null;
        let descriptionAdditional: string | null = null;
        const filteredParts = descriptionParts.filter(Boolean);
        if (filteredParts.length > 0) {
          description = filteredParts[0];
          if (filteredParts.length > 1) {
            descriptionAdditional = filteredParts.slice(1).join(' | ');
          }
        }
        // Amount/date/type/currency: prefer TxDtls-level, fallback to Ntry-level
        const date = txDtls ? (extractDate(get(txDtls, ['BookgDt'])) ?? ntryDate) : ntryDate;
        const amount = txDtls ? (extractAmount(get(txDtls, ['Amt'])) ?? ntryAmount) : ntryAmount;
        const type = ntryType;
        const currencyVal = txDtls ? get(txDtls, ['Amt', 'Ccy']) : null;
        const txCurrency = currencyVal || ntryCurrency;

        return {
          date,
          amount,
          currency: txCurrency,
          type,
          counterpartyName,
          counterpartyAccountIBAN,
          description,
          descriptionAdditional,
          endToEndReference,
          remittanceReference,
          purpose
        };
      });
    });

    // Statement title
    const statementTitle = `Statement ${idx + 1}: ${currency} Account`;

    return {
      statementTitle,
      accountHolder,
      accountIBAN,
      currency,
      statementDate,
      sequenceNumber,
      openingBalance,
      closingBalance,
      numberOfCredits,
      totalCredits,
      numberOfDebits,
      totalDebits,
      transactions
    };
  });

  return result;
}
