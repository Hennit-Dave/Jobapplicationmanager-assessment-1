/**
 * convert-tokens.js
 * 
 * Reads design tokens from `tokens.json` (including Spacing, MD3 Colors, and MD3 Typography with Fraunces, Inter, & JetBrains Mono),
 * converts them into standard CSS custom properties (CSS variables), and writes the output to `tokens.css`.
 * 
 * Usage:
 *   node convert-tokens.js [inputPath] [outputPath]
 */

const fs = require('fs');
const path = require('path');

// Helper to convert camelCase to kebab-case
function camelToKebab(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// Known typography property names / keywords for detection
const TYPOGRAPHY_KEYWORDS = [
  'typography',
  'fontfamily',
  'fontsize',
  'fontweight',
  'lineheight',
  'letterspacing',
  'typescale',
  'fraunces',
  'inter',
  'jetbrains'
];

/**
 * Deep search for typography tokens in the token structure
 */
function findTypographyTokens(obj, currentPath = []) {
  const found = [];

  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    const newPath = [...currentPath, key];

    if (value !== null && typeof value === 'object') {
      found.push(...findTypographyTokens(value, newPath));
    } else {
      const isTypography = TYPOGRAPHY_KEYWORDS.some(kw => 
        keyLower.includes(kw) || (typeof value === 'string' && /^(fraunces|inter|jetbrains mono|serif|sans-serif|monospace)$/i.test(value))
      );

      if (isTypography && !keyLower.startsWith('schemes')) {
        found.push({ path: newPath.join('.'), key, value });
      }
    }
  }

  return found;
}

/**
 * Parses token file content, handling both standard JSON and escaped JSON strings
 */
function parseTokenData(rawContent) {
  let data = JSON.parse(rawContent);
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }
  return data;
}

/**
 * Converts typography collection into structured CSS variables following Material Design 3 guidelines
 */
function convertTypographyToCss(typographyCollection) {
  const lines = [];

  // Font Families
  if (typographyCollection.fontFamilies) {
    lines.push('  /* Typography Font Families */');
    for (const [role, fontVal] of Object.entries(typographyCollection.fontFamilies)) {
      lines.push(`  --font-family-${camelToKebab(role)}: ${fontVal};`);
    }
    lines.push('');
  }

  // Type Scale
  if (typographyCollection.typeScale) {
    lines.push('  /* Material Design 3 Typography Scale (Fraunces, Inter, JetBrains Mono) */');
    for (const [roleName, specs] of Object.entries(typographyCollection.typeScale)) {
      const kebabRole = camelToKebab(roleName);
      lines.push(`  /* ${roleName} */`);
      
      if (specs.fontFamily) {
        lines.push(`  --typescale-${kebabRole}-font-family: var(--font-family-${camelToKebab(specs.fontFamily)});`);
      }
      if (specs.fontSize !== undefined) {
        const px = specs.fontSize;
        const rem = (px / 16).toFixed(4).replace(/\.?0+$/, '') + 'rem';
        lines.push(`  --typescale-${kebabRole}-size: ${px}px; /* ${rem} */`);
      }
      if (specs.lineHeight !== undefined) {
        lines.push(`  --typescale-${kebabRole}-line-height: ${specs.lineHeight}px;`);
      }
      if (specs.fontWeight !== undefined) {
        lines.push(`  --typescale-${kebabRole}-weight: ${specs.fontWeight};`);
      }
      if (specs.letterSpacing !== undefined) {
        lines.push(`  --typescale-${kebabRole}-letter-spacing: ${specs.letterSpacing}px;`);
      }
      // Shorthand CSS font rule helper
      if (specs.fontFamily && specs.fontSize && specs.lineHeight && specs.fontWeight) {
        lines.push(`  --typescale-${kebabRole}-font: ${specs.fontWeight} ${specs.fontSize}px/${specs.lineHeight}px var(--font-family-${camelToKebab(specs.fontFamily)});`);
      }
      lines.push('');
    }
  }

  return lines;
}

