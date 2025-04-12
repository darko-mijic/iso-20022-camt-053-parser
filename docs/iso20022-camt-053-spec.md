# Understanding and Parsing ISO 20022 CAMT.053 Messages

## 1. Introduction

The **CAMT.053 (BankToCustomerStatement)** message is an XML-based standard defined under ISO 20022 for financial messaging. It serves as an end-of-day bank statement, providing detailed, structured information about entries booked to a customer's account, along with balance information. It is designed to replace older formats like SWIFT MT940 or BAI2, facilitating automated processing and reconciliation.

This document summarizes key information gathered from official and secondary sources to aid in understanding the structure and content of CAMT.053 messages, focusing on aspects relevant for building a parser.

**Note:** While this guide provides extensive information, building a fully compliant parser requires consulting the **official ISO 20022 Message Definition Reports (MDRs) and XML Schema Definitions (XSDs)** for the specific versions you need to support. These are the definitive sources for all elements, data types, constraints, and code lists.

## 2. Official Resources

* **ISO 20022 Official Website:** [https://www.iso20022.org](https://www.iso20022.org)
* **Message Definitions Catalogue:** [https://www.iso20022.org/iso-20022-message-definitions](https://www.iso20022.org/iso-20022-message-definitions) (Search for "camt.053")
* **Message Archive (Previous Versions):** [https://www.iso20022.org/catalogue-messages/iso-20022-messages-archive](https://www.iso20022.org/catalogue-messages/iso-20022-messages-archive)
* **External Code Sets (including BTC):** [https://www.iso20022.org/catalogue-messages/additional-content-messages/external-code-sets](https://www.iso20022.org/catalogue-messages/additional-content-messages/external-code-sets)

**Accessing MDRs and XSDs:** The detailed MDRs and XSD files are **not** available per individual message directly on the site overview. They must be downloaded as part of the relevant **Message Set** (e.g., "Bank-to-Customer Cash Management") from the catalogue or archive.

## 3. Key Versions

CAMT.053 has evolved over time. Common versions encountered include:

* `camt.053.001.02` (Based on 2009 ISO approval)
* `camt.053.001.08` (Based on 2019 ISO release, widely used for SEPA/CBPR+)
* `camt.053.001.13` (Latest version as of Feb 2025)

**Version Differences:** No official comparison documents were readily found. Differences primarily lie in added/removed/modified elements, updated code lists, or changes in constraints. **Manual comparison of the official MDRs/XSDs for each version is necessary** to identify specific changes relevant to parsing logic.

## 4. Message Structure Overview

A CAMT.053 message is an XML document. The high-level structure typically follows this hierarchy:

* **`Document`** (Root element, contains namespace declaration)
    * **`BkToCstmrStmt`** (BankToCustomerStatement - Main message container)
        * **`GrpHdr`** (Group Header): Contains metadata about the entire message file (e.g., `MsgId`, `CreDtTm`, `MsgRcpt`).
        * **`Stmt`** (Statement): Represents the report for a single account. This block can repeat if the file contains statements for multiple accounts.
            * **`Id`**: Unique identifier for this specific statement.
            * **`ElctrncSeqNb`**: Electronic sequence number for statements sent to the recipient.
            * **`CreDtTm`**: Timestamp when the statement was generated.
            * **`Acct`**: Contains details of the account being reported (e.g., `Id` with `IBAN` or `Othr`, `Ccy`, `Ownr`, `Svcr`).
            * **`Bal`**: Represents a balance for the account. This block repeats for different balance types (e.g., Opening, Closing). Contains `Tp` (Type code), `Amt` (Amount and Currency), `CdtDbtInd`, and `Dt` (Balance Date).
            * **`TxsSummry`**: Optional summary of transactions within the statement (e.g., total credits/debits count and sum).
            * **`Ntry`** (Entry): Represents a single posting (debit or credit) to the account. This block repeats for each entry in the statement period.
                * **`NtryRef`**: Unique reference for this entry within the statement.
                * **`Amt`**: Amount of the entry (in account currency). Requires `Ccy` attribute.
                * **`CdtDbtInd`**: Indicates if the entry is a Credit (`CRDT`) or Debit (`DBIT`).
                * **`RvslInd`**: Optional indicator (`true`/`false`) if the entry is a reversal of a previous entry.
                * **`Sts`**: Status of the entry (usually `BOOK` for booked).
                * **`BookgDt`**: Date the entry was posted to the account ledger.
                * **`ValDt`**: Value date of the entry.
                * **`AcctSvcrRef`**: Account Servicer's (Bank's) reference for the entry.
                * **`BkTxCd`**: Bank Transaction Code(s) classifying the entry type (contains `<Domn>` and/or `<Prtry>`).
                * **`NtryDtls`** (Entry Details): Contains details if the entry represents a batch or requires further breakdown.
                    * **`Btch`**: Optional information about the batch (e.g., number of transactions, total amount).
                    * **`TxDtls`** (Transaction Details): Details of the underlying transaction(s) that make up the entry. This block repeats if the entry is a batch.
                        * **`Refs`**: Various references related to the transaction (e.g., `EndToEndId`, `TxId`, `InstrId`, `MndtId`).
                        * **`AmtDtls`**: Detailed amounts (e.g., `InstdAmt`, `TxAmt`).
                        * **`RltdPties`**: Information about related parties (Debtor, Creditor, Ultimate Parties).
                        * **`RltdAgts`**: Information about related agents (Debtor Agent, Creditor Agent).
                        * **`RmtInf`**: Remittance information (Structured or Unstructured).
                        * *(Other elements like `Purp`, `RltdDts`, `RtrInf`)*
                * **`AddtlNtryInf`**: Additional free-text information about the entry.
            * **`AddtlStmtInf`**: Additional free-text information about the statement.

* **Single vs. Batch Entries:**
    * If an `<Ntry>` represents a single transaction, details might be directly within `<Ntry>` or within a single `<TxDtls>` block under `<NtryDtls>`.
    * If an `<Ntry>` represents a batch posting, the details of the individual underlying transactions will be in repeating `<TxDtls>` blocks under `<NtryDtls>`. The `<Ntry>/<Amt>` will be the total batch amount.

## 5. Key Elements & Data Types for Parsing

* **Identifiers:** Crucial for matching and reconciliation.
    * `<GrpHdr>/<MsgId>`: Unique ID for the message file.
    * `<Stmt>/<Id>`: Unique ID for the statement (per account).
    * `<Ntry>/<NtryRef>`: Unique ID for the entry within the statement.
    * `<Ntry>/<AcctSvcrRef>`: Bank's reference for the entry/transaction.
    * `<TxDtls>/<Refs>/<EndToEndId>`: Originator's end-to-end reference (should pass through unchanged).
    * `<TxDtls>/<Refs>/<InstrId>`: Originator's instruction ID.
    * `<TxDtls>/<Refs>/<TxId>`: Bank's transaction ID.
    * `<TxDtls>/<Refs>/<MndtId>`: Mandate ID (for Direct Debits).
* **Dates/Times:**
    * `<GrpHdr>/<CreDtTm>`: File creation time.
    * `<Stmt>/<FrToDt>`: Statement period start/end dates.
    * `<Ntry>/<BookgDt>`: Posting date.
    * `<Ntry>/<ValDt>`: Value date.
    * *(Note: Timestamps often include timezone offsets or 'Z' for UTC).*
* **Account Info:**
    * `<Stmt>/<Acct>/<Id>/<IBAN>` or `<Othr>/<Id>`: The account number being reported.
    * `<Stmt>/<Acct>/<Ccy>`: Account currency.
* **Amounts & Currency:**
    * `<Bal>/<Amt>`: Balance amount. `Ccy` attribute mandatory.
    * `<Ntry>/<Amt>`: Entry amount. `Ccy` attribute mandatory. Usually in account currency.
    * `<TxDtls>/<AmtDtls>/<TxAmt>/<Amt>`: Transaction amount (often net amount in account currency). `Ccy` attribute mandatory.
    * `<TxDtls>/<AmtDtls>/<InstdAmt>/<Amt>`: Instructed amount (original amount in original currency). `Ccy` attribute mandatory.
* **Debit/Credit Indicator:**
    * `<CdtDbtInd>`: Present for Balances and Entries. Values: `CRDT` (Credit), `DBIT` (Debit).
* **Balances:**
    * `<Bal>` element repeats for different balance types. Key types identified by `<Tp>/<CdOrPrtry>/<Cd>`. See Code Lists section.
* **Bank Transaction Codes (BTC):**
    * `<BkTxCd>`: Crucial for classifying transaction types. Contains structured `<Domn>` (Domain/Family/SubFamily codes from ISO list) and/or `<Prtry>` (Proprietary code + Issuer). See Code Lists section. Can appear at `<Ntry>` and/or `<TxDtls>` level.
* **Remittance Information:**
    * `<RmtInf>`: Contains payment details. Can be `<Ustrd>` (Unstructured text) or `<Strd>` (Structured, e.g., for invoices).
* **Related Parties/Agents:**
    * `<RltdPties>`: Contains Debtor (`<Dbtr>`), Creditor (`<Cdtr>`), Ultimate Debtor (`<UltmtDbtr>`), Ultimate Creditor (`<UltmtCdtr>`), including Name, Address, Identifiers.
    * `<RltdAgts>`: Contains Debtor Agent (`<DbtrAgt>`), Creditor Agent (`<CdtrAgt>`), Intermediary Agents (`<IntrmyAgt>`), including BIC, Name, etc.
* **Data Types:** Common types include:
    * `Text` (often with length restrictions, e.g., `Max35Text`)
    * `Amount` (decimal, requires `Ccy` attribute)
    * `Date` (YYYY-MM-DD)
    * `DateTime` (YYYY-MM-DDThh:mm:ss[.sss][+/-hh:mm or Z])
    * `Code` (Specific values from internal or external lists)
    * `Indicator` (Boolean: `true`/`false`)
    * `Identifier` (Specific formats like IBAN, BIC, or general text)

## 6. Code Lists

Using the correct codes is essential for interpretation.

* **Bank Transaction Codes (BTC):**
    * **Structure:** Hierarchical: Domain -> Family -> SubFamily. Allows classification (e.g., PMNT -> RCDT -> CORT = Payment -> Received Credit Transfer -> Core Transfer).
    * **Source:** Defined in an **External Code Set** maintained by ISO 20022.
    * **Location:** Downloadable from [ISO 20022 External Code Sets page](https://www.iso20022.org/catalogue-messages/additional-content-messages/external-code-sets) (XLSX, XSD, JSON formats available). Also includes a list of valid combinations.
    * **Proprietary Codes:** Banks may also use proprietary codes within `<Prtry>`, identified by an `<Issr>` tag (e.g., Issuer="BAI").
* **Balance Type Codes (`<Bal>/<Tp>/<CdOrPrtry>/<Cd>`):**
    * `OPBD`: Opening Booked Balance
    * `CLBD`: Closing Booked Balance
    * `CLAV`: Closing Available Balance
    * `PRCD`: Previously Closed Booked Balance
    * `FWAV`: Forward Available Balance
    * `ITBD`: Interim Booked Balance (Intraday)
    * `OIBD`: Opening Interim Booked Balance (Used for multi-page statements, except last page)
    * `CIBD`: Closing Interim Booked Balance (Used for multi-page statements, except last page)
    * *(Others may exist, consult MDR/MUG)*
* **Status Codes (`<Ntry>/<Sts>`):**
    * `BOOK`: Booked (Most common in CAMT.053)
    * `PDNG`: Pending
    * `INFO`: Informational
* **Credit/Debit Indicator (`<CdtDbtInd>`):**
    * `CRDT`: Credit
    * `DBIT`: Debit

*(Consult the official MDRs/MUGs for comprehensive lists of all codes used within CAMT.053)*

## 7. Implementation Context

* **CGI-MP (Common Global Implementation - Market Practice):** An initiative to harmonize bank-to-corporate message implementations. Their guidelines (especially for V02) provide valuable usage context but may differ slightly from base standard or other implementations. ([Example V02 Guide](https://www.swift.com/swift-resource/35371/download))
* **SEPA (Single Euro Payments Area):** CAMT.053 is used for reporting SEPA Credit Transfers (SCT/SCT Inst) and Direct Debits (SDD). EPC provides mapping recommendations showing how SEPA data elements appear in CAMT messages (e.g., using V08). ([Example EPC Mapping Guide](https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2023-02/EPC188-09%20v4.0%20Recommendation%20on%20Customer%20Reporting%20SCTs%20and%20SDDs.pdf))
* **SWIFT CBPR+ (Cross-Border Payments and Reporting Plus):** Defines usage guidelines for ISO 20022 messages in cross-border scenarios, including CAMT.053. May impose specific rules (e.g., preference for structured addresses). Access often requires SWIFT MyStandards.

## 8. Parsing Considerations

* **Version Handling:** Your parser must be able to handle the specific versions you expect to receive. Identify the version from the namespace in the `<Document>` tag. Be prepared for differences in element presence, names, or structure between versions.
* **Schema Validation:** Use the official XSD for the relevant version to validate the structure and basic data types of incoming files.
* **Batch vs. Single Entries:** Check for the presence of `<NtryDtls>` and multiple `<TxDtls>` within an `<Ntry>` to determine if it's a batch posting.
* **Transaction Classification:** Use the `<BkTxCd>` (both Domain and Proprietary codes) as the primary means to classify the type of transaction. Map these codes to your internal system's transaction types.
* **Reconciliation:** Extract key identifiers (`EndToEndId`, `InstrId`, `AcctSvcrRef`, `NtryRef`, potentially remittance info) to match statement entries against internal records or payment initiation files (e.g., PAIN.001).
* **Balance Handling:** Correctly identify and process different balance types (`OPBD`, `CLBD`, `CLAV`, etc.). Handle multi-page logic using `OIBD`/`CIBD` if necessary.
* **Proprietary Data:** Be aware that banks may use proprietary codes (e.g., in `<BkTxCd>/<Prtry>`) or populate optional fields based on their specific services. Consult bank-specific Message Implementation Guides (MIGs) for details.
* **Character Sets:** Standard uses UTF-8, but implementations often restrict to Latin character sets. Check bank MIGs.
* **Data Extraction:** Extract necessary data points like dates, amounts, currencies, references, party information, and remittance details based on the defined structure.

## 9. Example Files

Reviewing actual examples is highly recommended.

* **V08 Example:** [Goldman Sachs Sample CAMT.053 V8](https://developer.gs.com/docs/services/transaction-banking/camt-053-v8-sample)
* **V02 Example:** [Goldman Sachs Sample CAMT.053 V2](https://developer.gs.com/docs/services/transaction-banking/camt-053-us-sample)
* **V02 Example:** [GitHub Dutch SEPA CAMT.053 V2](https://github.com/jasperkrijgsman/dutch-sepa-iso20022/blob/master/src/main/resources/camt.053.001.02.xml)
* **V02 Examples (incl. SEPA):** [Handelsbanken ISO 20022 Page](https://www.handelsbanken.com/en/our-services/digital-services/global-gateway/iso-20022-xml) (Scroll down to "Example files")

*(Note: A V13 example was not readily found during the research phase).*
