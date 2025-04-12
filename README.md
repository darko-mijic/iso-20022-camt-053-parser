# ISO 20022 CAMT.053 Parser

A robust Node.js/TypeScript parser for ISO 20022 CAMT.053 bank statement XML files. This project extracts structured statement and transaction data from CAMT.053 files from various banks and countries, handling multiple standard versions and diverse XML layouts.

## Features

- **Supports multiple CAMT.053 versions**: Out-of-the-box support for .001.02, .001.08, .001.13 (easily extendable).
- **XSD validation**: Validates input XML against the appropriate XSD schema before parsing.
- **Robust field extraction**: Handles a wide variety of bank-specific layouts, including missing or non-standard fields.
- **Batch and multi-transaction support**: Correctly extracts all transactions, even when multiple `<TxDtls>` are present or missing.
- **Graceful fallbacks**: Provides sensible fallbacks for missing fields (e.g., uses Ntry-level info if TxDtls is missing).
- **Comprehensive output**: Extracts account, balance, transaction, counterparty, remittance, and description fields.
- **Sample files and schemas included**: Test with real-world samples and official XSDs.

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- npm
- [libxmljs2](https://github.com/libxmljs/libxmljs2) (for XSD validation, used internally by the parser)

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/your-org/iso-20022-camt-053-parser.git
   cd iso-20022-camt-053-parser
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. (Optional) Build the project:
   ```sh
   npm run build
   ```

### Directory Structure

```
.
├── src/
│   ├── parser.ts           # Main parsing logic
│   ├── parse-samples.ts    # CLI for parsing sample files
│   └── types.ts            # TypeScript types
├── samples/                # Example CAMT.053 XML files from various banks
├── schemas/                # Official ISO 20022 XSD schemas
├── test/                   # Unit tests
├── docs/                   # Additional documentation
├── package.json
├── tsconfig.json
└── README.md
```

## Usage

### CLI: Parse All Sample Files

Parse all XML files in the `samples/` directory and print the parsed output:

```sh
npm run build
node dist/parse-samples.js
```

### Programmatic Usage

You can use the parser as a library in your own Node.js/TypeScript project:

```typescript
import { parseCamt053 } from './src/parser';
import * as fs from 'fs';

const xml = fs.readFileSync('samples/your-file.xml', 'utf8');
parseCamt053(xml).then(statements => {
  console.log(JSON.stringify(statements, null, 2));
});
```

### Output Structure

The parser returns an array of statements, each with:

- `statementTitle`
- `accountHolder`
- `accountIBAN`
- `currency`
- `statementDate`
- `openingBalance`
- `closingBalance`
- `numberOfCredits`
- `totalCredits`
- `numberOfDebits`
- `totalDebits`
- `transactions`: array of transactions, each with:
  - `date`
  - `amount`
  - `currency`
  - `type` (`credit` or `debit`)
  - `counterpartyName`
  - `counterpartyAccountIBAN`
  - `description` — the most relevant/primary description for the transaction (short and focused)
  - `descriptionAdditional` — any additional description details, concatenated as a string (or `null` if not present)
  - `endToEndReference`
  - `remittanceReference`
  - `purpose`

Fields may be `null` if not present in the source XML.

**Note:**  
The `description` field is now concise, containing only the most relevant part of the transaction description. Any supplementary or concatenated information is placed in `descriptionAdditional`. This makes the output cleaner and easier to use, while still preserving all available details.

## Supported Standards

- ISO 20022 CAMT.053.001.02
- ISO 20022 CAMT.053.001.08
- ISO 20022 CAMT.053.001.13

To add support for more versions, update the `NAMESPACE_TO_XSD` map in `src/parser.ts` and add the corresponding XSD to `schemas/`.

## Limitations & Notes

- **Field nullability**: If a field is missing in the source XML, it will be `null` in the output.
- **XSD validation**: Files that do not conform to the XSD will fail to parse.
- **Bank-specific quirks**: The parser is robust, but some banks may use highly non-standard layouts. Further customization may be required for edge cases.

## Testing

Run the test suite:

```sh
npm test
```

## Contributing

Contributions are welcome! Please open issues or pull requests for bug fixes, new features, or support for additional CAMT.053 versions/banks.

1. Fork the repo and create your branch.
2. Add tests for your feature or fix.
3. Ensure all tests pass.
4. Submit a pull request.

## License

MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

- [ISO 20022](https://www.iso20022.org/) for the CAMT.053 standard
- [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js) for XML parsing

## Additional Documentation

- [CAMT.053 Format and Parsing Guide](docs/iso20022-camt-053-spec.md)
