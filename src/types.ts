export interface Camt053Transaction {
  date: string; // ISO 8601 Date format (YYYY-MM-DD)
  amount: number;
  currency: string;
  type: 'credit' | 'debit';
  counterpartyName: string | null;
  counterpartyAccountIBAN: string | null;
  description: string | null;
  endToEndReference: string | null; // from <EndToEndId>
  remittanceReference: string | null; // from <RmtInf>/<Strd>/<CdtrRefInf>/<Ref>
  purpose: string | null; // from <Purp>/<Cd>
}

export interface Camt053Statement {
  statementTitle: string;
  accountHolder: string | null;
  accountIBAN: string | null;
  currency: string;
  statementDate: string; // ISO 8601 Date format (YYYY-MM-DD)
  sequenceNumber: number | null; // Legal sequence number of the statement
  openingBalance: number | null;
  closingBalance: number | null;
  numberOfCredits: number | null;
  totalCredits: number | null;
  numberOfDebits: number | null;
  totalDebits: number | null;
  transactions: Camt053Transaction[];
}
