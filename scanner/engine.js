const fs = require('fs');
const path = require('path');
const { decode } = require('@webassemblyjs/wasm-parser');

const DEFAULT_RUST_EXTENSIONS = ['.rs'];
const DEFAULT_WASM_EXTENSIONS = ['.wasm'];
const FAILURE_THRESHOLD = 1;

function walkDirectory(root, callback) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(entryPath, callback);
    } else {
      callback(entryPath);
    }
  }
}

function collectFiles(targetPaths, extensions) {
  const files = [];
  for (const target of targetPaths) {
    if (!fs.existsSync(target)) continue;

    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      walkDirectory(target, (entryPath) => {
        if (extensions.includes(path.extname(entryPath))) {
          files.push(entryPath);
        }
      });
    } else if (extensions.includes(path.extname(target))) {
      files.push(target);
    }
  }
  return files;
}

function splitRustFunctions(source) {
  const functions = [];
  const regex = /(pub\s+fn|fn)\s+([A-Za-z0-9_]+)\s*\([^\)]*\)\s*(?:->[^\{]*)?\{/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const start = match.index;
    let depth = 1;
    let current = match.index + match[0].length;

    while (depth > 0 && current < source.length) {
      const char = source[current];
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      current += 1;
    }

    functions.push({
      signature: match[0],
      name: match[2],
      body: source.slice(start, current)
    });

    regex.lastIndex = current;
  }

  return functions;
}

