import * as fs from 'fs';
import * as path from 'path';
import { parseCamt053, Camt053ParserError } from './parser';

async function main() {
  const samplesDir = path.join(__dirname, '..', 'samples');
  const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.xml'));

  for (const file of files) {
    const filePath = path.join(samplesDir, file);
    console.log(`\n=== Parsing: ${file} ===`);
    try {
      const xml = fs.readFileSync(filePath, 'utf8');
      const result = await parseCamt053(xml);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      if (err instanceof Camt053ParserError) {
        console.error(`Error: ${err.message}`);
      } else {
        console.error('Unexpected error:', err);
      }
    }
  }
}

main();