/**
 * Converts token object into CSS variables
 */
function convertTokensToCss(tokens) {
  const cssLines = [':root {'];

  // 1. Spacing tokens
  if (tokens.spacingCollection) {
    cssLines.push('  /* Spacing Tokens */');
    for (const [mode, values] of Object.entries(tokens.spacingCollection)) {
      if (typeof values === 'object' && values !== null) {
        for (const [key, val] of Object.entries(values)) {
          const varName = `--spacing-${camelToKebab(key)}`;
          const varValue = typeof val === 'number' ? (val === 0 ? '0' : `${val}px`) : val;
          cssLines.push(`  ${varName}: ${varValue};`);
        }
      }
    }
    cssLines.push('');
  }

  // 2. Color & Theme tokens (Material Design 3)
  if (tokens.applicationManagerColorAndTypography) {
    cssLines.push('  /* Material Design 3 Color Scheme (Light Mode) */');
    for (const [theme, values] of Object.entries(tokens.applicationManagerColorAndTypography)) {
      if (typeof values === 'object' && values !== null) {
        for (const [key, val] of Object.entries(values)) {
          const kebabKey = camelToKebab(key);
          const varName = kebabKey.startsWith('schemes-') 
            ? `--color-${kebabKey.replace('schemes-', '')}` 
            : `--color-${kebabKey}`;
          cssLines.push(`  ${varName}: ${val};`);
        }
      }
    }
    cssLines.push('');
  }

  // 3. Typography tokens (Fraunces, Inter, JetBrains Mono per MD3)
  if (tokens.typographyCollection) {
    const typoLines = convertTypographyToCss(tokens.typographyCollection);
    cssLines.push(...typoLines);
  }

  // 4. Any additional custom collections
  for (const [category, values] of Object.entries(tokens)) {
    if (['spacingCollection', 'applicationManagerColorAndTypography', 'typographyCollection'].includes(category)) {
      continue;
    }
    cssLines.push(`  /* ${category} */`);
    if (typeof values === 'object' && values !== null) {
      for (const [key, val] of Object.entries(values)) {
        const varName = `--${camelToKebab(category)}-${camelToKebab(key)}`;
        const varValue = typeof val === 'number' ? `${val}px` : val;
        cssLines.push(`  ${varName}: ${varValue};`);
      }
    }
    cssLines.push('');
  }

  // Remove trailing empty lines inside root
  while (cssLines[cssLines.length - 1] === '') {
    cssLines.pop();
  }

  cssLines.push('}');
  return cssLines.join('\n');
}

/**
 * Main execution
 */
function main() {
  const inputPath = process.argv[2] || path.join(__dirname, 'tokens.json');
  const outputPath = process.argv[3] || path.join(__dirname, 'tokens.css');

  console.log(`\n🔍 Reading tokens from: ${path.resolve(inputPath)}`);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: File not found at ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const tokens = parseTokenData(raw);

  // Check for typography tokens
  console.log('\n----------------------------------------');
  console.log('📝 TYPOGRAPHY TOKEN REPORT:');
  const typographyTokens = findTypographyTokens(tokens);

  if (typographyTokens.length > 0) {
    console.log(`✅ Found ${typographyTokens.length} typography token entries:`);
    typographyTokens.forEach(t => console.log(`   • ${t.path}: ${t.value}`));
  } else {
    console.log('ℹ️  No typography tokens were found.');
  }
  console.log('----------------------------------------\n');

  // Convert to CSS variables
  const css = convertTokensToCss(tokens);
  fs.writeFileSync(outputPath, css, 'utf8');

  console.log(`✨ Successfully generated CSS variables!`);
  console.log(`📄 Saved to: ${path.resolve(outputPath)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  camelToKebab,
  parseTokenData,
  findTypographyTokens,
  convertTokensToCss
};
