import * as fs from 'fs';
import * as path from 'path';
import { parseCamt053, Camt053ParserError } from '../src/parser';
import { Camt053Statement } from '../src/types';

const samplesDir = path.join(__dirname, '..', 'samples');

function loadSample(filename: string): string {
  return fs.readFileSync(path.join(samplesDir, filename), 'utf8');
}

describe('CAMT.053 Parser', () => {
  const sampleFiles = [
    'camt_053_swedish_account_statement.xml',
    'camt_053_ver_2_extended_se_account_swish_ecommerce.xml',
    'camt_053_ver_2_extended_uk_account.xml',
    'camt_053_ver2_mixed_extended_account_statement.xml',
    'ISO20022_camt053_extended_SE_incoming_payments_incl_CB_example.xml',
    'ISO20022_camt053_extended_SE_outgoing_payments_example.xml',
    
  ];

  for (const file of sampleFiles) {
    it(`parses valid sample: ${file}`, async () => {
      const xml = loadSample(file);
      const result = await parseCamt053(xml);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      for (const stmt of result) {
        expect(typeof stmt.statementTitle).toBe('string');
        expect(typeof stmt.currency).toBe('string');
        expect(typeof stmt.statementDate).toBe('string');
        expect(Array.isArray(stmt.transactions)).toBe(true);
      }
    });
  }

  it('throws on invalid XML (fails XSD validation)', async () => {
    const xml = `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><Invalid></Invalid></Document>`;
    await expect(parseCamt053(xml)).rejects.toThrow(Camt053ParserError);
  });
});
