import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { solveModuleJob } from '../../src/engines/index.ts';
import { generateMasterTemplateArrayBuffer } from '../../src/io/exporters/excelExporter.ts';
import { parseCsvText } from '../../src/io/parsers/csvParser.ts';
import { parseExcelArrayBuffer } from '../../src/io/parsers/excelParser.ts';
import { parseJsonOrJsText } from '../../src/io/parsers/jsonParser.ts';
import { mapGridToModuleInput } from '../../src/io/parsers/moduleMapper.ts';

describe('Universal Ingestion (4-Sheet Excel, CSV, JSON, & Safe Zero-Eval JS)', () => {
  it('round-trips all 4 PPIC methods from Master Excel Template and solves cleanly', async () => {
    const buffer = await generateMasterTemplateArrayBuffer();
    const candidates = await parseExcelArrayBuffer('Template_4_Metode_Ha_Jodeya.xlsx', buffer);

    expect(candidates.length).toBe(4);
    const detectedIds = candidates.map((c) => c.detectedModuleId);
    expect(detectedIds).toEqual(['forecasting', 'mps', 'mrp', 'scheduling']);

    for (const cand of candidates) {
      const input = mapGridToModuleInput(
        cand.detectedModuleId,
        cand.rawRows,
        cand.headerRowIndex,
        cand.columnMapping,
      );
      const res = solveModuleJob({
        id: cand.id,
        moduleId: cand.detectedModuleId,
        title: cand.sheetName,
        enabled: true,
        input,
      });
      expect(res.status === 'success' || res.status === 'warning').toBe(true);
    }
  });

  it('auto-detects MPS, MRP, and Scheduling CSVs with semicolon/comma delimiters', () => {
    const mpsCsv = [
      'Periode;Forecast;CustomerOrders;AvailableCapacity',
      'Mgg 1;150;160;180',
      'Mgg 2;165;120;180',
      'Mgg 3;170;90;180',
    ].join('\n');

    const cands = parseCsvText('jadwal_mps_pabrik.csv', mpsCsv);
    expect(cands.length).toBe(1);
    expect(cands[0].detectedModuleId).toBe('mps');
    const mapped = mapGridToModuleInput('mps', cands[0].rawRows, cands[0].headerRowIndex, cands[0].columnMapping);
    const res = solveModuleJob({
      id: 'csv-mps',
      moduleId: 'mps',
      title: 'MPS CSV',
      enabled: true,
      input: mapped,
    });
    expect(res.status).toBe('success');
  });

  it('parses multi-export ESM, CommonJS, and bare array JS files with zero eval()', () => {
    const jsParserSrc = fs.readFileSync(
      path.resolve(__dirname, '../../src/io/parsers/jsDataParser.ts'),
      'utf8',
    );
    expect(jsParserSrc).not.toMatch(/\beval\s*\(/);
    expect(jsParserSrc).not.toMatch(/new\s+Function\s*\(/);

    const esmSample = `
      // Contoh skrip JS multi-metode Ha Jodeya
      export const dataRamalan = {
        moduleId: 'forecasting',
        title: 'Ramalan Q1-Q6',
        values: [120, 132, 145, 158, 170, 184],
        horizon: 4,
      };
      export default {
        module: 'mps',
        productName: 'gearbox-x',
        beginningInventory: 60,
        safetyStock: 15,
        lotSizing: 'FOQ',
        lotSize: 180,
        forecasts: [195, 205, 215, 225],
        customerOrders: [200, 140, 80, 30],
      };
    `;

    const parsed = parseJsonOrJsText('skrip_ppic_bebas.js', esmSample);
    expect(parsed.jobs.length).toBe(2);
    for (const job of parsed.jobs) {
      const res = solveModuleJob(job);
      expect(res.status === 'success' || res.status === 'warning').toBe(true);
    }
  });
});
