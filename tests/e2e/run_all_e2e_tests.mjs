#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR, REPORTS_DIR, TestRunner, colors, logHeader } from './common.mjs';
import { registerTier1Tests } from './tier1-feature-coverage.test.mjs';
import { registerTier2Tests } from './tier2-boundary-corner-cases.test.mjs';
import { registerTier3Tests } from './tier3-cross-feature-combinations.test.mjs';
import { registerTier4Tests } from './tier4-real-world-scenarios.test.mjs';

async function main() {
  const overallStart = Date.now();
  console.log(`\n${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}   Painel Prime Mobile — End-to-End Test Suite    ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.dim}Date: ${new Date().toISOString()}${colors.reset}`);
  console.log(`${colors.dim}Workspace: ${ROOT_DIR}${colors.reset}\n`);

  const tierRunners = [
    new TestRunner('Tier 1: Feature Coverage (F1 to F25)'),
    new TestRunner('Tier 2: Boundary & Corner Cases'),
    new TestRunner('Tier 3: Cross-Feature Combinations & Invariants'),
    new TestRunner('Tier 4: Real-World Scenarios & Pipelines'),
  ];

  registerTier1Tests(tierRunners[0]);
  registerTier2Tests(tierRunners[1]);
  registerTier3Tests(tierRunners[2]);
  registerTier4Tests(tierRunners[3]);

  const tierReports = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const runner of tierRunners) {
    const report = await runner.run();
    tierReports.push(report);
    totalTests += report.total;
    totalPassed += report.passed;
    totalFailed += report.failed;
    totalSkipped += report.skipped;
  }

  const overallDuration = Date.now() - overallStart;

  // Print Grand Summary Table
  console.log(`\n${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}                 GRAND SUMMARY                      ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);

  for (const rep of tierReports) {
    const tierStatus = rep.failed === 0 ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
    console.log(`  [${tierStatus}] ${colors.bold}${rep.tier.padEnd(46)}${colors.reset} ` +
      `${colors.green}${String(rep.passed).padStart(2)} pass${colors.reset} | ` +
      `${rep.failed > 0 ? colors.red : colors.dim}${String(rep.failed).padStart(2)} fail${colors.reset} | ` +
      `${colors.dim}${rep.duration}ms${colors.reset}`);
  }

  console.log(`${colors.dim}----------------------------------------------------${colors.reset}`);
  const grandStatus = totalFailed === 0
    ? `${colors.bgGreen}${colors.white}${colors.bold} ALL TESTS PASSED ${colors.reset}`
    : `${colors.bgRed}${colors.white}${colors.bold} TESTS FAILED: ${totalFailed} ${colors.reset}`;

  console.log(`\n  Result: ${grandStatus}`);
  console.log(`  Total: ${totalTests} | Passed: ${totalPassed} | Failed: ${totalFailed} | Duration: ${overallDuration}ms\n`);

  // Ensure reports directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  // Generate JSON Report
  const jsonReportPath = path.join(REPORTS_DIR, 'e2e-summary.json');
  const summaryData = {
    timestamp: new Date().toISOString(),
    status: totalFailed === 0 ? 'passed' : 'failed',
    total: totalTests,
    passed: totalPassed,
    failed: totalFailed,
    skipped: totalSkipped,
    durationMs: overallDuration,
    tiers: tierReports,
  };
  fs.writeFileSync(jsonReportPath, JSON.stringify(summaryData, null, 2), 'utf8');
  console.log(`  ${colors.dim}Detailed JSON report saved to: ${jsonReportPath}${colors.reset}`);

  // Generate Markdown Report
  const mdReportPath = path.join(REPORTS_DIR, 'e2e-summary.md');
  let mdContent = `# Painel Prime Mobile — E2E Test Execution Summary\n\n`;
  mdContent += `- **Timestamp:** ${summaryData.timestamp}\n`;
  mdContent += `- **Status:** ${summaryData.status.toUpperCase()}\n`;
  mdContent += `- **Total Tests:** ${totalTests}\n`;
  mdContent += `- **Passed:** ${totalPassed}\n`;
  mdContent += `- **Failed:** ${totalFailed}\n`;
  mdContent += `- **Execution Time:** ${overallDuration}ms\n\n`;

  mdContent += `## Tier Results\n\n`;
  mdContent += `| Tier | Total | Passed | Failed | Duration |\n`;
  mdContent += `|---|---|---|---|---|\n`;
  for (const rep of tierReports) {
    const statusIcon = rep.failed === 0 ? '✅' : '❌';
    mdContent += `| ${statusIcon} ${rep.tier} | ${rep.total} | ${rep.passed} | ${rep.failed} | ${rep.duration}ms |\n`;
  }

  if (totalFailed > 0) {
    mdContent += `\n## Failed Tests Details\n\n`;
    for (const rep of tierReports) {
      for (const res of rep.results) {
        if (res.status === 'fail') {
          mdContent += `### ❌ ${res.name} (${rep.tier})\n`;
          mdContent += `**Error:** \`${res.error}\`\n\n`;
        }
      }
    }
  }

  fs.writeFileSync(mdReportPath, mdContent, 'utf8');
  console.log(`  ${colors.dim}Markdown summary saved to: ${mdReportPath}${colors.reset}\n`);

  process.exit(totalFailed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