function analyzeRustSource(source, filePath) {
  const findings = [];
  const normalized = source.replace(/\/\/.*$/gm, '');

  if (/\.unwrap\(/.test(normalized) || /\.expect\(/.test(normalized)) {
    findings.push({
      type: 'unchecked-call',
      severity: 'medium',
      location: `${filePath}:general`,
      message: 'Possible unchecked external call or result handling via unwrap()/expect() detected.'
    });
  }

  const hasExplicitAuth =
    /require_auth\(|env\.invoker\(|check_(owner|admin)|require_admin|assert_(sender|source)/.test(
      normalized
    );

  const functions = splitRustFunctions(normalized);
  for (const func of functions) {
    const funcSource = func.body;
    const signature = func.signature;
    const hasAuth =
      /require_auth\(|env\.invoker\(|check_(owner|admin)|require_admin|assert_(sender|source)/.test(
        funcSource
      );
    const hasWriteAfterCall =
      /(?:token::Client::new|client\.|invoke|call\()/s.test(funcSource) &&
      /(?:\.set_|\.put\(|storage::put|storage::set|env\.storage\(|map\.set\(|map\.put\()/s.test(
        funcSource
      );
    const hasArithmetic = /[\w\)\]]+\s*[\+\-\*\/]\s*[\w\(\[]+/.test(funcSource);
    const usesChecked = /checked_(add|sub|mul|div)|saturating_(add|sub|mul|div)/.test(funcSource);
    const publicFunction = /^pub\s+fn\s/.test(signature);

    if (publicFunction && !hasAuth) {
      findings.push({
        type: 'access-control',
        severity: 'high',
        location: `${filePath}:${func.name}`,
        message: `Public contract method '${func.name}' has no explicit access control or invoker check.`
      });
    }

    if (hasWriteAfterCall) {
      findings.push({
        type: 'reentrancy',
        severity: 'high',
        location: `${filePath}:${func.name}`,
        message: `Potential reentrancy risk in '${func.name}', external call may be followed by state mutation.`
      });
    }

    if (hasArithmetic && !usesChecked) {
      findings.push({
        type: 'overflow',
        severity: 'high',
        location: `${filePath}:${func.name}`,
        message: `Arithmetic operations in '${func.name}' are present without explicit checked or saturating arithmetic.`
      });
    }

    const clones = (funcSource.match(/\.clone\(\)/g) || []).length;
    if (funcSource.split(/\r?\n/).length > 120 || clones >= 4) {
      findings.push({
        type: 'gas-inefficiency',
        severity: 'low',
        location: `${filePath}:${func.name}`,
        message: `Function '${func.name}' is large or may allocate frequently, inspect for gas inefficiencies.`
      });
    }
  }

  if (!functions.length && /\bpub\s+fn\b/.test(normalized) && !hasExplicitAuth) {
    findings.push({
      type: 'access-control',
      severity: 'high',
      location: `${filePath}:module`,
      message: 'Public Rust source contains callable public methods without explicit access control checks.'
    });
  }

  return findings;
}

function scanRustSource(source, filePath = 'inline.rs') {
  return analyzeRustSource(source, filePath);
}

function scanRustFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  return analyzeRustSource(source, filePath);
}

function walkObject(node, callback) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) {
      walkObject(item, callback);
    }
    return;
  }

  callback(node);

  for (const value of Object.values(node)) {
    if (typeof value === 'object') {
      walkObject(value, callback);
    }
  }
}

function instructionCost(instructionId) {
  if (!instructionId) return 1;
  if (/^(call|call_indirect|return)$/.test(instructionId)) return 5;
  if (/\.(load|store|memory\.grow|memory\.size)$/.test(instructionId)) return 4;
  if (/\.(div|rem|mul|sub|add|and|or|xor)$/.test(instructionId)) return 3;
  if (/^(i32|i64|f32|f64)\.const$/.test(instructionId)) return 1;
  return 2;
}

function scanWasmBuffer(buffer, filePath) {
  let ast;

  try {
    ast = decode(buffer);
  } catch (error) {
    return {
      path: filePath,
      totalFunctions: 1,
      totalInstructions: 1,
      functions: [
        {
          name: 'main',
          instructions: 1,
          cost: 1,
          calls: 0
        }
      ],
      issues: [
        {
          type: 'invalid-wasm',
          severity: 'low',
          location: `${filePath}:general`,
          message: `WASM decode failed: ${error.message}`
        }
      ]
    };
  }

  const functions = [];
  let current = null;

  walkObject(ast, (node) => {
    if (node.type === 'Func') {
      current = {
        name: node.name || `func_${functions.length}`,
        instructions: 0,
        cost: 0,
        calls: 0
      };
      functions.push(current);
    }

    if (current && node.type === 'Instr') {
      const opcode = node.id || node.idRaw || node.name;
      current.instructions += 1;
      current.cost += instructionCost(opcode);

      if (opcode === 'call' || opcode === 'call_indirect') {
        current.calls += 1;
      }
    }

    if (node.type === 'Code') {
      current = null;
    }
  });

  if (functions.length === 0) {
    functions.push({
      name: 'main',
      instructions: 1,
      cost: 1,
      calls: 0
    });
  }

  const allInstructions = functions.reduce((sum, fn) => sum + fn.instructions, 0);

  const highGasFunctions = functions.filter((fn) => fn.cost > 250);
  const issues = [];

  for (const fn of highGasFunctions) {
    issues.push({
      type: 'gas-inefficiency',
      severity: 'low',
      location: `${filePath}:${fn.name}`,
      message: `WASM function '${fn.name}' has a high estimated cost (${fn.cost}). Review for gas optimization.`
    });
  }

  return {
    path: filePath,
    totalFunctions: functions.length,
    totalInstructions: allInstructions,
    functions,
    issues
  };
}

function scanWasmFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return scanWasmBuffer(buffer, filePath);
}

function buildReport(rustFindings, wasmReports) {
  const findings = [...rustFindings, ...wasmReports.flatMap((report) => report.issues)];
  const severityCounts = findings.reduce((counts, finding) => {
    const level = finding.severity || 'low';
    counts[level] = (counts[level] || 0) + 1;
    return counts;
  }, {});

  const criticalFindings = findings.filter(
    (finding) =>
      finding.severity === 'high' ||
      finding.type === 'reentrancy' ||
      finding.type === 'access-control' ||
      finding.type === 'overflow'
  );

  const pass = criticalFindings.length < FAILURE_THRESHOLD;

  return {
    timestamp: new Date().toISOString(),
    pass,
    summary: {
      totalFindings: findings.length,
      high: severityCounts.high || 0,
      medium: severityCounts.medium || 0,
      low: severityCounts.low || 0
    },
    findings,
    wasmReports
  };
}

function createScanContext(targetPaths = []) {
  const rustRoots = targetPaths.length
    ? targetPaths
    : [path.join(__dirname, '../Contracts/contracts')];
  const rustFiles = collectFiles(rustRoots, DEFAULT_RUST_EXTENSIONS);
  const wasmFiles = collectFiles(
    [path.join(__dirname, '../Contracts/target/wasm32-unknown-unknown/release')],
    DEFAULT_WASM_EXTENSIONS
  );

  return { rustFiles, wasmFiles };
}

function runScan(targetPaths = []) {
  const { rustFiles, wasmFiles } = createScanContext(targetPaths);
  const rustFindings = [];

  for (const file of rustFiles) {
    rustFindings.push(...scanRustFile(file));
  }

  const wasmReports = [];
  for (const wasmFile of wasmFiles) {
    wasmReports.push(scanWasmFile(wasmFile));
  }

  return buildReport(rustFindings, wasmReports);
}

module.exports = {
  collectFiles,
  scanRustSource,
  scanRustFile,
  scanWasmBuffer,
  scanWasmFile,
  runScan,
  buildReport
};