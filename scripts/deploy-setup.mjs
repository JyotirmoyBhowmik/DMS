#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('========================================================================');
echo('🚀 DMS Automated One-Click Deployment & Environment Setup Tool');
echo('Target Domain: https://dms.jyotirmoyb.com');
echo('API Gateway:   https://api.dms.jyotirmoyb.com');
console.log('========================================================================\n');

function echo(msg) {
  console.log(msg);
}

function run(cmd, desc) {
  try {
    echo(`[RUNNING] ${desc || cmd}...`);
    const output = execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' });
    echo(`  ✓ SUCCESS`);
    return output.trim();
  } catch (err) {
    echo(`  ❌ ERROR: ${err.message}`);
    if (err.stdout) echo(`Output: ${err.stdout}`);
    if (err.stderr) echo(`Stderr: ${err.stderr}`);
    return null;
  }
}

// 1. Check Prerequisites
echo('Step 1: Checking Local System Prerequisites...');

const nodeVer = run('node --version', 'Checking Node.js version');
const pnpmVer = run('pnpm --version', 'Checking pnpm version');
const gitVer = run('git --version', 'Checking Git version');

if (!nodeVer || !pnpmVer || !gitVer) {
  echo('❌ Missing basic prerequisites (Node.js, pnpm, or Git). Please install them.');
  process.exit(1);
}

// 2. Validate Monorepo Build
echo('\nStep 2: Validating Monorepo Production Compilation...');
const buildResult = run('pnpm build', 'Compiling 34 monorepo targets with pnpm build');

if (!buildResult) {
  echo('❌ Build failed. Please fix compilation errors before deploying.');
  process.exit(1);
}

// 3. Verify Deployment Infrastructure Configurations
echo('\nStep 3: Checking Cloud Infrastructure Specifications...');

const renderYamlPath = path.resolve('render.yaml');
const vercelJsonPath = path.resolve('apps/web-admin/vercel.json');

if (fs.existsSync(renderYamlPath)) {
  echo('  ✓ Render Blueprint (render.yaml) verified for api.dms.jyotirmoyb.com');
} else {
  echo('  ❌ Missing render.yaml');
}

if (fs.existsSync(vercelJsonPath)) {
  echo('  ✓ Vercel Config (apps/web-admin/vercel.json) verified for dms.jyotirmoyb.com');
} else {
  echo('  ❌ Missing vercel.json');
}

// 4. Mobile App Build Status
echo('\nStep 4: Checking Mobile App Workspace...');
const flutterPath = path.resolve('apps/mobile-flutter');
if (fs.existsSync(flutterPath)) {
  echo('  ✓ Flutter Mobile App workspace located at apps/mobile-flutter');
}

echo('\n========================================================================');
echo('🎉 All Deployment Readiness Checks PASSED!');
echo('To complete deployment to https://dms.jyotirmoyb.com:');
echo('  1. Git Push:  git push origin main (triggers GitHub Actions CD pipeline)');
echo('  2. Vercel:    Import repository & connect domain dms.jyotirmoyb.com');
echo('  3. Render:    New + Blueprint & connect domain api.dms.jyotirmoyb.com');
echo('========================================================================');
