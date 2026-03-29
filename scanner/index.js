const fs = require('fs');
const path = require('path');
const { runScan } = require('./engine');

const args = process.argv.slice(2);
const targets = args.length ? args : [path.join(__dirname, '../Contracts/contracts')];

function writeReport(report) {
  const outputPath = path.join(__dirname, 'audit-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  return outputPath;
}

function printReport(report) {
  console.log('Smart Contract Security Scanner Report');
  console.log('======================================');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Pass: ${report.pass}`);
  console.log(`Findings: ${report.summary.totalFindings} (high=${report.summary.high}, medium=${report.summary.medium}, low=${report.summary.low})`);
  console.log('');
  for (const finding of report.findings.slice(0, 20)) {
    console.log(`- [${finding.severity.toUpperCase()}] ${finding.type} @ ${finding.location}`);
    console.log(`  ${finding.message}`);
  }
  if (report.findings.length > 20) {
    console.log(`...and ${report.findings.length - 20} more findings`);
  }
  console.log('');
  if (report.wasmReports.length) {
    console.log('WASM Gas Profiling');
    for (const wasmReport of report.wasmReports) {
      console.log(`  ${wasmReport.path}: ${wasmReport.totalFunctions} functions, ${wasmReport.totalInstructions} total instructions`);
      for (const fn of wasmReport.functions.slice(0, 8)) {
        console.log(`    - ${fn.name}: ${fn.instructions} instructions, cost ${fn.cost}`);
      }
    }
  }
}

const report = runScan(targets);
const outputPath = writeReport(report);
printReport(report);

if (!report.pass) {
  console.error('Contract security scan failed. Review findings and fix high-priority issues before deployment.');
  process.exit(1);
}

console.log(`Audit report written to ${outputPath}`);
process.exit(0);
